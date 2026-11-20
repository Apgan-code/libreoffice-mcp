"""Operasi dokumen melalui UNO. Penyimpanan dan validasi path ditangani worker."""
import re

import uno


def create_report(doc, args):
    paragraphs = [("Title", args["title"])]
    for section in args["sections"]:
        paragraphs.append((f'Heading {section["level"]}', section["heading"]))
        paragraphs.extend(("Standard", p) for p in section["paragraphs"])
    cursor = doc.Text.createTextCursor()
    for index, (style, text) in enumerate(paragraphs):
        if index:
            doc.Text.insertControlCharacter(cursor, 0, False)
        cursor.ParaStyleName = style
        doc.Text.insertString(cursor, text, False)
        cursor.gotoEnd(False)
    return {"sections": len(args["sections"])}


def append_table(doc, args):
    name = args["name"]
    if doc.TextTables.hasByName(name):
        raise ValueError(f"Tabel {name} sudah ada.")
    width = len(args["headers"])
    if any(len(row) != width for row in args["rows"]):
        raise ValueError("Jumlah sel setiap baris harus sama dengan jumlah tajuk.")
    table = doc.createInstance("com.sun.star.text.TextTable")
    records = [args["headers"], *args["rows"]]
    table.initialize(len(records), width)
    cursor = doc.Text.createTextCursor()
    cursor.gotoEnd(False)
    doc.Text.insertControlCharacter(cursor, 0, False)
    doc.Text.insertTextContent(doc.Text.End, table, False)
    table.Name = name
    table.RepeatHeadline = True
    table.HeaderRowCount = 1
    for row_index, row in enumerate(records):
        for col_index, value in enumerate(row):
            cell = table.getCellByPosition(col_index, row_index)
            cell.String = value
            if row_index == 0:
                cell.BackColor = 0x25425B
                text = cell.createTextCursor()
                text.gotoEnd(True)
                text.CharWeight = 150.0
                text.CharColor = 0xFFFFFF
    return {"name": table.Name, "rows": len(records), "columns": width}


def writer_outline(doc, args):
    title, headings = "", []
    enumeration = doc.Text.createEnumeration()
    while enumeration.hasMoreElements():
        element = enumeration.nextElement()
        if not element.supportsService("com.sun.star.text.Paragraph"):
            continue
        style = element.ParaStyleName
        if style == "Title" and not title:
            title = element.String[:1000]
        level = getattr(element, "OutlineLevel", 0)
        if not level:
            match = re.fullmatch(r"Heading (\d+)", style)
            if match:
                level = int(match[1])
        if level:
            headings.append({"level": level, "text": element.String[:1000]})
            if len(headings) == 201:
                break
    names = doc.TextTables.ElementNames
    return {"title": title, "headings": headings[:200], "headings_truncated": len(headings) > 200,
            "tables": names[:200], "table_count": len(names)}


def read_table(doc, args):
    if not doc.TextTables.hasByName(args["name"]):
        raise ValueError("Nama tabel tidak ditemukan. Periksa writer_outline.")
    table = doc.TextTables.getByName(args["name"])
    names = table.getCellNames()
    batch = names[args["offset"]:args["offset"] + args["limit"]]
    cells = [{"address": name, "text": table.getCellByName(name).String[:8000]} for name in batch]
    return {"name": table.Name, "cell_count": len(names), "cells": cells}


def rename_sheet(sheet, doc, args):
    name = args["new_name"]
    if doc.Sheets.hasByName(name) and name.casefold() != sheet.Name.casefold():
        raise ValueError("Nama sheet tujuan sudah digunakan.")
    sheet.Name = name
    return {"sheet": sheet.Name}


def format_range(sheet, doc, args):
    area = sheet.getCellRangeByName(args["range"])
    if area.Rows.Count * area.Columns.Count > 100000:
        raise ValueError("Format maksimal 100.000 sel per operasi.")
    style = args["style"]
    if "bold" in style:
        area.CharWeight = 150.0 if style["bold"] else 100.0
    if "font_color" in style:
        area.CharColor = int(style["font_color"][1:], 16)
    if "background" in style:
        area.CellBackColor = int(style["background"][1:], 16)
    if "font_size_pt" in style:
        area.CharHeight = float(style["font_size_pt"])
    if "wrap" in style:
        area.IsTextWrapped = style["wrap"]
    if "column_width_mm" in style:
        width = round(100 * style["column_width_mm"])
        for index in range(area.Columns.Count):
            area.Columns.getByIndex(index).Width = width
    return {"sheet": sheet.Name, "range": args["range"]}


def hex_color(value):
    return None if value < 0 else f"#{value & 0xFFFFFF:06X}"


