"""LibreOffice worker for Windows and Linux; requires Python with PyUNO."""
import contextlib
import ctypes
import errno
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile

import uno
import office_exchange
from office_extra import EXTRA_OPERATIONS, edit_extra
from com.sun.star.beans import PropertyValue
from com.sun.star.connection import NoConnectException
from com.sun.star.document.MacroExecMode import NEVER_EXECUTE
from com.sun.star.document.UpdateDocMode import NO_UPDATE
from com.sun.star.uno import Exception as UnoError


FORMATS = {
    "writer": {"odt": "writer8", "docx": "Office Open XML Text", "pdf": "writer_pdf_Export"},
    "calc": {"ods": "calc8", "xlsx": "Calc MS Excel 2007 XML", "pdf": "calc_pdf_Export"},
    "impress": {"odp": "impress8", "pptx": "Impress MS PowerPoint 2007 XML", "pdf": "impress_pdf_Export"},
    "draw": {"odg": "draw8", "pdf": "draw_pdf_Export"},
    "math": {"odf": "math8", "pdf": "math_pdf_Export"},
}
FACTORY = {"writer": "swriter", "calc": "scalc", "impress": "simpress", "draw": "sdraw", "math": "smath"}
SERVICES = {"writer": "text.TextDocument", "calc": "sheet.SpreadsheetDocument",
            "impress": "presentation.PresentationDocument", "draw": "drawing.DrawingDocument",
            "math": "formula.FormulaProperties"}
ROOT = Path(os.environ.get("LO_MCP_WORKSPACE") or Path(__file__).with_name("dokumen")).resolve()
WINDOWS = os.name == "nt"
SPAWN_FLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def office_command():
    if os.environ.get("LO_MCP_SOFFICE"):
        return os.environ["LO_MCP_SOFFICE"]
    executable = "soffice.com" if WINDOWS else "soffice"
    if os.environ.get("LO_PROGRAM"):
        return str(Path(os.environ["LO_PROGRAM"]) / executable)
    return (str(Path(uno.__file__).resolve().parent / executable) if WINDOWS
            else shutil.which(executable) or "/usr/lib/libreoffice/program/soffice")


def prop(name, value):
    return PropertyValue(Name=name, Value=value)


def url(path):
    return uno.systemPathToFileUrl(str(path))


def checked(name, write=False):
    if (not name or name.startswith(".") or name.endswith((" ", ".")) or
            re.search(r'[<>:"/\\|?*\x00-\x1f]', name) or
            re.fullmatch(r"(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|(?:COM|LPT)[1-9¹²³])",
                         name.split(".", 1)[0].rstrip(" "), re.IGNORECASE)):
        raise ValueError("Gunakan nama file biasa tanpa folder atau karakter terlarang.")
    path = ROOT / name
    if path.resolve() != path or path.is_symlink():
        raise ValueError("Tautan file tidak didukung.")
    if write and path.exists():
        raise ValueError(f"{name} sudah ada. Pilih nama hasil baru.")
    if not write and (not path.is_file() or path.stat().st_size > 64 * 1024 * 1024):
        raise ValueError("Sumber tidak ditemukan atau melebihi 64 MiB.")
    return path


def publish(staged, destination):
    """Publish a completed file without ever replacing a concurrent writer's result."""
    try:
        if WINDOWS:
            staged.rename(destination)
            return
        # Linux renameat2 supports atomic no-replace, including filesystems without hard links.
        rename = getattr(ctypes.CDLL(None, use_errno=True), "renameat2", None)
        if rename is not None:
            rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
            rename.restype = ctypes.c_int
            if rename(-100, os.fsencode(staged), -100, os.fsencode(destination), 1) == 0:
                return
            error = ctypes.get_errno()
            if error not in (errno.ENOSYS, errno.EOPNOTSUPP, errno.EINVAL):
                raise OSError(error, os.strerror(error), str(destination))
        # Source and destination share a filesystem. TemporaryDirectory removes the staging link.
        os.link(staged, destination)
    except FileExistsError:
        raise ValueError(f"{destination.name} sudah ada. Pilih nama hasil baru.") from None


