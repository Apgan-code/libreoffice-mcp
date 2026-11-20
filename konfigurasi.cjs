// Cetak konfigurasi siap disalin. File pengaturan aplikasi tetap dikelola pengguna.
const path = require("node:path");

const clients = ["vscode", "cursor", "gemini", "opencode", "claude-desktop", "claude-code", "generic"];
const urlClients = ["vscode", "cursor", "gemini", "opencode", "generic"];
const [client, mode = "stdio", endpoint = "http://127.0.0.1:8765/mcp", ...extra] = process.argv.slice(2);
const usage = "node konfigurasi.cjs <" + clients.join("|") + "> [stdio|http] [URL]";
if (!client || client === "--help") {
  console.log(usage);
  process.exit(0);
}
if (!clients.includes(client) || !["stdio", "http"].includes(mode) || extra.length ||
    (mode === "stdio" && process.argv.length > 4) || (mode === "http" && !urlClients.includes(client))) {
  console.error(usage);
  process.exit(1);
}
const name = "libreoffice";
const args = [path.join(__dirname, "server.cjs")];
const local = { command: process.execPath, args };
const authorization = "Bearer GANTI_DENGAN_TOKEN_LOKAL";
let config;
if (mode === "stdio") {
  if (client === "vscode") config = { servers: { [name]: { type: "stdio", ...local } } };
  else if (client === "opencode") config = { mcp: { servers: { [name]: { type: "local", command: [local.command, ...args] } } } };
  else config = { mcpServers: { [name]: local } };
} else {
  let url;
  try { url = new URL(endpoint); } catch { /* Report URL error below. */ }
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    console.error("Masukkan URL HTTP/HTTPS tanpa kredensial.");
    process.exit(1);
  }
  if (client === "vscode") {
    config = {
      inputs: [{ id: "libreoffice-token", type: "promptString", description: "Token LibreOffice MCP", password: true }],
      servers: { [name]: { type: "http", url: endpoint, headers: { Authorization: "Bearer ${input:libreoffice-token}" } } }
    };
  } else if (client === "opencode") {
    config = { mcp: { servers: { [name]: { type: "remote", url: endpoint, oauth: false,
      headers: { Authorization: "Bearer {env:LO_MCP_HTTP_TOKEN}" } } } } };
  } else {
    const headers = { Authorization: client === "cursor" ? "Bearer ${env:LO_MCP_HTTP_TOKEN}" : authorization };
    config = { mcpServers: { [name]: { [client === "gemini" ? "httpUrl" : "url"]: endpoint, headers } } };
  }
}
console.log(JSON.stringify(config, null, 2));
