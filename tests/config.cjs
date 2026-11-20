const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const generator = path.join(__dirname, "..", "konfigurasi.cjs");
const server = path.join(__dirname, "..", "server.cjs");
const secret = "token-uji-jangan-cetak-00000000000000000000";

function generate(...args) {
  const result = spawnSync(process.execPath, [generator, ...args], {
    encoding: "utf8", env: { ...process.env, LO_MCP_HTTP_TOKEN: secret }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes(secret), "Token harus tetap privat");
  return JSON.parse(result.stdout);
}

function getEntry(name, value) {
  if (name === "vscode") return value.servers.libreoffice;
  if (name === "opencode") return value.mcp.servers.libreoffice;
  return value.mcpServers.libreoffice;
}

const httpClients = ["vscode", "cursor", "gemini", "antigravity", "opencode", "generic"];
const specialUrlFields = { gemini: "httpUrl", antigravity: "serverUrl" };
for (const name of [...httpClients, "claude-desktop", "claude-code"]) {
  const local = getEntry(name, generate(name));
  assert.deepEqual(name === "opencode" ? local.command : [local.command, ...local.args],
    [process.execPath, server], name);
}
for (const name of httpClients) {
  const url = "http://127.0.0.1:9887/mcp";
  const remote = getEntry(name, generate(name, "http", url));
  const field = specialUrlFields[name] || "url";
  assert.equal(remote[field], url, name);
  assert.equal(["url", "httpUrl", "serverUrl"].filter(key => key in remote).length, 1, name);
  assert.match(remote.headers.Authorization, /^Bearer /);
}
const rejection = spawnSync(process.execPath, [generator, "generic", "http", "https://user@example.invalid/mcp"],
  { encoding: "utf8" });
assert.equal(rejection.status, 1);
assert.equal(rejection.stdout, "");
console.log("Delapan konfigurasi stdio dan enam konfigurasi HTTP lulus.");
