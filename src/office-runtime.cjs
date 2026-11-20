const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const windows = process.platform === "win32";
const outputLimit = 8 * 1024 * 1024;

function executable(file) {
  if (!file) return false;
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch { return false; }
}

function fromPath(name) {
  return (process.env.PATH || "").split(path.delimiter).filter(path.isAbsolute)
    .map(dir => path.join(dir, name)).find(executable);
}

function findRuntime() {
  if (!windows && process.platform !== "linux") throw new Error("Server ini mendukung Windows dan Linux.");
  const sofficeName = windows ? "soffice.com" : "soffice";
  const dirs = windows
    ? [process.env.ProgramW6432, process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
        .filter(Boolean).map(root => path.join(root, "LibreOffice", "program"))
    : ["/usr/lib/libreoffice/program", "/usr/lib64/libreoffice/program", "/opt/libreoffice/program"];
  const office = process.env.LO_PROGRAM ? path.resolve(process.env.LO_PROGRAM, sofficeName)
    : [...dirs.map(dir => path.join(dir, sofficeName)), fromPath(sofficeName)].find(executable);
  if (!executable(office)) throw new Error("LibreOffice tidak ditemukan. Atur LO_PROGRAM ke folder program yang berisi " + sofficeName + ".");
  const program = path.dirname(fs.realpathSync(office));
  const candidates = process.env.LO_PYTHON ? [path.resolve(process.env.LO_PYTHON)]
    : windows ? [path.join(program, "python.exe")]
    : [path.join(program, "python"), path.join(program, "python3"), "/usr/bin/python3", fromPath("python3")];
  for (const python of new Set(candidates.filter(executable))) {
    const check = spawnSync(python, ["-s", "-c", "import sys, uno; sys.exit(sys.version_info < (3, 10))"],
      { stdio: "ignore", windowsHide: true, timeout: 5000 });
    if (check.status === 0) return { python, office };
  }
  throw new Error("Python 3.10+ dengan modul UNO tidak ditemukan. " +
    (windows ? "Periksa Python bawaan LibreOffice." : "Pada Debian/Ubuntu pasang python3-uno.") +
    " LO_PYTHON dapat diisi dengan lokasi absolut interpreter yang sesuai.");
}

function killTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (!windows) {
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (err) { if (err.code !== "ESRCH") child.kill("SIGKILL"); }
    return;
  }
  const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
    windowsHide: true, stdio: "ignore"
  });
  killer.on("error", () => child.kill());
}

function createRunner(script) {
  const workspace = path.resolve(process.env.LO_MCP_WORKSPACE || path.join(path.dirname(script), "dokumen"));
  const active = new Set();
  let runtime;
  function runOffice(op, args, signal) {
    if (signal?.aborted) throw new Error("Operasi dibatalkan.");
    if (active.size >= 3) throw new Error("Tiga operasi sedang berjalan. Coba lagi setelah salah satunya selesai.");
    runtime ??= findRuntime();
    fs.mkdirSync(workspace, { recursive: true });
    const job = fs.mkdtempSync(path.join(workspace, ".lo-mcp-"));
    return new Promise((resolve, reject) => {
      const child = spawn(runtime.python, ["-s", script], {
        windowsHide: true, detached: !windows, stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, LO_MCP_WORKSPACE: workspace, LO_MCP_SOFFICE: runtime.office, LO_MCP_JOB_DIR: job }
      });
      active.add(child);
      const chunks = [];
      let bytes = 0, stderr = "", stopped;
      function stop(message) {
        if (stopped) return;
        stopped = new Error(message);
        killTree(child);
      }
      const abort = () => stop("Operasi dibatalkan.");
      const timer = setTimeout(() => stop("Operasi melewati batas waktu 90 detik."), 90000);
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", part => {
        bytes += part.length;
        if (bytes <= outputLimit) chunks.push(part);
        else stop("Hasil terlalu besar. Baca rentang atau bagian yang lebih kecil.");
      });
      child.stderr.setEncoding("utf8").on("data", part => { stderr = (stderr + part).slice(-2000); });
      child.on("error", err => { stopped = err; });
      child.on("close", async code => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        active.delete(child);
        if (!windows && child.pid) {
          // Discard any remaining descendants in this worker's private process group.
          try { process.kill(-child.pid, "SIGKILL"); } catch (err) {
            if (err.code !== "ESRCH") console.error("Pembersihan proses:", err.message);
          }
        }
        try { await fs.promises.rm(job, { recursive: true, force: true, maxRetries: 4, retryDelay: 75 }); }
        catch (err) { console.error("Pembersihan folder sementara:", err.message); }
        if (stopped) return reject(stopped);
        if (code !== 0) return reject(new Error(stderr.trim() || "Worker LibreOffice berhenti dengan kode " + code));
        try {
          const reply = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!reply.ok) throw new Error(reply.error);
          resolve(reply.result);
        } catch (err) { reject(err); }
      });
      child.stdin.on("error", () => {}); // Exit/error from a worker is reported via close.
      child.stdin.end(JSON.stringify({ op, args }), "utf8");
    });
  }
  return { runOffice, shutdown: () => { for (const child of active) killTree(child); } };
}

module.exports = { createRunner };
