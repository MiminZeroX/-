// ระบบจองห้องประชุมบน Cloudflare (ไม่ต้องเปิดเครื่องในสำนักงาน)
// - หน้าเว็บ (public/) เสิร์ฟจาก Static Assets พร้อม header ความปลอดภัยชุดเดียวกับเซิร์ฟเวอร์ Node
// - /api/* ส่งต่อไปยัง Durable Object ตัวเดียว ("main") ที่รันระบบเดิม (src/app.js) และเก็บข้อมูลใน SQLite
// - Cloudflare deploy ให้อัตโนมัติเมื่อมีการ push เข้า main (Workers Builds)
// ตั้งค่า (Settings › Variables and Secrets):
//   ADMIN_INITIAL_PASSWORD (Secret, แนะนำ)  รหัสผ่านเริ่มต้นของบัญชี admin ตอนเปิดใช้ครั้งแรก
//   OFFICE_IPS (Variable, ไม่บังคับ)        IP สาธารณะของสำนักงาน คั่นด้วย , (ผ่อนเพดานการใช้งานต่อ IP)
//   PUBLIC_URL (Variable, ไม่บังคับ)        ที่อยู่เว็บหลัก เช่น https://booking.example.go.th

import { DurableObject } from "cloudflare:workers";
import { createApp, SHORT_PATHS } from "../src/app.js";
import { SECURITY_HEADERS } from "../src/http.js";
import { hashPasswordSync, randomId, sha256 } from "../src/security.js";
import { CloudStore } from "./cloud-store.js";
import { serveNode } from "./node-shim.js";

const list = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- หน้าเว็บ
const NO_CACHE = /\.(html|css|js|webmanifest)$/;

function withSecurity(res, extra = {}) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra }))
    out.headers.set(k, v);
  return out;
}

async function serveAsset(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return withSecurity(
      Response.json({ error: "Method not allowed" }, { status: 405 }),
    );
  const short = SHORT_PATHS[url.pathname.replace(/\/+$/, "")];
  if (short)
    return withSecurity(new Response(null, { status: 302 }), {
      Location: short + url.search,
      "Cache-Control": "no-store",
    });
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const res = await env.ASSETS.fetch(
    new Request(new URL(path, url.origin), request),
  );
  if (res.status === 404) {
    const page = await env.ASSETS.fetch(new URL("/404.html", url.origin));
    return withSecurity(new Response(page.body, { status: 404 }), {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
  }
  // html/css/js ตรวจกับเซิร์ฟเวอร์ทุกครั้ง เพื่อให้อัปเดตระบบมีผลทันที
  return withSecurity(res, {
    "Cache-Control": NO_CACHE.test(path) ? "no-cache" : "public, max-age=86400",
  });
}

// ส่งต่อสตรีมอัปเดตสด และยกเลิกฝั่งระบบทันทีที่ผู้ใช้ปิดหน้า
// (ไม่เช่นนั้นระบบจะนับว่าการเชื่อมต่อยังเปิดอยู่ จนอุปกรณ์นั้นเปิดหน้าใหม่ไม่ได้)
function relayStream(request, res) {
  if (!res.body || res.status !== 200) return res;
  const reader = res.body.getReader();
  const stop = () => reader.cancel().catch(() => {});
  request.signal?.addEventListener("abort", stop);
  const body = new ReadableStream({
    async pull(c) {
      try {
        const { done, value } = await reader.read();
        if (done) c.close();
        else c.enqueue(value);
      } catch {
        c.close();
      }
    },
    cancel: stop,
  });
  return new Response(body, res);
}

// ---------------------------------------------------------------- Worker หลัก
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // IP จริงของผู้ใช้จาก Cloudflare (ผู้ใช้ปลอม header นี้ไม่ได้ เพราะเขียนทับทุกครั้ง)
      const headers = new Headers(request.headers);
      headers.set(
        "x-br-client-ip",
        request.headers.get("cf-connecting-ip") || "",
      );
      const app = env.APP.get(env.APP.idFromName("main"));
      const res = await app.fetch(new Request(request, { headers }));
      return url.pathname === "/api/events" ? relayStream(request, res) : res;
    }
    return serveAsset(request, env, url);
  },
};

