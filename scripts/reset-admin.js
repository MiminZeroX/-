#!/usr/bin/env node
"use strict";

// รีเซ็ตบัญชีผู้ดูแล "admin" ด้วยรหัสผ่านชั่วคราวแบบสุ่ม (กรณีลืมรหัสผ่าน)
// ใช้:  ปิดระบบก่อน แล้วรัน  node scripts/reset-admin.js  [--data=โฟลเดอร์ข้อมูล]

const fs = require("fs");
const path = require("path");
const { Store } = require("../src/store");
const {
  hashPasswordSync,
  randomId,
  randomPassword,
} = require("../src/security");

const arg = process.argv.find((a) => a.startsWith("--data="));
const dataDir = path.resolve(
  arg
    ? arg.slice(7)
    : process.env.DATA_DIR || path.join(__dirname, "..", "data"),
);
// ระบบที่เปิดอยู่จะเขียนข้อมูลในหน่วยความจำทับไฟล์ภายหลัง ทำให้การรีเซ็ตไม่มีผล จึงต้องปิดระบบก่อน
try {
  const pid = Number(fs.readFileSync(path.join(dataDir, "server.pid"), "utf8"));
  if (pid > 0) {
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch (err) {
      alive = err.code === "EPERM";
    }
    if (alive) {
      console.error(
        "\n  ระบบยังเปิดอยู่ — กรุณาปิดหน้าต่างระบบจองห้องประชุม (หรือกด Ctrl + C) ก่อน แล้วรันคำสั่งนี้อีกครั้ง" +
          `\n  (หากแน่ใจว่าปิดระบบแล้ว ให้ลบไฟล์ ${path.join(dataDir, "server.pid")} แล้วลองใหม่)\n`,
      );
      process.exit(1);
    }
  }
} catch {
  /* ไม่มีไฟล์ server.pid = ระบบไม่ได้เปิด */
}

const store = new Store(dataDir).load();
const password = randomPassword();

let admin = store.db.admins.find((a) => a.username === "admin");
if (!admin) {
  admin = {
    id: randomId(),
    username: "admin",
    name: "ผู้ดูแลระบบ",
    createdAt: Date.now(),
    lastLogin: null,
  };
  store.db.admins.push(admin);
}
Object.assign(admin, {
  role: "admin",
  active: true,
  mustChange: true,
  passHash: hashPasswordSync(password),
});
store.flushDb();
store.writeInitialPassword("admin", password);
store.addLog({
  level: "security",
  action: "user.update",
  detail: "รีเซ็ตบัญชี admin ด้วยสคริปต์ reset-admin",
  actor: "ระบบ",
});
store.flushLogs();

console.log(
  [
    "",
    `  รีเซ็ตเรียบร้อย (ข้อมูลที่ ${dataDir})`,
    "  เข้าสู่ระบบด้วยรหัสผ่านชั่วคราว",
    "    ชื่อผู้ใช้:  admin",
    `    รหัสผ่าน:  ${password}`,
    `  (บันทึกไว้ที่ ${store.initialPasswordFile} ด้วย)`,
    "  ระบบจะให้ตั้งรหัสผ่านใหม่ทันทีหลังเข้าสู่ระบบ — หากระบบเปิดอยู่ กรุณาปิดแล้วเปิดใหม่",
    "",
  ].join("\n"),
);
