#!/usr/bin/env node
"use strict";

// รีเซ็ตบัญชีผู้ดูแล "admin" เป็นรหัสผ่าน admin1234 (กรณีลืมรหัสผ่าน)
// ใช้:  ปิดระบบก่อน แล้วรัน  node scripts/reset-admin.js  [--data=โฟลเดอร์ข้อมูล]

const path = require("path");
const { Store } = require("../src/store");
const { hashPassword, randomId } = require("../src/security");

const arg = process.argv.find((a) => a.startsWith("--data="));
const dataDir = path.resolve(
  arg
    ? arg.slice(7)
    : process.env.DATA_DIR || path.join(__dirname, "..", "data"),
);
const store = new Store(dataDir).load();

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
  passHash: hashPassword("admin1234"),
});
store.flushDb();
store.addLog({
  level: "security",
  action: "user.update",
  detail: "รีเซ็ตบัญชี admin ด้วยสคริปต์ reset-admin",
  actor: "ระบบ",
});
store.flushLogs();

console.log(
  `\n  รีเซ็ตเรียบร้อย — เข้าสู่ระบบด้วย admin / admin1234 (ข้อมูลที่ ${dataDir})`,
);
console.log(
  "  ระบบจะให้ตั้งรหัสผ่านใหม่ทันทีหลังเข้าสู่ระบบ — หากระบบเปิดอยู่ กรุณาปิดแล้วเปิดใหม่\n",
);
