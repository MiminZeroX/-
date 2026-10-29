#!/usr/bin/env node
"use strict";

// ระบบจองห้องประชุม สำนักงานเขตบางรัก
// เริ่มระบบ:  node server.js   (หรือดับเบิลคลิก start-windows.bat)
// ตัวเลือก:   --port=3000  --host=0.0.0.0  --data=./data   (หรือใช้ตัวแปร PORT, HOST, DATA_DIR)

const http = require("http");
const path = require("path");
const { createApp, lanAddresses } = require("./src/app");

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

const port = Number(arg("port", process.env.PORT || 3000));
const host = arg("host", process.env.HOST || "0.0.0.0");
const dataDir = path.resolve(
  arg("data", process.env.DATA_DIR || path.join(__dirname, "data")),
);

const app = createApp({ dataDir, port });
const server = http.createServer((req, res) => app.handle(req, res));
server.keepAliveTimeout = 65000;

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
  app.start({ port });
  const urls = lanAddresses().map(
    (ip) => `http://${ip}${port === 80 ? "" : `:${port}`}`,
  );
  const line = "-".repeat(58);
  const out = [
    "",
    `  ${line}`,
    "   ระบบจองห้องประชุม · สำนักงานเขตบางรัก",
    `  ${line}`,
    "   ระบบพร้อมใช้งานแล้ว",
    "",
    "   เปิดจากเครื่องอื่นที่เชื่อม Wi-Fi/LAN เดียวกัน:",
    ...(urls.length
      ? urls.map((u) => `     ${u}`)
      : ["     (ไม่พบเครือข่าย — ตรวจสอบการเชื่อมต่อ Wi-Fi/LAN)"]),
    `     http://localhost${port === 80 ? "" : `:${port}`}   (บนเครื่องนี้)`,
    "",
    `   หน้าผู้ดูแลระบบ :  ${urls[0] || `http://localhost:${port}`}/admin.html`,
    `   จอแสดงผลหน้าห้อง:  ${urls[0] || `http://localhost:${port}`}/display.html`,
    `   เก็บข้อมูลที่     :  ${dataDir}`,
  ];
  if (app.firstRun) {
    out.push(
      "",
      "   ติดตั้งครั้งแรก — บัญชีผู้ดูแล:  admin / admin1234",
      "     (ระบบจะให้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก)",
    );
  }
  out.push("", "   กด Ctrl + C เพื่อหยุดระบบ", `  ${line}`, "");
  console.log(out.join("\n"));
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
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
process.on("uncaughtException", (err) => {
  console.error("[uncaught]", err);
});
