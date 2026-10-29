"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

class HttpError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
};

function sendJson(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function sendFile(res, status, body, contentType, filename, headers = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    ...headers,
  });
  res.end(body);
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limitBytes) {
        failed = true;
        reject(new HttpError(413, "ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป"));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => !failed && resolve(Buffer.concat(chunks)));
    req.on("error", (err) => !failed && reject(err));
  });
}

async function readJson(req, limitBytes = 256 * 1024) {
  const buf = await readBody(req, limitBytes);
  if (!buf.length) return {};
  try {
    const data = JSON.parse(buf.toString("utf8"));
    if (data === null || typeof data !== "object")
      throw new Error("not object");
    return data;
  } catch {
    throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i > 0) {
        const k = part.slice(0, i).trim();
        try {
          out[k] = decodeURIComponent(part.slice(i + 1).trim());
        } catch {
          out[k] = part.slice(i + 1).trim();
        }
      }
    });
  return out;
}

function clientIp(req) {
  const ip = req.socket?.remoteAddress || "";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

// ---------- ไฟล์ static ----------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const COMPRESSIBLE = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".webmanifest",
  ".svg",
  ".txt",
]);

function createStatic(rootDir) {
  const root = path.resolve(rootDir);
  const cache = new Map(); // filePath -> { mtimeMs, size, etag, raw, gz }

  function load(filePath, stat) {
    const hit = cache.get(filePath);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size)
      return hit;
    const raw = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      etag: `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
      raw,
      gz:
        COMPRESSIBLE.has(ext) && raw.length > 1024
          ? zlib.gzipSync(raw, { level: 9 })
          : null,
    };
    cache.set(filePath, entry);
    return entry;
  }

  return function serve(req, res, urlPath) {
    let rel;
    try {
      rel = decodeURIComponent(urlPath);
    } catch {
      return false;
    }
    if (rel.includes("\0")) return false;
    const filePath = path.resolve(root, `.${path.posix.normalize(`/${rel}`)}`);
    if (!filePath.startsWith(root + path.sep)) return false;
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return false;
    }
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const entry = load(filePath, stat);
    const headers = {
      ...SECURITY_HEADERS,
      "Content-Type": MIME[ext] || "application/octet-stream",
      ETag: entry.etag,
      "Cache-Control":
        ext === ".html" ? "no-cache" : "public, max-age=300, must-revalidate",
      Vary: "Accept-Encoding",
    };
    if (req.headers["if-none-match"] === entry.etag) {
      res.writeHead(304, headers);
      res.end();
      return true;
    }
    const acceptGz = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    const body = acceptGz && entry.gz ? entry.gz : entry.raw;
    if (body === entry.gz) headers["Content-Encoding"] = "gzip";
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
    return true;
  };
}

module.exports = {
  HttpError,
  SECURITY_HEADERS,
  sendJson,
  sendFile,
  readBody,
  readJson,
  parseCookies,
  clientIp,
  createStatic,
};