@contextlib.contextmanager
def session(temp):
    pipe = "lo_mcp_" + uuid.uuid4().hex
    spec = f"pipe,name={pipe};urp;"
    process = subprocess.Popen(
        [office_command(), "-env:UserInstallation=" + (temp / "profile").as_uri(),
         "--headless", "--nologo", "--nodefault", "--nofirststartwizard", "--norestore",
         "--accept=" + spec + "StarOffice.ServiceManager"],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=SPAWN_FLAGS)
    desktop = None
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        deadline = time.monotonic() + 35
        while True:
            try:
                remote = resolver.resolve("uno:" + spec + "StarOffice.ComponentContext")
                break
            except NoConnectException:
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise RuntimeError("LibreOffice gagal dibuka dengan profil sementara.")
                time.sleep(0.12)
        desktop = remote.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", remote)
        try:
            yield desktop
        except UnoError as exc:
            raise ValueError(exc.Message or str(exc) or type(exc).__name__) from exc
    finally:
        if desktop:
            with contextlib.suppress(Exception):
                desktop.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if WINDOWS:
                subprocess.run(["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                               capture_output=True, creationflags=SPAWN_FLAGS, timeout=10)
            else:
                process.kill()
            process.wait(timeout=5)


def address(start):
    match = re.fullmatch(r"([A-Za-z]{1,3})([1-9][0-9]{0,6})", start)
    if not match:
        raise ValueError("Alamat sel harus seperti A1.")
    col = 0
    for letter in match[1].upper():
        col = col * 26 + ord(letter) - 64
    return col - 1, int(match[2]) - 1


def sheet_for(doc, name):
    if not name:
        return doc.Sheets.getByIndex(0)
    if not doc.Sheets.hasByName(name):
        raise ValueError(f"Sheet {name} tidak ditemukan.")
    return doc.Sheets.getByName(name)


def cells(doc, a, reading):
    sheet = sheet_for(doc, a.get("sheet"))
    col, row = address(a.get("start", "A1"))
    values = a.get("values")
    height, width = (a["rows"], a["columns"]) if reading else (len(values), max(map(len, values)))
    if row + height > sheet.Rows.Count or col + width > sheet.Columns.Count:
        raise ValueError("Rentang di luar batas sheet.")
    if reading:
        area = sheet.getCellRangeByPosition(col, row, col + width - 1, row + height - 1)
        return {"sheet": sheet.Name, "start": a["start"], "values": area.DataArray,
                "formulas": area.FormulaArray} if a["include_formulas"] else {
                    "sheet": sheet.Name, "start": a["start"], "values": area.DataArray}
    for y, record in enumerate(values):
        for x, value in enumerate(record):
            cell = sheet.getCellByPosition(col + x, row + y)
            if isinstance(value, dict):
                formula = value["formula"]
                # Allow local arithmetic, cell ranges and common numeric functions only.
                tokens = re.findall(r'\s+|(?:SUM|AVERAGE|MIN|MAX|COUNT|ROUND|ABS)(?=\()|\$?[A-Z]{1,3}\$?[1-9][0-9]*|[0-9]+(?:\.[0-9]+)?|[=():;+*/^%$-]', formula.upper())
                if "".join(tokens) != formula.upper():
                    raise ValueError("Rumus hanya mendukung referensi sel lokal, aritmetika, dan fungsi numerik terdokumentasi.")
                cell.Formula = formula.upper()
            elif isinstance(value, (int, float)) and math.isfinite(value):
                cell.Value = value
            else:
                cell.String = "" if value is None else value
    doc.calculateAll()
    return {"sheet": sheet.Name, "rows_written": height}


def text_shape(doc, page, text, x, y, w, h, size, name, shape_type="TextShape"):
    shape = doc.createInstance("com.sun.star.drawing." + shape_type)
    shape.Position = uno.createUnoStruct("com.sun.star.awt.Point", x, y)
    shape.Size = uno.createUnoStruct("com.sun.star.awt.Size", w, h)
    page.add(shape)
    shape.Name = name
    shape.String = text
    shape.CharHeight = float(size)
    return shape


def add_slide(doc, slide, first=False):
    pages = doc.DrawPages
    page = pages.getByIndex(0) if first else pages.insertNewByIndex(pages.Count)
    # A template may already have inserted placeholders on the first slide.
    for shape in reversed(range(page.Count)):
        page.remove(page.getByIndex(shape))
    width, height = page.Width, page.Height
    margin = width // 14
    title = text_shape(doc, page, slide["title"], margin, height // 12,
                       width - 2 * margin, height // 5, 32, "Title")
    title.CharWeight = 150.0
    title.CharColor = 0x163654
    text_shape(doc, page, slide.get("body", ""), margin, height // 3,
               width - 2 * margin, height * 3 // 5, 21, "Body")


def read_pages(doc, a):
    pages = doc.DrawPages
    start = a["page"] - 1
    if start >= pages.Count:
        raise ValueError("Nomor halaman di luar dokumen.")
    page = pages.getByIndex(start)
    return {"pages": pages.Count, "page": start + 1,
            "shapes": [{"name": s.Name, "type": s.ShapeType, "text": getattr(s, "String", "")[:10000]}
                       for s in (page.getByIndex(i) for i in range(min(200, page.Count)))]}


def draw_page(doc, a, create):
    pages = doc.DrawPages
    page = pages.getByIndex(0) if create else pages.insertNewByIndex(pages.Count)
    for i, item in enumerate(a["shapes"]):
        x, y, w, h = (round(item[key] * 100) for key in ("x", "y", "width", "height"))
        if x + w > page.Width or y + h > page.Height:
            raise ValueError(f"Bentuk {i+1} keluar dari halaman {page.Width/100:g} x {page.Height/100:g} mm.")
        kind = {"rectangle": "RectangleShape", "ellipse": "EllipseShape", "text": "TextShape"}[item["kind"]]
        shape = text_shape(doc, page, item.get("text", ""), x, y, w, h, 14, f"Shape {i+1}", kind)
        if kind != "TextShape":
            shape.FillColor = int(item.get("color", "#CFE5EF")[1:], 16)
            shape.LineColor = 0x395064
    return {"pages": pages.Count}


def base_inspect(path):
    with zipfile.ZipFile(path) as bundle:
        if bundle.getinfo("mimetype").file_size > 160:
            raise ValueError("Tipe ODB tidak dikenali.")
        if bundle.read("mimetype") != b"application/vnd.oasis.opendocument.base":
            raise ValueError("File bukan dokumen Base.")
        if bundle.getinfo("content.xml").file_size > 6_000_000:
            raise ValueError("Metadata ODB terlalu besar.")
        content = ET.fromstring(bundle.read("content.xml"))
        db = "{urn:oasis:names:tc:opendocument:xmlns:database:1.0}"
        def names(tag):
            return [n.get(db + "name") for n in content.iter(db + tag) if n.get(db + "name")]
        return {"queries": names("query"), "table_descriptions": names("table-representation"),
                "forms": sum(s.endswith("/content.xml") and s.startswith("forms/") for s in bundle.namelist()),
                "reports": sum(s.endswith("/content.xml") and s.startswith("reports/") for s in bundle.namelist()),
                "embedded_data": any(s.startswith("database/") for s in bundle.namelist())}


def identifier(name):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,30}", name):
        raise ValueError("Nama tabel/kolom harus berupa huruf, angka, atau garis bawah.")
    return '"' + name + '"'


def database(doc, op, a, staged):
    if op == "base_create":
        doc.DataSource.URL = "sdbc:embedded:firebird"
        doc.storeAsURL(url(staged), ())
    if doc.DataSource.URL != "sdbc:embedded:firebird":
        raise ValueError("Operasi tabel mendukung Firebird tertanam. Gunakan base_inspect untuk metadata ODB lain.")
    conn = doc.DataSource.getIsolatedConnection("", "")
    try:
        if op == "base_create":
            kinds = {"text": "VARCHAR(1024)", "integer": "INTEGER", "number": "DOUBLE PRECISION"}
            fields = [identifier(c["name"]) + " " + kinds[c["type"]] for c in a["columns"]]
            sql = "CREATE TABLE " + identifier(a["table"]) + " (" + ", ".join(fields) + ")"
            conn.createStatement().executeUpdate(sql)
            result = {"table": a["table"], "columns": a["columns"]}
        elif op == "base_tables":
            return {"tables": sorted(n for n in conn.Tables.ElementNames if not n.startswith(("RDB$", "MON$")))}
        else:
            table = identifier(a["table"])
            if not conn.Tables.hasByName(a["table"]):
                raise ValueError("Tabel tidak ditemukan.")
            if op == "base_read":
                stmt = conn.createStatement()
                rs = stmt.executeQuery(f'SELECT FIRST {int(a["limit"])} * FROM {table}')
                meta = rs.getMetaData()
                columns = [meta.getColumnName(i + 1) for i in range(meta.ColumnCount)]
                rows = []
                while rs.next():
                    row = []
                    for i in range(1, len(columns) + 1):
                        value = rs.getString(i)
                        row.append(None if rs.wasNull() else value)
                    rows.append(row)
                return {"columns": columns, "rows": rows}
            fields = ", ".join(map(identifier, a["columns"]))
            marks = ", ".join("?" for _ in a["columns"])
            conn.setAutoCommit(False)
            stmt = conn.prepareStatement(f"INSERT INTO {table} ({fields}) VALUES ({marks})")
            for row in a["rows"]:
                if len(row) != len(a["columns"]):
                    raise ValueError("Jumlah nilai harus sama dengan jumlah kolom.")
                for i, val in enumerate(row, 1):
                    if val is None:
                        stmt.setNull(i, 12)
                    elif isinstance(val, int) and -2147483648 <= val <= 2147483647:
                        stmt.setInt(i, val)
                    elif isinstance(val, (int, float)):
                        stmt.setDouble(i, float(val))
                    else:
                        stmt.setString(i, val)
                stmt.executeUpdate()
            conn.commit()
            result = {"inserted": len(a["rows"])}
        doc.store()
        return result
    finally:
        conn.close()


def edit(doc, op, a):
    if op in EXTRA_OPERATIONS:
        return edit_extra(doc, op, a, sheet_for)
    if op == "writer_read":
        body = doc.Text.String
        start = a["offset"]
        return {"length": len(body), "text": body[start:start + a["limit"]]}
    if op == "writer_create":
        doc.Text.String = a["text"]
    elif op == "writer_append":
        if doc.Text.String:
            doc.Text.insertControlCharacter(doc.Text.End, 0, False)
        doc.Text.insertString(doc.Text.End, a["text"], False)
    elif op == "writer_replace":
        desc = doc.createReplaceDescriptor()
        desc.SearchString, desc.ReplaceString = a["find"], a["replacement"]
        desc.SearchRegularExpression, desc.SearchCaseSensitive = False, a["case_sensitive"]
        return {"replacements": doc.replaceAll(desc)}
    elif op == "calc_sheets":
        return {"sheets": doc.Sheets.ElementNames}
    elif op == "calc_add_sheet":
        doc.Sheets.insertNewByName(a["sheet"], doc.Sheets.Count)
    elif op in ("calc_create", "calc_write", "calc_read"):
        if op == "calc_create":
            doc.Sheets.getByIndex(0).Name = a["sheet"]
        return cells(doc, a, op == "calc_read")
    elif op in ("impress_create", "impress_append"):
        for i, slide in enumerate(a["slides"]):
            add_slide(doc, slide, op == "impress_create" and i == 0)
        return {"pages": doc.DrawPages.Count}
    elif op in ("impress_read", "draw_read"):
        return read_pages(doc, a)
    elif op in ("draw_create", "draw_append"):
        return draw_page(doc, a, op == "draw_create")
    elif op in ("math_create", "math_edit"):
        doc.Formula = a["formula"]
    elif op == "math_read":
        return {"formula": doc.Formula}
    return {}


def process(op, a):
    ROOT.mkdir(parents=True, exist_ok=True)
    if op == "office_status":
        version = subprocess.check_output([office_command(), "--version"],
                                          creationflags=SPAWN_FLAGS, timeout=12)
        return {"version": version.decode(errors="replace").strip(), "workspace": str(ROOT),
                "platform": sys.platform, "soffice": office_command(), "formats": FORMATS}
    if op == "office_files":
        supported = {ext for group in FORMATS.values() for ext in group} | {"odb", "csv"}
        return {"files": sorted(p.name for p in ROOT.iterdir() if p.is_file() and not p.is_symlink()
                                and p.suffix[1:].lower() in supported and not p.name.startswith("."))}
    src = checked(a["source"]) if "source" in a else None
    dst = checked(a["output"], write=True) if "output" in a else None
    if op == "base_inspect":
        if src.suffix.lower() != ".odb":
            raise ValueError("Pilih file .odb.")
        return base_inspect(src)
    if op.startswith("base_"):
        if any(p.suffix.lower() != ".odb" for p in (src, dst) if p):
            raise ValueError("Sumber dan hasil Base harus berupa .odb.")
        kind = "base"
    else:
        kind = op.split("_")[0] if not op.startswith("office_") else next(
            (k for k, f in FORMATS.items() if src.suffix[1:].lower() in f and src.suffix.lower() != ".pdf"), None)
        allowed_input = {"csv"} if op == "calc_import_csv" else set(FORMATS.get(kind, ())) - {"pdf"}
        if kind not in FORMATS or (src and src.suffix[1:].lower() not in allowed_input):
            raise ValueError("Jenis sumber tidak sesuai dengan alat.")
        allowed_output = {"csv"} if op == "calc_export_csv" else set(FORMATS[kind])
        if op != "office_convert":
            allowed_output.discard("pdf")
        if dst and dst.suffix[1:].lower() not in allowed_output:
            raise ValueError("Format hasil tidak sesuai. Gunakan office_convert untuk PDF.")
        if a.get("pages") and dst.suffix.lower() != ".pdf":
            raise ValueError("Opsi pages hanya berlaku untuk ekspor PDF.")

    job = os.environ.get("LO_MCP_JOB_DIR")
    staging = contextlib.nullcontext(job) if job else tempfile.TemporaryDirectory(
        prefix=".lo-mcp-", dir=ROOT, ignore_cleanup_errors=True)
    with staging as name:
        temp = Path(name)
        with session(temp) as desktop:
            options = (prop("Hidden", True), prop("Silent", True),
                       prop("MacroExecutionMode", uno.Any("short", NEVER_EXECUTE)),
                       prop("UpdateDocMode", uno.Any("short", NO_UPDATE)))
            if src and op != "calc_import_csv":
                copy = temp / ("input" + src.suffix)
                shutil.copyfile(src, copy)
                location = url(copy)
            else:
                location = "private:factory/" + ("sdatabase" if kind == "base" else FACTORY[kind])
            doc = desktop.loadComponentFromURL(location, "_blank", 0, options)
            if not doc:
                raise ValueError("LibreOffice tidak dapat membuka file. Periksa format dan kata sandi.")
            try:
                staged = temp / ("result" + dst.suffix) if dst else None
                if kind == "base":
                    result = database(doc, op, a, staged)
                else:
                    if not doc.supportsService("com.sun.star." + SERVICES[kind]):
                        raise ValueError("Isi file tidak cocok dengan formatnya.")
                    if op == "calc_import_csv":
                        result = office_exchange.import_csv(doc, src, a)
                    elif op == "calc_export_csv":
                        result = office_exchange.export_csv(sheet_for(doc, a.get("sheet")), address(a["start"]), staged, a)
                    elif op in ("office_metadata", "office_set_metadata"):
                        result = office_exchange.metadata(doc, a.get("changes"))
                    else:
                        result = edit(doc, op, a)
                    if dst and op != "calc_export_csv":
                        filter_name = FORMATS[kind][dst.suffix[1:].lower()]
                        doc.storeToURL(url(staged), office_exchange.store_options(filter_name, a.get("pages"), prop))
            finally:
                doc.close(True)
            if op == "base_append":
                copy.rename(staged)
        if dst:
            if not staged.is_file() or not staged.stat().st_size:
                raise ValueError("LibreOffice tidak menghasilkan file.")
            publish(staged, dst)
            result["file"] = dst.name
        return result


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin.buffer)
        reply = {"ok": True, "result": process(request["op"], request["args"])}
    except Exception as exc:
        if os.environ.get("LO_MCP_DEBUG") == "1":
            import traceback
            traceback.print_exc(file=sys.stderr)
        reply = {"ok": False, "error": str(exc) or type(exc).__name__}
    print(json.dumps(reply, ensure_ascii=True, allow_nan=False))
