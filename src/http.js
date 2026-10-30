"use strict";

const fs = require("fs");
const net = require("net");
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
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), interest-cohort=()",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
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

function tooLarge(req) {
  // บอกให้ปิดการเชื่อมต่อหลังตอบ 413 เพื่อไม่ต้องรับข้อมูลที่เหลือ
  req.tooLarge = true;
  return new HttpError(413, "ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป");
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"]);
    if (declared > limitBytes) {
      reject(tooLarge(req));
      return;
    }
    let size = 0;
    const chunks = [];
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limitBytes) {
        failed = true;
        chunks.length = 0;
        req.pause();
        reject(tooLarge(req));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => !failed && resolve(Buffer.concat(chunks)));
    req.on("error", (err) => !failed && reject(err));
  });
}

async function readJson(req, limitBytes = 256 * 1024) {
  const type = String(req.headers["content-type"] || "").toLowerCase();
  const hasBody =
    Number(req.headers["content-length"]) > 0 ||
    req.headers["transfer-encoding"] !== undefined;
  // รับเฉพาะ JSON (ฟอร์ม HTML และ text/plain จากเว็บอื่นจะถูกปฏิเสธ)
  if (hasBody && !/^application\/json\s*(;|$)/.test(type)) {
    req.resume();
    throw new HttpError(415, "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)");
  }
  const buf = await readBody(req, limitBytes);
  if (!buf.length) return {};
  try {
    const data = JSON.parse(buf.toString("utf8"));
    if (data === null || typeof data !== "object" || Array.isArray(data))
      throw new Error("not object");
    return data;
  } catch {
    throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}

function redirect(res, location) {
  res.writeHead(302, {
    ...SECURITY_HEADERS,
    Location: location,
    "Cache-Control": "no-store",
  });
  res.end();
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

const normalizeIp = (ip) => {
  const s = String(ip || "").trim();
  return s.startsWith("::ffff:") ? s.slice(7) : s;
};

function clientIp(req) {
  return normalizeIp(req.socket?.remoteAddress);
}

// ---------- รายการ IP / เครือข่าย ----------
// รับรายการเช่น ["loopback", "10.0.0.5", "203.0.113.0/24", "2001:db8::/32"]
// คืนฟังก์ชันตรวจว่า IP อยู่ในรายการหรือไม่ — ค่าที่ไม่ถูกต้องจะ throw พร้อมบอกค่าที่ผิด
function ipMatcher(list) {
  const bl = new net.BlockList();
  for (const raw of list || []) {
    const entry = String(raw).trim();
    if (!entry) continue;
    if (entry === "loopback") {
      bl.addSubnet("127.0.0.0", 8, "ipv4");
      bl.addAddress("::1", "ipv6");
      continue;
    }
    const [addr, bits, extra] = entry.split("/");
    const type = net.isIP(addr);
    const max = type === 6 ? 128 : 32;
    if (!type || extra !== undefined)
      throw new Error(`รูปแบบ IP ไม่ถูกต้อง: "${entry}"`);
    const family = type === 6 ? "ipv6" : "ipv4";
    if (bits === undefined) {
      bl.addAddress(addr, family);
    } else {
      const n = Number(bits);
      if (!/^\d{1,3}$/.test(bits) || n > max)
        throw new Error(`รูปแบบเครือข่ายไม่ถูกต้อง: "${entry}"`);
      bl.addSubnet(addr, n, family);
    }
  }
  return (ip) => {
    const type = net.isIP(ip);
    return type ? bl.check(ip, type === 6 ? "ipv6" : "ipv4") : false;
  };
}

// IP จริงของผู้ใช้เมื่อระบบอยู่หลัง reverse proxy (เช่น Caddy/Nginx ที่ทำ HTTPS ให้)
// เชื่อ X-Forwarded-For เฉพาะเมื่อคำขอมาจาก proxy ที่กำหนดไว้ (trusted) และอ่านจากขวาไปซ้าย
// หยุดที่ IP แรกที่ไม่ใช่ proxy — ผู้ใช้ปลอม header มาเองก็จะได้ IP จริงที่ proxy เห็น ไม่ใช่ค่าที่ปลอม
function proxyAwareIp(trusted) {
  if (!trusted) return clientIp;
  return (req) => {
    let ip = clientIp(req);
    if (!trusted(ip)) return ip;
    const hops = String(req.headers["x-forwarded-for"] || "").split(",");
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = normalizeIp(hops[i]);
      if (!net.isIP(hop)) break;
      ip = hop;
      if (!trusted(hop)) break;
    }
    return ip;
  };
}

// ---------- ตรวจชื่อโฮสต์ (กัน DNS rebinding) ----------
// เว็บภายนอกที่หลอกให้โดเมนของตนชี้มาที่ IP ภายใน จะส่ง Host เป็นโดเมนของตนเอง
// จึงรับเฉพาะ IP ตรง ๆ, localhost, ชื่อเครื่องนี้ และชื่อที่ผู้ดูแลกำหนดเพิ่ม (ALLOWED_HOSTS)
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function hostName(header) {
  const h = String(header || "")
    .trim()
    .toLowerCase();
  if (!h) return "";
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end > 0 ? h.slice(0, end + 1) : "";
  }
  return h.replace(/:\d+$/, "").replace(/\.$/, "");
}

