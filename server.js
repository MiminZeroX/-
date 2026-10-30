#!/usr/bin/env node
"use strict";

// ระบบจองห้องประชุม สำนักงานเขตบางรัก
// เริ่มระบบ:  node server.js   (หรือดับเบิลคลิก start-windows.bat)
// ตัวเลือก:   --port=3000  --host=0.0.0.0  --data=./data   (หรือใช้ตัวแปร PORT, HOST, DATA_DIR)
//            --allowed-hosts=booking.bangrak.local,*.example.lan   (ชื่อโดเมนภายในที่ใช้เปิดระบบ
//            นอกเหนือจาก IP และชื่อเครื่อง หรือใช้ตัวแปร ALLOWED_HOSTS)
//            --tls-cert=cert.pem --tls-key=key.pem   (เปิด HTTPS ด้วยใบรับรองของหน่วยงาน/mkcert
//            หรือใช้ตัวแปร TLS_CERT, TLS_KEY — แนะนำเมื่อใช้ Wi-Fi ร่วมกับผู้มาติดต่อ)
// รันบนคลาวด์ (ดู deploy/README.md):
//            --public-url=https://booking.example.go.th   (ที่อยู่ที่ผู้ใช้เปิด ใช้ทำลิงก์/QR — PUBLIC_URL)
//            --trust-proxy=loopback   (เชื่อ IP จริงที่ proxy ด้านหน้า เช่น Caddy ส่งมา — TRUST_PROXY)
//            --office-ips=203.0.113.10   (IP สาธารณะของสำนักงานที่ทุกคนใช้ร่วมกัน — OFFICE_IPS)

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { createApp, lanAddresses } = require("./src/app");
const { ipMatcher } = require("./src/http");

const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error(
    `ต้องใช้ Node.js เวอร์ชัน 18 ขึ้นไป (เครื่องนี้เป็น ${process.version}) — ดาวน์โหลดได้ที่ https://nodejs.org`,
  );
  process.exit(1);
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

// ตัวเลือกที่ไม่รู้จักจะถูกข้ามไป — แจ้งไว้ ไม่ให้เข้าใจผิดว่าเปิดใช้แล้ว
const KNOWN_OPTIONS = [
  "port",
  "host",
  "data",
  "allowed-hosts",
  "tls-cert",
  "tls-key",
  "public-url",
  "trust-proxy",
  "office-ips",
];
for (const a of process.argv.slice(2)) {
  const name = (/^--([^=]+)/.exec(a) || [])[1];
  if (!KNOWN_OPTIONS.includes(name))
    console.warn(
      `\n  ไม่รู้จักตัวเลือก "${a}" — ข้ามไป` +
        (name === "https"
          ? "\n  เปิด HTTPS ด้วย  ./start.sh --https  (macOS/Linux) หรือ  start-windows.bat --https  (Windows)"
          : ""),
    );
}

const port = Number(arg("port", process.env.PORT || 3000));
const host = arg("host", process.env.HOST || "0.0.0.0");
const dataDir = path.resolve(
  arg("data", process.env.DATA_DIR || path.join(__dirname, "data")),
);

const allowedHosts = String(
  arg("allowed-hosts", process.env.ALLOWED_HOSTS || ""),
)
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const list = (name, env) =>
  String(arg(name, process.env[env] || ""))
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const trustProxy = list("trust-proxy", "TRUST_PROXY");
const officeIps = list("office-ips", "OFFICE_IPS");
let publicUrl = String(arg("public-url", process.env.PUBLIC_URL || "")).trim();
try {
  ipMatcher(trustProxy);
  ipMatcher(officeIps);
  if (publicUrl) {
    const u = new URL(publicUrl);
    if (!/^https?:$/.test(u.protocol) || u.pathname !== "/" || u.search)
      throw new Error("ต้องเป็นที่อยู่เว็บแบบ https://ชื่อโดเมน (ไม่มี path)");
    publicUrl = u.origin;
  }
} catch (err) {
  console.error(`\n  ตัวเลือกไม่ถูกต้อง: ${err.message}\n`);
  process.exit(1);
}

const tlsCert = arg("tls-cert", process.env.TLS_CERT || "");
const tlsKey = arg("tls-key", process.env.TLS_KEY || "");
let tls = null;
if (tlsCert || tlsKey) {
  try {
    tls = { cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) };
  } catch (err) {
    console.error(`\n  อ่านไฟล์ใบรับรอง HTTPS ไม่สำเร็จ: ${err.message}\n`);
    process.exit(1);
  }
}
const scheme = tls ? "https" : "http";

// ไฟล์ server.pid บอกสคริปต์อื่น (เช่น reset-admin) ว่าระบบกำลังทำงานอยู่
const pidFile = path.join(dataDir, "server.pid");

const app = createApp({
  dataDir,
  port,
  allowedHosts,
  secure: !!tls,
  publicUrl,
  trustProxy,
  officeIps,
});
const handler = (req, res) => app.handle(req, res);
const server = tls
  ? https.createServer({ ...tls, minVersion: "TLSv1.2" }, handler)
  : http.createServer(handler);
