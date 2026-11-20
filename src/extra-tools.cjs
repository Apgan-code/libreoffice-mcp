// Alat dokumen dengan struktur, tata letak, dan visualisasi.
module.exports = function registerExtra({ tool, z, source, output, sheet, start, page }) {
  const edit = { source, output };
  const sheetChoice = sheet.optional().describe("Kosongkan untuk memilih sheet pertama.");
  const range = z.string().regex(/^[A-Za-z]{1,3}[1-9][0-9]{0,6}(?::[A-Za-z]{1,3}[1-9][0-9]{0,6})?$/)
    .describe("Rentang pada satu sheet, misalnya A1:D12.");
  const color = z.string().regex(/^#[0-9a-f]{6}$/i);
  const section = z.object({
    heading: z.string().min(1).max(300), level: z.number().int().min(1).max(3).default(1),
    paragraphs: z.array(z.string().max(8000)).max(50).default([])
  });
  tool("writer_create_report", "Buat laporan dengan judul, heading bertingkat, dan paragraf menggunakan gaya Writer.", {
    output, title: z.string().min(1).max(300), sections: z.array(section).min(1).max(50)
      .refine(s => s.reduce((size, item) => size + item.paragraphs.join("").length, 0) <= 200000,
        "Jumlah isi laporan maksimal 200.000 karakter.")
  });
  tool("writer_append_table", "Tambahkan tabel teks bernama ke akhir dokumen, dengan baris tajuk berwarna yang diulang pada halaman berikutnya.", {
    ...edit, name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,49}$/),
    headers: z.array(z.string().min(1).max(200)).min(1).max(20),
    rows: z.array(z.array(z.string().max(2000)).min(1).max(20)).max(100)
  });
  tool("writer_outline", "Baca judul, heading tingkat atas dan turunannya pada teks utama, serta nama tabel dokumen.", { source });
  tool("writer_read_table", "Baca sel tabel Writer berdasarkan nama dari writer_outline. Setiap sel memuat alamat dan teks.", {
    source, name: z.string().min(1).max(250), offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(200).default(100)
  });
  tool("calc_rename_sheet", "Ganti nama sheet dan simpan salinan workbook.", {
    ...edit, sheet, new_name: sheet.regex(/^[^\\/?*:\[\]]+$/)
  });
  const style = z.object({
    bold: z.boolean().optional(), font_color: color.optional(), background: color.optional(),
    font_size_pt: z.number().min(5).max(96).optional(), wrap: z.boolean().optional(),
    column_width_mm: z.number().min(2).max(200).optional()
  }).refine(s => Object.keys(s).length > 0, "Tentukan sedikitnya satu pengaturan format.");
  tool("calc_format", "Atur warna, ukuran atau ketebalan huruf, pembungkusan teks dan lebar kolom pada rentang sel.", {
    ...edit, sheet: sheetChoice, range, style
  });
  tool("calc_inspect", "Periksa isi, tampilan dan format satu sel, lebar kolomnya, serta nama grafik pada sheet.", {
    source, sheet: sheetChoice, cell: start,
    chart: z.string().min(1).max(80).optional().describe("Nama grafik untuk membaca judul, tipe diagram, dan sumber datanya.")
  });
  tool("calc_add_chart", "Buat grafik kolom atau garis dari rentang dengan nama seri di baris pertama dan label kategori di kolom pertama.", {
    ...edit, sheet: sheetChoice, range, name: z.string().min(1).max(80), title: z.string().min(1).max(200),
    kind: z.enum(["column", "line"]).default("column"),
    anchor: z.string().regex(/^[A-Za-z]{1,3}[1-9][0-9]{0,6}$/).default("F2")
  });
  tool("impress_edit_text", "Ganti teks satu objek pada slide. Nomor objek dihitung mulai 1 sesuai urutan impress_read.", {
    ...edit, page, object: z.number().int().min(1).max(10000), text: z.string().max(12000)
  });
  tool("impress_outline", "Baca ringkasan slide, jumlah objek dan cuplikan teks pertama tiap slide.", {
    source, first_page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(30)
  });
};
