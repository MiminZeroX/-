#!/usr/bin/env node
"use strict";

// โปรแกรมตรวจสอบระบบจองห้องประชุม — ตรวจว่าเว็บทำงานปกติ และเกราะป้องกันด้านความปลอดภัยยังทำงานอยู่
// -----------------------------------------------------------------------------------------------
// ใช้กับระบบ "ของหน่วยงานเอง" หรือระบบที่ได้รับอนุญาตเป็นลายลักษณ์อักษรให้ทดสอบเท่านั้น
// ทุกข้อเป็นการทดสอบแบบไม่ทำลายข้อมูล: อ่านอย่างเดียว หรือส่งคำขอที่ระบบต้องปฏิเสธอยู่แล้ว
// (คำขอที่เปลี่ยนข้อมูลใช้ค่าที่ไม่ถูกต้องเสมอ แม้ระบบจะพังก็ไม่มีข้อมูลถูกแก้หรือถูกลบ)
//
// เปิดง่ายที่สุด: ดับเบิลคลิก  check-windows.bat (Windows)  หรือ  check-mac.command (macOS)
// เรียกเอง:     node checker/check.js --url=https://<ที่อยู่เว็บ> --yes [--deep] [--no-open]
//
//   --url=<URL>    ที่อยู่ระบบที่จะตรวจ (ถ้าไม่ใส่ จะถาม และจำค่าล่าสุดไว้ใน settings.local.json)
//   --yes          ยืนยันว่าเป็นระบบของหน่วยงาน/ได้รับอนุญาตให้ทดสอบ (ข้ามคำถามยืนยัน)
//   --deep         ทดสอบเชิงลึก: จงใจใส่รหัสผ่านผิดซ้ำเพื่อยืนยันว่าระบบล็อกจริง
//                  (IP ของเครื่องที่รันจะเข้าสู่ระบบผู้ดูแลไม่ได้ประมาณ 15 นาที และค้นหาการจองไม่ได้ 1 ชั่วโมง)
//   --no-open      ไม่ต้องเปิดรายงานในเบราว์เซอร์อัตโนมัติ
//   --report=DIR   โฟลเดอร์เก็บรายงาน (ค่าเริ่มต้น checker/reports/)
//
// ต้องมี Node.js 18 ขึ้นไป ไม่ต้องติดตั้งไลบรารีเพิ่ม · ผลลัพธ์: รายงาน .html (อ่าน/พิมพ์) และ .json
// -----------------------------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const tls = require("tls");
const { spawn } = require("child_process");

const VERSION = "1.0";
const SETTINGS_FILE = path.join(__dirname, "settings.local.json");

const PAGES = [
  "/",
  "/calendar.html",
  "/book.html",
  "/my.html",
  "/feedback.html",
  "/display.html",
  "/admin.html",
];
const ASSETS = ["/css.css", "/js.js", "/manifest.webmanifest", "/icon.svg"];
// เมนูผู้ดูแลที่ต้องเข้าสู่ระบบก่อน (อ่าน)
const ADMIN_READ = [
  "/api/admin/me",
  "/api/admin/stats",
  "/api/admin/kpi?from=2026-01-01&to=2026-01-02",
  "/api/admin/bookings",
  "/api/admin/bookings.csv",
  "/api/admin/feedback",
  "/api/admin/settings",
  "/api/admin/rooms",
  "/api/admin/users",
  "/api/admin/logs",
  "/api/admin/logs.csv",
  "/api/admin/backup",
  "/api/admin/backups",
  "/api/admin/kiosk-key",
  "/api/admin/system",
];
// คำสั่งเปลี่ยนข้อมูลของผู้ดูแล — ใส่ค่าที่ไม่ถูกต้องทุกข้อ ระบบที่ทำงานถูกต้องตอบ 401 ก่อนตรวจค่า
const ADMIN_WRITE = [
  ["PUT", "/api/admin/settings", { settings: {} }],
  ["POST", "/api/admin/users", { username: "", name: "" }],
  ["DELETE", "/api/admin/users/__checker_none__", null],
  ["DELETE", "/api/admin/rooms/__checker_none__", null],
  ["DELETE", "/api/admin/bookings/__checker_none__", null],
  ["POST", "/api/admin/bookings/bulk", { ids: [], action: "__none__" }],
  ["DELETE", "/api/admin/feedback/__checker_none__", null],
  ["DELETE", "/api/admin/logs?before=invalid", null],
  ["POST", "/api/admin/purge", { scope: "__none__" }],
  ["POST", "/api/admin/restore", {}],
  ["POST", "/api/admin/kiosk-key", { confirmPassword: "" }],
];
// ไฟล์ที่ต้องไม่ถูกเปิดเผยผ่านเว็บ (โค้ดฝั่งเซิร์ฟเวอร์ ค่าตั้ง ข้อมูล)
const SECRET_PATHS = [
  "/server.js",
  "/src/app.js",
  "/worker/index.js",
  "/package.json",
  "/wrangler.jsonc",
  "/.git/config",
  "/.env",
  "/data/db.json",
  "/../server.js",
  "/%2e%2e/server.js",
  "/public/../server.js",
  "/..%2fserver.js",
];
const REQUIRED_HEADERS = {
  "content-security-policy": /default-src 'self'/i,
  "x-content-type-options": /nosniff/i,
  "x-frame-options": /SAMEORIGIN|DENY/i,
  "referrer-policy": /./,
  "permissions-policy": /./,
};