def inspect_cell(sheet, doc, args):
    cell = sheet.getCellRangeByName(args["cell"])
    result = {"cell": args["cell"].upper(), "sheet": sheet.Name, "display": cell.String[:32767],
            "formula": cell.Formula if cell.Type.value == "FORMULA" else None,
            "bold": cell.CharWeight >= 150, "font_size_pt": cell.CharHeight,
            "font_color": hex_color(cell.CharColor), "background": hex_color(cell.CellBackColor),
            "wrap": cell.IsTextWrapped, "column_width_mm": cell.Columns.getByIndex(0).Width / 100,
            "charts": sheet.Charts.ElementNames[:200]}
    if args.get("chart"):
        if not sheet.Charts.hasByName(args["chart"]):
            raise ValueError("Nama grafik tidak ditemukan pada sheet.")
        item = sheet.Charts.getByName(args["chart"])
        chart = item.EmbeddedObject
        result["chart"] = {"title": chart.Title.String if chart.HasMainTitle else "",
                           "diagram": chart.Diagram.DiagramType,
                           "ranges": [doc.Sheets.getByIndex(r.Sheet).getCellRangeByPosition(
                               r.StartColumn, r.StartRow, r.EndColumn, r.EndRow).AbsoluteName
                               for r in item.getRanges()]}
    return result


def add_chart(sheet, doc, args):
    area = sheet.getCellRangeByName(args["range"])
    if area.Columns.Count < 2 or area.Rows.Count < 2 or area.Rows.Count * area.Columns.Count > 10000:
        raise ValueError("Grafik membutuhkan minimal 2 baris dan 2 kolom serta maksimal 10.000 sel.")
    if sheet.Charts.hasByName(args["name"]):
        raise ValueError("Nama grafik sudah digunakan pada sheet ini.")
    anchor = sheet.getCellRangeByName(args["anchor"]).Position
    bounds = uno.createUnoStruct("com.sun.star.awt.Rectangle", anchor.X, anchor.Y, 15500, 8500)
    sheet.Charts.addNewByName(args["name"], bounds, (area.RangeAddress,), True, True)
    chart = sheet.Charts.getByName(args["name"]).EmbeddedObject
    kind = "LineDiagram" if args["kind"] == "line" else "BarDiagram"
    diagram = chart.createInstance("com.sun.star.chart." + kind)
    chart.setDiagram(diagram)
    if args["kind"] == "column":
        diagram.Vertical = True
    chart.HasMainTitle = True
    chart.Title.String = args["title"]
    return {"chart": args["name"], "sheet": sheet.Name, "kind": args["kind"]}


def edit_slide_text(doc, args):
    pages = doc.DrawPages
    if args["page"] > pages.Count:
        raise ValueError("Nomor slide di luar presentasi.")
    page = pages.getByIndex(args["page"] - 1)
    if args["object"] > page.Count:
        raise ValueError("Nomor objek tidak ditemukan pada slide.")
    shape = page.getByIndex(args["object"] - 1)
    if not hasattr(shape, "String"):
        raise ValueError("Objek ini tidak mendukung teks.")
    shape.String = args["text"]
    return {"page": args["page"], "object": args["object"], "name": shape.Name}


def slide_outline(doc, args):
    pages = doc.DrawPages
    start = args["first_page"] - 1
    if start >= pages.Count:
        raise ValueError("Nomor slide di luar presentasi.")
    result = []
    for index in range(start, min(pages.Count, start + args["limit"])):
        page = pages.getByIndex(index)
        first_text = ""
        for i in range(page.Count):
            text = getattr(page.getByIndex(i), "String", "")
            if text.strip():
                first_text = text.strip().splitlines()[0][:300]
                break
        result.append({"page": index + 1, "objects": page.Count, "first_text": first_text})
    return {"pages": pages.Count, "slides": result}


_DOCUMENT_TOOLS = {
    "writer_create_report": create_report, "writer_append_table": append_table,
    "writer_outline": writer_outline, "writer_read_table": read_table,
    "impress_edit_text": edit_slide_text, "impress_outline": slide_outline
}
_SHEET_TOOLS = {
    "calc_rename_sheet": rename_sheet, "calc_format": format_range,
    "calc_inspect": inspect_cell, "calc_add_chart": add_chart
}
EXTRA_OPERATIONS = _DOCUMENT_TOOLS.keys() | _SHEET_TOOLS.keys()


def edit_extra(doc, op, args, sheet_for):
    if op in _SHEET_TOOLS:
        return _SHEET_TOOLS[op](sheet_for(doc, args.get("sheet")), doc, args)
    return _DOCUMENT_TOOLS[op](doc, args)
