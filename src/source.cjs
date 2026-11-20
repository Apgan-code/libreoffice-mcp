const path = require("node:path");
const { createRunner } = require("./office-runtime.cjs");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod/v4");

const { version } = require("./package.json");
const server = new McpServer({ name: "libreoffice-local", version });
const { runOffice, shutdown } = createRunner(path.join(__dirname, "office.py"));

function tool(name, description, schema) {
  server.registerTool(name, { description, inputSchema: schema,
    annotations: { readOnlyHint: !("output" in schema), destructiveHint: false, openWorldHint: false } },
    async (args, extra) => {
      try {
        const value = await runOffice(name, args, extra?.signal);
        return { content: [{ type: "text", text: JSON.stringify(value) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error.message }] };
      }
    });
}

const filename = z.string().min(1).max(180);
const source = filename.describe("Nama file di folder dokumen MCP.");
const output = filename.describe("Nama hasil baru, termasuk ekstensi. Nama yang sudah ada ditolak.");
const text = z.string().max(200000);
const sheet = z.string().min(1).max(31);
const start = z.string().regex(/^[A-Za-z]{1,3}[1-9][0-9]{0,6}$/).default("A1");
const positive = (max) => z.number().int().min(1).max(max);
const page = positive(100000).default(1);
const cell = z.union([z.string().max(32767), z.number(), z.null(), z.object({
  formula: z.string().startsWith("=").max(512).describe("Rumus lokal, misalnya =SUM(B2:B8).")
})]);
const values = z.array(z.array(cell).min(1).max(100)).min(1).max(500)
  .refine(rows => rows.reduce((total, row) => total + row.length, 0) <= 5000, "Maksimal 5.000 sel per operasi.");
const slides = z.array(z.object({ title: z.string().min(1).max(250), body: z.string().max(12000).default("") })).min(1).max(100);
const mm = z.number().min(0).max(2000);
const dimension = z.number().min(1).max(2000);
const shapes = z.array(z.object({
  kind: z.enum(["rectangle", "ellipse", "text"]), x: mm, y: mm, width: dimension, height: dimension,
  text: z.string().max(2000).default(""), color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#CFE5EF")
})).min(1).max(100);
const formula = z.string().min(1).max(10000).describe("Ekspresi LibreOffice Math (StarMath).");