server.keepAliveTimeout = 65000;
// กันการเปิดการเชื่อมต่อค้างไว้เพื่อให้เซิร์ฟเวอร์เต็ม (slowloris)
server.headersTimeout = 20000;
server.requestTimeout = 120000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n  พอร์ต ${port} ถูกใช้งานอยู่แล้ว — ลองเปลี่ยนพอร์ต เช่น  node server.js --port=${port + 1}\n`,
    );
  } else if (err.code === "EACCES") {
    console.error(
      `\n  ไม่มีสิทธิ์เปิดพอร์ต ${port} — ลองใช้พอร์ตอื่น เช่น  node server.js --port=8080\n`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  app.start({ port, scheme });
  try {
    fs.writeFileSync(pidFile, String(process.pid));
  } catch {
    /* ไม่สำคัญ */
  }
  const urls = publicUrl
    ? [publicUrl]
    : lanAddresses().map(
        (ip) =>
          `${scheme}://${ip}${port === (tls ? 443 : 80) ? "" : `:${port}`}`,
      );
  const line = "-".repeat(58);
  const out = [
    "",
    `  ${line}`,
    "   ระบบจองห้องประชุม · สำนักงานเขตบางรัก",
    `  ${line}`,
    "   ระบบพร้อมใช้งานแล้ว",
    "",
    publicUrl
      ? "   เปิดใช้งานได้จากทุกที่ที่:"
      : "   เปิดจากเครื่องอื่นที่เชื่อม Wi-Fi/LAN เดียวกัน:",
    ...(urls.length
      ? urls.map((u) => `     ${u}`)
      : ["     (ไม่พบเครือข่าย — ตรวจสอบการเชื่อมต่อ Wi-Fi/LAN)"]),
    `     ${scheme}://localhost${port === (tls ? 443 : 80) ? "" : `:${port}`}   (บนเครื่องนี้)`,
    "",
    `   หน้าผู้ดูแลระบบ :  ${urls[0] || `${scheme}://localhost:${port}`}/admin.html`,
    `   จอแสดงผลหน้าห้อง:  ${urls[0] || `${scheme}://localhost:${port}`}/display.html`,
    `   เก็บข้อมูลที่     :  ${dataDir}`,
  ];
  if (app.firstRun && app.initialPassword) {
    out.push(
      "",
      "   ติดตั้งครั้งแรก — บัญชีผู้ดูแลเริ่มต้น",
      `     ชื่อผู้ใช้:  admin`,
      `     รหัสผ่าน:  ${app.initialPassword}`,
      `     (บันทึกไว้ที่ ${path.join(dataDir, "initial-admin-password.txt")} ด้วย`,
      "      ระบบจะให้ตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก แล้วลบไฟล์นี้ให้อัตโนมัติ)",
    );
  }
  if (publicUrl && trustProxy.length)
    out.push(
      "",
      `   รับ IP จริงของผู้ใช้จาก proxy: ${trustProxy.join(", ")}`,
      officeIps.length
        ? `   IP สำนักงาน (ผ่อนเพดานการใช้งาน): ${officeIps.join(", ")}`
        : "   ยังไม่ได้กำหนด IP สำนักงาน (--office-ips) — ดูได้ในหน้าผู้ดูแล › การเชื่อมต่อ",
    );
  if (!tls && !publicUrl.startsWith("https:"))
    out.push(
      "",
      "   หมายเหตุ: ใช้ HTTP ธรรมดา — หาก Wi-Fi นี้ใช้ร่วมกับผู้มาติดต่อ แนะนำให้เปิด HTTPS",
      "   (ดูวิธีใน README หัวข้อ “เปิดใช้ HTTPS”)",
    );
  out.push("", "   กด Ctrl + C เพื่อหยุดระบบ", `  ${line}`, "");
  console.log(out.join("\n"));
});

function removePid() {
  try {
    if (fs.readFileSync(pidFile, "utf8") === String(process.pid))
      fs.unlinkSync(pidFile);
  } catch {
    /* ไม่มีไฟล์ */
  }
}

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  removePid();
  console.log("\n  กำลังบันทึกข้อมูลและปิดระบบ...");
  try {
    app.stop();
  } catch (err) {
    console.error(err);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// ข้อผิดพลาดที่ไม่ได้ดักไว้: บันทึก แล้วปิดระบบให้สคริปต์เริ่มระบบเปิดใหม่ในสถานะที่สะอาด
process.on("uncaughtException", (err) => {
  console.error("[uncaught]", err);
  try {
    app.store.addLog({
      level: "error",
      action: "system.crash",
      detail: `ระบบหยุดเพราะข้อผิดพลาด: ${String(err && err.message).slice(0, 300)}`,
      actor: "ระบบ",
    });
    app.stop();
  } catch {
    /* บันทึกไม่ได้ */
  }
  removePid();
  process.exit(1);
});
