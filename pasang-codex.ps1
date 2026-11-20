$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$codex = (Get-Command codex.exe -ErrorAction Stop).Source
$server = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'server.cjs')).Path
$servers = & $codex mcp list --json
if ($LASTEXITCODE -ne 0) { throw 'Daftar server MCP tidak dapat dibaca.' }
if (($servers | ConvertFrom-Json) | Where-Object { $_.name -eq 'libreoffice' }) {
    Write-Host 'Nama libreoffice sudah terdaftar. Periksa lokasinya dengan: codex mcp get libreoffice'
    exit 0
}
& $codex mcp add libreoffice -- $node $server
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Server terdaftar. Buka chat Codex baru dan minta jalankan office_status.'
