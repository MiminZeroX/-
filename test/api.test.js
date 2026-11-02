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

// รหัสผ่านเริ่มต้นสำหรับทดสอบ (ระบบจริงสุ่มให้ทุกการติดตั้ง)
const INITIAL_PW = "first-run-pass-77";
const ADMIN_PW = "Bang-Rak-Room-7731";
// macOS ให้ใช้เฉพาะ 127.0.0.1 บน loopback (Linux/Windows ใช้ได้ทั้ง 127.x.x.x) — ข้อที่ต้องจำลองหลาย IP จึงข้ามบน macOS
const NO_MULTI_IP =
  process.platform === "darwin" && "macOS จำลองหลาย IP ไม่ได้ — ข้อนี้ทดสอบบน Linux/Windows";

function startServer(opts = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "br-test-"));
  const app = createApp({
    dataDir,
    initialPassword: INITIAL_PW,
    hostname: "booking-pc",
    ...opts,
  });
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
        dataDir,
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
      password: INITIAL_PW,
    });
    assert.equal(login.status, 200);
    const changed = await t.admin("POST", "/api/admin/password", {
      current: INITIAL_PW,
      next: ADMIN_PW,
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
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
    assert.match(res.data.bookings[0].code, /^BR\d{4}-[A-HJ-NP-Z2-9]{4}$/);
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
      password: "desk-temp-pass-41",
      confirmPassword: ADMIN_PW,
    });
    assert.equal(created.status, 200);
    const s2 = await startServerShare(t);
    const login = await s2.call(
      "POST",
      "/api/admin/login",
      { username: "staff1", password: "desk-temp-pass-41" },
      { auth: true },
    );
    assert.equal(login.status, 200);
    // บัญชีใหม่ต้องตั้งรหัสผ่านเองก่อนใช้งาน
    const blocked = await s2.call("GET", "/api/admin/bookings", undefined, {
      auth: true,
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.mustChange, true);
    const pw = await s2.call(
      "POST",
      "/api/admin/password",
      { current: "desk-temp-pass-41", next: "Staff-Own-Phrase-58" },
      { auth: true },
    );
    assert.equal(pw.status, 200, JSON.stringify(pw.data));
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
    // ต้องเลยเวลาเริ่มมาแล้วเกิน 15 นาที และยังไม่ถึงเวลาจบ: ช่วงใกล้เที่ยงคืนข้ามการทดสอบนี้
    if (now.minutes - startMin < 20 || endMin - now.minutes < 20) return;
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
    assert.ok(
      payload.db.admins.every((a) => !("passHash" in a)),
      "ไฟล์สำรองที่ดาวน์โหลดต้องไม่มีแฮชรหัสผ่าน",
    );
    assert.ok(!("kioskKey" in payload.db));
    const noPw = await t.admin("POST", "/api/admin/restore", payload);
    assert.equal(noPw.status, 400, "ต้องยืนยันรหัสผ่านก่อนกู้คืน");
    const restore = await t.admin("POST", "/api/admin/restore", {
      ...payload,
      confirmPassword: ADMIN_PW,
    });
    assert.equal(restore.status, 200, JSON.stringify(restore.data));
    assert.equal(restore.data.bookings, count);
    const bad = await t.admin("POST", "/api/admin/restore", {
      hello: 1,
      confirmPassword: ADMIN_PW,
    });
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
      password: INITIAL_PW,
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

// ---------------------------------------------------------------- ความปลอดภัย (ผลจากการทดสอบเจาะระบบ)
const net = require("net");
const {
  hashPassword,
  verifyPassword,
  needsRehash,
  passwordIssue,
} = require("../src/security");

// ส่งคำขอดิบ (กำหนด Host / header ได้เอง)
function rawRequest(base, lines) {
  const u = new URL(base);
  return new Promise((resolve) => {
    const s = net.connect(Number(u.port), u.hostname, () =>
      s.write(`${lines.join("\r\n")}\r\n\r\n`),
    );
    let buf = "";
    s.on("data", (d) => (buf += d));
    s.on("end", () =>
      resolve({ status: Number(buf.split(" ")[1]), text: buf }),
    );
    s.on("error", () => resolve({ status: 0, text: buf }));
    setTimeout(() => {
      s.destroy();
      resolve({ status: Number(buf.split(" ")[1]) || 0, text: buf });
    }, 3000);
  });
}

// เปิดสตรีม SSE แล้วเก็บข้อความที่ได้รับ
function openEvents(base) {
  return new Promise((resolve) => {
    const req = http.get(`${base}/api/events`, (res) => {
      const stream = {
        status: res.statusCode,
        text: "",
        close: () => req.destroy(),
      };
      res.setEncoding("utf8");
      res.on("data", (d) => (stream.text += d));
      res.on("error", () => {});
      resolve(stream);
    });
    req.on("error", () => resolve({ status: 0, text: "", close() {} }));
  });
}

describe("ความปลอดภัย: ผลจากการทดสอบเจาะระบบ", () => {
  let t;
  let day;
  before(async () => {
    t = await startServer();
    await t.admin("POST", "/api/admin/login", {
      username: "admin",
      password: INITIAL_PW,
    });
    await t.admin("POST", "/api/admin/password", {
      current: INITIAL_PW,
      next: ADMIN_PW,
    });
    await t.admin("PUT", "/api/admin/settings", {
      settings: { bookingRateLimitPerHour: 1000 },
    });
    const holidays = (await t.call("GET", "/api/config")).data.holidays.map(
      (h) => h.date,
    );
    day = nextWorkday(3, holidays);
  });
  after(() => t.close());

  it("ปฏิทินสาธารณะและการแจ้งเตือนสดไม่เปิดเผยรหัสการจอง", async () => {
    const ev = await openEvents(t.base);
    const res = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "13:00", end: "14:00" }),
    );
    assert.equal(res.status, 200);
    const code = res.data.bookings[0].code;
    await new Promise((r) => setTimeout(r, 150));
    ev.close();
    assert.ok(ev.text.includes("event: bookings"), "ต้องได้รับการแจ้งเตือน");
    assert.ok(!ev.text.includes(code), "SSE ต้องไม่ส่งรหัสการจอง");
    const list = await t.call("GET", `/api/bookings?from=${day}&to=${day}`);
    assert.ok(list.data.bookings.length > 0);
    assert.ok(list.data.bookings.every((b) => !("code" in b)));
    assert.ok(!JSON.stringify(list.data).includes(code));
  });

  it("ตัดการขึ้นบรรทัดในช่องข้อความบรรทัดเดียว แต่คงไว้ในหมายเหตุ", async () => {
    const res = await t.call(
      "POST",
      "/api/bookings",
      booking(day, {
        start: "14:00",
        end: "15:00",
        title: "บรรทัดแรก\nadmin.login ปลอม\r\nบรรทัดสาม",
        organizer: "ชื่อ\u202eปลอม",
        note: "ข้อ 1\nข้อ 2",
      }),
    );
    assert.equal(res.status, 200);
    const b = res.data.bookings[0];
    assert.equal(b.title, "บรรทัดแรก admin.login ปลอม บรรทัดสาม");
    assert.equal(b.organizer, "ชื่อปลอม");
    assert.equal(b.note, "ข้อ 1\nข้อ 2");
  });

  it("รับเฉพาะข้อมูลแบบ JSON (415)", async () => {
    const res = await fetch(`${t.base}/api/bookings`, {
      method: "POST",
      headers: { "x-requested-with": "br", "content-type": "text/plain" },
      body: JSON.stringify(booking(day)),
    });
    assert.equal(res.status, 415);
  });

  it("ปฏิเสธข้อมูลขนาดใหญ่เกินทันทีและปิดการเชื่อมต่อ (413)", async () => {
    const r = await rawRequest(t.base, [
      "POST /api/bookings HTTP/1.1",
      `Host: 127.0.0.1`,
      "Content-Type: application/json",
      "X-Requested-With: br",
      `Content-Length: ${10 * 1024 * 1024}`,
    ]);
    assert.equal(r.status, 413);
    assert.match(r.text, /connection: close/i);
  });

  it("ปฏิเสธชื่อโฮสต์แปลกปลอม (กัน DNS rebinding)", async () => {
    const bad = await rawRequest(t.base, [
      "GET /api/config HTTP/1.1",
      "Host: evil.example.com",
      "Connection: close",
    ]);
    assert.equal(bad.status, 421);
    for (const host of [
      "127.0.0.1:3000",
      "localhost",
      "booking-pc.local",
      "192.168.1.20",
    ]) {
      const ok = await rawRequest(t.base, [
        "GET /api/config HTTP/1.1",
        `Host: ${host}`,
        "Connection: close",
      ]);
      assert.equal(ok.status, 200, host);
    }
    const t2 = await startServer({
      allowedHosts: ["booking.bangrak.local", "*.office.lan"],
    });
    try {
      for (const host of ["booking.bangrak.local", "room.office.lan"]) {
        const ok = await rawRequest(t2.base, [
          "GET /api/config HTTP/1.1",
          `Host: ${host}`,
          "Connection: close",
        ]);
        assert.equal(ok.status, 200, host);
      }
    } finally {
      t2.close();
    }
  });

  it("ส่ง header ความปลอดภัยครบทุกหน้า รวมถึงการเปลี่ยนเส้นทาง", async () => {
    for (const url of ["/", "/admin"]) {
      const res = await fetch(t.base + url, { redirect: "manual" });
      const h = res.headers;
      assert.equal(h.get("cross-origin-opener-policy"), "same-origin", url);
      assert.match(h.get("permissions-policy") || "", /camera=\(\)/, url);
      assert.match(
        h.get("content-security-policy") || "",
        /form-action 'self'/,
        url,
      );
      assert.match(
        h.get("content-security-policy") || "",
        /script-src 'self';/,
        url,
      );
      assert.equal(h.get("x-content-type-options"), "nosniff", url);
    }
  });

  it("จำกัดการเชื่อมต่อสดต่ออุปกรณ์", async () => {
    const streams = [];
    for (let i = 0; i < 16; i++) streams.push(await openEvents(t.base));
    const extra = await openEvents(t.base);
    assert.ok(streams.every((s) => s.status === 200));
    assert.equal(extra.status, 429);
    streams.concat(extra).forEach((s) => s.close());
    await new Promise((r) => setTimeout(r, 100));
    const again = await openEvents(t.base);
    assert.equal(again.status, 200, "ปิดแล้วต้องเชื่อมต่อใหม่ได้");
    again.close();
  });

  it("โลโก้ SVG ต้องไม่มีสคริปต์หรือลิงก์ภายนอก", async () => {
    const svg = (s) =>
      `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;
    const bad = [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://evil/x.png"/></svg>',
    ];
    for (const s of bad) {
      const r = await t.admin("PUT", "/api/admin/settings", {
        settings: { logo: svg(s) },
      });
      assert.equal(r.status, 400, s);
    }
    const good = await t.admin("PUT", "/api/admin/settings", {
      settings: {
        logo: svg(
          '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><circle id="c" r="4"/></defs><use href="#c" x="5" y="5"/></svg>',
        ),
      },
    });
    assert.equal(good.status, 200, JSON.stringify(good.data));
    await t.admin("PUT", "/api/admin/settings", { settings: { logo: "" } });
  });

  it("ไม่รับรหัสผ่านที่เดาง่าย", async () => {
    for (const password of [
      "12345678",
      "123456789012",
      "password1234",
      "admin1234",
      "aaaaaaaaaaaa",
      "abcdefghijkl",
      "weakuser-2569",
    ]) {
      const r = await t.admin("POST", "/api/admin/users", {
        username: "weakuser",
        name: "ทดสอบ",
        role: "staff",
        password,
      });
      assert.equal(r.status, 400, password);
      assert.ok(r.data.fields.password, password);
    }
    assert.equal(passwordIssue("ตึกสีฟ้าริมน้ำเจ้าพระยา"), null);
    assert.equal(passwordIssue("Bang-Rak-Room-7731"), null);
  });

  it("แฮชรหัสผ่านรูปแบบเดิมยังใช้ได้ และถูกอัปเกรดเมื่อเข้าสู่ระบบ", async () => {
    const crypto = require("crypto");
    const salt = crypto.randomBytes(16);
    const legacy = `scrypt$${salt.toString("base64")}$${crypto
      .scryptSync("Legacy-Pass-9911", salt, 64, { N: 16384, r: 8, p: 1 })
      .toString("base64")}`;
    assert.ok(await verifyPassword("Legacy-Pass-9911", legacy));
    assert.ok(!(await verifyPassword("wrong-pass-0000", legacy)));
    assert.ok(needsRehash(legacy));
    assert.ok(!needsRehash(await hashPassword("x")));
    // ค่าที่ถูกแก้ไขให้ใช้หน่วยความจำ/เวลามหาศาล หรือแฮชสั้นผิดปกติ ต้องถูกปฏิเสธ
    assert.ok(!(await verifyPassword("x", "scrypt2$1048576$8$1$AAAA$AAAA")));
    assert.ok(!(await verifyPassword("x", "scrypt2$131072$16$8$AAAA$AAAA")));
    assert.ok(
      !(await verifyPassword(
        "x",
        "scrypt2$32768$8.5$3$AAAAAAAAAAAAAAAAAAAAAA==$AAAA",
      )),
    );
    const created = await t.admin("POST", "/api/admin/users", {
      username: "legacy1",
      name: "บัญชีเก่า",
      role: "staff",
      password: "Legacy-Temp-Pass-1",
      confirmPassword: ADMIN_PW,
    });
    const acc = t.app.store.db.admins.find(
      (a) => a.id === created.data.user.id,
    );
    acc.passHash = legacy;
    const s2 = await startServerShare(t);
    const login = await s2.call(
      "POST",
      "/api/admin/login",
      { username: "legacy1", password: "Legacy-Pass-9911" },
      { auth: true },
    );
    assert.equal(login.status, 200);
    assert.match(acc.passHash, /^scrypt2\$/);
    assert.ok(await verifyPassword("Legacy-Pass-9911", acc.passHash));
  });
});

describe("ความปลอดภัย: การติดตั้งครั้งแรก", () => {
  it("สุ่มรหัสผ่านเริ่มต้น และบังคับเปลี่ยนก่อนใช้งาน", async () => {
    const t = await startServer({ initialPassword: undefined });
    try {
      const pw = t.app.initialPassword;
      assert.match(pw, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
      const file = path.join(t.dataDir, "initial-admin-password.txt");
      assert.ok(fs.readFileSync(file, "utf8").includes(pw));
      const weak = await t.call("POST", "/api/admin/login", {
        username: "admin",
        password: "admin1234",
      });
      assert.equal(weak.status, 401, "ต้องไม่มีรหัสผ่านตายตัว admin1234");
      const login = await t.admin("POST", "/api/admin/login", {
        username: "admin",
        password: pw,
      });
      assert.equal(login.status, 200);
      assert.equal(login.data.admin.mustChange, true);
      const blocked = await t.admin("GET", "/api/admin/settings");
      assert.equal(blocked.status, 403);
      assert.equal(blocked.data.mustChange, true);
      assert.equal((await t.admin("GET", "/api/admin/me")).status, 200);
      const reuse = await t.admin("POST", "/api/admin/password", {
        current: pw,
        next: "12345678",
      });
      assert.equal(reuse.status, 400);
      const ok = await t.admin("POST", "/api/admin/password", {
        current: pw,
        next: "Bang-Rak-Room-7731",
      });
      assert.equal(ok.status, 200);
      assert.ok(!fs.existsSync(file), "ต้องลบไฟล์รหัสผ่านเริ่มต้นหลังเปลี่ยน");
      assert.equal((await t.admin("GET", "/api/admin/settings")).status, 200);
    } finally {
      t.close();
    }
  });
});

// ส่งคำขอจาก IP ปลายทางอื่นบนเครื่องเดียวกัน (127.0.0.x) เพื่อจำลองหลายอุปกรณ์
function callFrom(base, ip, method, url, body, cookie) {
  const u = new URL(base);
  const data = body === undefined ? "" : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: u.hostname,
        port: u.port,
        method,
        path: url,
        localAddress: ip,
        headers: {
          "x-requested-with": "br",
          ...(data
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(data),
              }
            : {}),
          ...(cookie ? { cookie } : {}),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (text += d));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            /* ไม่ใช่ JSON */
          }
          resolve({
            status: res.statusCode,
            data: json,
            cookie: (res.headers["set-cookie"] || [""])[0].split(";")[0],
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", reject);
    req.end(data);
  });
}

describe("ความปลอดภัย: ผลจากการตรวจโค้ด (security review)", () => {
  let t;
  let day;
  before(async () => {
    t = await startServer();
    await t.admin("POST", "/api/admin/login", {
      username: "admin",
      password: INITIAL_PW,
    });
    await t.admin("POST", "/api/admin/password", {
      current: INITIAL_PW,
      next: ADMIN_PW,
    });
    const holidays = (await t.call("GET", "/api/config")).data.holidays.map(
      (h) => h.date,
    );
    day = nextWorkday(4, holidays);
  });
  after(() => t.close());

  it("ไม่อ่านข้อมูลขนาดใหญ่ก่อนตรวจสิทธิ์ (กันหน่วยความจำเต็ม)", async () => {
    const r = await rawRequest(t.base, [
      "POST /api/admin/restore HTTP/1.1",
      "Host: 127.0.0.1",
      "Content-Type: application/json",
      "X-Requested-With: br",
      `Content-Length: ${30 * 1024 * 1024}`,
    ]);
    assert.equal(r.status, 401);
    assert.match(r.text, /connection: close/i);
  });

  it("คุกกี้ผู้ดูแลที่ถูกนำไปใช้จากเครื่องอื่นใช้ไม่ได้", { skip: NO_MULTI_IP }, async () => {
    const login = await callFrom(
      t.base,
      "127.0.0.21",
      "POST",
      "/api/admin/login",
      {
        username: "admin",
        password: ADMIN_PW,
      },
    );
    assert.equal(login.status, 200);
    const same = await callFrom(
      t.base,
      "127.0.0.21",
      "GET",
      "/api/admin/me",
      undefined,
      login.cookie,
    );
    assert.equal(same.status, 200);
    const other = await callFrom(
      t.base,
      "127.0.0.22",
      "GET",
      "/api/admin/me",
      undefined,
      login.cookie,
    );
    assert.equal(other.status, 401);
    const again = await callFrom(
      t.base,
      "127.0.0.21",
      "GET",
      "/api/admin/me",
      undefined,
      login.cookie,
    );
    assert.equal(again.status, 401, "เซสชันที่ถูกขโมยต้องถูกยกเลิกทั้งหมด");
  });

  it("จำกัดการเดารหัสต่อบัญชี แม้เปลี่ยน IP และเข้าสู่ระบบบัญชีอื่นสำเร็จก็ล้างตัวนับไม่ได้", { skip: NO_MULTI_IP }, async () => {
    for (let i = 0; i < 12; i++) {
      const r = await callFrom(
        t.base,
        `127.0.1.${i + 2}`,
        "POST",
        "/api/admin/login",
        {
          username: "admin",
          password: `wrong-guess-${i}`,
        },
      );
      assert.equal(r.status, 401);
    }
    const right = await callFrom(
      t.base,
      "127.0.1.200",
      "POST",
      "/api/admin/login",
      {
        username: "admin",
        password: ADMIN_PW,
      },
    );
    assert.equal(
      right.status,
      429,
      "บัญชีที่ถูกเดารหัสหลายครั้งต้องถูกพักชั่วคราว",
    );
  });

  it("ต้องยืนยันรหัสผ่านก่อนเพิ่มผู้ใช้/ตั้งรหัสให้ผู้อื่น และตั้งรหัสตนเองผ่านหน้านี้ไม่ได้", async () => {
    // บัญชี admin ของเซิร์ฟเวอร์หลักถูกพักจากการทดสอบก่อนหน้า จึงใช้เซิร์ฟเวอร์ใหม่
    const t2 = await startServer();
    try {
      await t2.admin("POST", "/api/admin/login", {
        username: "admin",
        password: INITIAL_PW,
      });
      await t2.admin("POST", "/api/admin/password", {
        current: INITIAL_PW,
        next: ADMIN_PW,
      });
      const noPw = await t2.admin("POST", "/api/admin/users", {
        username: "clerk1",
        name: "ธุรการ",
        role: "staff",
        password: "clerk-temp-pass-31",
      });
      assert.equal(noPw.status, 400);
      assert.ok(noPw.data.fields.confirmPassword);
      const ok = await t2.admin("POST", "/api/admin/users", {
        username: "clerk1",
        name: "ธุรการ",
        role: "staff",
        password: "clerk-temp-pass-31",
        confirmPassword: ADMIN_PW,
      });
      assert.equal(ok.status, 200);
      const me = (await t2.admin("GET", "/api/admin/me")).data.admin;
      const self = await t2.admin("PUT", `/api/admin/users/${me.id}`, {
        password: "Another-Own-Phrase-7",
        confirmPassword: ADMIN_PW,
      });
      assert.equal(
        self.status,
        400,
        "เปลี่ยนรหัสตนเองต้องใช้ /api/admin/password",
      );
      const promote = await t2.admin(
        "PUT",
        `/api/admin/users/${ok.data.user.id}`,
        {
          role: "admin",
        },
      );
      assert.equal(promote.status, 400, "เลื่อนสิทธิ์ต้องยืนยันรหัสผ่าน");
      assert.equal(
        t2.app.store.db.admins.find((x) => x.username === "clerk1").role,
        "staff",
      );
    } finally {
      t2.close();
    }
  });

  it("เช็คอินต้องมีโทเคนผู้จองหรือรหัสจอหน้าห้อง", async () => {
    const t2 = await startServer();
    try {
      await t2.admin("POST", "/api/admin/login", {
        username: "admin",
        password: INITIAL_PW,
      });
      await t2.admin("POST", "/api/admin/password", {
        current: INITIAL_PW,
        next: ADMIN_PW,
      });
      await t2.admin("PUT", "/api/admin/settings", {
        settings: { checkinEnabled: true, checkinWindowMinutes: 120 },
      });
      const now = bkkNow();
      const toHH = (m) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      if (now.minutes > 24 * 60 - 70) return; // ใกล้เที่ยงคืน ข้าม
      const startMin = Math.ceil((now.minutes + 10) / 30) * 30;
      const res = await t2.admin("POST", "/api/admin/bookings", {
        ...booking(now.date, {
          start: toHH(startMin),
          end: toHH(Math.min(startMin + 60, 1439)),
        }),
        force: true,
      });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const id = res.data.bookings[0].id;
      const anon = await t2.call("POST", `/api/bookings/${id}/checkin`, {});
      assert.equal(anon.status, 403);
      const key = (await t2.admin("GET", "/api/admin/kiosk-key")).data.key;
      const kiosk = await fetch(`${t2.base}/api/bookings/${id}/checkin`, {
        method: "POST",
        headers: {
          "x-requested-with": "br",
          "content-type": "application/json",
          "x-kiosk-key": key,
        },
        body: "{}",
      });
      assert.equal(kiosk.status, 200);
    } finally {
      t2.close();
    }
  });

  it("รหัสการจองเดาลำดับไม่ได้ และเดาเบอร์ซ้ำ ๆ จะถูกพักการค้นหา", { skip: NO_MULTI_IP }, async () => {
    const a = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "08:00", end: "08:30" }),
    );
    const b = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "08:30", end: "09:00" }),
    );
    assert.equal(a.status, 200);
    const [c1, c2] = [a.data.bookings[0].code, b.data.bookings[0].code];
    assert.notEqual(c1.slice(-4), c2.slice(-4));
    for (let i = 0; i < 5; i++) {
      const r = await callFrom(
        t.base,
        `127.0.3.${i + 2}`,
        "POST",
        "/api/lookup",
        {
          code: c1,
          phone: `0800000${i}0`,
        },
      );
      assert.equal(r.status, 404);
    }
    const right = await callFrom(t.base, "127.0.3.50", "POST", "/api/lookup", {
      code: c1,
      phone: "081-234-5678",
    });
    assert.equal(right.status, 429, "รหัสที่ถูกเดาเบอร์หลายครั้งต้องถูกพัก");
    const other = await callFrom(t.base, "127.0.3.51", "POST", "/api/lookup", {
      code: c2,
      phone: "081-234-5678",
    });
    assert.equal(other.status, 200);
    assert.ok(
      !("approvedBy" in other.data.bookings[0]),
      "ไม่เปิดเผยชื่อบัญชีผู้ดูแล",
    );
    assert.ok(!("createdIp" in other.data.bookings[0]));
  });

  it("จำกัดการจองตามจำนวนรายการจริง (จองซ้ำหลายวันนับทุกวัน)", async () => {
    const t2 = await startServer();
    try {
      await t2.admin("POST", "/api/admin/login", {
        username: "admin",
        password: INITIAL_PW,
      });
      await t2.admin("POST", "/api/admin/password", {
        current: INITIAL_PW,
        next: ADMIN_PW,
      });
      await t2.admin("PUT", "/api/admin/settings", {
        settings: { bookingRateLimitPerHour: 5, maxRecurring: 12 },
      });
      const holidays = (await t2.call("GET", "/api/config")).data.holidays.map(
        (h) => h.date,
      );
      const d = nextWorkday(2, holidays);
      const r = await t2.call("POST", "/api/bookings", {
        ...booking(d, { start: "10:00", end: "11:00" }),
        repeat: { type: "weekly", count: 8 },
        skipConflicts: true,
      });
      assert.equal(r.status, 429);
    } finally {
      t2.close();
    }
  });

  it("แก้ไขเนื้อหาหลังอนุมัติแล้ว ต้องกลับไปรออนุมัติใหม่", async () => {
    await t.admin("PUT", "/api/admin/settings", {
      settings: { requireApproval: true },
    });
    const r = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "15:00", end: "16:00" }),
    );
    assert.equal(r.status, 200);
    const b = r.data.bookings[0];
    assert.equal(b.status, "pending");
    await t.admin("POST", `/api/admin/bookings/${b.id}/status`, {
      status: "approved",
    });
    const edit = await t.call("PATCH", `/api/bookings/${b.id}`, {
      token: r.data.token,
      title: "หัวข้อที่เปลี่ยนหลังอนุมัติ",
    });
    assert.equal(edit.status, 200, JSON.stringify(edit.data));
    assert.equal(edit.data.statusReset, true);
    assert.equal(edit.data.booking.status, "pending");
    await t.admin("PUT", "/api/admin/settings", {
      settings: { requireApproval: false },
    });
  });

  it("สถานะที่ไม่ใช่ค่าที่กำหนด (เช่น constructor) ถูกปฏิเสธ", async () => {
    const r = await t.call(
      "POST",
      "/api/bookings",
      booking(day, { start: "16:00", end: "17:00" }),
    );
    const id = r.data.bookings[0].id;
    for (const status of ["constructor", "__proto__", "toString"]) {
      const s = await t.admin("POST", `/api/admin/bookings/${id}/status`, {
        status,
      });
      assert.equal(s.status, 400, status);
    }
    const bulk = await t.admin("POST", "/api/admin/bookings/bulk", {
      ids: [id],
      action: "constructor",
    });
    assert.equal(bulk.status, 400);
  });

  it("ลบบันทึกกิจกรรม 30 วันล่าสุดไม่ได้", async () => {
    const r = await t.admin(
      "DELETE",
      `/api/admin/logs?before=${addDays(bkkNow().date, 1)}`,
    );
    assert.equal(r.status, 400);
    const old = await t.admin(
      "DELETE",
      `/api/admin/logs?before=${addDays(bkkNow().date, -40)}`,
    );
    assert.equal(old.status, 200);
  });

  it("กู้คืนข้อมูล: ตรวจทุกค่า ไม่แทนที่บัญชีผู้ใช้ และไม่ลบบันทึกเดิม", async () => {
    const backup = (await t.admin("GET", "/api/admin/backup")).data;
    const admins = JSON.stringify(t.app.store.db.admins.map((a) => a.username));
    const logsBefore = t.app.store.logs.length;
    const evil = structuredClone(backup.db);
    evil.settings.sessionHours = "x";
    evil.settings.maxRecurring = 1e9;
    evil.settings.logRetentionDays = null;
    evil.admins = [
      {
        id: "evil",
        username: "evil",
        role: "admin",
        passHash: "scrypt$AAAA$AAAA",
        active: true,
      },
    ];
    evil.bookings.push({
      id: "bad1",
      code: "X",
      date: "2026-02-31",
      start: "09:00",
      end: "10:00",
      status: "approved",
    });
    evil.bookings.push({
      id: "bad2",
      code: "Y",
      date: day,
      start: "xx",
      end: "10:00",
      status: "approved",
    });
    const r = await t.admin("POST", "/api/admin/restore", {
      db: evil,
      logs: [{ ts: 1, action: "forged", detail: "x\nforged line" }],
      restoreLogs: true,
      confirmPassword: ADMIN_PW,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const s = t.app.store.db.settings;
    assert.equal(typeof s.sessionHours, "number");
    assert.ok(s.maxRecurring <= 52);
    assert.equal(typeof s.logRetentionDays, "number");
    assert.ok(r.data.rejectedSettings.includes("maxRecurring"));
    assert.equal(r.data.skipped.bookings, 2);
    assert.equal(
      JSON.stringify(t.app.store.db.admins.map((a) => a.username)),
      admins,
    );
    assert.ok(t.app.store.logs.length > logsBefore, "บันทึกเดิมต้องยังอยู่");
    const forged = t.app.store.logs.find((l) => l.action === "forged");
    assert.equal(forged.imported, true);
    assert.ok(!forged.detail.includes("\n"));
  });

  it("ไฟล์ข้อมูลที่ถูกแก้ไขด้วยค่าผิดกฎ จะใช้ค่าเริ่มต้นแทนตอนเปิดระบบ", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "br-load-"));
    try {
      const app = createApp({ dataDir: dir, initialPassword: INITIAL_PW });
      app.stop();
      const file = path.join(dir, "db.json");
      const db = JSON.parse(fs.readFileSync(file, "utf8"));
      db.settings.backupKeepDays = 0;
      db.settings.slotMinutes = 0;
      db.settings.logo = `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`;
      db.bookings.push({
        id: "n1",
        code: "Z",
        date: "bad",
        start: "09:00",
        end: "10:00",
        status: "approved",
      });
      fs.writeFileSync(file, JSON.stringify(db));
      const app2 = createApp({ dataDir: dir });
      const s = app2.store.db.settings;
      assert.ok(s.backupKeepDays >= 1);
      assert.ok(s.slotMinutes > 0);
      assert.equal(s.logo, "");
      assert.equal(app2.store.db.bookings.length, 0);
      app2.stop();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("รันบนคลาวด์: IP จริงหลัง proxy และเครือข่ายสำนักงาน", () => {
  const { ipMatcher, proxyAwareIp } = require("../src/http");
  const fakeReq = (peer, xff) => ({
    socket: { remoteAddress: peer },
    headers: xff === undefined ? {} : { "x-forwarded-for": xff },
  });

  it("ไม่เชื่อ X-Forwarded-For ถ้าไม่ได้ตั้ง proxy ที่เชื่อถือ (กันปลอม IP)", () => {
    const ipOf = proxyAwareIp(null);
    assert.equal(
      ipOf(fakeReq("::ffff:198.51.100.7", "1.2.3.4")),
      "198.51.100.7",
    );
  });

  it("อ่าน IP จริงจาก proxy ที่เชื่อถือ และไม่สนค่าที่ผู้ใช้ปลอมมาเอง", () => {
    const ipOf = proxyAwareIp(ipMatcher(["loopback", "10.0.0.0/8"]));
    assert.equal(ipOf(fakeReq("127.0.0.1", "198.51.100.7")), "198.51.100.7");
    // ผู้ใช้ส่ง X-Forwarded-For ปลอมมา proxy ต่อท้ายด้วย IP จริง
    assert.equal(
      ipOf(fakeReq("127.0.0.1", "1.2.3.4, 198.51.100.7, 10.1.2.3")),
      "198.51.100.7",
    );
    assert.equal(ipOf(fakeReq("127.0.0.1", "junk")), "127.0.0.1");
    assert.equal(ipOf(fakeReq("127.0.0.1")), "127.0.0.1");
    // คำขอที่ไม่ได้มาจาก proxy ใช้ IP ที่เชื่อมต่อจริงเสมอ
    assert.equal(ipOf(fakeReq("203.0.113.9", "1.2.3.4")), "203.0.113.9");
  });

  it("ตรวจรูปแบบ IP/เครือข่ายที่ตั้งค่าไว้", () => {
    const m = ipMatcher(["203.0.113.0/24", "2001:db8::/32"]);
    assert.ok(m("203.0.113.77"));
    assert.ok(m("2001:db8::1"));
    assert.ok(!m("198.51.100.1"));
    assert.ok(!m("not-an-ip"));
    assert.throws(() => ipMatcher(["203.0.113.0/40"]));
    assert.throws(() => ipMatcher(["example.com"]));
  });

  it("ล็อกเฉพาะ IP ที่เดารหัสผิด ไม่ล็อกทุกคนที่มาทาง proxy เดียวกัน และผ่อนเพดานให้ IP สำนักงาน", async () => {
    const t = await startServer({
      trustProxy: ["loopback"],
      officeIps: ["203.0.113.10"],
      publicUrl: "https://booking.example.go.th",
    });
    const send = async (xff, url, body, cookie) => {
      const res = await fetch(t.base + url, {
        method: body ? "POST" : "GET",
        headers: {
          "x-requested-with": "br",
          "x-forwarded-for": xff,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: res.status,
        data: await res.json(),
        cookie: res.headers.get("set-cookie") || "",
      };
    };
    try {
      for (let i = 0; i < 8; i++)
        await send("198.51.100.20", "/api/admin/login", {
          username: "nobody",
          password: "wrong-password-x",
        });
      const blocked = await send("198.51.100.20", "/api/admin/login", {
        username: "nobody",
        password: "wrong-password-x",
      });
      assert.equal(blocked.status, 429);
      // ผู้ใช้อีกคน (IP อื่น) ยังเข้าสู่ระบบได้ตามปกติ
      const other = await send("198.51.100.21", "/api/admin/login", {
        username: "admin",
        password: INITIAL_PW,
      });
      assert.equal(other.status, 200);
      assert.match(other.cookie, /; Secure/);
      const sys = await send(
        "1.2.3.4, 198.51.100.21",
        "/api/admin/system",
        undefined,
        other.cookie.split(";")[0],
      );
      // บัญชียังต้องเปลี่ยนรหัสผ่าน: ระบบตอบ 403 แต่ไม่ใช่ 401 = เซสชันผูกกับ IP จริงถูกต้อง
      assert.equal(sys.status, 403);

      // IP สำนักงาน: ผิดเกิน 8 ครั้งยังไม่ถูกพักทั้งสำนักงาน
      for (let i = 0; i < 10; i++) {
        const r = await send("203.0.113.10", "/api/admin/login", {
          username: `staff${i}`,
          password: "wrong-password-x",
        });
        assert.equal(r.status, 401);
      }
      const cfg = await send("203.0.113.10", "/api/config");
      assert.deepEqual(cfg.data.serverUrls, ["https://booking.example.go.th"]);
    } finally {
      t.close();
    }
  });
});

describe("ล้างข้อมูลการจอง", () => {
  let t;
  before(async () => {
    t = await startServer();
    await t.admin("POST", "/api/admin/login", {
      username: "admin",
      password: INITIAL_PW,
    });
    await t.admin("POST", "/api/admin/password", {
      current: INITIAL_PW,
      next: ADMIN_PW,
    });
  });
  after(() => t.close());

  it("ลบเฉพาะการจองเก่า ลบทั้งหมด และกู้คืนจากไฟล์สำรองก่อนลบได้", async () => {
    const day = nextWorkday(3);
    for (const start of ["09:00", "11:00", "14:00"]) {
      const r = await t.call(
        "POST",
        "/api/bookings",
        booking(day, { start, end: `${Number(start.slice(0, 2)) + 1}:00` }),
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    const db = t.app.store.db;
    db.bookings[0].date = addDays(bkkNow().date, -400); // จำลองการจองเมื่อปีก่อน
    const today = bkkNow().date;

    const noPw = await t.admin("POST", "/api/admin/purge", {
      scope: "before",
      before: today,
    });
    assert.notEqual(noPw.status, 200, "ต้องยืนยันรหัสผ่านก่อนลบ");
    const future = await t.admin("POST", "/api/admin/purge", {
      scope: "before",
      before: addDays(today, 7),
      confirmPassword: ADMIN_PW,
    });
    assert.equal(future.status, 400, "ห้ามลบการจองที่ยังไม่ถึงวัน");
    assert.equal(db.bookings.length, 3);

    const old = await t.admin("POST", "/api/admin/purge", {
      scope: "before",
      before: addDays(today, -365),
      confirmPassword: ADMIN_PW,
    });
    assert.equal(old.status, 200, JSON.stringify(old.data));
    assert.equal(old.data.removed, 1);
    assert.equal(t.app.store.db.bookings.length, 2);
    assert.match(old.data.snapshot, /^prepurge-/);

    const noWord = await t.admin("POST", "/api/admin/purge", {
      scope: "all",
      confirmPassword: ADMIN_PW,
    });
    assert.equal(noWord.status, 400, "ต้องพิมพ์คำยืนยัน");
    const all = await t.admin("POST", "/api/admin/purge", {
      scope: "all",
      confirmText: "ลบทั้งหมด",
      confirmPassword: ADMIN_PW,
    });
    assert.equal(all.status, 200, JSON.stringify(all.data));
    assert.equal(all.data.removed, 2);
    assert.equal(t.app.store.db.bookings.length, 0);

    const logs = await t.admin("GET", "/api/admin/logs?q=purge");
    assert.equal(logs.status, 200);
    assert.ok(
      t.app.store.logs.filter((l) => l.action === "system.purge").length === 2,
    );

    // กู้คืนจากไฟล์สำรองที่ระบบเก็บไว้ก่อนลบทั้งหมด
    const list = (await t.admin("GET", "/api/admin/backups")).data.backups;
    assert.ok(list.some((b) => b.name === all.data.snapshot));
    const snap = await t.admin(
      "GET",
      `/api/admin/backups/${encodeURIComponent(all.data.snapshot)}`,
    );
    assert.equal(snap.status, 200);
    const restored = await t.admin("POST", "/api/admin/restore", {
      db: snap.data,
      confirmPassword: ADMIN_PW,
    });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.equal(restored.data.bookings, 2);
  });

  it("ผู้ใช้ที่ไม่ได้เข้าสู่ระบบล้างข้อมูลไม่ได้", async () => {
    const r = await t.call("POST", "/api/admin/purge", {
      scope: "all",
      confirmText: "ลบทั้งหมด",
      confirmPassword: ADMIN_PW,
    });
    assert.equal(r.status, 401);
  });
});
