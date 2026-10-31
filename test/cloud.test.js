"use strict";

// ทดสอบส่วนที่รันบน Cloudflare (worker/) โดยไม่ต้องใช้ Cloudflare:
// ใช้ SQLite ของ Node แทน SQLite ของ Durable Object และเรียกระบบผ่านตัวแปลงคำขอ (node-shim)
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { bkkNow, addDays, weekdayOf } = require("../src/time");

let sqlite = null;
try {
  sqlite = require("node:sqlite");
} catch {
  /* Node รุ่นที่ไม่มี node:sqlite: ข้ามชุดทดสอบนี้ */
}

const ADMIN_PW = "Cloud-Desk-Phrase-2569";

// ห่อ DatabaseSync ให้มีหน้าตาเหมือน ctx.storage.sql ของ Durable Object
function fakeSql() {
  const db = new sqlite.DatabaseSync(":memory:");
  return {
    exec(query, ...params) {
      const stmt = db.prepare(query);
      const rows = /^\s*SELECT/i.test(query)
        ? stmt.all(...params)
        : (stmt.run(...params), []);
      return { toArray: () => rows };
    },
  };
}

function workday(after) {
  let d = addDays(bkkNow().date, after);
  while ([0, 6].includes(weekdayOf(d))) d = addDays(d, 1);
  return d;
}

describe(
  "Cloudflare: ที่เก็บข้อมูล SQLite และตัวแปลงคำขอ",
  { skip: !sqlite },
  () => {
    let CloudStore;
    let serveNode;
    before(async () => {
      ({ CloudStore } = await import("../worker/cloud-store.js"));
      ({ serveNode } = await import("../worker/node-shim.js"));
    });

    const boot = (sql, extra = {}) => {
      const store = new CloudStore(sql, {
        initialPassword: "first-run-pass-77",
      }).load();
      const app = createApp({
        store,
        publicDir: false,
        anyHost: true,
        secure: true,
        ...extra,
      });
      return { store, app };
    };
    const call = (app, method, path, body, headers = {}) =>
      serveNode(
        app.handle,
        new Request(`https://booking.test${path}`, {
          method,
          headers: {
            "x-requested-with": "br",
            ...(body !== undefined
              ? { "content-type": "application/json" }
              : {}),
            ...headers,
          },
          body:
            body === undefined
              ? undefined
              : typeof body === "string"
                ? body
                : JSON.stringify(body),
        }),
        "203.0.113.9",
      );

    it("เก็บการจอง การตั้งค่า รหัสผ่าน และบันทึกกิจกรรมข้ามการเริ่มระบบใหม่", async () => {
      const sql = fakeSql();
      let { app, store } = boot(sql);
      assert.equal(store.firstRun, true);
      const day = workday(5);
      let r = await call(app, "POST", "/api/bookings", {
        roomId: "small-2",
        date: day,
        start: "09:00",
        end: "10:00",
        title: "ประชุมบนคลาวด์",
        organizer: "สมใจ ใจดี",
        department: "ฝ่ายปกครอง",
        phone: "0812345678",
        attendees: 4,
      });
      assert.equal(r.status, 200);
      r = await call(app, "POST", "/api/admin/login", {
        username: "admin",
        password: "first-run-pass-77",
      });
      assert.equal(r.status, 200);
      assert.match(r.headers.get("set-cookie"), /; Secure/);
      const cookie = r.headers.get("set-cookie").split(";")[0];
      r = await call(
        app,
        "POST",
        "/api/admin/password",
        { current: "first-run-pass-77", next: ADMIN_PW },
        { cookie },
      );
      assert.equal(r.status, 200);
      app.stop();

      // ปลุกระบบใหม่จากข้อมูลเดิม (เหมือน Durable Object ถูกโหลดใหม่)
      ({ app, store } = boot(sql));
      assert.equal(store.firstRun, false);
      assert.ok(store.db.bookings.some((b) => b.title === "ประชุมบนคลาวด์"));
      assert.ok(store.logs.some((l) => l.action === "admin.login"));
      r = await call(app, "POST", "/api/admin/login", {
        username: "admin",
        password: ADMIN_PW,
      });
      assert.equal(r.status, 200);
      const sys = await (
        await call(app, "GET", "/api/admin/system", undefined, {
          cookie: r.headers.get("set-cookie").split(";")[0],
        })
      ).json();
      assert.equal(sys.yourIp, "203.0.113.9");
      app.stop();
    });

    it("สำรองข้อมูลรายวัน อ่านไฟล์สำรอง และข้อมูลขนาดใหญ่เกินหนึ่งแถว", () => {
      const sql = fakeSql();
      const { store, app } = boot(sql);
      const name = store.dailyBackup();
      assert.ok(store.listBackups().some((b) => b.name === name));
      assert.equal(JSON.parse(store.readBackup(name)).bookings.length, 0);
      assert.equal(store.readBackup("../db.json"), null);
      // ข้อมูลยาวกว่าหนึ่งท่อน (400,000 ตัวอักษร) ต้องอ่านกลับได้ครบ
      store.db.departments = Array.from({ length: 9000 }, (_, i) =>
        `หน่วยงานทดสอบหมายเลข ${i} `.repeat(3),
      );
      store.flushDb();
      const again = new CloudStore(sql).load();
      assert.equal(again.db.departments.length, 9000);
      app.stop();
    });

    it("ตอบ 413 เมื่อข้อมูลใหญ่เกิน และ 415 เมื่อไม่ใช่ JSON", async () => {
      const { app } = boot(fakeSql());
      let r = await call(
        app,
        "POST",
        "/api/bookings",
        JSON.stringify({ note: "x".repeat(400000) }),
      );
      assert.equal(r.status, 413);
      r = await call(app, "POST", "/api/bookings", "a=1", {
        "content-type": "text/plain",
      });
      assert.equal(r.status, 415);
      app.stop();
    });

    it("สตรีมอัปเดตสดปิดตามรอบพร้อมแจ้ง bye และคืนโควตาการเชื่อมต่อ", async () => {
      const { app } = boot(fakeSql(), { sseMaxMs: 200, ssePerIp: 1 });
      const read = async () => {
        const r = await call(app, "GET", "/api/events");
        assert.equal(r.status, 200);
        return r.text();
      };
      const first = await read();
      assert.match(first, /event: hello/);
      assert.match(first, /event: bye/);
      // เพดาน 1 การเชื่อมต่อต่อ IP: ถ้าสตรีมแรกไม่ถูกคืนโควตา ครั้งที่สองจะได้ 429
      assert.match(await read(), /event: bye/);
      app.stop();
    });
  },
);
