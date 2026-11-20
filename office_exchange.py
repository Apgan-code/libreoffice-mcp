"""Pertukaran CSV, metadata dokumen, dan opsi ekspor PDF."""
import csv
import re

import uno


def import_csv(doc, source, args):
    sheet = doc.Sheets.getByIndex(0)
    sheet.Name = args["sheet"]
    rows = []
    max_width = 0
    field_count = 0
    with source.open(encoding="utf-8-sig", newline="") as stream:
        for record in csv.reader(stream, delimiter=args["delimiter"], strict=True):
            field_count += max(len(record), 1)
            if field_count > 100000 or len(rows) >= 10000 or len(record) > 256:
                raise ValueError("Impor CSV dibatasi hingga 10.000 baris, 256 kolom dan 100.000 sel.")
            if any(len(value) > 32767 for value in record):
                raise ValueError("Satu kolom CSV melebihi 32.767 karakter.")
            rows.append(record)
            max_width = max(max_width, len(record))
    # Write rows in groups of equal width. setDataArray treats CSV strings as
    # literal text, including reference numbers with leading zeroes and '=...'.
    i = 0
    while i < len(rows):
        width = len(rows[i])
        end = i + 1
        while end < len(rows) and len(rows[end]) == width and end - i < 1000:
            end += 1
        if width:
            area = sheet.getCellRangeByPosition(0, i, width - 1, end - 1)
            area.setDataArray(tuple(tuple(record) for record in rows[i:end]))
        i = end
    return {"rows": len(rows), "columns": max_width, "sheet": sheet.Name}


def export_csv(sheet, start, staged, args):
    col, row = start
    width, height = args["columns"], args["rows"]
    if row + height > sheet.Rows.Count or col + width > sheet.Columns.Count:
        raise ValueError("Rentang di luar batas sheet.")
    area = sheet.getCellRangeByPosition(col, row, col + width - 1, row + height - 1)
    with staged.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream, delimiter=args["delimiter"])
        for record in area.getDataArray():
            writer.writerow(record)
    return {"rows": height, "columns": width, "sheet": sheet.Name}


def metadata(doc, changes=None):
    properties = doc.DocumentProperties
    names = {"title": "Title", "subject": "Subject", "author": "Author",
             "description": "Description", "keywords": "Keywords"}
    for key, value in (changes or {}).items():
        setattr(properties, names[key], tuple(value) if key == "keywords" else value)
    return {key: getattr(properties, prop_name) for key, prop_name in names.items()}


def store_options(filter_name, pages, prop):
    options = [prop("FilterName", filter_name)]
    if pages:
        for item in pages.split(","):
            if not re.fullmatch(r"[1-9]\d{0,4}(?:-[1-9]\d{0,4})?", item):
                raise ValueError("Rentang PDF harus seperti 1,3-5.")
            ends = [int(n) for n in item.split("-")]
            if ends[0] > ends[-1]:
                raise ValueError("Halaman awal rentang PDF melebihi halaman akhirnya.")
        data = uno.Any("[]com.sun.star.beans.PropertyValue", (prop("PageRange", pages),))
        options.append(prop("FilterData", data))
    return tuple(options)
