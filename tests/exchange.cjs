const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function testExchange(call, root) {
  const fixture = 'Kode;Nama;Catatan\r\n001;"Teh; hijau";"Dua\nbaris"\r\n002;Kopi;=3+5\r\n';
  fs.writeFileSync(path.join(root, "masuk.csv"), "\uFEFF" + fixture, "utf8");
  await call("calc_import_csv", { source: "masuk.csv", output: "impor.ods", delimiter: ";" },
    v => { assert.equal(v.rows, 3); assert.equal(v.columns, 3); });
  await call("calc_read", { source: "impor.ods", start: "A2", rows: 2, columns: 3 },
    v => assert.deepEqual(v.values, [["001", "Teh; hijau", "Dua\nbaris"], ["002", "Kopi", "=3+5"]]));
  await call("calc_export_csv", { source: "impor.ods", output: "keluar.csv", rows: 3, columns: 3, delimiter: ";" },
    () => assert.equal(fs.readFileSync(path.join(root, "keluar.csv"), "utf8"), "\uFEFF" + fixture));
  await call("office_set_metadata", { source: "awal.odt", output: "judul.odt", changes: {
    title: "Daftar harga", subject: "November", keywords: ["kopi", "teh"]
  } });
  await call("office_metadata", { source: "judul.odt" }, v => {
    assert.equal(v.title, "Daftar harga"); assert.equal(v.subject, "November");
    assert.deepEqual(v.keywords, ["kopi", "teh"]);
  });
  await call("office_convert", { source: "slide.pptx", output: "halaman2.pdf", pages: "2" },
    () => {
      const pdf = fs.readFileSync(path.join(root, "halaman2.pdf")).toString("latin1");
      assert.equal((pdf.match(/\/Type\s*\/Page\b/g) || []).length, 1, "PDF seharusnya berisi satu halaman");
    });
  await call("office_convert", { source: "slide.pptx", output: "salah.odp", pages: "2" }, null, true);
  assert.ok(!fs.existsSync(path.join(root, "salah.odp")));
};
