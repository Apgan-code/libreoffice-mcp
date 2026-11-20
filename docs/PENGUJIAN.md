# Pengujian MCP LibreOffice v1.0.0

Pengujian integrasi menjalankan server melalui MCP yang sebenarnya. Klien meminta katalog alat, memanggil tiap alat, kemudian membuka kembali dokumen untuk memeriksa hasilnya. Dokumen contoh dibuat dalam folder sementara.

## Hasil

| Sistem uji | Runtime | Hasil |
| --- | --- | --- |
| Windows x64 | Node.js 20.18.0, LibreOffice 26.8.3.1 | 58 skenario, 40 alat berhasil dipanggil |
| Debian GNU/Linux 13 (trixie) x64 | Node.js 20.19.2, Python 3.13.5, LibreOffice 25.2.3.2 | 58 skenario, 40 alat berhasil dipanggil |

Di kedua sistem, pemeriksaan tambahan memastikan PDF pilihan halaman hanya memuat isi slide kedua. Di Debian, skrip pendaftaran juga lulus pemeriksaan argumen dan perilaku saat dijalankan ulang dengan simulasi Codex CLI.

## Cara mengulang pengujian

```sh
node uji.cjs
```

Gunakan `node uji.cjs --cepat` untuk memeriksa koneksi LibreOffice dan pembuatan satu ODT. Jika memakai Docker di Linux, jalankan perintah berikut dari folder paket:

```sh
docker build -f tests/Dockerfile.linux -t libreoffice-mcp-qa .
docker run --rm libreoffice-mcp-qa
```

## Cakupan

- Writer membuat laporan dengan dua tingkat heading, menyimpan tabel bernama, dan memastikan isi tabel dapat dibaca kembali.
- Calc membaca hasil rumus dari XLSX, mengecek format sel setelah disimpan dan membuka kembali grafik beserta judul dan rentang datanya.
- CSV memeriksa nol di depan, pemisah di dalam kutipan, isi beberapa baris, dan teks yang dimulai dengan tanda sama dengan.
- Impress memeriksa isi PPTX setelah mengubah teks. Ekspor halaman tertentu menghasilkan PDF dengan jumlah halaman yang sesuai.
- Draw dan Math membuat, mengedit, membuka kembali dan mengekspor dokumen.
- Base membuat tabel Firebird, menambah baris ke salinan, dan membuka kembali ODB untuk memeriksa data.
- Pengujian mencakup penolakan nama hasil yang sudah ada, traversal direktori, file dan sheet yang hilang, tabel dengan jumlah kolom salah, grafik duplikat, serta nomor objek tidak valid.

[Kembali ke panduan pemasangan](../PANDUAN.md)
