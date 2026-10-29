"use strict";

// ทดสอบ API ด้วย node:test (ไม่ต้องติดตั้งแพ็กเกจเพิ่ม):  npm test
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { bkkNow, addDays, weekdayOf } = require("../src/time");

function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "br-test-"));
  const app = createApp({ dataDir });
  const server = http.createServer((req, res) => app.handle(req, res));
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      let cookie = "";
      async function call(
        method,
        url,
        body,
        { csrf = true, auth = false } = {},
      ) {
        const headers = {};
        if (body !== undefined) headers["content-type"] = "application/json";
        if (csrf) headers["x-requested-with"] = "br";
        if (auth && cookie) headers.cookie = cookie;
        const res = await fetch(base + url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: "manual",
        });
        const setCookie = res.headers.get("set-cookie");
        if (setCookie && auth) cookie = setCookie.split(";")[0];
        const type = res.headers.get("content-type") || "";
        // อ่านแบบไม่ตัด BOM เพื่อตรวจไฟล์ CSV สำหรับ Excel ได้
        const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
          await res.arrayBuffer(),
        );
        const data = type.includes("json") ? JSON.parse(text) : text;
        return { status: res.status, data, headers: res.headers };
      }
      resolve({
        app,
        base,
        call,
        admin: (method, url, body) => call(method, url, body, { auth: true }),
        close: () => {
          app.stop();
          server.close();
          fs.rmSync(dataDir, { recursive: true, force: true });
        },
      });
    });
  });
}

// วันทำการถัดไปที่ไม่ใช่วันหยุด
function nextWorkday(after = 1, skip = []) {
  let d = addDays(bkkNow().date, after);
  for (;;) {
    const wd = weekdayOf(d);
    if (wd !== 0 && wd !== 6 && !skip.includes(d)) return d;
    d = addDays(d, 1);
  }
}

function nextWeekend() {
  let d = addDays(bkkNow().date, 1);
  while (weekdayOf(d) !== 6) d = addDays(d, 1);
  return d;
}

const booking = (date, extra = {}) => ({
  roomId: "small-2",
  date,
  start: "09:00",
  end: "10:00",
  title: "ประชุมทดสอบ",
  organizer: "สมชาย ทดสอบ",
  department: "ฝ่ายปกครอง",
  phone: "081-234-5678",
  attendees: 5,
  ...extra,
});

