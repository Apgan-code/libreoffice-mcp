#!/bin/sh
set -eu

dir=$(CDPATH='' cd -P -- "$(dirname -- "$0")" && pwd)
node_bin=$(command -v node) || { echo "Node.js 20+ belum terpasang." >&2; exit 1; }
command -v codex >/dev/null || { echo "Codex CLI belum terpasang." >&2; exit 1; }
"$node_bin" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' ||
  { echo "Diperlukan Node.js 20 atau yang lebih baru." >&2; exit 1; }
test -r "$dir/server.cjs" && test -r "$dir/office.py" ||
  { echo "Ekstrak semua file paket sebelum mendaftarkan server." >&2; exit 1; }

servers=$(codex mcp list --json) || { echo "Daftar server Codex tidak dapat dibaca." >&2; exit 1; }
registered=$(printf '%s' "$servers" | "$node_bin" -e '
  const list = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(list.some(item => item.name === "libreoffice") ? "yes" : "no");
')
if [ "$registered" = yes ]; then
  echo "Nama libreoffice sudah terdaftar. Periksa dengan: codex mcp get libreoffice"
  exit 0
fi
set -- libreoffice
if [ -n "${LO_PROGRAM:-}" ]; then set -- "$@" --env "LO_PROGRAM=$LO_PROGRAM"; fi
if [ -n "${LO_PYTHON:-}" ]; then set -- "$@" --env "LO_PYTHON=$LO_PYTHON"; fi
if [ -n "${LO_MCP_WORKSPACE:-}" ]; then set -- "$@" --env "LO_MCP_WORKSPACE=$LO_MCP_WORKSPACE"; fi
codex mcp add "$@" -- "$node_bin" "$dir/server.cjs"
echo "Server terdaftar. Buka chat Codex baru dan minta jalankan office_status."
