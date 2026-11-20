const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { once } = require("node:events");
const { get } = require("node:http");
const path = require("node:path");
const readline = require("node:readline");

const serverPath = path.join(__dirname, "..", "server.cjs");

async function stdio(root) {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, LO_MCP_WORKSPACE: root },
    stdio: ["pipe", "pipe", "inherit"], windowsHide: true
  });
  const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  await once(child, "spawn");
  return {
    async send(message) {
      child.stdin.write(JSON.stringify(message) + "\n");
      if (!("id" in message)) return;
      while (true) {
        const line = await lines.next();
        assert.ok(!line.done, "Server terputus");
        const reply = JSON.parse(line.value);
        if ("id" in reply) return reply;
      }
    },
    close() { child.stdin.end(); }
  };
}

async function http(root) {
  const token = randomBytes(32).toString("hex");
  const child = spawn(process.execPath, [serverPath, "--http"], {
    env: { ...process.env, LO_MCP_WORKSPACE: root, LO_MCP_HTTP_PORT: "0", LO_MCP_HTTP_TOKEN: token },
    stdio: ["ignore", "ignore", "pipe"], windowsHide: true
  });
  const lines = readline.createInterface({ input: child.stderr });
  const startup = once(lines, "line");
  const exited = once(child, "exit").then(() => { throw new Error("Server HTTP berhenti sebelum siap."); });
  let url;
  let timer;
  try {
    const first = await Promise.race([startup, exited, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Server HTTP belum siap.")), 10000);
    })]);
    url = first[0].match(/http:\/\/127\.0\.0\.1:\d+\/mcp$/)?.[0];
    assert.ok(url, first[0]);
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  lines.on("line", line => console.error(line));
  const headers = {
    Authorization: "Bearer " + token, Accept: "application/json, text/event-stream",
    "Content-Type": "application/json", "MCP-Protocol-Version": "2025-11-25"
  };
  async function post(body, overrides) {
    return fetch(url, { method: "POST", headers: { ...headers, ...overrides }, body,
      signal: AbortSignal.timeout(95000) });
  }
  try {
    const ping = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });
    for (const [body, override, expected] of [
      [ping, { Authorization: "Bearer salah" }, 401],
      [ping, { Authorization: "" }, 401],
      [ping, { Origin: "https://example.invalid" }, 403],
      [ping, { "Content-Type": "text/plain" }, 415],
      ["{", {}, 400]
    ]) {
      const response = await post(body, override);
      assert.equal(response.status, expected, "HTTP " + expected + " expected: " + await response.text());
    }
    // Fetch can generate its own Host header. Send a raw HTTP request for this check.
    const status = await new Promise((resolve, reject) => {
      get(url, { headers: { ...headers, Host: "example.invalid" } }, response => {
        response.resume();
        resolve(response.statusCode);
      }).on("error", reject);
    });
    assert.equal(status, 403, "Host validation");
    console.log("Autentikasi dan validasi HTTP lulus.");
  } catch (error) {
    child.kill();
    throw error;
  }
  return {
    async send(message) {
      const response = await post(JSON.stringify(message));
      if (!("id" in message)) {
        assert.equal(response.status, 202);
        return;
      }
      if (!response.ok) throw new Error("HTTP " + response.status + " " + (await response.text()));
      return response.json();
    },
    close() { child.kill(); }
  };
}

module.exports = { http, stdio };