describe("ระบบจองห้องประชุม API", () => {
  let t;
  let day;
  let holidays;
  before(async () => {
    t = await startServer();
    const login = await t.admin("POST", "/api/admin/login", {
      username: "admin",
      password: "admin1234",
    });
    assert.equal(login.status, 200);
    // ปิดการจำกัดอัตราการจองสำหรับการทดสอบ
    const s = await t.admin("PUT", "/api/admin/settings", {
      settings: { bookingRateLimitPerHour: 1000 },
    });
    assert.equal(s.status, 200);
    holidays = (await t.call("GET", "/api/config")).data.holidays.map(
      (h) => h.date,
    );
    day = nextWorkday(2, holidays);
  });
  after(() => t.close());

  it("ส่งข้อมูลตั้งต้น: ห้องเล็กชั้น 2 และห้องใหญ่ชั้น 4", async () => {
    const { status, data } = await t.call("GET", "/api/config");
    assert.equal(status, 200);
    assert.equal(data.settings.orgName, "สำนักงานเขตบางรัก");
    const rooms = Object.fromEntries(data.rooms.map((r) => [r.id, r]));
    assert.equal(rooms["small-2"].floor, "ชั้น 2");
    assert.equal(rooms["large-4"].floor, "ชั้น 4");
    assert.ok(!("sessionHours" in data.settings), "ไม่ควรเปิดเผยค่าภายในระบบ");
  });

  it("จองสำเร็จ และปฏิทินสาธารณะไม่เปิดเผยเบอร์โทร", async () => {
    const res = await t.call("POST", "/api/bookings", booking(day));
    assert.equal(res.status, 200);
    assert.equal(res.data.bookings[0].status, "approved");
    assert.match(res.data.bookings[0].code, /^BR\d{4}-\d{4}$/);
    assert.ok(res.data.token.length > 20);
    const list = await t.call("GET", `/api/bookings?from=${day}&to=${day}`);
    assert.equal(list.data.bookings.length, 1);
    assert.equal(list.data.bookings[0].phone, undefined);
    assert.equal(list.data.bookings[0].tokenHashes, undefined);
  });

  it("ป้องกันการจองซ้อนเวลา", async () => {
    const res = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "09:30", end: "10:30" }),
    );
    assert.equal(res.status, 409);
    assert.ok(res.data.conflicts.length);
    const other = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { roomId: "large-4", start: "09:30", end: "10:30" }),
    );
    assert.equal(other.status, 200, "ห้องอื่นเวลาเดียวกันต้องจองได้");
    const adjacent = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "10:00", end: "11:00" }),
    );
    assert.equal(adjacent.status, 200, "ต่อเวลากันพอดีต้องจองได้");
  });

  it("ตรวจสอบข้อมูลไม่ครบ และความจุห้อง", async () => {
    const res = await t.call("POST", "/api/bookings", {
      roomId: "small-2",
      date: day,
      start: "13:00",
      end: "14:00",
      attendees: 99,
    });
    assert.equal(res.status, 400);
    for (const k of ["title", "organizer", "department", "phone", "attendees"])
      assert.ok(res.data.fields[k], `ควรแจ้งช่อง ${k}`);
  });

  it("ไม่รับจองเวลาที่ผ่านมา วันหยุดสุดสัปดาห์ และนอกเวลาทำการ", async () => {
    const past = await t.call(
      "POST",
      "/api/bookings",
      booking(addDays(bkkNow().date, -3)),
    );
    assert.equal(past.status, 400);
    const weekend = await t.call(
      "POST",
      "/api/bookings",
      booking(nextWeekend()),
    );
    assert.equal(weekend.status, 400);
    assert.match(weekend.data.error, /เสาร์/);
    const late = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "18:00", end: "19:00" }),
    );
    assert.equal(late.status, 400);
  });

  it("ไม่รับจองวันหยุดราชการที่แอดมินกำหนด", async () => {
    const hday = nextWorkday(5, holidays);
    const cfg = (await t.call("GET", "/api/config")).data;
    const res = await t.admin("PUT", "/api/admin/holidays", {
      holidays: [...cfg.holidays, { date: hday, name: "วันหยุดพิเศษทดสอบ" }],
    });
    assert.equal(res.status, 200);
    const b = await t.call("POST", "/api/bookings", booking(hday));
    assert.equal(b.status, 400);
    assert.match(b.data.error, /วันหยุดพิเศษทดสอบ/);
  });

  it("ปฏิเสธคำขอที่ไม่มี header ป้องกัน CSRF", async () => {
    const res = await t.call("POST", "/api/bookings", booking(day), {
      csrf: false,
    });
    assert.equal(res.status, 403);
  });

  it("ผู้จองแก้ไขและยกเลิกได้ด้วยโทเคน ส่วนคนอื่นทำไม่ได้", async () => {
    const created = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "14:00", end: "15:00" }),
    );
    const id = created.data.bookings[0].id;
    const token = created.data.token;
    const bad = await t.call("POST", `/api/bookings/${id}/cancel`, {
      token: "wrong-token",
    });
    assert.equal(bad.status, 403);
    const edit = await t.call("PATCH", `/api/bookings/${id}`, {
      token,
      start: "15:00",
      end: "16:00",
      title: "ย้ายเวลา",
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.data.booking.start, "15:00");
    const clash = await t.call("PATCH", `/api/bookings/${id}`, {
      token,
      start: "09:00",
      end: "10:00",
    });
    assert.equal(clash.status, 409);
    const cancel = await t.call("POST", `/api/bookings/${id}/cancel`, {
      token,
      reason: "เลื่อนประชุม",
    });
    assert.equal(cancel.status, 200);
    const my = await t.call("POST", "/api/my", { tokens: [token] });
    assert.equal(my.data.items[0].bookings[0].status, "cancelled");
  });

  it("ค้นหาการจองด้วยรหัสและเบอร์โทร", async () => {
    const created = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "16:00", end: "17:00" }),
    );
    const code = created.data.bookings[0].code;
    const wrong = await t.call("POST", "/api/lookup", {
      code,
      phone: "0999999999",
    });
    assert.equal(wrong.status, 404);
    const ok = await t.call("POST", "/api/lookup", {
      code,
      phone: "0812345678",
    });
    assert.equal(ok.status, 200);
    const my = await t.call("POST", "/api/my", { tokens: [ok.data.token] });
    assert.equal(my.data.items[0].bookings[0].code, code);
  });

  it("จองซ้ำทุกสัปดาห์ และเลือกจองเฉพาะวันที่ว่าง", async () => {
    const start = nextWorkday(1, holidays);
    const res = await t.call(
      "POST",
      "/api/bookings",
      booking(start, {
        roomId: "large-4",
        start: "13:00",
        end: "14:00",
        repeat: { type: "weekly", count: 3 },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.bookings.length, 3);
    assert.ok(res.data.bookings[0].seriesId);
    const again = await t.call(
      "POST",
      "/api/bookings",
      booking(start, {
        roomId: "large-4",
        start: "13:30",
        end: "14:30",
        repeat: { type: "weekly", count: 4 },
      }),
    );
    assert.equal(again.status, 409);
    const skip = await t.call(
      "POST",
      "/api/bookings",
      booking(start, {
        roomId: "large-4",
        start: "13:30",
        end: "14:30",
        repeat: { type: "weekly", count: 4 },
        skipConflicts: true,
      }),
    );
    assert.equal(skip.status, 200);
    assert.equal(skip.data.bookings.length, 1);
  });

  it("โหมดต้องอนุมัติ: การจองใหม่รออนุมัติ แล้วแอดมินอนุมัติได้", async () => {
    await t.admin("PUT", "/api/admin/settings", {
      settings: { requireApproval: true },
    });
    const res = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { roomId: "large-4", start: "08:00", end: "09:00" }),
    );
    assert.equal(res.data.bookings[0].status, "pending");
    const id = res.data.bookings[0].id;
    const stats = await t.admin("GET", "/api/admin/stats");
    assert.ok(stats.data.pendingCount >= 1);
    const ok = await t.admin("POST", `/api/admin/bookings/${id}/status`, {
      status: "approved",
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.booking.status, "approved");
    assert.equal(ok.data.booking.history.at(-1).text.includes("อนุมัติ"), true);
    await t.admin("PUT", "/api/admin/settings", {
      settings: { requireApproval: false },
    });
  });

  it("บันทึก Log ทุกการกระทำสำคัญ", async () => {
    const logs = await t.admin("GET", "/api/admin/logs?size=200");
    const actions = new Set(logs.data.items.map((l) => l.action));
    for (const a of [
      "admin.login",
      "booking.create",
      "booking.update",
      "booking.cancel",
      "booking.approve",
      "settings.update",
      "holidays.update",
      "booking.lookup",
    ]) {
      assert.ok(actions.has(a), `ควรมี log ${a}`);
    }
    const csv = await t.admin("GET", "/api/admin/logs.csv");
    assert.equal(csv.status, 200);
    assert.ok(
      csv.data.startsWith("﻿"),
      "CSV ต้องมี BOM เพื่อให้ Excel อ่านภาษาไทยได้",
    );
  });

  it("ตรวจสอบค่าการตั้งค่าที่ไม่ถูกต้อง", async () => {
    const bad = await t.admin("PUT", "/api/admin/settings", {
      settings: { slotMinutes: 7 },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.field, "slotMinutes");
    const order = await t.admin("PUT", "/api/admin/settings", {
      settings: { openTime: "19:00" },
    });
    assert.equal(order.status, 400);
  });

  it("สิทธิ์เจ้าหน้าที่: จัดการการจองได้ แต่เข้าเมนูตั้งค่าไม่ได้", async () => {
    const created = await t.admin("POST", "/api/admin/users", {
      username: "staff1",
      name: "เจ้าหน้าที่ทดสอบ",
      role: "staff",
      password: "staffpass1",
    });
    assert.equal(created.status, 200);
    const s2 = await startServerShare(t);
    const login = await s2.call(
      "POST",
      "/api/admin/login",
      { username: "staff1", password: "staffpass1" },
      { auth: true },
    );
    assert.equal(login.status, 200);
    assert.equal(
      (await s2.call("GET", "/api/admin/bookings", undefined, { auth: true }))
        .status,
      200,
    );
    assert.equal(
      (await s2.call("GET", "/api/admin/settings", undefined, { auth: true }))
        .status,
      403,
    );
    assert.equal(
      (await s2.call("GET", "/api/admin/logs", undefined, { auth: true }))
        .status,
      403,
    );
  });

  it("ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 คน", async () => {
    const me = await t.admin("GET", "/api/admin/me");
    const res = await t.admin("DELETE", `/api/admin/users/${me.data.admin.id}`);
    assert.equal(res.status, 400);
  });

  it("เช็คอินและคืนห้องอัตโนมัติเมื่อไม่มาใช้ห้อง", async () => {
    await t.admin("PUT", "/api/admin/settings", {
      settings: { checkinEnabled: true, autoReleaseMinutes: 15 },
    });
    const now = bkkNow();
    const toHH = (m) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const startMin = Math.max(0, now.minutes - 30);
    const endMin = Math.min(24 * 60, now.minutes + 60);
    if (endMin - startMin < 40) return; // ใกล้เที่ยงคืน ข้ามการทดสอบนี้
    const res = await t.admin("POST", "/api/admin/bookings", {
      ...booking(now.date, {
        roomId: "small-2",
        start: toHH(startMin),
        end: toHH(endMin),
      }),
      force: true,
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const b = t.app.store.db.bookings.find(
      (x) => x.id === res.data.bookings[0].id,
    );
    b.createdAt = 0; // จำลองว่าจองไว้ล่วงหน้า
    t.app.autoRelease();
    assert.equal(b.status, "cancelled");
    assert.equal(b.released, true);
  });

  it("สำรองและกู้คืนข้อมูล", async () => {
    const backup = await t.admin("GET", "/api/admin/backup");
    assert.equal(backup.status, 200);
    const payload = backup.data;
    const count = payload.db.bookings.length;
    await t.call(
      "POST",
      "/api/bookings",
      booking(day, { roomId: "large-4", start: "16:00", end: "17:00" }),
    );
    const restore = await t.admin("POST", "/api/admin/restore", payload);
    assert.equal(restore.status, 200);
    assert.equal(restore.data.bookings, count);
    const bad = await t.admin("POST", "/api/admin/restore", { hello: 1 });
    assert.equal(bad.status, 400);
  });

  it("ไม่ให้เข้าถึงไฟล์นอกโฟลเดอร์ public", async () => {
    const res = await fetch(`${t.base}/..%2fserver.js`, { redirect: "manual" });
    assert.notEqual(res.status, 200);
    const res2 = await fetch(`${t.base}/assets/../../server.js`, {
      redirect: "manual",
    });
    const txt = await res2.text();
    assert.ok(!txt.includes("createApp"), "ต้องไม่ส่งซอร์สโค้ดเซิร์ฟเวอร์");
  });
});

describe("ความปลอดภัยการเข้าสู่ระบบ", () => {
  let t;
  before(async () => {
    t = await startServer();
  });
  after(() => t.close());

  it("ต้องเข้าสู่ระบบก่อนใช้ API ผู้ดูแล", async () => {
    assert.equal((await t.call("GET", "/api/admin/bookings")).status, 401);
  });

  it("ล็อกชั่วคราวเมื่อเดารหัสผ่านผิดหลายครั้ง", async () => {
    let last;
    for (let i = 0; i < 9; i++)
      last = await t.call("POST", "/api/admin/login", {
        username: "admin",
        password: `wrong${i}`,
      });
    assert.equal(last.status, 429);
    const right = await t.call("POST", "/api/admin/login", {
      username: "admin",
      password: "admin1234",
    });
    assert.equal(right.status, 429, "แม้รหัสถูกก็ต้องรอจนพ้นช่วงล็อก");
  });
});

// ใช้เซิร์ฟเวอร์เดิมแต่แยก cookie (จำลองผู้ใช้อีกคน)
async function startServerShare(t) {
  let cookie = "";
  return {
    async call(method, url, body, { auth = false } = {}) {
      const headers = { "x-requested-with": "br" };
      if (body !== undefined) headers["content-type"] = "application/json";
      if (auth && cookie) headers.cookie = cookie;
      const res = await fetch(t.base + url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
      return { status: res.status, data: await res.json().catch(() => null) };
    },
  };
}