function createHostCheck(machineName = "", extra = []) {
  const names = new Set(["localhost"]);
  const base = String(machineName || "").toLowerCase();
  if (base) {
    names.add(base);
    for (const suffix of [".local", ".lan", ".home", ".localdomain"])
      names.add(base + suffix);
  }
  const suffixes = [];
  for (const raw of extra) {
    const v = String(raw || "")
      .trim()
      .toLowerCase();
    if (!v) continue;
    if (v.startsWith("*.")) suffixes.push(v.slice(1));
    else names.add(v);
  }
  return function allowed(header) {
    const h = hostName(header);
    if (!h) return false;
    if (IPV4_RE.test(h) || h.startsWith("[")) return true;
    if (names.has(h) || h.endsWith(".localhost")) return true;
    return suffixes.some((s) => h.endsWith(s));
  };
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
  ".webp": "image/webp",
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
  // รายชื่อไฟล์จริงในโฟลเดอร์ public (ตัวพิมพ์ตรงทุกตัวอักษร) — ไม่รับชื่อแปลง เช่น ตัวพิมพ์ใหญ่/เล็กต่างกัน
  // ชื่อย่อ 8.3 หรือ ::$DATA บน Windows ซึ่งจะทำให้แคชโตไม่จำกัด
  let index = new Map();
  let indexedAt = 0;
  function buildIndex() {
    const next = new Map();
    const walk = (dir, prefix) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name.startsWith(".")) continue;
        const full = path.join(dir, ent.name);
        const url = `${prefix}/${ent.name}`;
        if (ent.isDirectory()) walk(full, url);
        else if (ent.isFile()) next.set(url, full);
      }
    };
    walk(root, "");
    index = next;
    indexedAt = Date.now();
  }
  buildIndex();
  function resolveFile(urlPath) {
    let file = index.get(urlPath);
    // ไฟล์ที่เพิ่มหลังเปิดระบบ: สร้างรายชื่อใหม่ได้ไม่เกินทุก 5 วินาที
    if (!file && Date.now() - indexedAt > 5000) {
      buildIndex();
      file = index.get(urlPath);
    }
    return file || null;
  }

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
    const filePath = resolveFile(path.posix.normalize(`/${rel}`));
    if (!filePath) return false;
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
      // html/css/js ตรวจกับเซิร์ฟเวอร์ทุกครั้ง (ได้ 304 เร็วบน LAN) เพื่อให้อัปเดตระบบมีผลทันที
      "Cache-Control": [".html", ".css", ".js", ".webmanifest"].includes(ext)
        ? "no-cache"
        : "public, max-age=86400",
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
  redirect,
  createHostCheck,
  hostName,
  ipMatcher,
  proxyAwareIp,
  parseCookies,
  clientIp,
  createStatic,
};