tool("office_status", "Periksa versi LibreOffice, lokasi folder dokumen, dan format keluaran.", {});
tool("office_files", "Daftar file yang tersedia di folder dokumen MCP.", {});
tool("office_convert", "Konversi dalam keluarga Writer/Calc/Impress atau ekspor ke PDF. Opsi pages memilih halaman PDF, misalnya 1,3-5.", {
  source, output, pages: z.string().min(1).max(256).regex(/^[1-9]\d{0,4}(?:-[1-9]\d{0,4})?(?:,[1-9]\d{0,4}(?:-[1-9]\d{0,4})?)*$/).optional()
});
const optionalLabel = z.string().max(2048).optional();
tool("office_metadata", "Baca judul, subjek, penulis, deskripsi dan kata kunci Writer, Calc, Impress, Draw atau Math.", { source });
tool("office_set_metadata", "Ubah properti yang disebutkan dan simpan salinan.", {
  source, output, changes: z.object({ title: optionalLabel, subject: optionalLabel, author: optionalLabel,
    description: z.string().max(10000).optional(), keywords: z.array(z.string().max(150)).max(100).optional() })
    .strict().refine(obj => Object.keys(obj).length > 0, "Isi minimal satu properti.")
});
const delimiter = z.enum([",", ";", "\t"]).default(",");
tool("calc_import_csv", "Impor CSV UTF-8 ke ODS/XLSX sebagai teks literal. Mempertahankan nol awal dan isi yang diawali =.", {
  source, output, sheet: sheet.default("Data"), delimiter
});
tool("calc_export_csv", "Ekspor nilai dari rentang Calc ke CSV UTF-8. Pilih awal, jumlah baris dan kolom.", {
  source, output, sheet: sheet.optional(), start, rows: positive(1000), columns: positive(100), delimiter
});
tool("writer_create", "Buat dokumen ODT atau DOCX dari teks. Gunakan baris baru untuk paragraf.", { output, text });
tool("writer_read", "Baca teks utama Writer. Offset dihitung dalam karakter.", { source, offset: z.number().int().min(0).default(0), limit: positive(50000).default(10000) });
tool("writer_append", "Tambahkan paragraf di akhir dokumen dan simpan salinan.", { source, output, text });
tool("writer_replace", "Ganti semua kemunculan teks literal dan kembalikan jumlah penggantian.", { source, output, find: z.string().min(1).max(1000), replacement: text, case_sensitive: z.boolean().default(true) });
tool("calc_create", "Buat ODS/XLSX dengan satu sheet dan isi sel dari A1.", { output, sheet: sheet.default("Data"), values });
tool("calc_sheets", "Daftar nama sheet dalam workbook.", { source });
tool("calc_add_sheet", "Tambah sheet kosong kemudian simpan sebagai file baru.", { source, output, sheet });
tool("calc_read", "Baca blok sel, termasuk nilai hasil rumus. Sheet default adalah sheet pertama.", {
  source, sheet: sheet.optional(), start, rows: positive(200).default(20), columns: positive(50).default(8), include_formulas: z.boolean().default(false)
});
tool("calc_write", "Isi sel mulai dari alamat awal. String adalah teks literal, null mengosongkan sel, objek formula berisi rumus lokal.", {
  source, output, sheet: sheet.optional(), start, values
});
tool("impress_create", "Buat presentasi ODP/PPTX berisi slide judul dan isi.", { output, slides });
tool("impress_append", "Tambahkan slide ke akhir presentasi.", { source, output, slides });
tool("impress_read", "Baca teks objek tingkat atas pada satu slide, dengan jumlah slide presentasi.", { source, page });
tool("draw_create", "Buat gambar ODG satu halaman. Koordinat dan ukuran bentuk dalam mm dari kiri atas.", { output, shapes });
tool("draw_append", "Tambahkan halaman berisi bentuk baru ke salinan ODG.", { source, output, shapes });
tool("draw_read", "Baca nama, jenis, dan teks objek tingkat atas pada satu halaman Draw.", { source, page });
tool("math_create", "Buat dokumen rumus ODF dari ekspresi StarMath.", { output, formula });
tool("math_edit", "Ganti ekspresi StarMath dalam salinan dokumen ODF.", { source, output, formula });
tool("math_read", "Baca ekspresi dari dokumen LibreOffice Math.", { source });
const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,30}$/);
const dbValue = z.union([z.string().max(8000), z.number(), z.null()]);
tool("base_create", "Buat ODB Firebird tertanam dengan satu tabel. Nama tabel dan kolom membedakan huruf besar/kecil.", {
  output, table: identifier.default("Data"), columns: z.array(z.object({ name: identifier, type: z.enum(["text", "integer", "number"]) }))
    .min(1).max(40).default([{ name: "Nama", type: "text" }])
});
tool("base_inspect", "Baca metadata ODB: nama kueri tersimpan, deskripsi tabel tersimpan, jumlah formulir dan laporan. Tidak menghubungi sumber data.", { source });
tool("base_tables", "Daftar tabel lokal dari dokumen Base dengan Firebird tertanam.", { source });
tool("base_read", "Baca baris tabel Firebird tertanam. Nilai dikembalikan sebagai teks atau null.", { source, table: identifier, limit: positive(200).default(50) });
tool("base_append", "Tambahkan baris ke tabel Firebird tertanam dan simpan ODB baru.", {
  source, output, table: identifier, columns: z.array(identifier).min(1).max(40), rows: z.array(z.array(dbValue).min(1).max(40)).min(1).max(200)
});

require("./extra-tools.cjs")({ tool, z, source, output, sheet, start, page });

process.stdin.on("end", shutdown);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { shutdown(); process.stdin.destroy(); });
}
server.connect(new StdioServerTransport()).catch(error => { console.error(error.message); process.exitCode = 1; });
