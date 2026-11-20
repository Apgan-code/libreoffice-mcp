# LibreOffice MCP v1.0.0

Server MCP lokal untuk Writer, Calc, Impress, Draw, Math, dan Base di Windows dan Linux. Paket mencakup 40 alat untuk membuat, membaca, mengedit, dan mengonversi dokumen.

- [Pemasangan Windows dan Linux](PANDUAN.md)
- [Daftar alat dan contoh](docs/ALAT.md)
- [Cara mengulang pengujian](docs/PENGUJIAN.md)

Butuh Node.js 20+ dan LibreOffice dengan Python serta UNO. Setelah memasang dependensi, jalankan `node uji.cjs --cepat` untuk menguji pembuatan dan pembacaan satu dokumen. Kode server ada di `src/`. ZIP pada halaman rilis sudah menyertakan server yang siap dijalankan.