// ---------------------------------------------------------------- ระบบจอง (Durable Object)
// ช่วงเวลาทำการ (ไทย 07:00–20:00) ปลุกทุก 1 นาทีเพื่อคืนห้องอัตโนมัติ นอกเวลาปลุกทุกชั่วโมง (สำรองข้อมูล/ล้าง log)
function nextAlarmDelay() {
  const hour = new Date(Date.now() + 7 * 3600000).getUTCHours();
  return hour >= 7 && hour < 20 ? 60000 : 3600000;
}

// ลืมรหัสผ่านผู้ดูแลทุกคน: ตั้ง Secret ADMIN_RESET_PASSWORD แล้วเปิดเว็บ — บัญชี admin จะถูกรีเซ็ตเป็นรหัสนั้น
// (ต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ) ทำครั้งเดียวต่อค่าที่ตั้ง จึงไม่รีเซ็ตซ้ำทุกครั้งที่ระบบถูกปลุก — ลบ Secret ได้หลังใช้
function resetAdminOnce(store, password) {
  if (!password) return;
  const mark = sha256(`reset:${password}`);
  if (store.getBlob("admin-reset") === mark) return;
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
  store.putBlob("admin-reset", mark);
  store.addLog({
    level: "security",
    action: "user.update",
    detail: "รีเซ็ตบัญชี admin ด้วย ADMIN_RESET_PASSWORD (Cloudflare)",
    actor: "ระบบ",
  });
}

export class BookingApp extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.app = null;
    this.lastHousekeeping = 0;
  }

  ensure(origin) {
    if (this.app) return this.app;
    const store = new CloudStore(this.ctx.storage.sql, {
      initialPassword: this.env.ADMIN_INITIAL_PASSWORD || "",
    }).load();
    resetAdminOnce(store, this.env.ADMIN_RESET_PASSWORD);
    this.app = createApp({
      store,
      publicDir: false,
      anyHost: true,
      secure: true,
      publicUrl: this.env.PUBLIC_URL || origin || "",
      officeIps: list(this.env.OFFICE_IPS),
      platform: "Cloudflare Workers · Durable Object",
      // ปิดสตรีมอัปเดตสดทุก 2 นาที (เบราว์เซอร์ต่อใหม่เอง) — การเชื่อมต่อที่ผู้ใช้ปิดไปแล้ว
      // จะไม่ค้างนับเกิน 2 นาที แม้ Cloudflare ไม่ได้แจ้งว่าผู้ใช้ตัดการเชื่อมต่อ
      sseMaxMs: (Number(this.env.SSE_MAX_SECONDS) || 120) * 1000,
      // ทั้งสำนักงานมักออกเน็ตด้วย IP เดียวกัน และบน Cloudflare ไม่มีข้อจำกัดจำนวนการเชื่อมต่อแบบเซิร์ฟเวอร์เดี่ยว
      ssePerIp: 100,
    });
    this.app.start({ scheme: "https", log: store.firstRun });
    this.lastHousekeeping = Date.now();
    this.ctx.storage.getAlarm().then((at) => {
      if (at == null) this.ctx.storage.setAlarm(Date.now() + nextAlarmDelay());
    });
    return this.app;
  }

  async fetch(request) {
    const app = this.ensure(new URL(request.url).origin);
    return serveNode(
      app.handle,
      request,
      request.headers.get("x-br-client-ip") || "",
    );
  }

  async alarm() {
    const app = this.ensure("");
    app.autoRelease();
    if (Date.now() - this.lastHousekeeping >= 3600000) {
      this.lastHousekeeping = Date.now();
      app.housekeeping();
    }
    await this.ctx.storage.setAlarm(Date.now() + nextAlarmDelay());
  }
}

// คลาสเดิมของลิงก์ส่งต่อไป Quick Tunnel (เลิกใช้แล้ว) — คงไว้ให้ migration เดิมของ Durable Object ถูกต้อง
export class TunnelTarget extends DurableObject {}
