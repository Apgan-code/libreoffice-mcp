// Uji integrasi lewat stdin/stdout, memakai folder dokumen sementara yang unik.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const assert = require("node:assert/strict");

async function main() {
  const root = fs.mkdtempSync(path.join(process.env.LO_TEST_DIR || os.tmpdir(), "uji-lo-"));
  console.log("Dokumen contoh:", root);
  const child = spawn(process.execPath, [path.join(__dirname, "server.cjs")], {
    env: { ...process.env, LO_MCP_WORKSPACE: root }, stdio: ["pipe", "pipe", "inherit"], windowsHide: true
  });
  const replies = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  let id = 0;
  function send(message) { child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n"); }
  async function request(method, params) {
    send({ id: ++id, method, params });
    while (true) {
      const line = await replies.next();
      assert.ok(!line.done, "Server terputus");
      const reply = JSON.parse(line.value);
      if (!("id" in reply)) continue;
      assert.equal(reply.id, id);
      assert.ok(!reply.error, JSON.stringify(reply.error));
      return reply.result;
    }
  }
  const passed = new Set();
  let cases = 0;
  async function call(name, args, verify, fail = false) {
    try {
      const reply = await request("tools/call", { name, arguments: args });
      const raw = reply.content[0].text;
      assert.equal(Boolean(reply.isError), fail, raw);
      if (verify) verify(fail ? raw : JSON.parse(raw));
      if (!fail) passed.add(name);
      ++cases;
      console.log("OK", name, args.output || args.source || "");
    } catch (e) {
      console.error("GAGAL", name, args.output || args.source || "", e.message);
      process.exitCode = 1;
    }
  }
  const hasText = (value, text) => assert.ok(JSON.stringify(value).includes(text), JSON.stringify(value));
  try {
    const init = await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "uji-libreoffice", version: "1" } });
    assert.equal(init.serverInfo.name, "libreoffice-local");
    send({ method: "notifications/initialized" });
    const catalog = await request("tools/list", {});
    console.log("Alat terdaftar:", catalog.tools.length);
    await call("office_status", {}, v => { assert.equal(v.workspace, root); console.log(v.version); });
    if (process.argv.includes("--cepat")) {
      await call("writer_create", { output: "uji.odt", text: "Halo LibreOffice" });
      await call("writer_read", { source: "uji.odt" }, v => assert.equal(v.text, "Halo LibreOffice"));
      if (!process.exitCode) console.log("Uji cepat lulus.");
      return;
    }
    const writer = { source: "awal.odt" };
    await call("writer_create", { output: writer.source, text: "Kopi\nHarga Rp5.000 – 日本" });
    await call("writer_append", { ...writer, output: "baru.docx", text: "Jumlah 3" });
    await call("writer_replace", { source: "baru.docx", output: "akhir.odt", find: "Kopi", replacement: "Teh" }, v => assert.equal(v.replacements, 1));
    await call("writer_read", { source: "akhir.odt" }, v => { hasText(v, "Teh"); hasText(v, "日本"); hasText(v, "Jumlah 3"); });
    await call("writer_read", writer, v => assert.equal(v.text.trim().split(/\r?\n/)[0], "Kopi"));
    await call("calc_create", { output: "data.ods", values: [["Produk", "Harga"], ["Teh", 12], ["Kopi", 8], ["Total", { formula: "=SUM(B2:B3)" }]] });
    await call("calc_add_sheet", { source: "data.ods", output: "tab.ods", sheet: "Catatan" });
    await call("calc_sheets", { source: "tab.ods" }, v => assert.deepEqual(v.sheets, ["Data", "Catatan"]));
    await call("calc_write", { source: "tab.ods", output: "angka.xlsx", sheet: "Data", start: "B2", values: [[17]] });
    await call("calc_read", { source: "angka.xlsx", start: "B4", rows: 1, columns: 1, include_formulas: true }, v => { assert.equal(v.values[0][0], 25); hasText(v.formulas, "SUM"); });
    await call("impress_create", { output: "slide.odp", slides: [{ title: "Ringkasan", body: "Hasil bulanan" }] });
    await call("impress_append", { source: "slide.odp", output: "slide.pptx", slides: [{ title: "Langkah berikut", body: "Rapat Jumat" }] });
    await call("impress_read", { source: "slide.pptx", page: 2 }, v => { assert.equal(v.pages, 2); hasText(v.shapes, "Rapat Jumat"); });
    const shapes = [{ kind: "rectangle", x: 15, y: 15, width: 80, height: 30, text: "Proses" }];
    await call("draw_create", { output: "gambar.odg", shapes });
    await call("draw_append", { source: "gambar.odg", output: "gambar2.odg", shapes });
    await call("draw_read", { source: "gambar2.odg", page: 2 }, v => { assert.equal(v.pages, 2); hasText(v.shapes, "Proses"); });
    await call("math_create", { output: "rumus.odf", formula: "a over b" });
    await call("math_edit", { source: "rumus.odf", output: "akar.odf", formula: "sqrt {x}" });
    await call("math_read", { source: "akar.odf" }, v => hasText(v.formula, "sqrt"));
    await call("base_create", { output: "arsip.odb", table: "Barang", columns: [{name: "Nama", type: "text"}, {name: "Stok", type: "integer"}] });
    await call("base_inspect", { source: "arsip.odb" }, v => assert.ok(Array.isArray(v.queries)));
    await call("base_tables", { source: "arsip.odb" }, v => assert.ok(v.tables.includes("Barang")));
    await call("base_append", { source: "arsip.odb", output: "stok.odb", table: "Barang", columns: ["Nama","Stok"], rows: [["Teh",12],["Kopi",8]] }, v => assert.equal(v.inserted, 2));
    await call("base_read", { source: "stok.odb", table: "Barang" }, v => { assert.deepEqual(v.columns, ["Nama","Stok"]); assert.ok(v.rows.some(r => r[0] === "Kopi" && r[1] === "8")); });
    for (const file of ["akhir.odt", "angka.xlsx", "slide.pptx", "gambar2.odg", "akar.odf"]) {
      const pdf = file + ".pdf";
      await call("office_convert", { source: file, output: pdf }, () => assert.equal(fs.readFileSync(path.join(root, pdf)).subarray(0, 5).toString(), "%PDF-"));
    }
    await call("office_files", {}, v => assert.ok(v.files.includes("slide.pptx")));
    await call("writer_create", { output: writer.source, text: "duplikat" }, v => hasText(v, "sudah ada"), true);
    await call("writer_read", { source: "../awal.odt" }, null, true);
    await call("calc_read", { source: "angka.xlsx", sheet: "TidakAda" }, null, true);
    await call("writer_read", { source: "hilang.odt" }, null, true);
    await require("./tests/exchange.cjs")(call, root);
    await require("./tests/extra.cjs")(call);
    assert.deepEqual(catalog.tools.map(t => t.name).filter(n => !passed.has(n)), [], "Sebagian alat belum lulus");
    console.log(cases, "skenario lulus;", passed.size, "alat berhasil dipanggil.");
  } finally { child.stdin.end(); }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
