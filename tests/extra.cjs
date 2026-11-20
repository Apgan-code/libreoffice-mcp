const assert = require("node:assert/strict");

module.exports = async function testDocumentTools(call) {
  await call("writer_create_report", {
    output: "laporan.odt", title: "Laporan penjualan",
    sections: [
      { heading: "Ikhtisar", paragraphs: ["Penjualan teh stabil."] },
      { level: 2, heading: "Per wilayah", paragraphs: ["Rincian ada di tabel."] }
    ]
  });
  await call("writer_append_table", {
    source: "laporan.odt", output: "wilayah.odt", name: "Wilayah",
    headers: ["Wilayah", "Penjualan"], rows: [["Timur", "32"], ["Barat", "18"]]
  });
  await call("writer_outline", { source: "wilayah.odt" }, v => {
    assert.equal(v.title, "Laporan penjualan");
    assert.deepEqual(v.headings, [{ level: 1, text: "Ikhtisar" }, { level: 2, text: "Per wilayah" }]);
    assert.deepEqual(v.tables, ["Wilayah"]);
  });
  await call("writer_read_table", { source: "wilayah.odt", name: "Wilayah" }, v => {
    assert.equal(v.cell_count, 6);
    const cells = Object.fromEntries(v.cells.map(c => [c.address, c.text]));
    assert.deepEqual(cells, { A1: "Wilayah", B1: "Penjualan", A2: "Timur", B2: "32", A3: "Barat", B3: "18" });
  });
  await call("writer_append_table", { source: "wilayah.odt", output: "salah.odt",
    name: "Ganjil", headers: ["A", "B"], rows: [["1"]] }, null, true);

  await call("calc_create", { output: "rekap.ods", values: [["Wilayah", "Unit"], ["Timur", 32], ["Barat", 18]] });
  await call("calc_rename_sheet", { source: "rekap.ods", output: "unit.ods", sheet: "Data", new_name: "Penjualan" });
  await call("calc_format", {
    source: "unit.ods", output: "tata-letak.ods", sheet: "Penjualan", range: "A1:B1",
    style: { bold: true, background: "#13536A", font_color: "#FFFFFF", font_size_pt: 14, wrap: true, column_width_mm: 35 }
  });
  await call("calc_add_chart", { source: "tata-letak.ods", output: "grafik.ods", sheet: "Penjualan",
    range: "A1:B3", name: "Volume", title: "Unit per wilayah", kind: "line", anchor: "D2" });
  await call("calc_inspect", { source: "grafik.ods", sheet: "Penjualan", cell: "B1", chart: "Volume" }, v => {
    assert.equal(v.display, "Unit");
    assert.equal(v.wrap, true);
    assert.equal(v.bold, true);
    assert.equal(v.background, "#13536A");
    assert.equal(v.font_color, "#FFFFFF");
    assert.equal(v.font_size_pt, 14);
    assert.ok(Math.abs(v.column_width_mm - 35) < 0.1, JSON.stringify(v));
    assert.ok(v.charts.includes("Volume"));
    assert.equal(v.chart.title, "Unit per wilayah");
    assert.match(v.chart.diagram, /LineDiagram/);
    assert.ok(v.chart.ranges.some(r => r.includes("$A$1:$B$3")), JSON.stringify(v.chart));
  });
  await call("calc_add_chart", { source: "grafik.ods", output: "grafik-duplikat.ods", range: "A1:B3",
    name: "Volume", title: "Lain" }, null, true);

  await call("impress_create", { output: "briefing.odp", slides: [
    { title: "Target awal", body: "Isi satu" }, { title: "Tindak lanjut", body: "Isi dua" }
  ] });
  await call("impress_edit_text", { source: "briefing.odp", output: "briefing-revisi.pptx",
    page: 1, object: 1, text: "Target bulanan" });
  await call("impress_outline", { source: "briefing-revisi.pptx" }, v => {
    assert.equal(v.pages, 2);
    assert.deepEqual(v.slides.map(s => s.first_text), ["Target bulanan", "Tindak lanjut"]);
  });
  await call("impress_read", { source: "briefing-revisi.pptx", page: 1 }, v =>
    assert.ok(v.shapes.some(s => s.text === "Isi satu")));
  await call("impress_edit_text", { source: "briefing.odp", output: "kosong.odp", page: 1, object: 7, text: "X" }, null, true);
};
