const { createServer } = require("node:http");
const { createHash, timingSafeEqual } = require("node:crypto");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const maxBodyBytes = 8 * 1024 * 1024;
const digest = text => createHash("sha256").update(text).digest();

function reply(response, status, message) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify({ error: message }));
}

async function readJson(request, response) {
  const parts = [];
  let bytes = 0;
  for await (const part of request.iterator({ destroyOnReturn: false })) {
    bytes += part.length;
    if (bytes > maxBodyBytes) {
      response.setHeader("Connection", "close");
      reply(response, 413, "Permintaan melebihi 8 MiB.");
      return;
    }
    parts.push(part);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (value && typeof value === "object") return value;
  } catch { /* Return the same error as for a non-object JSON value. */ }
  reply(response, 400, "Isi permintaan harus berupa objek atau array JSON.");
}

function startHttp(createMcp) {
  const rawPort = process.env.LO_MCP_HTTP_PORT || "8765";
  if (!/^\d{1,5}$/.test(rawPort) || Number(rawPort) > 65535) {
    throw new Error("LO_MCP_HTTP_PORT harus berupa nomor port dari 0 sampai 65535.");
  }
  const token = process.env.LO_MCP_HTTP_TOKEN;
  if (!token || !/^[A-Za-z0-9._~+/-]{32,256}$/.test(token)) {
    throw new Error("Atur LO_MCP_HTTP_TOKEN ke token acak 32–256 karakter. Lihat docs/KLIEN.md.");
  }
  const expected = digest("Bearer " + token);
  const http = createServer(async (request, response) => {
    try {
      const port = http.address().port;
      const hosts = ["127.0.0.1:" + port, "localhost:" + port];
      const origin = request.headers.origin;
      if (!hosts.includes(request.headers.host) || (origin !== undefined && !hosts.some(h => origin === "http://" + h))) {
        reply(response, 403, "Host atau Origin tidak diizinkan.");
        return;
      }
      if (request.url !== "/mcp") {
        reply(response, 404, "Endpoint MCP tersedia di /mcp.");
        return;
      }
      if (!timingSafeEqual(digest(request.headers.authorization || ""), expected)) {
        response.setHeader("WWW-Authenticate", 'Bearer realm="LibreOffice MCP"');
        reply(response, 401, "Token akses MCP diperlukan.");
        return;
      }
      let body;
      if (request.method === "POST") {
        const type = (request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (type !== "application/json") {
          reply(response, 415, "Gunakan Content-Type application/json.");
          return;
        }
        if (Number(request.headers["content-length"]) > maxBodyBytes) {
          response.setHeader("Connection", "close");
          reply(response, 413, "Permintaan melebihi 8 MiB.");
          return;
        }
        body = await readJson(request, response);
        if (body === undefined || response.destroyed) return;
      }
      const mcp = createMcp();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      response.once("close", () => { mcp.close().catch(() => {}); });
      await mcp.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) reply(response, 500, "Permintaan MCP gagal diproses.");
      else if (!response.writableEnded) response.destroy();
      console.error(error.message);
    }
  });
  http.on("error", error => { console.error(error.message); process.exitCode = 1; });
  http.listen(Number(rawPort), "127.0.0.1", () => {
    console.error("LibreOffice MCP: http://127.0.0.1:" + http.address().port + "/mcp");
  });
  return http;
}

module.exports = { startHttp };
