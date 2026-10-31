#!/usr/bin/env node
"use strict";

// สร้างใบรับรอง HTTPS สำหรับเครื่องแม่ข่ายในสำนักงานด้วย mkcert (ใช้โดย start.sh / start-windows.bat --https)
// ใบรับรองครอบคลุม localhost, ชื่อเครื่อง และ IP ทุกวงของเครื่องนี้ — สร้างใหม่อัตโนมัติเมื่อ IP เปลี่ยน
// พิมพ์โฟลเดอร์ใบรับรองออกทาง stdout (ข้อความอื่นออกทาง stderr)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { lanAddresses } = require("../src/app");

const say = (...lines) => console.error(lines.join("\n"));

const arg = process.argv.find((a) => a.startsWith("--data="));
const dataDir = path.resolve(
  arg
    ? arg.slice(7)
    : process.env.DATA_DIR || path.join(__dirname, "..", "data"),
);
const certDir = path.join(dataDir, "certs");
const certFile = path.join(certDir, "cert.pem");
const keyFile = path.join(certDir, "key.pem");
const namesFile = path.join(certDir, "names.txt");

const names = [
  ...new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    os.hostname(),
    ...lanAddresses(),
  ]),
];

let current = "";
try {
  current = fs.readFileSync(namesFile, "utf8");
} catch {
  /* ยังไม่เคยสร้าง */
}
if (
  fs.existsSync(certFile) &&
  fs.existsSync(keyFile) &&
  current === names.join("\n")
) {
  process.stdout.write(certDir);
  process.exit(0);
}

const mkcert = (args) =>
  spawnSync("mkcert", args, { stdio: ["inherit", process.stderr, "inherit"] });

if (spawnSync("mkcert", ["-CAROOT"], { stdio: "ignore" }).error) {
  const how = {
    darwin: [
      "  brew install mkcert",
      "  (ยังไม่มี Homebrew: ติดตั้งจาก https://brew.sh ก่อน)",
    ],
    win32: [
      "  winget install FiloSottile.mkcert",
      "  (หรือ  choco install mkcert)",
    ],
  }[process.platform] || [
    "  sudo apt install mkcert libnss3-tools",
    "  (หรือดาวน์โหลดจาก https://github.com/FiloSottile/mkcert/releases)",
  ];
  say(
    "",
    "  เปิด HTTPS ไม่ได้: ไม่พบโปรแกรม mkcert (ใช้สร้างใบรับรองที่เบราว์เซอร์เชื่อถือ)",
    "  ติดตั้งด้วยคำสั่ง",
    ...how,
    "  แล้วเปิดระบบด้วย --https อีกครั้ง",
    "",
  );
  process.exit(1);
}

say("", "  กำลังสร้างใบรับรอง HTTPS สำหรับ:", `    ${names.join(", ")}`, "");
// ติดตั้งใบรับรองหลักให้เครื่องนี้เชื่อถือ (ครั้งแรกอาจถามรหัสผ่านเครื่อง)
if (mkcert(["-install"]).status !== 0) {
  say(
    "",
    "  ติดตั้งใบรับรองหลักไม่สำเร็จ — ลองรัน  mkcert -install  เองอีกครั้ง",
    "",
  );
  process.exit(1);
}
fs.mkdirSync(certDir, { recursive: true, mode: 0o700 });
if (
  mkcert(["-cert-file", certFile, "-key-file", keyFile, ...names]).status !== 0
) {
  say("", "  สร้างใบรับรองไม่สำเร็จ", "");
  process.exit(1);
}
fs.chmodSync(keyFile, 0o600);
fs.writeFileSync(namesFile, names.join("\n"));

const caRoot = spawnSync("mkcert", ["-CAROOT"], {
  encoding: "utf8",
}).stdout.trim();
say(
  "",
  "  สร้างใบรับรองเรียบร้อย — เครื่องนี้เปิด https:// ได้โดยไม่มีคำเตือน",
  "  เครื่องอื่น (มือถือ/คอมพิวเตอร์ของเจ้าหน้าที่) ต้องติดตั้งใบรับรองหลักจากไฟล์",
  `    ${path.join(caRoot, "rootCA.pem")}`,
  "  ก่อน จึงจะไม่ขึ้นคำเตือน (ห้ามส่งต่อไฟล์ rootCA-key.pem)",
  "",
);
process.stdout.write(certDir);