// ---------------------------------------------------------------- ตัวเลือก
const argv = process.argv.slice(2);
function opt(name, def = "") {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
}

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const C = COLOR
  ? { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[36m", d: "\x1b[2m", h: "\x1b[1m", x: "\x1b[0m" }
  : { g: "", r: "", y: "", b: "", d: "", h: "", x: "" };

// ---------------------------------------------------------------- HTTP
function makeClient(origin, timeoutMs = 20000) {
  return async function req(method, pathname, { headers = {}, body, raw = false } = {}) {
    const t0 = Date.now();
    try {
      const res = await fetch(origin + pathname, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = raw ? "" : await res.text();
      return { ok: true, status: res.status, headers: res.headers, text, ms: Date.now() - t0, res };
    } catch (err) {
      const cause = err && err.cause ? ` (${err.cause.code || err.cause.message})` : "";
      return { ok: false, error: `${err.name === "TimeoutError" ? "หมดเวลารอ" : err.message}${cause}`, ms: Date.now() - t0 };
    }
  };
}

const json = (r) => {
  try {
    return JSON.parse(r.text);
  } catch {
    return null;
  }
};
const missingHeaders = (h) =>
  Object.entries(REQUIRED_HEADERS)
    .filter(([name, re]) => !re.test(h.get(name) || ""))
    .map(([name]) => name);
const bkkDate = (offsetDays = 0) =>
  new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);

// อ่านวันหมดอายุใบรับรอง HTTPS
function certInfo(url) {
  return new Promise((resolve) => {
    const sock = tls.connect(
      { host: url.hostname, port: Number(url.port) || 443, servername: url.hostname, timeout: 10000 },
      () => {
        const c = sock.getPeerCertificate();
        resolve({ ok: sock.authorized, error: sock.authorizationError, validTo: c && c.valid_to, issuer: c && c.issuer && (c.issuer.O || c.issuer.CN) });
        sock.end();
      },
    );
    sock.on("error", (e) => resolve({ ok: false, error: e.message }));
    sock.on("timeout", () => {
      sock.destroy();
      resolve({ ok: false, error: "หมดเวลารอ" });
    });
  });
}

// อ่านข้อความแรกของสตรีมอัปเดตสด แล้วปิด
async function firstEvent(origin, ms = 10000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(`${origin}/api/events`, { signal: ctl.signal, headers: { accept: "text/event-stream" } });
    if (res.status !== 200) return { ok: false, error: `ตอบ ${res.status}` };
    const reader = res.body.getReader();
    let text = "";
    while (!/event: \w+/.test(text)) {
      const { done, value } = await reader.read();
      if (done) break;
      text += Buffer.from(value).toString("utf8");
    }
    return { ok: /event: hello/.test(text), ms: Date.now() - t0, type: res.headers.get("content-type") || "" };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "ไม่ได้รับข้อมูลภายในเวลาที่กำหนด" : err.message };
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

// ---------------------------------------------------------------- รายการตรวจ
// group: func = การทำงานของเว็บไซต์, sec = ความปลอดภัย · sev: high/medium/low/info
// แต่ละข้อคืนค่า [สถานะ, รายละเอียด] สถานะ: pass ผ่าน · warn ควรตรวจ · fail ไม่ผ่าน · skip ข้าม
function buildChecks(ctx) {
  const { req, url, origin } = ctx;
  const https = url.protocol === "https:";
  return [
    // ===== การทำงานของเว็บไซต์ =====
    {
      id: "home",
      group: "func",
      sev: "high",
      title: "หน้าแรกเปิดได้",
      fix: "เปิดเว็บไม่ได้: ตรวจอินเทอร์เน็ตของเครื่องนี้ ที่อยู่เว็บ และหน้า Deployments ใน Cloudflare (เวอร์ชันล่าสุดสำเร็จหรือไม่)",
      async run() {
        const r = await req("GET", "/");
        if (!r.ok) return ["fail", `เชื่อมต่อไม่ได้: ${r.error}`];
        if (r.status !== 200) return ["fail", `ตอบรหัส ${r.status} (ควรเป็น 200)`];
        if (!/<title>/i.test(r.text)) return ["fail", "ได้หน้าเว็บที่ไม่ใช่ระบบจองห้องประชุม"];
        return ["pass", `ตอบ 200 ใน ${r.ms} มิลลิวินาที`];
      },
    },
    {
      id: "pages",
      group: "func",
      sev: "high",
      title: "ทุกหน้าของระบบเปิดได้",
      fix: "หน้าที่เปิดไม่ได้อาจถูกลบหรือเปลี่ยนชื่อในโฟลเดอร์ public/ — ตรวจประวัติการแก้ไขใน GitHub แล้วย้อนกลับ",
      async run() {
        const bad = [];
        for (const p of PAGES) {
          const r = await req("GET", p);
          if (!r.ok || r.status !== 200) bad.push(`${p} → ${r.ok ? r.status : r.error}`);
        }
        return bad.length ? ["fail", `เปิดไม่ได้: ${bad.join(", ")}`] : ["pass", `เปิดได้ครบ ${PAGES.length} หน้า`];
      },
    },
    {
      id: "assets",
      group: "func",
      sev: "high",
      title: "ไฟล์หน้าตาและสคริปต์ของเว็บโหลดได้",
      fix: "ไฟล์ css.css หรือ js.js หาย/เสีย หน้าเว็บจะแสดงผิดหรือกดอะไรไม่ได้ — ย้อนกลับการแก้ไขล่าสุดใน GitHub",
      async run() {
        const bad = [];
        for (const p of ASSETS) {
          const r = await req("GET", p);
          if (!r.ok || r.status !== 200 || !r.text.length) bad.push(`${p} → ${r.ok ? r.status : r.error}`);
        }
        return bad.length ? ["fail", `โหลดไม่ได้: ${bad.join(", ")}`] : ["pass", `โหลดได้ครบ ${ASSETS.length} ไฟล์`];
      },
    },
    {
      id: "config",
      group: "func",
      sev: "high",
      title: "ระบบหลังบ้าน (API) ตอบสนอง",
      fix: "API ไม่ตอบ: ดู Cloudflare › Workers › bangrak-room-booking › Logs หาข้อผิดพลาด หรือ Rollback เวอร์ชันล่าสุด",
      async run() {
        const r = await req("GET", "/api/config");
        if (!r.ok) return ["fail", `เรียกไม่ได้: ${r.error}`];
        const d = json(r);
        if (r.status !== 200 || !d || !Array.isArray(d.rooms) || !d.settings)
          return ["fail", `ข้อมูลผิดรูปแบบ (รหัส ${r.status})`];
        ctx.config = d;
        return ["pass", `ระบบ “${d.settings.siteName || "-"}” · ${d.settings.orgName || "-"}`];
      },
    },
    {
      id: "rooms",
      group: "func",
      sev: "medium",
      title: "มีห้องประชุมเปิดให้จอง และไม่ได้อยู่ในโหมดปิดปรับปรุง",
      fix: "เปิดห้องที่หน้าผู้ดูแล › ห้องประชุม (สวิตช์ “เปิดให้บริการ”) และปิดโหมดปิดปรับปรุงที่ › ตั้งค่าและฟังก์ชัน",
      async run() {
        const d = ctx.config;
        if (!d) return ["skip", "ข้าม เพราะเรียก API ไม่ได้"];
        const active = d.rooms.filter((r) => r.active);
        const names = d.rooms.map((r) => `${r.name}${r.active ? "" : " (ปิด)"}`).join(", ");
        if (!active.length) return ["fail", `ไม่มีห้องที่เปิดให้จอง: ${names || "ยังไม่มีห้อง"}`];
        if (d.settings.maintenanceMode) return ["warn", `เปิดโหมดปิดปรับปรุงอยู่ ผู้ใช้จองไม่ได้ · ห้อง: ${names}`];
        return ["pass", `เปิดให้จอง ${active.length}/${d.rooms.length} ห้อง: ${names}`];
      },
    },
    {
      id: "calendar",
      group: "func",
      sev: "high",
      title: "ตารางการจอง 7 วันข้างหน้าอ่านได้",
      fix: "ตารางอ่านไม่ได้: ดู Logs ใน Cloudflare และตรวจว่าฐานข้อมูลไม่เสีย (กู้คืนจากไฟล์สำรองถ้าจำเป็น)",
      async run() {
        const r = await req("GET", `/api/bookings?from=${bkkDate()}&to=${bkkDate(6)}`);
        if (!r.ok) return ["fail", `เรียกไม่ได้: ${r.error}`];
        const d = json(r);
        if (r.status !== 200 || !d || !Array.isArray(d.bookings)) return ["fail", `ตอบ ${r.status}`];
        ctx.bookings = d.bookings;
        return ["pass", `อ่านได้ · มีการจอง ${d.bookings.length} รายการใน 7 วันนี้`];
      },
    },
    {
      id: "live",
      group: "func",
      sev: "medium",
      title: "การอัปเดตสด (หน้าจอเปลี่ยนเองเมื่อมีคนจอง)",
      fix: "ถ้าไม่ผ่าน ผู้ใช้ต้องกดรีเฟรชเองจึงเห็นการจองใหม่ — ตรวจ Logs ใน Cloudflare หรือไฟร์วอลล์/พร็อกซีของหน่วยงานที่ตัดการเชื่อมต่อแบบต่อเนื่อง",
      async run() {
        const r = await firstEvent(origin);
        return r.ok ? ["pass", `เชื่อมต่อสำเร็จใน ${r.ms} มิลลิวินาที`] : ["warn", `เชื่อมต่อไม่สำเร็จ: ${r.error || "ไม่ได้รับข้อความต้อนรับ"}`];
      },
    },
    {
      id: "photos",
      group: "func",
      sev: "low",
      title: "รูปห้องประชุมโหลดได้",
      fix: "อัปโหลดรูปห้องใหม่ที่หน้าผู้ดูแล › ห้องประชุม › แก้ไข › รูปห้อง",
      async run() {
        const rooms = (ctx.config && ctx.config.rooms) || [];
        const withPhoto = rooms.filter((r) => r.photo);
        if (!withPhoto.length) return ["skip", "ยังไม่มีห้องที่ใส่รูป"];
        const bad = [];
        for (const room of withPhoto) {
          const r = await req("GET", room.photo, { raw: true });
          if (!r.ok || r.status !== 200 || !/^image\/(jpeg|png|webp)/.test(r.headers.get("content-type") || ""))
            bad.push(`${room.name} → ${r.ok ? r.status : r.error}`);
          if (r.ok) r.res.body?.cancel().catch(() => {});
        }
        return bad.length ? ["warn", `โหลดไม่ได้: ${bad.join(", ")}`] : ["pass", `โหลดได้ ${withPhoto.length} รูป`];
      },
    },
    {
      id: "not-found",
      group: "func",
      sev: "low",
      title: "หน้าที่ไม่มีอยู่จริงแสดงหน้า “ไม่พบหน้า” อย่างถูกต้อง",
      fix: "ตรวจไฟล์ public/404.html",
      async run() {
        const r = await req("GET", "/__checker_missing_page__");
        if (!r.ok) return ["warn", r.error];
        return r.status === 404 ? ["pass", "ตอบ 404 พร้อมหน้าแจ้งเตือน"] : ["warn", `ตอบ ${r.status} (ควรเป็น 404)`];
      },
    },
    {
      id: "speed",
      group: "func",
      sev: "medium",
      title: "ความเร็วในการตอบสนอง",
      fix: "ช้าผิดปกติ: ตรวจอินเทอร์เน็ตของเครื่องนี้ก่อน ถ้าช้าทุกเครื่อง ดู Cloudflare › Metrics (CPU time) และสถานะ cloudflarestatus.com",
      async run() {
        const times = [];
        for (let i = 0; i < 5; i++) {
          const r = await req("GET", "/api/config");
          if (!r.ok || r.status !== 200) return ["warn", `เรียกไม่สำเร็จระหว่างวัด: ${r.ok ? r.status : r.error}`];
          times.push(r.ms);
        }
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const max = Math.max(...times);
        const detail = `เฉลี่ย ${avg} มิลลิวินาที · ช้าสุด ${max} มิลลิวินาที (วัด 5 ครั้ง)`;
        return avg <= 1000 ? ["pass", detail] : avg <= 3000 ? ["warn", `ค่อนข้างช้า · ${detail}`] : ["fail", `ช้ามาก · ${detail}`];
      },
    },
    {
      id: "clock",
      group: "func",
      sev: "info",
      title: "นาฬิกาของเครื่องนี้ตรงกับเวลาของระบบ",
      fix: "ตั้งเวลาเครื่องนี้ให้ซิงก์อัตโนมัติ (Windows: Settings › Time › Sync now · macOS: System Settings › General › Date & Time) — ระบบใช้เวลาของเซิร์ฟเวอร์เสมอ",
      async run() {
        const r = await req("GET", "/api/config");
        const server = r.ok && Date.parse(r.headers.get("date") || "");
        if (!server) return ["skip", "อ่านเวลาเซิร์ฟเวอร์ไม่ได้"];
        const diff = Math.round((Date.now() - server) / 1000);
        return Math.abs(diff) <= 120 ? ["pass", `ต่างกัน ${Math.abs(diff)} วินาที`] : ["warn", `นาฬิกาเครื่องนี้${diff > 0 ? "เร็ว" : "ช้า"}กว่า ${Math.round(Math.abs(diff) / 60)} นาที`];
      },
    },

    // ===== ความปลอดภัย =====
    {
      id: "https",
      group: "sec",
      sev: "high",
      owasp: "A02 Cryptographic Failures",
      title: "ใช้การเชื่อมต่อเข้ารหัส (HTTPS)",
      fix: "บน Cloudflare เป็น HTTPS อยู่แล้ว · เครื่องในสำนักงานให้เปิดด้วย start-windows.bat --https หรือ ./start.sh --https",
      async run() {
        if (!https) return ["warn", `ใช้ ${url.protocol.replace(":", "")} ธรรมดา ข้อมูลและรหัสผ่านอาจถูกดักฟังใน Wi-Fi เดียวกัน`];
        const plain = await makeClient(`http://${url.host}`, 10000)("GET", "/");
        if (!plain.ok) return ["pass", "HTTPS · ไม่เปิดให้เข้าแบบ http ธรรมดา"];
        const loc = plain.headers.get("location") || "";
        return [301, 302, 307, 308].includes(plain.status) && loc.startsWith("https://")
          ? ["pass", "HTTPS · เข้าแบบ http จะถูกส่งต่อไป https อัตโนมัติ"]
          : ["warn", `HTTPS ใช้ได้ แต่เปิดแบบ http ได้ด้วย (ตอบ ${plain.status}) — แนะนำเปิด “Always Use HTTPS” ในโดเมน`];
      },
    },
    {
      id: "certificate",
      group: "sec",
      sev: "high",
      owasp: "A02 Cryptographic Failures",
      title: "ใบรับรอง HTTPS ถูกต้องและยังไม่หมดอายุ",
      fix: "บน Cloudflare ต่ออายุให้อัตโนมัติ · ถ้าใช้โดเมนของหน่วยงาน ตรวจ SSL/TLS ในบัญชี Cloudflare · เครื่องในสำนักงานให้สร้างใบรับรองใหม่",
      async run() {
        if (!https) return ["skip", "ไม่ได้ใช้ HTTPS"];
        const c = await certInfo(url);
        if (!c.ok) return ["fail", `ใบรับรองไม่ผ่านการตรวจ: ${c.error}`];
        const days = Math.floor((Date.parse(c.validTo) - Date.now()) / 86400000);
        const detail = `ออกโดย ${c.issuer || "-"} · หมดอายุ ${new Date(c.validTo).toLocaleDateString("th-TH", { dateStyle: "long" })} (อีก ${days} วัน)`;
        return days < 7 ? ["warn", `ใกล้หมดอายุ · ${detail}`] : ["pass", detail];
      },
    },
    {
      id: "hsts",
      group: "sec",
      sev: "medium",
      owasp: "A02 Cryptographic Failures",
      title: "บังคับให้เบราว์เซอร์ใช้ HTTPS เสมอ (HSTS)",
      fix: "อัปเดตระบบเป็นเวอร์ชันล่าสุด (worker/index.js ใส่ Strict-Transport-Security ให้ทุกคำตอบ)",
      async run() {
        if (!https) return ["skip", "ไม่ได้ใช้ HTTPS"];
        const r = await req("GET", "/");
        if (!r.ok) return ["skip", "เปิดหน้าแรกไม่ได้"];
        const v = r.headers.get("strict-transport-security") || "";
        const age = Number((/max-age=(\d+)/i.exec(v) || [])[1] || 0);
        return age >= 15552000 ? ["pass", v] : ["warn", v ? `ตั้งไว้สั้นเกินไป: ${v}` : "ไม่มี header Strict-Transport-Security"];
      },
    },
    {
      id: "headers-page",
      group: "sec",
      sev: "high",
      owasp: "A05 Security Misconfiguration",
      title: "หน้าเว็บมี header ความปลอดภัยครบ (กันสคริปต์แปลกปลอม/ฝังเว็บ)",
      fix: "ตรวจ SECURITY_HEADERS ใน src/http.js และ withSecurity ใน worker/index.js ว่าไม่ถูกแก้/ลบ",
      async run() {
        const bad = [];
        for (const p of ["/", "/admin.html", "/__checker_missing_page__"]) {
          const r = await req("GET", p);
          if (!r.ok) continue;
          const m = missingHeaders(r.headers);
          if (m.length) bad.push(`${p}: ${m.join(", ")}`);
        }
        return bad.length ? ["fail", `ขาด header: ${bad.join(" · ")}`] : ["pass", "CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy ครบ"];
      },
    },
    {
      id: "headers-api",
      group: "sec",
      sev: "high",
      owasp: "A05 Security Misconfiguration",
      title: "API มี header ความปลอดภัยและไม่ให้เก็บแคชข้อมูล",
      fix: "ตรวจ sendJson ใน src/http.js (ต้องมี Cache-Control: no-store)",
      async run() {
        const r = await req("GET", "/api/config");
        if (!r.ok) return ["skip", "เรียก API ไม่ได้"];
        const m = missingHeaders(r.headers);
        if (m.length) return ["fail", `ขาด header: ${m.join(", ")}`];
        return /no-store/i.test(r.headers.get("cache-control") || "") ? ["pass", "ครบ และตั้ง no-store"] : ["warn", "header ครบ แต่ไม่มี Cache-Control: no-store"];
      },
    },
    {
      id: "server-banner",
      group: "sec",
      sev: "low",
      owasp: "A05 Security Misconfiguration",
      title: "ไม่เปิดเผยชนิด/เวอร์ชันซอฟต์แวร์ของเซิร์ฟเวอร์",
      fix: "ลบ header Server/X-Powered-By ที่ระบุเวอร์ชันซอฟต์แวร์",
      async run() {
        const r = await req("GET", "/api/config");
        if (!r.ok) return ["skip", "เรียก API ไม่ได้"];
        const leaks = ["server", "x-powered-by"]
          .map((n) => [n, r.headers.get(n)])
          .filter(([, v]) => v && !/^cloudflare$/i.test(v));
        return leaks.length ? ["warn", `เปิดเผย: ${leaks.map(([n, v]) => `${n}: ${v}`).join(", ")}`] : ["pass", "ไม่พบข้อมูลเวอร์ชันซอฟต์แวร์"];
      },
    },
    {
      id: "config-private",
      group: "sec",
      sev: "high",
      owasp: "A01 Broken Access Control",
      title: "ข้อมูลที่ทุกคนเห็นไม่มีค่าภายในหรือรหัสลับ",
      fix: "ตรวจ PUBLIC_SETTING_KEYS ใน src/defaults.js ว่าไม่มีค่าภายในถูกเพิ่มเข้าไป",
      async run() {
        const r = await req("GET", "/api/config");
        if (!r.ok) return ["skip", "เรียก API ไม่ได้"];
        const keys = ["kioskKey", "passHash", "admins", "sessionHours", "logRetentionDays", "backupKeepDays", "tokenHashes", "feedback"];
        const leaked = keys.filter((k) => new RegExp(`"${k}"\\s*:`).test(r.text));
        return leaked.length ? ["fail", `เปิดเผยค่าภายใน: ${leaked.join(", ")}`] : ["pass", "เปิดเผยเฉพาะค่าที่หน้าเว็บต้องใช้"];
      },
    },
    {
      id: "calendar-pii",
      group: "sec",
      sev: "high",
      owasp: "A01 Broken Access Control",
      title: "ตารางสาธารณะไม่เปิดเผยข้อมูลส่วนบุคคล (PDPA)",
      fix: "ตรวจฟังก์ชัน publicView ใน src/app.js ว่าไม่ส่งเบอร์โทร อีเมล หรือรหัสการจองออกไป",
      async run() {
        const r = await req("GET", `/api/bookings?from=${bkkDate(-30)}&to=${bkkDate(30)}`);
        if (!r.ok || r.status !== 200) return ["skip", "อ่านตารางไม่ได้"];
        const keys = ["phone", "email", "tokenHashes", "createdIp", "adminNote", "code"];
        const leaked = keys.filter((k) => new RegExp(`"${k}"\\s*:`).test(r.text));
        const n = (json(r) || { bookings: [] }).bookings.length;
        return leaked.length ? ["fail", `เปิดเผย: ${leaked.join(", ")}`] : ["pass", `ตรวจ ${n} รายการ ไม่มีเบอร์โทร/อีเมล/รหัสการจอง`];
      },
    },
    {
      id: "admin-read",
      group: "sec",
      sev: "high",
      owasp: "A01 Broken Access Control",
      title: "ข้อมูลในหน้าผู้ดูแลต้องเข้าสู่ระบบก่อนทุกจุด",
      fix: "ตรวจตัวเลือก { auth: ... } ของ route ที่ไม่ผ่านใน src/app.js — ห้ามลบออก",
      async run() {
        const bad = [];
        for (const p of ADMIN_READ) {
          const r = await req("GET", p);
          if (r.ok && r.status !== 401 && r.status !== 403) bad.push(`${p} → ${r.status}`);
        }
        return bad.length ? ["fail", `อ่านได้โดยไม่เข้าสู่ระบบ: ${bad.join(", ")}`] : ["pass", `ปฏิเสธครบ ${ADMIN_READ.length} จุด (401)`];
      },
    },
    {
      id: "admin-write",
      group: "sec",
      sev: "high",
      owasp: "A01 Broken Access Control",
      title: "คำสั่งแก้ไข/ลบของผู้ดูแลใช้ไม่ได้ถ้าไม่เข้าสู่ระบบ",
      fix: "ตรวจตัวเลือก { auth: ... } ของ route ที่ไม่ผ่านใน src/app.js — ห้ามลบออก",
      async run() {
        const bad = [];
        for (const [m, p, b] of ADMIN_WRITE) {
          const r = await req(m, p, {
            headers: { "x-requested-with": "br", "content-type": "application/json" },
            body: b ? JSON.stringify(b) : undefined,
          });
          if (r.ok && r.status !== 401 && r.status !== 403) bad.push(`${m} ${p} → ${r.status}`);
        }
        return bad.length ? ["fail", `ไม่ถูกปฏิเสธ: ${bad.join(", ")}`] : ["pass", `ปฏิเสธครบ ${ADMIN_WRITE.length} คำสั่ง (ทดสอบด้วยค่าที่ไม่มีผลกับข้อมูล)`];
      },
    },
    {
      id: "csrf",
      group: "sec",
      sev: "high",
      owasp: "A01 Broken Access Control",
      title: "กันการสั่งงานแทนผู้ใช้จากเว็บอื่น (CSRF)",
      fix: "ตรวจการเช็ค header x-requested-with ใน src/app.js (ฟังก์ชัน handle)",
      async run() {
        const r = await req("POST", "/api/bookings", {
          headers: { "content-type": "application/json", origin: "https://evil.example" },
          body: "{}",
        });
        if (!r.ok) return ["skip", r.error];
        return r.status === 403 ? ["pass", "คำขอที่ไม่ได้มาจากหน้าเว็บของระบบถูกปฏิเสธ (403)"] : ["fail", `ตอบ ${r.status} (ควรเป็น 403)`];
      },
    },
    {
      id: "cors",
      group: "sec",
      sev: "medium",
      owasp: "A05 Security Misconfiguration",
      title: "เว็บไซต์อื่นอ่านข้อมูลของระบบผ่านเบราว์เซอร์ไม่ได้ (CORS)",
      fix: "ห้ามเพิ่ม Access-Control-Allow-Origin ใน src/http.js หรือ worker/index.js",
      async run() {
        const r = await req("GET", "/api/config", { headers: { origin: "https://evil.example" } });
        if (!r.ok) return ["skip", r.error];
        const v = r.headers.get("access-control-allow-origin");
        return v ? ["fail", `อนุญาตให้เว็บอื่นอ่าน: Access-Control-Allow-Origin: ${v}`] : ["pass", "ไม่อนุญาตเว็บไซต์อื่น"];
      },
    },
    {
      id: "json-only",
      group: "sec",
      sev: "medium",
      owasp: "A04 Insecure Design",
      title: "รับข้อมูลเฉพาะรูปแบบที่กำหนด (JSON)",
      fix: "ตรวจฟังก์ชัน readJson ใน src/http.js",
      async run() {
        const r = await req("POST", "/api/bookings", {
          headers: { "x-requested-with": "br", "content-type": "text/plain" },
          body: "roomId=x",
        });
        if (!r.ok) return ["skip", r.error];
        return r.status === 415 ? ["pass", "ข้อมูลรูปแบบอื่นถูกปฏิเสธ (415)"] : ["warn", `ตอบ ${r.status} (ควรเป็น 415)`];
      },
    },
    {
      id: "body-limit",
      group: "sec",
      sev: "medium",
      owasp: "A04 Insecure Design",
      title: "ปฏิเสธข้อมูลขนาดใหญ่ผิดปกติ (กันระบบล่ม)",
      fix: "ตรวจค่า limit ใน readJson (src/http.js)",
      async run() {
        const big = JSON.stringify({ title: "x".repeat(2 * 1024 * 1024) });
        const r = await req("POST", "/api/bookings", {
          headers: { "x-requested-with": "br", "content-type": "application/json" },
          body: big,
        });
        if (!r.ok) return /ECONNRESET|EPIPE|UND_ERR|socket|terminated|other side closed/i.test(r.error) ? ["pass", "ระบบตัดการเชื่อมต่อทันทีเมื่อข้อมูลใหญ่เกิน"] : ["skip", r.error];
        return r.status === 413 ? ["pass", "ข้อมูล 2 MB ถูกปฏิเสธ (413)"] : ["warn", `ตอบ ${r.status} (ควรเป็น 413)`];
      },
    },
    {
      id: "error-leak",
      group: "sec",
      sev: "medium",
      owasp: "A05 Security Misconfiguration",
      title: "ข้อความผิดพลาดไม่เปิดเผยรายละเอียดภายในของโปรแกรม",
      fix: "ตรวจการจัดการข้อผิดพลาดใน src/app.js (ต้องตอบข้อความทั่วไป ไม่ส่ง stack trace)",
      async run() {
        const r = await req("POST", "/api/bookings", {
          headers: { "x-requested-with": "br", "content-type": "application/json" },
          body: "{ not json",
        });
        if (!r.ok) return ["skip", r.error];
        const leak = /at \w+ \(|\.js:\d+|node_modules|TypeError|ReferenceError|SyntaxError: Unexpected/.test(r.text);
        if (r.status >= 500) return ["fail", `ข้อมูลเสียทำให้ระบบผิดพลาด (${r.status})`];
        return leak ? ["fail", "พบรายละเอียดภายใน (stack trace)"] : ["pass", `ตอบ ${r.status} พร้อมข้อความทั่วไป`];
      },
    },
    {
      id: "source-files",
      group: "sec",
      sev: "high",
      owasp: "A05 Security Misconfiguration",
      title: "โค้ดฝั่งเซิร์ฟเวอร์ ค่าตั้ง และไฟล์ข้อมูลเปิดผ่านเว็บไม่ได้",
      fix: "ห้ามนำไฟล์ระบบหรือโฟลเดอร์ data/ ไปไว้ใน public/ · ตรวจ assets.directory ใน wrangler.jsonc",
      async run() {
        const bad = [];
        for (const p of SECRET_PATHS) {
          const r = await req("GET", p);
          if (!r.ok) continue;
          if (r.status === 200 && !/<html/i.test(r.text.slice(0, 500))) bad.push(p);
        }
        return bad.length ? ["fail", `เปิดได้: ${bad.join(", ")}`] : ["pass", `ทดลอง ${SECRET_PATHS.length} ที่อยู่ (รวมการไต่โฟลเดอร์ ../) ไม่พบไฟล์รั่ว`];
      },
    },
    {
      id: "no-public-cookie",
      group: "sec",
      sev: "low",
      owasp: "A05 Security Misconfiguration",
      title: "หน้าและ API สาธารณะไม่ตั้งคุกกี้โดยไม่จำเป็น",
      fix: "คุกกี้ควรตั้งเฉพาะตอนผู้ดูแลเข้าสู่ระบบ",
      async run() {
        const a = await req("GET", "/");
        const b = await req("GET", "/api/config");
        const set = [a, b].filter((r) => r.ok && r.headers.get("set-cookie"));
        return set.length ? ["warn", "พบการตั้งคุกกี้ในหน้า/API สาธารณะ"] : ["pass", "ไม่ตั้งคุกกี้"];
      },
    },
    {
      id: "input-validation",
      group: "sec",
      sev: "medium",
      owasp: "A03 Injection",
      title: "ตรวจข้อมูลที่ผู้ใช้ส่งมาก่อนบันทึก",
      fix: "ตรวจ route /api/feedback และ /api/bookings ใน src/app.js",
      async run() {
        const h = { "x-requested-with": "br", "content-type": "application/json" };
        const tries = [
          ["/api/feedback", { type: "<script>", message: "ทดสอบจากโปรแกรมตรวจสอบระบบ" }],
          ["/api/bookings", { roomId: "../../etc", date: "2026-13-45", start: "25:00", end: "99:99" }],
          ["/api/lookup", { code: { $ne: "" }, phone: ["0"] }],
        ];
        const bad = [];
        for (const [p, b] of tries) {
          const r = await req("POST", p, { headers: h, body: JSON.stringify(b) });
          if (r.ok && (r.status < 400 || r.status >= 500)) bad.push(`${p} → ${r.status}`);
        }
        return bad.length ? ["fail", `รับข้อมูลผิดรูปแบบ: ${bad.join(", ")}`] : ["pass", "ข้อมูลผิดรูปแบบ/ค่าอันตรายถูกปฏิเสธทุกกรณี (ไม่มีอะไรถูกบันทึก)"];
      },
    },
    {
      id: "login-lockout",
      group: "sec",
      sev: "high",
      owasp: "A07 Identification & Authentication Failures",
      deep: true,
      title: "พักการเข้าสู่ระบบเมื่อเดารหัสผ่านผิดซ้ำ (กันการสุ่มรหัส)",
      fix: "ตรวจ limits.login และ limits.loginUser ใน src/app.js",
      async run() {
        // ใช้ชื่อผู้ใช้ที่ไม่มีจริง จึงไม่กระทบบัญชีจริง แต่ IP เครื่องนี้จะถูกพักประมาณ 15 นาที
        const user = `checker-${Date.now()}`;
        for (let i = 1; i <= 14; i++) {
          const r = await req("POST", "/api/admin/login", {
            headers: { "x-requested-with": "br", "content-type": "application/json" },
            body: JSON.stringify({ username: user, password: `wrong-password-${i}` }),
          });
          if (!r.ok) return ["skip", r.error];
          if (r.status === 429)
            return ["pass", i === 1 ? "IP นี้ถูกพักอยู่แล้วจากการทดสอบก่อนหน้า (ระบบล็อกทำงาน)" : `ถูกพักหลังใส่รหัสผิด ${i} ครั้ง (429)`];
        }
        return ["warn", "ใส่รหัสผิด 14 ครั้งยังไม่ถูกพัก — ถ้ารันจาก IP สำนักงานที่ตั้งไว้ใน OFFICE_IPS ระบบผ่อนเพดานให้ ลองรันจากเน็ตมือถือ"];
      },
    },
    {
      id: "lookup-throttle",
      group: "sec",
      sev: "medium",
      owasp: "A07 Identification & Authentication Failures",
      deep: true,
      title: "จำกัดการค้นหาการจองซ้ำ ๆ (กันการไล่เดารหัสการจอง)",
      fix: "ตรวจ limits.lookup ใน src/app.js",
      async run() {
        for (let i = 1; i <= 26; i++) {
          const r = await req("POST", "/api/lookup", {
            headers: { "x-requested-with": "br", "content-type": "application/json" },
            body: JSON.stringify({ code: `ZZ${String(i).padStart(4, "0")}-CHK`, phone: "0000000000" }),
          });
          if (!r.ok) return ["skip", r.error];
          if (r.status === 429)
            return ["pass", i === 1 ? "IP นี้ถูกจำกัดอยู่แล้วจากการทดสอบก่อนหน้า (การจำกัดทำงาน)" : `ถูกจำกัดหลังค้นหา ${i} ครั้ง (429)`];
        }
        return ["warn", "ค้นหา 26 ครั้งยังไม่ถูกจำกัด (IP สำนักงานได้รับการผ่อนเพดาน)"];
      },
    },
  ];
}

// ---------------------------------------------------------------- รัน
async function runChecks({ target, deep = false, onResult = () => {} }) {
  const url = new URL(target);
  const origin = url.origin;
  const ctx = { url, origin, req: makeClient(origin) };
  const results = [];
  const started = Date.now();
  for (const check of buildChecks(ctx)) {
    let status;
    let detail;
    if (check.deep && !deep) [status, detail] = ["skip", "ข้าม (ทดสอบเฉพาะโหมดเชิงลึก)"];
    else {
      try {
        [status, detail] = await check.run();
      } catch (err) {
        [status, detail] = ["warn", `ทดสอบไม่สำเร็จ: ${err.message}`];
      }
    }
    const { run, ...meta } = check;
    const item = { ...meta, status, detail };
    results.push(item);
    onResult(item);
    // ถ้าเปิดเว็บไม่ได้เลย ข้อที่เหลือไม่มีความหมาย
    if (check.id === "home" && status === "fail") break;
  }
  const counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
  results.forEach((r) => counts[r.status]++);
  return {
    tool: `โปรแกรมตรวจสอบระบบจองห้องประชุม ${VERSION}`,
    target: origin,
    at: new Date(started).toISOString(),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    deep,
    counts,
    siteName: ctx.config ? ctx.config.settings.siteName : "",
    orgName: ctx.config ? ctx.config.settings.orgName : "",
    results,
  };
}

// ---------------------------------------------------------------- รายงาน HTML
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LABEL = { pass: "ผ่าน", warn: "ควรตรวจ", fail: "ไม่ผ่าน", skip: "ข้าม" };
const SEV = { high: "สูง", medium: "กลาง", low: "ต่ำ", info: "ข้อมูล" };

function reportHtml(rep) {
  const when = new Date(rep.at).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "medium" });
  const verdict = rep.counts.fail
    ? ["bad", "พบจุดที่ไม่ผ่าน ต้องแก้ไขโดยเร็ว"]
    : rep.counts.warn
      ? ["warn", "ใช้งานได้ มีบางจุดที่ควรตรวจสอบ"]
      : ["ok", "ระบบทำงานปกติและผ่านการตรวจความปลอดภัยทุกข้อ"];
  const section = (group, title) => {
    const rows = rep.results.filter((r) => r.group === group);
    return `<h2>${title}</h2><table><thead><tr><th>ผล</th><th>รายการตรวจ</th><th>รายละเอียด</th><th>ระดับ</th></tr></thead><tbody>${rows
      .map(
        (r) => `<tr class="${r.status}"><td><span class="tag ${r.status}">${LABEL[r.status]}</span></td><td><b>${esc(r.title)}</b>${r.owasp ? `<small>${esc(r.owasp)}</small>` : ""}<small class="id">${esc(r.id)}</small></td><td>${esc(r.detail)}${r.status === "fail" || r.status === "warn" ? `<div class="fix">แนวทางแก้ไข: ${esc(r.fix)}</div>` : ""}</td><td>${SEV[r.sev] || ""}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  };
  const todo = rep.results.filter((r) => r.status === "fail" || r.status === "warn");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>รายงานตรวจสอบระบบ ${esc(rep.target)}</title>
<style>
:root{--ok:#1f7a4d;--okb:#e5f4ec;--warn:#9a5b00;--warnb:#fff3dc;--bad:#b42318;--badb:#fde8e6;--mut:#5d6b7a;--line:#dfe5ec}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 "Sarabun","Tahoma","Leelawadee UI","Thonburi",sans-serif;color:#17202a;background:#f4f6f8}
main{max-width:1000px;margin:0 auto;padding:28px 18px 60px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:30px 0 10px}
.meta{color:var(--mut);margin:0 0 18px}.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.verdict{display:flex;gap:14px;align-items:center;font-weight:700;font-size:17px}.verdict.ok{background:var(--okb);color:var(--ok)}.verdict.warn{background:var(--warnb);color:var(--warn)}.verdict.bad{background:var(--badb);color:var(--bad)}
.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.nums div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px}.nums b{display:block;font-size:26px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{text-align:left;vertical-align:top;padding:9px 12px;border-top:1px solid var(--line)}th{background:#eef2f6;font-size:13px;border-top:0}
td small{display:block;color:var(--mut);font-size:12px}td small.id{font-family:ui-monospace,Consolas,monospace}.tag{display:inline-block;padding:2px 10px;border-radius:99px;font-size:13px;font-weight:700;white-space:nowrap}
.tag.pass{background:var(--okb);color:var(--ok)}.tag.warn{background:var(--warnb);color:var(--warn)}.tag.fail{background:var(--badb);color:var(--bad)}.tag.skip{background:#eef2f6;color:var(--mut)}
.fix{margin-top:6px;padding:6px 10px;border-left:3px solid currentColor;background:#fafbfc;font-size:14px}tr.fail .fix{color:var(--bad)}tr.warn .fix{color:var(--warn)}
ol li{margin:4px 0}.note{color:var(--mut);font-size:13px;margin-top:26px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px}.sign div{border-top:1px dotted #8896a5;padding-top:6px;text-align:center;color:var(--mut)}
@media print{body{background:#fff}main{padding:0}.card,table{break-inside:avoid}tr{break-inside:avoid}}
@media (max-width:640px){.nums{grid-template-columns:repeat(2,1fr)}td:nth-child(4),th:nth-child(4){display:none}}
</style></head><body><main>
<h1>รายงานการตรวจสอบระบบจองห้องประชุม</h1>
<p class="meta">${esc(rep.orgName || "")} ${rep.siteName ? `· ${esc(rep.siteName)}` : ""}<br>ที่อยู่ที่ตรวจ <b>${esc(rep.target)}</b> · ${esc(when)} · ใช้เวลา ${rep.seconds} วินาที · โหมด${rep.deep ? "เชิงลึก (รวมทดสอบการล็อก)" : "ปกติ (ไม่ทำลายข้อมูล)"}</p>
<div class="card verdict ${verdict[0]}">${esc(verdict[1])}</div>
<div class="nums"><div><b style="color:var(--ok)">${rep.counts.pass}</b>ผ่าน</div><div><b style="color:var(--warn)">${rep.counts.warn}</b>ควรตรวจ</div><div><b style="color:var(--bad)">${rep.counts.fail}</b>ไม่ผ่าน</div><div><b style="color:var(--mut)">${rep.counts.skip}</b>ข้าม</div></div>
${todo.length ? `<h2>สิ่งที่ควรทำต่อ</h2><div class="card"><ol>${todo.map((r) => `<li><b>${esc(r.title)}</b> — ${esc(r.fix)}</li>`).join("")}</ol></div>` : ""}
${section("func", "1. การทำงานของเว็บไซต์")}
${section("sec", "2. ความปลอดภัย")}
<p class="note">รายงานนี้เป็นการตรวจอัตโนมัติเบื้องต้นแบบไม่ทำลายข้อมูล ยืนยันว่าเกราะป้องกันหลักของระบบยังทำงาน ไม่ใช่การรับรองว่าไม่มีช่องโหว่ใด ๆ และไม่ทดแทนการทดสอบเจาะระบบโดยผู้เชี่ยวชาญ · ${esc(rep.tool)} · ข้อที่ “ข้าม” คือข้อที่ไม่เกี่ยวกับระบบนี้หรือไม่ได้เลือกทดสอบ</p>
<div class="sign"><div>ผู้ตรวจสอบ ............................................ วันที่ ..............</div><div>ผู้รับทราบ ............................................ วันที่ ..............</div></div>
</main></body></html>`;
}

function saveReport(rep, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date(Date.parse(rep.at) + 7 * 3600000).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const host = new URL(rep.target).host.replace(/[^a-z0-9.-]/gi, "_");
  const base = path.join(dir, `report-${host}-${stamp}`);
  fs.writeFileSync(`${base}.html`, reportHtml(rep));
  fs.writeFileSync(`${base}.json`, JSON.stringify(rep, null, 2));
  return base;
}

function openFile(file) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", file]]
      : process.platform === "darwin"
        ? ["open", [file]]
        : ["xdg-open", [file]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  } catch {
    /* เปิดเองจากโฟลเดอร์รายงาน */
  }
}

// ---------------------------------------------------------------- หน้าจอคำสั่ง
function ask(rl, q) {
  return new Promise((res) => rl.question(q, (a) => res(a.trim())));
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function normalizeUrl(s) {
  let v = String(s || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  const u = new URL(v);
  return u.origin;
}

async function main() {
  const interactive = process.stdin.isTTY && !opt("yes", false);
  const saved = readSettings();
  let target = opt("url", process.env.CHECK_URL || "");
  let deep = !!opt("deep", false);
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  console.log(`\n${C.h}${C.b}  โปรแกรมตรวจสอบระบบจองห้องประชุม ${VERSION}${C.x}`);
  console.log(`${C.d}  ตรวจการทำงานของเว็บไซต์ และเกราะป้องกันด้านความปลอดภัย (ไม่แก้ไขหรือลบข้อมูล)${C.x}\n`);

  try {
    if (!target && rl) {
      const def = saved.url ? ` [Enter = ${saved.url}]` : "";
      target = (await ask(rl, `  ที่อยู่เว็บที่จะตรวจ${def}: `)) || saved.url || "";
    }
    try {
      target = normalizeUrl(target);
    } catch {
      target = "";
    }
    if (!target) {
      console.error(`${C.r}  ยังไม่ได้ระบุที่อยู่เว็บ เช่น https://bangrak-room-booking.<บัญชี>.workers.dev${C.x}`);
      process.exitCode = 2;
      return;
    }
    console.log(`  เป้าหมาย: ${C.b}${target}${C.x}`);
    if (rl) {
      console.log(
        `${C.y}  ใช้ตรวจระบบของหน่วยงานเอง หรือระบบที่ได้รับอนุญาตเป็นลายลักษณ์อักษรเท่านั้น\n` +
          `  การทดสอบระบบของผู้อื่นโดยไม่ได้รับอนุญาตเป็นความผิดตาม พ.ร.บ.คอมพิวเตอร์ฯ${C.x}`,
      );
      if (!/^(y|yes|ใช่)$/i.test(await ask(rl, "  ยืนยันว่าได้รับอนุญาตให้ตรวจระบบนี้ (พิมพ์ y แล้วกด Enter): "))) {
        console.log("  ยกเลิกการตรวจ");
        return;
      }
      if (!deep)
        deep = /^(y|yes|ใช่)$/i.test(
          await ask(
            rl,
            `  ทดสอบเชิงลึกด้วยไหม? (จงใจใส่รหัสผิดเพื่อยืนยันการล็อก — เครื่องนี้จะเข้าหน้าผู้ดูแลไม่ได้ ~15 นาที) [y/N]: `,
          ),
        );
    }
    if (target !== saved.url) {
      try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ url: target }, null, 2));
      } catch {
        /* โฟลเดอร์อ่านอย่างเดียว: ไม่ต้องจำ */
      }
    }

    console.log(`\n  กำลังตรวจ… (ประมาณ 30–60 วินาที)\n`);
    let lastGroup = "";
    const tags = { pass: `${C.g}ผ่าน    ${C.x}`, warn: `${C.y}ควรตรวจ ${C.x}`, fail: `${C.r}ไม่ผ่าน  ${C.x}`, skip: `${C.d}ข้าม    ${C.x}` };
    const rep = await runChecks({
      target,
      deep,
      onResult(r) {
        if (r.group !== lastGroup) {
          lastGroup = r.group;
          console.log(`  ${C.h}${r.group === "func" ? "การทำงานของเว็บไซต์" : "ความปลอดภัย"}${C.x}`);
        }
        console.log(`   ${tags[r.status]} ${r.title}\n            ${C.d}${r.detail}${C.x}`);
      },
    });
    const base = saveReport(rep, path.resolve(String(opt("report", path.join(__dirname, "reports")))));
    const c = rep.counts;
    console.log(
      `\n  ${C.h}สรุป:${C.x} ${C.g}ผ่าน ${c.pass}${C.x} · ${C.y}ควรตรวจ ${c.warn}${C.x} · ${C.r}ไม่ผ่าน ${c.fail}${C.x} · ข้าม ${c.skip}`,
    );
    console.log(`  รายงาน: ${C.b}${base}.html${C.x}\n`);
    if (!opt("no-open", false)) openFile(`${base}.html`);
    process.exitCode = c.fail ? 1 : 0;
  } finally {
    if (rl) rl.close();
  }
}

if (require.main === module) {
  if (Number(process.versions.node.split(".")[0]) < 18) {
    console.error("ต้องใช้ Node.js เวอร์ชัน 18 ขึ้นไป — ดาวน์โหลดที่ https://nodejs.org");
    process.exit(1);
  }
  main().catch((err) => {
    console.error(`${C.r}เกิดข้อผิดพลาด: ${err.message}${C.x}`);
    process.exitCode = 1;
  });
}

module.exports = { runChecks, reportHtml };
