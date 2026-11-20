# Hubungkan LibreOffice MCP ke aplikasi pilihanmu

Pakai **stdio** jika aplikasi bisa menjalankan perintah di komputer yang memiliki LibreOffice. Pakai **Streamable HTTP** jika klien lokal lebih mudah menerima URL. Keduanya menyediakan 40 alat yang sama. Selesaikan dulu [pemasangan LibreOffice dan Node.js](../PANDUAN.md).

## Koneksi lokal melalui stdio

Jalankan generator dari folder paket. Ganti `vscode` dengan nama klien di tabel. Generator mengisi lokasi Node.js dan `server.cjs` secara otomatis.

```sh
node konfigurasi.cjs vscode
```

Salin hasilnya ke pengaturan aplikasi. Jika sudah ada server lain, tambahkan entri `libreoffice` ke objek yang sesuai.

| Klien | Nama generator | Lokasi pengaturan |
| --- | --- | --- |
| VS Code / GitHub Copilot | `vscode` | Buka **MCP: Open User Configuration** atau gunakan `.vscode/mcp.json` di proyek. Gabungkan entri di `servers`. [Dokumentasi VS Code](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Cursor | `cursor` | `~/.cursor/mcp.json` atau `.cursor/mcp.json` di proyek. [Dokumentasi Cursor](https://prod.cursor.com/docs/mcp) |
| Gemini CLI | `gemini` | `~/.gemini/settings.json` atau `.gemini/settings.json` di proyek. Jalankan `/mcp` untuk memeriksa server. [Dokumentasi Gemini CLI](https://geminicli.com/docs/tools/mcp-server/) |
| OpenCode | `opencode` | `opencode.json` atau `opencode.jsonc` di proyek. Gabungkan di `mcp.servers`. [Dokumentasi OpenCode](https://opencode.ai/docs/mcp-servers/) |
| Claude Desktop | `claude-desktop` | Tambahkan di `claude_desktop_config.json` di Windows, biasanya di folder `%APPDATA%\Claude`. Tutup dan buka aplikasi setelah menyimpan. [Panduan Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) |
| Claude Code | `claude-code` | Gunakan `.mcp.json` di proyek atau daftarkan langsung dengan `claude mcp add --transport stdio libreoffice -- node /lokasi/server.cjs`. [Dokumentasi Claude Code](https://code.claude.com/docs/en/mcp) |
| Codex | Skrip pemasangan | Jalankan `pasang-codex.ps1` di Windows atau `sh pasang-codex.sh` di Linux. [Langkah lengkap](../PANDUAN.md#codex-opsional) |
| Klien lainnya | `generic` | Gunakan hasil JSON jika klien memakai `mcpServers`. Jika tersedia formulir, masukkan lokasi absolut Node.js di **Command** dan lokasi `server.cjs` di **Arguments**. |

Untuk mencoba koneksi, minta klien menjalankan `office_status` dan membaca lokasi folder dokumen.

## Streamable HTTP di komputer yang sama

Buat token acak dan jalankan server dari folder paket.

**Windows PowerShell**

```powershell
$env:LO_MCP_HTTP_TOKEN = node -p "require('node:crypto').randomBytes(32).toString('hex')"
node server.cjs --http
```

**Linux**

```sh
export LO_MCP_HTTP_TOKEN="$(node -p "require('node:crypto').randomBytes(32).toString('hex')")"
node server.cjs --http
```

Biarkan proses berjalan. Di klien pilih **Streamable HTTP**, masukkan `http://127.0.0.1:8765/mcp` dan gunakan header `Authorization` dengan nilai `Bearer <token>`. Simpan token di pengaturan privat klien atau variabel lingkungan. Pilih port lain dengan `LO_MCP_HTTP_PORT` jika diperlukan.

```sh
node konfigurasi.cjs vscode http
node konfigurasi.cjs cursor http
node konfigurasi.cjs gemini http
node konfigurasi.cjs opencode http
```

VS Code akan meminta token. Cursor dan OpenCode mengambilnya dari lingkungan proses aplikasi. Untuk Gemini CLI atau format generik, ganti `GANTI_DENGAN_TOKEN_LOKAL` di konfigurasi lokal. Argumen URL opsional setelah `http` mengubah alamat pada konfigurasi yang dicetak. Mode ini memakai token Bearer dan port loopback IPv4.

## ChatGPT web dan klien yang berjalan di cloud

Alamat `127.0.0.1` hanya tersedia pada komputer yang menjalankan server. Untuk ChatGPT yang mendukung koneksi privat, gunakan [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) dengan profil **stdio**. Di pengaturan tunnel, arahkan perintah ke lokasi absolut Node.js dengan argumen `server.cjs`. Pilih tunnel tersebut saat menambahkan server MCP di ChatGPT. Ketersediaannya bergantung pada izin organisasi dan workspace.

Untuk layanan cloud lain, jalankan server pada host yang juga dapat mengakses folder dokumen dan gunakan koneksi privat atau gateway HTTPS dengan autentikasi yang didukung klien. Konektor yang mengharuskan OAuth perlu gateway OAuth tersendiri. [Persyaratan konektor Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) · [Persyaratan ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server)
