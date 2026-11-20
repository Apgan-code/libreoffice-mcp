# Pengujian MCP LibreOffice

Rilis v1.0 mencakup generator konfigurasi Antigravity dengan `command` dan `args` (stdio) atau `serverUrl` (Streamable HTTP). Bentuk konfigurasi tersebut diuji dengan `node tests/config.cjs`.

Pengujian integrasi menjalankan server melalui MCP yang sebenarnya. Klien meminta katalog alat, memanggil tiap alat, kemudian membuka kembali dokumen untuk memeriksa hasilnya. Dokumen contoh dibuat dalam folder sementara.

## Hasil

| Sistem uji | Runtime | Uji lengkap |
| --- | --- | --- |
| Windows x64 | Node.js 20.18.0, LibreOffice 26.8.3.1 | stdio, 58 skenario, 40 alat |
| Debian GNU/Linux 13 (trixie) x64 | Node.js 20.19.2, Python 3.13.5, LibreOffice 25.2.3.2 | Streamable HTTP, 58 skenario, 40 alat |

Uji cepat juga menjalankan Streamable HTTP di Windows dan stdio di Debian. Di Windows, klien SDK MCP resmi berhasil tersambung ke kedua transport, melihat 40 alat, dan memanggil `office_status`. Format konfigurasi divalidasi berdasarkan struktur masing-masing klien. Pengujian dijalankan di tingkat protokol dan generator.

## Cara mengulang pengujian

```sh
node uji.cjs
node uji.cjs --http
node tests/config.cjs
```

Tambahkan `--cepat` pada uji stdio atau HTTP untuk memeriksa koneksi dan pembuatan satu ODT. Uji HTTP membuat token dan port sementara, serta memeriksa penolakan token yang salah, Host atau Origin asing, dan isi permintaan yang tidak valid. Jika memakai Docker di Linux, jalankan perintah berikut dari folder paket:

```sh
docker build -f tests/Dockerfile.linux -t libreoffice-mcp-qa .
docker run --rm libreoffice-mcp-qa
docker run --rm libreoffice-mcp-qa node uji.cjs --http
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
