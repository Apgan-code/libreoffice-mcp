<p align="center">
  <img src="docs/assets/hero.svg" alt="LibreOffice MCP — otomasi dokumen dari chat" width="100%">
</p>

<p align="center"><strong>40 alat MCP</strong> · Windows &amp; Linux · stdio &amp; Streamable HTTP</p>

<p align="center">
  <a href="https://github.com/Apgan-code/libreoffice-mcp/releases/download/v1.0/LibreOffice-MCP-v1.0.zip"><img src="docs/assets/download.svg" alt="Unduh ZIP LibreOffice MCP v1.0" width="212" height="44"></a>
</p>

<p align="center">
  <a href="PANDUAN.md">Pemasangan</a> ·
  <a href="docs/KLIEN.md">Konfigurasi klien</a> ·
  <a href="docs/ALAT.md">Daftar alat</a> ·
  <a href="docs/PENGUJIAN.md">Hasil pengujian</a>
</p>

## Apa yang bisa kamu kerjakan?

| Aplikasi | Contoh pekerjaan |
| --- | --- |
| **Writer** | Buat laporan DOCX dengan heading dan tabel, lalu ekspor ke PDF. |
| **Calc** | Impor CSV, hitung dengan rumus, dan buat grafik dari data. |
| **Impress** | Buat presentasi PPTX, ubah teks slide, atau ekspor halaman pilihan. |
| **Draw** | Susun diagram dari bentuk dan teks, lalu simpan sebagai ODG. |
| **Math** | Buat dokumen rumus dengan ekspresi StarMath. |
| **Base** | Buat tabel Firebird tertanam, lalu isi dan baca kembali datanya. |

## Mulai dalam tiga langkah

1. **Siapkan Node.js 20+ dan LibreOffice dengan Python/UNO.** Lihat [panduan pemasangan Windows dan Linux](PANDUAN.md).
2. **Unduh dan ekstrak ZIP.** Buka terminal di folder yang berisi `server.cjs`, lalu jalankan uji cepat.

   ```sh
   node uji.cjs --cepat
   ```

3. **Hubungkan aplikasi pilihanmu.** Contoh untuk Google Antigravity:

   ```sh
   node konfigurasi.cjs antigravity
   ```

   Gabungkan hasil JSON ke pengaturan MCP aplikasi. Langkah ini juga tersedia untuk **Claude Desktop, Claude Code, VS Code, Cursor, Gemini CLI, OpenCode, dan Codex**. Untuk **ChatGPT web**, ikuti bagian Secure MCP Tunnel jika workspace mendukungnya. [Pilih panduan klien](docs/KLIEN.md)

## Coba dari chat

> Gunakan LibreOffice MCP untuk membuat `penjualan.ods` dengan data Teh 12 dan Kopi 8. Hitung totalnya dengan rumus, lalu ekspor hasilnya ke `penjualan.pdf`.

Sumber dan hasil berada di folder `dokumen/` di samping server. Saat mengedit, beri nama baru untuk hasilnya.

**Teruji di Windows dan Debian 13.** Semua 40 alat dipanggil dalam 58 skenario di masing-masing sistem. [Lihat cakupan dan cara mengulang pengujian](docs/PENGUJIAN.md).
