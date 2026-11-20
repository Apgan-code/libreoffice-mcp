# Daftar alat MCP LibreOffice

Nama file sumber dan hasil mengacu pada folder yang dilaporkan oleh `office_status`. Operasi tulis membutuhkan nama hasil baru, termasuk ekstensi. Nomor slide, halaman, dan objek dihitung mulai dari 1.

| Kelompok | Alat | Kegunaan |
| --- | --- | --- |
| Umum | `office_status`, `office_files` | Periksa instalasi dan lihat file yang tersedia. |
| Konversi | `office_convert` | Konversi format dalam keluarga dokumen atau ekspor ke PDF. Gunakan `pages` seperti `2,4-6` untuk memilih halaman yang diekspor. |
| Metadata | `office_metadata`, `office_set_metadata` | Baca atau ubah judul, subjek, penulis, deskripsi, dan kata kunci. |
| Writer | `writer_create`, `writer_read`, `writer_append`, `writer_replace` | Buat ODT/DOCX, baca teks utama, tambah paragraf, dan ganti teks literal. |
| Laporan Writer | `writer_create_report`, `writer_outline`, `writer_append_table`, `writer_read_table` | Buat laporan dengan heading bertingkat. Tambah tabel bernama, baca struktur laporan, dan periksa isi tabel. |
| Calc | `calc_create`, `calc_sheets`, `calc_add_sheet`, `calc_read`, `calc_write` | Buat ODS/XLSX, kelola sheet dan baca atau tulis isi sel. |
| Tata letak Calc | `calc_rename_sheet`, `calc_format`, `calc_inspect`, `calc_add_chart` | Ganti nama sheet, atur format sel dan lebar kolom, periksa format dan grafik, serta buat grafik kolom atau garis. |
| CSV | `calc_import_csv`, `calc_export_csv` | Impor CSV UTF-8 sebagai teks literal atau ekspor nilai dari rentang yang dipilih. Pemisah dapat berupa koma, titik koma, atau tab. |
| Impress | `impress_create`, `impress_read`, `impress_append`, `impress_edit_text`, `impress_outline` | Buat ODP/PPTX, tambah dan ringkas slide, lalu baca atau ganti teks pada objek slide. |
| Draw | `draw_create`, `draw_read`, `draw_append` | Buat ODG dengan persegi, elips, dan teks. Tambah halaman atau baca objek pada halaman tertentu. Gunakan milimeter untuk ukuran dan posisi. |
| Math | `math_create`, `math_read`, `math_edit` | Buat, baca, dan ganti ekspresi StarMath pada file ODF. |
| Base | `base_create`, `base_inspect`, `base_tables`, `base_read`, `base_append` | Buat tabel Firebird tertanam di ODB, baca metadata dan data, lalu tambah baris pada salinan. |

## Contoh perintah chat

- **Writer** “Buat laporan.odt dengan judul Ringkasan Penjualan dan bagian Ikhtisar serta Rincian. Tambahkan tabel Wilayah di laporan-final.odt. Buka kembali tabelnya dan bacakan hasilnya.”
- **Calc** “Impor penjualan.csv yang memakai titik koma ke penjualan.ods. Buat grafik kolom dari A1:B5, simpan sebagai penjualan-grafik.ods, lalu tampilkan judul serta rentang sumber grafiknya.”
- **Impress** “Baca struktur rapat.pptx. Pada slide 2, ganti teks objek pertama dengan Rencana Baru, simpan sebagai rapat-revisi.pptx, lalu ekspor hanya slide 2 ke rapat-slide-2.pdf.”
- **Base** “Buat barang.odb dengan tabel Barang dan kolom Nama bertipe text serta Stok bertipe integer. Tambahkan Teh dengan stok 12 ke salinan bernama barang-isi.odb.”

## Format dan batas

- Ekspor PDF tersedia untuk Writer, Calc, Impress, Draw, dan Math. Tata letak mengikuti pengaturan cetak LibreOffice. Gunakan folder sumber yang bisa ditulis oleh akun yang menjalankan klien.
- Untuk rumus Calc, kirim objek seperti `{"formula":"=SUM(B2:B3)"}`. Rumus baru mendukung referensi sel lokal, aritmetika, serta SUM, AVERAGE, MIN, MAX, COUNT, ROUND dan ABS. Gunakan titik untuk desimal dan titik koma untuk memisahkan argumen. `null` mengosongkan sel.
- Impor CSV mempertahankan nol di awal, kutipan, isi dalam beberapa baris, dan nilai yang dimulai dengan `=` sebagai teks literal. Ekspor CSV menggunakan nilai sel. Hasil CSV sendiri tidak menyimpan tipe sel atau format workbook.
- `impress_read` dan `draw_read` membaca objek tingkat atas pada halaman. Periksa nomor objek dengan `impress_read` sebelum memakai `impress_edit_text`.
- Operasi tabel Base bekerja pada ODB Firebird tertanam. `base_inspect` membaca metadata ODB tanpa terhubung ke sumber data eksternal.

[Kembali ke panduan pemasangan](../PANDUAN.md)
