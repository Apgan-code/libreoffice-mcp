# LibreOffice MCP v1.0

Server MCP untuk Writer, Calc, Impress, Draw, Math, dan Base di Windows dan Linux. Paket mencakup 40 alat untuk membuat, membaca, mengedit, dan mengonversi dokumen melalui stdio atau Streamable HTTP.

- [Pemasangan Windows dan Linux](PANDUAN.md)
- [Konfigurasi Google Antigravity, Claude, VS Code, Cursor, Gemini CLI, OpenCode, Codex, dan ChatGPT](docs/KLIEN.md)
- [Daftar alat dan contoh](docs/ALAT.md)
- [Cara mengulang pengujian](docs/PENGUJIAN.md)

Butuh Node.js 20+ dan LibreOffice dengan Python serta UNO. Setelah memasang dependensi, jalankan `node uji.cjs --cepat` untuk menguji pembuatan dan pembacaan satu dokumen. Kode server ada di `src/`. ZIP pada halaman rilis sudah menyertakan server yang siap dijalankan.
