# MCP LibreOffice v1.0 untuk Windows dan Linux

Gunakan Writer, Calc, Impress, Draw, Math, dan Base lewat chat. Server bekerja secara lokal. Kamu bisa membuat laporan bertabel, menyusun grafik dari spreadsheet, menyunting slide, atau mengekspor halaman tertentu ke PDF.

[Konfigurasi aplikasi MCP](docs/KLIEN.md) · [Daftar 40 alat dan contoh pemakaian](docs/ALAT.md) · [Hasil pengujian](docs/PENGUJIAN.md)

## Mulai di Windows

Ekstrak paket ke lokasi tetap. Gunakan Node.js 20 atau lebih baru dan LibreOffice untuk Windows dengan Python bawaan. Buka PowerShell di folder paket lalu jalankan:

```powershell
node .\uji.cjs --cepat
```

## Mulai di Linux

Gunakan Node.js 20 atau lebih baru, Python 3.10 atau lebih baru dengan modul UNO, dan LibreOffice. Di Debian atau Ubuntu, perintah berikut memasang komponen LibreOffice untuk keenam aplikasi:

```sh
sudo apt update
sudo apt install libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw libreoffice-math libreoffice-base libreoffice-sdbc-firebird python3-uno
```

Ekstrak ZIP ke folder yang bisa ditulis oleh akunmu. Dari dalam folder yang berisi `server.cjs`, periksa versi Node dan jalankan uji cepat:

```sh
node --version
node ./uji.cjs --cepat
```

Uji cepat membuat dan membuka kembali satu ODT di folder sementara. Setelah muncul **Uji cepat lulus**, ikuti [langkah untuk klien yang kamu pakai](docs/KLIEN.md). Untuk uji pertama di aplikasi, minta **“Gunakan LibreOffice. Jalankan office_status dan beri tahu saya lokasi folder dokumen.”**

## Codex (opsional)

Jalankan `pasang-codex.ps1` di PowerShell atau `sh ./pasang-codex.sh` di Linux. Jika server sudah terdaftar dan folder tetap di lokasi semula, buka chat baru. Jika PowerShell membatasi skrip, gunakan `codex mcp add libreoffice -- (Get-Command node.exe).Source (Resolve-Path .\server.cjs).Path`.

## Pekerjaan pertama

Letakkan sumber di folder `dokumen` di samping server. Coba permintaan berikut dalam chat:

> Buat rekap.ods dengan penjualan Teh 12 dan Kopi 8. Buat grafik kolom dari data itu. Simpan sebagai rekap-grafik.ods, buka kembali hasilnya, lalu beri tahu judul grafiknya.

Setiap operasi edit memakai nama file hasil baru. Untuk mencoba dokumen sendiri, panggil `office_files` agar AI melihat file yang tersedia. Server mengakses nama file langsung di folder dokumen dan menerima sumber sampai 64 MiB.

## Lokasi folder dan runtime khusus

Seluruh SDK MCP sudah disertakan. Contoh konfigurasi folder khusus untuk klien yang memakai `mcpServers`:

```json
{
  "mcpServers": {
    "libreoffice": {
      "command": "/usr/bin/node",
      "args": ["/home/ana/aplikasi/LibreOffice-MCP/server.cjs"],
      "env": { "LO_MCP_WORKSPACE": "/home/ana/Dokumen/Kantor" }
    }
  }
}
```

Ganti lokasi contoh sesuai komputer. Di Windows, path JSON juga bisa ditulis dengan garis miring biasa, misalnya `C:/Aplikasi/LibreOffice-MCP/server.cjs`.

| Pengaturan opsional | Kegunaan |
| --- | --- |
| `LO_MCP_WORKSPACE` | Lokasi absolut folder sumber dan hasil. Nilai bawaan adalah folder `dokumen` di samping server. |
| `LO_PROGRAM` | Folder yang berisi `soffice` di Linux atau `soffice.com` di Windows. |
| `LO_PYTHON` | Lokasi absolut Python yang dapat menjalankan `import uno`. Debian/Ubuntu umumnya menggunakan `/usr/bin/python3`. |

Untuk Codex, tetapkan variabel ini di konfigurasi server, atau gunakan opsi `--env KEY=VALUE` pada `codex mcp add`. Server membuka salinan dokumen dengan profil LibreOffice sementara dan makro dinonaktifkan.

## Bila ada kendala

| Gejala | Cara memeriksa |
| --- | --- |
| Alat belum terlihat di chat | Jalankan `codex mcp get libreoffice`, periksa path server, dan buka chat baru. Jika paket dipindahkan, perbarui pendaftarannya. |
| Python atau LibreOffice tidak ditemukan | Di Linux, coba `/usr/bin/python3 -c "import uno"` dan `soffice --version`. Di Windows, periksa Python bawaan di folder `LibreOffice/program`. |
| Writer berfungsi, tetapi Base gagal | Pastikan komponen Base dan driver Firebird tertanam terpasang. Akses tabel MCP mendukung ODB Firebird tertanam. |
| File tidak terlihat atau nama hasil sudah ada | Periksa folder dari `office_status`. Letakkan file langsung di sana dan pilih nama baru untuk hasil. |
| Dokumen tidak bisa dibuka | Buka sumber di LibreOffice. Untuk sumber terenkripsi, siapkan salinan yang dapat dibuka tanpa kata sandi. |

Untuk menguji seluruh alat, jalankan `node uji.cjs`. Untuk membangun ulang setelah mengedit sumber JavaScript, jalankan `npm ci --ignore-scripts` dan `node build.cjs` dari folder `src`, lalu jalankan pengujian dari folder utama paket.
