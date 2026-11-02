"use strict";

// โปรแกรมตรวจสอบระบบ (checker/check.js) ต้องผ่านทุกข้อกับระบบเวอร์ชันปัจจุบัน
// ถ้าแก้ระบบแล้วข้อนี้ไม่ผ่าน แปลว่าเกราะป้องกันหรือหน้าเว็บบางส่วนเสีย หรือโปรแกรมตรวจต้องอัปเดตตาม
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { runChecks, reportHtml } = require("../checker/check");

describe("โปรแกรมตรวจสอบระบบ", () => {
  it("ระบบปัจจุบันผ่านทุกข้อ (ยกเว้น HTTPS ที่เครื่องทดสอบไม่ได้เปิด) และรายงานไม่มีโค้ดแปลกปลอม", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "br-check-"));
    const app = createApp({ dataDir, initialPassword: "first-run-pass-77", hostname: "booking-pc" });
    const server = http.createServer((req, res) => app.handle(req, res));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    try {
      const rep = await runChecks({ target: `http://127.0.0.1:${server.address().port}`, deep: true });
      const notOk = rep.results.filter((r) => r.status === "fail" || (r.status === "warn" && r.id !== "https"));
      assert.deepEqual(notOk.map((r) => `${r.id}: ${r.detail}`), []);
      assert.equal(rep.results.find((r) => r.id === "https").status, "warn");
      for (const id of ["admin-read", "admin-write", "csrf", "source-files", "login-lockout", "lookup-throttle"])
        assert.equal(rep.results.find((r) => r.id === id).status, "pass", id);
      // ข้อความจากเว็บที่ตรวจต้องถูก escape ในรายงาน
      rep.results[0].detail = '<script>alert(1)</script>';
      assert.ok(!reportHtml(rep).includes("<script>alert"));
    } finally {
      app.stop();
      server.close();
    }
  });
});
