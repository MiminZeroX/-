"use strict";

const os = require("os");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Store } = require("./store");
const {
  SETTINGS_SCHEMA,
  PUBLIC_SETTING_KEYS,
  fixedHolidays,
} = require("./defaults");
const {
  HttpError,
  SECURITY_HEADERS,
  sendJson,
  sendFile,
  readJson,
  redirect,
  createHostCheck,
  hostName,
  parseCookies,
  ipMatcher,
  proxyAwareIp,
  createStatic,
} = require("./http");
const {
  cleanText,
  cleanStr,
  cleanList,
  has,
  validateSetting,
  settingsIssue,
  sanitizeSettings,
  sanitizeBooking,
} = require("./sanitize");
const {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  needsRehash,
  passwordIssue,
  randomToken,
  randomId,
  sha256,
  RateLimiter,
} = require("./security");
const {
  bkkNow,
  toMin,
  toHHMM,
  isDate,
  addDays,
  weekdayOf,
  diffDays,
  toEpoch,
} = require("./time");

const ACTIVE = new Set(["pending", "approved"]);
const STATUS_TH = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};
const COOKIE = "br_sid";
const PHONE_RE = /^[0-9+()#\-\s,./]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
// แฮชหลอกสำหรับตรวจชื่อผู้ใช้ที่ไม่มีอยู่ (เวลาตอบเท่ากัน) — สร้างเมื่อใช้ครั้งแรก
// (Cloudflare Workers ไม่อนุญาตให้สุ่มค่าตอนโหลดโมดูล)
let dummyHash = "";
const DUMMY_HASH = () =>
  dummyHash || (dummyHash = hashPasswordSync("dummy-password-for-timing"));

const digits = (s) => String(s || "").replace(/\D/g, "");
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const thaiDate = (d) =>
  `${Number(d.slice(8, 10))} ${TH_MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(0, 4)) + 543}`;
function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (
    [h ? `${h} ชั่วโมง` : "", m ? `${m} นาที` : ""].filter(Boolean).join(" ") ||
    "0 นาที"
  );
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      const v4 = ni.family === "IPv4" || ni.family === 4;
      if (v4 && !ni.internal && !ni.address.startsWith("169.254."))
        out.push(ni.address);
    }
  }
  return out;
}

// ที่อยู่สั้นที่จำง่าย พาไปยังไฟล์ HTML ของแต่ละหน้า (เช่น /admin -> /admin.html)
const SHORT_PATHS = {
  "/admin": "/admin.html",
  "/display": "/display.html",
  "/calendar": "/calendar.html",
  "/book": "/book.html",
  "/my": "/my.html",
  "/feedback": "/feedback.html",
};

const FEEDBACK_TYPES = {
  complaint: "ร้องเรียน",
  bug: "แจ้งปัญหาการใช้งาน",
  idea: "ข้อเสนอแนะ",
};
const MAX_FEEDBACK = 2000;
// รูปห้อง: ไม่รับ SVG (อาจฝังสคริปต์ได้) ย่อขนาดจากหน้าแอดมินก่อนส่ง
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO = 700000;
const MAX_BACKUP_DAYS = 1200;
// เป้าหมายตัวชี้วัด (KPI) ในรายงานผู้บริหาร — ปรับตัวเลขได้ที่นี่
const KPI_TARGETS = {
  backup: 100, // % ของวันที่มีการสำรองข้อมูลอัตโนมัติ
  utilization: 30, // % ชั่วโมงที่ห้องถูกใช้ เทียบกับเวลาเปิดให้จองในวันทำการ
  cancelRate: 20, // % ยกเลิก/ไม่อนุมัติ ไม่เกิน
  approvalHours: 24, // ชั่วโมงเฉลี่ยในการอนุมัติ ไม่เกิน
  checkinRate: 80, // % การประชุมที่เช็คอินจริง
  feedbackDone: 80, // % เรื่องร้องเรียน/แจ้งปัญหาที่ดำเนินการแล้ว
};

function createApp(opts = {}) {
  // ไม่มี __dirname บน Cloudflare Workers (ที่นั่นส่ง opts.store และ publicDir: false มาเสมอ)
  const here = typeof __dirname === "string" ? __dirname : "";
  const dataDir = opts.dataDir || path.join(here, "..", "data");
  const publicDir = opts.publicDir || path.join(here, "..", "public");
  // opts.store: ที่เก็บข้อมูลแบบอื่น (เช่น Cloudflare Durable Object) แทนไฟล์ใน dataDir
  const store =
    opts.store ||
    new Store(dataDir, {
      initialPassword: opts.initialPassword,
    }).load();
  // ที่อยู่สาธารณะเมื่อรันบนคลาวด์ (เช่น https://booking.example.go.th) ใช้ทำลิงก์/QR
  // และบอกว่าผู้ใช้เข้าผ่าน HTTPS แม้ proxy ด้านหน้าจะส่งต่อมาแบบ HTTP
  const publicUrl = opts.publicUrl ? new URL(opts.publicUrl).origin : "";
  const secureCookie = !!opts.secure || publicUrl.startsWith("https:");
  // proxy ที่เชื่อถือ X-Forwarded-For ได้ และ IP สาธารณะของสำนักงาน (หลายคนใช้ IP เดียวกัน)
  const clientIp = proxyAwareIp(
    opts.trustProxy?.length ? ipMatcher(opts.trustProxy) : null,
  );
  const isOfficeIp = ipMatcher(opts.officeIps || []);
  // ขยายเพดานต่อ IP สำหรับเครือข่ายสำนักงาน ไม่ให้คนหนึ่งใช้งานเยอะแล้วทุกคนโดนจำกัดไปด้วย
  // (การจำกัดต่อบัญชีและต่อรหัสการจองยังคงเดิม จึงยังกันการเดารหัสได้)
  const OFFICE_FACTOR = 20;
  const ipFactor = (ip) => (isOfficeIp(ip) ? OFFICE_FACTOR : 1);
  // รหัสเฉพาะของจอหน้าห้อง (ใช้เช็คอินโดยไม่ต้องมีโทเคนผู้จอง) — สุ่มครั้งแรกแล้วเก็บไว้
  if (!/^[A-Za-z0-9_-]{32,}$/.test(store.db.kioskKey || "")) {
    store.db.kioskKey = randomToken(24);
    store.flushDb();
  }
  // publicDir: false = ไม่เสิร์ฟไฟล์หน้าเว็บเอง (บน Cloudflare หน้าเว็บมาจาก Static Assets)
  const serveStatic =
    opts.publicDir === false ? () => false : createStatic(publicDir);
  // anyHost: ไม่ตรวจชื่อโฮสต์ (บน Cloudflare คำขอมาจาก Worker ด้านหน้าเท่านั้น ไม่มีความเสี่ยง DNS rebinding)
  const hostAllowed = opts.anyHost
    ? () => true
    : createHostCheck(
        opts.hostname === undefined ? os.hostname() : opts.hostname,
        [
          ...(opts.allowedHosts || []),
          ...(publicUrl ? [new URL(publicUrl).hostname] : []),
        ],
      );
  const sessions = new Map(); // sha256(token) -> { adminId, expires, ip, createdAt }
  const sseClients = new Set();
  const ssePerIp = new Map(); // ip -> จำนวนการเชื่อมต่อสด
  const SSE_PER_IP = Number(opts.ssePerIp) || 16;
  const SSE_MAX_MS = Number(opts.sseMaxMs) || 0;
  const warnedHosts = new Set();
  const limits = {
    booking: new RateLimiter(30, 3600000),
    lookup: new RateLimiter(20, 3600000),
    // ค้นหาด้วยรหัสเดียวกันแต่เบอร์ผิดซ้ำ ๆ = เดาเบอร์ → ล็อกรหัสนั้น
    lookupCode: new RateLimiter(5, 3600000),
    login: new RateLimiter(8, 15 * 60000),
    // จำกัดต่อบัญชีด้วย (กันการเดารหัสจากหลายเครื่อง/หลาย IP)
    loginUser: new RateLimiter(12, 15 * 60000),
    password: new RateLimiter(5, 15 * 60000),
    my: new RateLimiter(240, 10 * 60000),
    feedback: new RateLimiter(10, 3600000),
  };
  const MAX_ACTIVE_PER_DEVICE = 60;
  const MAX_HASHING = 4; // จำนวนการตรวจรหัสผ่านพร้อมกันสูงสุด
  let hashing = 0;
  const startedAt = Date.now();
  let port = opts.port || 0;
  let scheme = secureCookie ? "https" : "http";
  const serverUrls = () =>
    publicUrl
      ? [publicUrl]
      : port
        ? lanAddresses().map(
            (ip) =>
              `${scheme}://${ip}${port === (scheme === "https" ? 443 : 80) ? "" : `:${port}`}`,
          )
        : [];
  const timers = [];
  const S = () => store.db.settings;

  // ---------------------------------------------------------------- helpers
  const roomById = (id) => store.db.rooms.find((r) => r.id === id);
  const holidayOn = (date) => store.db.holidays.find((h) => h.date === date);
  const bookingById = (id) => {
    const b = store.db.bookings.find((x) => x.id === id);
    if (!b) throw new HttpError(404, "ไม่พบการจองนี้");
    return b;
  };
  const sortedRooms = () =>
    [...store.db.rooms].sort((a, b) => a.order - b.order);
  const needsApproval = (room) =>
    room.approval === "yes" ||
    (room.approval === "inherit" && S().requireApproval);
  const hasStarted = (b) => toEpoch(b.date, b.start) <= Date.now();
  const hasEnded = (b) => toEpoch(b.date, b.end) <= Date.now();
  const byDateTime = (a, b) =>
    a.date === b.date
      ? a.start.localeCompare(b.start)
      : a.date.localeCompare(b.date);

  function log(ctx, action, detail, extra = {}) {
    store.addLog({
      action,
      detail,
      level: extra.level,
      ref: extra.ref,
      actor: extra.actor || ctx.actor,
      actorType: extra.actorType || ctx.actorType,
      ip: ctx.ip,
      ua: ctx.ua,
    });
  }

  function pushHistory(b, ctx, text) {
    b.history = [
      ...(b.history || []),
      { ts: Date.now(), actor: ctx.actor, text },
    ].slice(-40);
  }

  function describe(b) {
    const room = roomById(b.roomId);
    return `${room ? room.name : b.roomId} ${thaiDate(b.date)} ${b.start}–${b.end} น. "${b.title}"`;
  }

  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of sseClients) {
      try {
        c.write(payload);
      } catch {
        sseClients.delete(c);
      }
    }
  }

  function bookingsChanged(action, list) {
    broadcast("bookings", {
      action,
      dates: [...new Set(list.map((b) => b.date))],
      rooms: [...new Set(list.map((b) => b.roomId))],
      pending: list.some((b) => b.status === "pending"),
      count: list.length,
    });
  }

  // ---------------------------------------------------------------- views
  function publicRoom(r) {
    return {
      id: r.id,
      name: r.name,
      floor: r.floor,
      capacity: r.capacity,
      description: r.description,
      equipment: r.equipment,
      color: r.color,
      active: r.active,
      closedMessage: r.closedMessage,
      needsApproval: needsApproval(r),
      // ที่อยู่รูปแยกจาก /api/config (โหลดทุกหน้า) ให้เบราว์เซอร์แคชได้ เปลี่ยนรูปแล้ว v เปลี่ยนตาม
      photo: r.photo
        ? `/api/rooms/${encodeURIComponent(r.id)}/photo?v=${sha256(r.photo).slice(0, 12)}`
        : "",
    };
  }

  function publicView(b) {
    const s = S();
    const block = b.kind === "block";
    return {
      id: b.id,
      roomId: b.roomId,
      date: b.date,
      start: b.start,
      end: b.end,
      status: b.status,
      kind: b.kind,
      title: block || s.showTitlePublic ? b.title : "",
      organizer: !block && s.showOrganizerPublic ? b.organizer : "",
      department: block ? "" : b.department,
      attendees: b.attendees,
      checkedIn: !!b.checkedIn,
      endedEarly: !!b.endedEarly,
      seriesId: b.seriesId || null,
    };
  }

  // ข้อมูลที่ผู้จองเห็นได้ (กำหนดแบบรายการที่อนุญาต ฟิลด์ใหม่จะไม่รั่วโดยไม่ตั้งใจ)
  const OWNER_FIELDS = [
    "id",
    "code",
    "roomId",
    "date",
    "start",
    "end",
    "status",
    "kind",
    "title",
    "organizer",
    "department",
    "phone",
    "email",
    "note",
    "attendees",
    "equipment",
    "services",
    "seriesId",
    "checkedIn",
    "checkedInAt",
    "endedEarly",
    "released",
    "createdAt",
    "updatedAt",
    "approvedAt",
    "rejectReason",
    "rejectedAt",
    "cancelReason",
    "cancelledAt",
  ];
  function ownerView(b) {
    const out = {};
    for (const k of OWNER_FIELDS) if (has(b, k)) out[k] = b[k];
    return out;
  }

  function adminView(b) {
    // eslint-disable-next-line no-unused-vars
    const { tokenHashes, ...rest } = b;
    return rest;
  }

  function adminPublic(a) {
    return {
      id: a.id,
      username: a.username,
      name: a.name,
      role: a.role,
      active: a.active !== false,
      mustChange: !!a.mustChange,
      createdAt: a.createdAt,
      lastLogin: a.lastLogin,
    };
  }

  function publicSettings() {
    const s = S();
    const out = {};
    for (const k of PUBLIC_SETTING_KEYS) out[k] = s[k];
    return out;
  }

  // ---------------------------------------------------------------- booking rules
  function pickBookingInput(body, base) {
    const b = { ...base };
    if (has(body, "roomId")) b.roomId = cleanStr(body.roomId, 64);
    if (has(body, "date")) b.date = cleanStr(body.date, 10);
    if (has(body, "start")) b.start = cleanStr(body.start, 5);
    if (has(body, "end")) b.end = cleanStr(body.end, 5);
    const texts = {
      title: 200,
      organizer: 100,
      department: 120,
      phone: 30,
      email: 120,
      note: 1000,
    };
    for (const [k, max] of Object.entries(texts))
      if (has(body, k))
        b[k] = k === "note" ? cleanText(body[k], max) : cleanStr(body[k], max);
    if (has(body, "attendees"))
      b.attendees = Math.max(
        0,
        Math.min(10000, parseInt(body.attendees, 10) || 0),
      );
    if (has(body, "equipment")) b.equipment = cleanList(body.equipment);
    if (has(body, "services")) b.services = cleanList(body.services);
    return b;
  }

  function fieldErrors(b, { admin = false, force = false } = {}) {
    const s = S();
    const e = {};
    const room = roomById(b.roomId);
    if (!room || room.archived) e.roomId = "กรุณาเลือกห้องประชุม";
    else if (!room.active && !admin)
      e.roomId = `${room.name}ปิดให้บริการชั่วคราว`;
    if (!isDate(b.date)) e.date = "กรุณาเลือกวันที่ให้ถูกต้อง";
    const sm = toMin(b.start);
    const em = toMin(b.end);
    if (Number.isNaN(sm)) e.start = "กรุณาเลือกเวลาเริ่ม";
    if (Number.isNaN(em)) e.end = "กรุณาเลือกเวลาสิ้นสุด";
    if (!e.start && !e.end && em <= sm)
      e.end = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
    const block = b.kind === "block";
    if (!b.title)
      e.title = block
        ? "กรุณาระบุเหตุผลการปิดห้อง"
        : "กรุณาระบุหัวข้อการประชุม";
    if (!block) {
      if (!b.organizer) e.organizer = "กรุณาระบุชื่อผู้จอง";
      if (!b.department) e.department = "กรุณาเลือกหน่วยงาน";
      if (b.phone) {
        if (!PHONE_RE.test(b.phone)) e.phone = "รูปแบบเบอร์โทรไม่ถูกต้อง";
      } else if (s.requirePhone && !admin) e.phone = "กรุณาระบุเบอร์โทรติดต่อ";
      if (b.email) {
        if (!EMAIL_RE.test(b.email)) e.email = "รูปแบบอีเมลไม่ถูกต้อง";
      } else if (s.requireEmail && !admin) e.email = "กรุณาระบุอีเมล";
      if (!(b.attendees >= 1)) e.attendees = "กรุณาระบุจำนวนผู้เข้าร่วม";
      else if (
        room &&
        s.enforceCapacity &&
        !force &&
        room.capacity &&
        b.attendees > room.capacity
      ) {
        e.attendees = `เกินความจุห้อง (รองรับได้ ${room.capacity} คน)`;
      }
    }
    if (!force && !e.start && !e.end) {
      const open = toMin(s.openTime);
      const close = toMin(s.closeTime);
      const dur = em - sm;
      if (sm < open || em > close)
        e.start = `เวลาจองต้องอยู่ในช่วง ${s.openTime}–${s.closeTime} น.`;
      else if ((sm - open) % s.slotMinutes || (em - open) % s.slotMinutes) {
        e.start = `กรุณาเลือกเวลาตามช่วงละ ${s.slotMinutes} นาที`;
      } else if (dur < s.minDurationMinutes)
        e.end = `ต้องจองอย่างน้อย ${fmtDur(s.minDurationMinutes)}`;
      else if (dur > s.maxDurationMinutes)
        e.end = `จองได้ไม่เกิน ${fmtDur(s.maxDurationMinutes)} ต่อครั้ง`;
    }
    return e;
  }

  function dateIssue(date, start, force) {
    if (force) return null;
    const s = S();
    const now = bkkNow();
    const startMs = toEpoch(date, start);
    if (startMs < now.ms) return "ไม่สามารถจองช่วงเวลาที่ผ่านมาแล้ว";
    if (startMs < now.ms + s.minNoticeMinutes * 60000)
      return `ต้องจองล่วงหน้าอย่างน้อย ${fmtDur(s.minNoticeMinutes)}`;
    if (diffDays(now.date, date) > s.advanceDays)
      return `จองล่วงหน้าได้ไม่เกิน ${s.advanceDays} วัน`;
    const wd = weekdayOf(date);
    if (!s.allowWeekends && (wd === 0 || wd === 6))
      return "ไม่เปิดให้จองวันเสาร์–อาทิตย์";
    const h = holidayOn(date);
    if (h && !s.allowHolidays) return `ตรงกับวันหยุดราชการ (${h.name})`;
    return null;
  }

  function findConflict(roomId, date, start, end, exclude = new Set()) {
    const buf = S().bufferMinutes;
    const sm = toMin(start);
    const em = toMin(end);
    return (
      store.db.bookings.find(
        (o) =>
          o.roomId === roomId &&
          o.date === date &&
          ACTIVE.has(o.status) &&
          !exclude.has(o.id) &&
          sm < toMin(o.end) + buf &&
          toMin(o.start) < em + buf,
      ) || null
    );
  }

  function conflictText(c) {
    return c.kind === "block"
      ? `ห้องปิดใช้งานช่วง ${c.start}–${c.end} น. (${c.title})`
      : `ช่วงเวลานี้มีการจองแล้ว ${c.start}–${c.end} น.`;
  }

  function expandDates(date, repeat) {
    const s = S();
    if (!repeat || !repeat.type || repeat.type === "none" || !s.enableRecurring)
      return [date];
    const count = Math.max(
      1,
      Math.min(s.maxRecurring, parseInt(repeat.count, 10) || 1),
    );
    const out = [date];
    if (repeat.type === "weekly") {
      for (let i = 1; i < count; i++) out.push(addDays(date, 7 * i));
    } else if (repeat.type === "daily") {
      let d = date;
      let guard = 0;
      while (out.length < count && guard++ < count * 4 + 30) {
        d = addDays(d, 1);
        const wd = weekdayOf(d);
        if (!s.allowWeekends && (wd === 0 || wd === 6)) continue;
        if (!s.allowHolidays && holidayOn(d)) continue;
        out.push(d);
      }
    } else {
      throw new HttpError(400, "รูปแบบการจองซ้ำไม่ถูกต้อง");
    }
    return out;
  }

  function throwFieldErrors(errors) {
    const keys = Object.keys(errors);
    if (keys.length)
      throw new HttpError(400, errors[keys[0]], { fields: errors });
  }

  function createBookings(ctx, body, admin) {
    const s = S();
    if (!admin && s.maintenanceMode)
      throw new HttpError(
        503,
        s.maintenanceMessage || "ระบบปิดรับการจองชั่วคราว",
      );
    const force = admin && body.force === true;
    const base = {
      kind: "meeting",
      title: "",
      organizer: "",
      department: "",
      phone: "",
      email: "",
      note: "",
      attendees: 0,
      equipment: [],
      services: [],
    };
    const b = pickBookingInput(body, base);
    if (admin) {
      b.kind = body.kind === "block" ? "block" : "meeting";
      b.adminNote = cleanText(body.adminNote, 500);
      if (b.kind === "block") {
        b.organizer = b.organizer || ctx.actor;
        b.department = "";
        b.attendees = 0;
      }
    }
    throwFieldErrors(fieldErrors(b, { admin, force }));

    const tooMany = (rl) =>
      new HttpError(
        429,
        `จองจากอุปกรณ์นี้ถี่เกินไป ลองใหม่ในอีก ${Math.ceil(rl.retryAfter / 60)} นาที หรือติดต่อผู้ดูแลห้องประชุม`,
      );
    if (!admin) {
      const rl = limits.booking.check(
        ctx.ip,
        s.bookingRateLimitPerHour * ipFactor(ctx.ip),
      );
      if (!rl.ok) throw tooMany(rl);
    }

    const dates = expandDates(b.date, body.repeat);
    const results = dates.map((date) => {
      const issue = dateIssue(date, b.start, force);
      if (issue) return { date, reason: issue, type: "rule" };
      const c = findConflict(b.roomId, date, b.start, b.end);
      if (c)
        return {
          date,
          reason: conflictText(c),
          type: "conflict",
          with: publicView(c),
        };
      return { date, reason: null };
    });
    const bad = results.filter((r) => r.reason);
    const good = results.filter((r) => !r.reason);
    if (
      bad.length &&
      (dates.length === 1 || !body.skipConflicts || !good.length)
    ) {
      const single = dates.length === 1;
      const status = single && bad[0].type === "rule" ? 400 : 409;
      throw new HttpError(
        status,
        single
          ? bad[0].reason
          : `มี ${bad.length} จาก ${dates.length} วันที่จองไม่ได้`,
        {
          conflicts: bad,
        },
      );
    }

    if (!admin) {
      // นับตามจำนวนการจองที่จะสร้างจริง (จองซ้ำหลายวัน = หลายครั้ง)
      const rl = limits.booking.check(
        ctx.ip,
        s.bookingRateLimitPerHour * ipFactor(ctx.ip),
        good.length,
      );
      if (!rl.ok) throw tooMany(rl);
      const fromDevice = store.db.bookings.filter(
        (x) =>
          x.createdIp === ctx.ip &&
          x.createdBy === "public" &&
          ACTIVE.has(x.status) &&
          !hasEnded(x),
      ).length;
      const maxActive = MAX_ACTIVE_PER_DEVICE * ipFactor(ctx.ip);
      if (fromDevice + good.length > maxActive)
        throw new HttpError(
          400,
          `อุปกรณ์นี้มีการจองที่ยังไม่ถึงกำหนด ${fromDevice} รายการแล้ว (สูงสุด ${maxActive}) กรุณาติดต่อผู้ดูแลห้องประชุม`,
        );
    }

    if (!admin && s.maxActivePerPhone > 0 && b.phone) {
      const norm = digits(b.phone);
      const activeCount = store.db.bookings.filter(
        (x) => ACTIVE.has(x.status) && digits(x.phone) === norm && !hasEnded(x),
      ).length;
      if (activeCount + good.length > s.maxActivePerPhone) {
        throw new HttpError(
          400,
          `เบอร์นี้จองได้สูงสุด ${s.maxActivePerPhone} รายการที่ยังไม่ถึงกำหนด (ขณะนี้มี ${activeCount} รายการ)`,
        );
      }
    }

    const room = roomById(b.roomId);
    let status = needsApproval(room) ? "pending" : "approved";
    if (admin) status = body.status === "pending" ? "pending" : "approved";
    const token = randomToken();
    const tokenHash = sha256(token);
    const seriesId = good.length > 1 ? randomId() : null;
    const now = Date.now();
    const created = good.map((r) => {
      const bk = {
        id: randomId(),
        code: store.nextBookingCode(),
        ...b,
        date: r.date,
        status,
        seriesId,
        tokenHashes: [tokenHash],
        checkedIn: false,
        createdAt: now,
        updatedAt: now,
        createdBy: admin ? ctx.actor : "public",
        createdIp: ctx.ip,
        history: [
          {
            ts: now,
            actor: ctx.actor,
            text: admin ? "สร้างโดยผู้ดูแลระบบ" : "สร้างการจอง",
          },
        ],
      };
      if (status === "approved" && !admin && !needsApproval(room))
        bk.approvedBy = "อัตโนมัติ";
      store.db.bookings.push(bk);
      return bk;
    });
    if (!admin)
      limits.booking.hit(
        ctx.ip,
        s.bookingRateLimitPerHour * ipFactor(ctx.ip),
        created.length,
      );
    store.saveDb();

    const first = created[0];
    const series =
      created.length > 1
        ? ` (จองซ้ำ ${created.length} ครั้ง: ${created.map((x) => thaiDate(x.date)).join(", ")})`
        : "";
    const who =
      b.kind === "block" ? "ปิดห้อง" : `โดย ${b.organizer} (${b.department})`;
    log(
      ctx,
      b.kind === "block" ? "booking.block" : "booking.create",
      `${first.code} ${describe(first)} ${who}${series}`,
      {
        ref: first.code,
        actor: admin ? ctx.actor : b.organizer,
      },
    );
    bookingsChanged("create", created);
    return { token, bookings: created, skipped: bad };
  }

  function ownerBooking(ctx, id) {
    const b = bookingById(id);
    const token = ctx.body.token || ctx.req.headers["x-booking-token"];
    if (!token || !b.tokenHashes.includes(sha256(token)))
      throw new HttpError(
        403,
        "อุปกรณ์นี้ไม่มีสิทธิ์จัดการการจองนี้ — ค้นหาด้วยรหัสการจองและเบอร์โทรในหน้า “การจองของฉัน” เพื่อเพิ่มการจองลงในอุปกรณ์นี้",
      );
    return b;
  }

  function applyEdit(ctx, b, body, { admin = false, force = false } = {}) {
    const next = pickBookingInput(body, b);
    if (admin) {
      if (has(body, "kind"))
        next.kind = body.kind === "block" ? "block" : "meeting";
      if (has(body, "adminNote"))
        next.adminNote = cleanText(body.adminNote, 500);
    }
    throwFieldErrors(fieldErrors(next, { admin, force }));
    const timeChanged = ["roomId", "date", "start", "end"].some(
      (k) => next[k] !== b[k],
    );
    if (timeChanged && ACTIVE.has(b.status)) {
      const issue = dateIssue(next.date, next.start, force);
      if (issue) throw new HttpError(400, issue);
      const c = findConflict(
        next.roomId,
        next.date,
        next.start,
        next.end,
        new Set([b.id]),
      );
      if (c)
        throw new HttpError(409, conflictText(c), {
          conflicts: [
            { date: next.date, reason: conflictText(c), with: publicView(c) },
          ],
        });
    }
    const labels = {
      roomId: "ห้อง",
      date: "วันที่",
      start: "เวลาเริ่ม",
      end: "เวลาสิ้นสุด",
      title: "หัวข้อ",
      organizer: "ผู้จอง",
      department: "หน่วยงาน",
      phone: "เบอร์โทร",
      email: "อีเมล",
      note: "หมายเหตุ",
      attendees: "ผู้เข้าร่วม",
      equipment: "อุปกรณ์",
      services: "บริการเสริม",
      kind: "ประเภท",
      adminNote: "บันทึกภายใน",
    };
    const changes = [];
    for (const [k, label] of Object.entries(labels)) {
      const before = Array.isArray(b[k]) ? b[k].join(", ") : String(b[k] ?? "");
      const after = Array.isArray(next[k])
        ? next[k].join(", ")
        : String(next[k] ?? "");
      if (before !== after) {
        const show = (v) =>
          (k === "roomId" ? roomById(v)?.name || v : v) || "-";
        changes.push(
          k === "note" || k === "adminNote"
            ? `${label}`
            : `${label}: ${show(before)} เป็น ${show(after)}`,
        );
      }
    }
    if (!changes.length) return { changed: false, statusReset: false };
    const prevDate = b.date;
    // แก้ไขเนื้อหาที่ผู้อนุมัติพิจารณาไปแล้ว ต้องกลับไปรออนุมัติใหม่
    const reviewChanged = [
      "title",
      "organizer",
      "department",
      "attendees",
      "equipment",
      "services",
    ].some((k) => JSON.stringify(next[k]) !== JSON.stringify(b[k]));
    Object.assign(b, next);
    let statusReset = false;
    if (
      !admin &&
      (timeChanged || reviewChanged) &&
      b.status === "approved" &&
      needsApproval(roomById(b.roomId))
    ) {
      b.status = "pending";
      statusReset = true;
    }
    b.updatedAt = Date.now();
    pushHistory(b, ctx, `แก้ไข: ${changes.join("; ")}`);
    store.saveDb();
    log(ctx, "booking.update", `${b.code} แก้ไข ${changes.join("; ")}`, {
      ref: b.code,
    });
    bookingsChanged("update", [
      b,
      ...(prevDate !== b.date ? [{ ...b, date: prevDate }] : []),
    ]);
    return { changed: true, statusReset };
  }

  function setStatus(ctx, b, status, reason) {
    if (!has(STATUS_TH, status)) throw new HttpError(400, "สถานะไม่ถูกต้อง");
    if (b.status === status) return false;
    if (ACTIVE.has(status) && !ACTIVE.has(b.status)) {
      const c = findConflict(b.roomId, b.date, b.start, b.end, new Set([b.id]));
      if (c)
        throw new HttpError(409, `${b.code}: ${conflictText(c)} (${c.code})`);
    }
    const now = Date.now();
    b.status = status;
    if (status === "approved") {
      b.approvedBy = ctx.actor;
      b.approvedAt = now;
    } else if (status === "rejected") {
      b.rejectReason = reason || "";
      b.rejectedBy = ctx.actor;
      b.rejectedAt = now;
    } else if (status === "cancelled") {
      b.cancelReason = reason || "";
      b.cancelledBy = ctx.actor;
      b.cancelledAt = now;
    }
    b.updatedAt = now;
    pushHistory(
      b,
      ctx,
      `เปลี่ยนสถานะเป็น "${STATUS_TH[status]}"${reason ? ` — ${reason}` : ""}`,
    );
    return true;
  }

  // ---------------------------------------------------------------- rooms validation
  function validateRoom(body, base = {}) {
    const r = { ...base };
    const bad = (field, msg) =>
      new HttpError(400, msg, { fields: { [field]: msg } });
    if (has(body, "name")) r.name = cleanStr(body.name, 80);
    if (has(body, "floor")) r.floor = cleanStr(body.floor, 40);
    if (has(body, "capacity")) r.capacity = parseInt(body.capacity, 10);
    if (has(body, "description"))
      r.description = cleanStr(body.description, 300);
    if (has(body, "equipment")) r.equipment = cleanList(body.equipment, 20, 60);
    if (has(body, "color")) r.color = String(body.color || "");
    if (has(body, "active")) r.active = body.active !== false;
    if (has(body, "approval")) r.approval = String(body.approval || "");
    if (has(body, "closedMessage"))
      r.closedMessage = cleanStr(body.closedMessage, 200);
    if (has(body, "photo")) r.photo = String(body.photo || "");
    if (!r.name) throw bad("name", "กรุณาระบุชื่อห้อง");
    if (!Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > 10000)
      throw bad("capacity", "ความจุต้องเป็นตัวเลข 1–10000");
    if (!/^#[0-9a-f]{6}$/i.test(r.color || ""))
      throw bad("color", "รูปแบบสีไม่ถูกต้อง");
    if (!["inherit", "yes", "no"].includes(r.approval))
      throw bad("approval", "ค่าการอนุมัติไม่ถูกต้อง");
    if (r.photo && !PHOTO_RE.test(r.photo))
      throw bad("photo", "ไฟล์รูปห้องไม่ถูกต้อง (รองรับ JPG, PNG, WEBP)");
    if ((r.photo || "").length > MAX_PHOTO)
      throw bad("photo", "รูปห้องใหญ่เกินไป (ไม่เกินประมาณ 500KB)");
    return r;
  }

  // ---------------------------------------------------------------- auth
  function getSession(req) {
    const tok = parseCookies(req.headers.cookie)[COOKIE];
    if (!tok) return null;
    const key = sha256(tok);
    const sess = sessions.get(key);
    const maxAge = Math.max(24, S().sessionHours) * 3600000;
    if (
      !sess ||
      sess.expires < Date.now() ||
      Date.now() - sess.createdAt > maxAge
    ) {
      sessions.delete(key);
      return null;
    }
    const admin = store.db.admins.find(
      (a) => a.id === sess.adminId && a.active !== false,
    );
    if (!admin) {
      sessions.delete(key);
      return null;
    }
    // คุกกี้ที่ถูกนำไปใช้จากเครื่องอื่น (IP ไม่ตรงกับตอนเข้าสู่ระบบ) ใช้ไม่ได้
    const ip = clientIp(req);
    if (sess.ip !== ip) {
      sessions.delete(key);
      store.addLog({
        level: "security",
        action: "admin.session_ip_mismatch",
        detail: `ยกเลิกเซสชันของ ${admin.username} เพราะถูกใช้จาก IP อื่น (เดิม ${sess.ip})`,
        actor: admin.username,
        actorType: "admin",
        ip,
        ua: String(req.headers["user-agent"] || ""),
      });
      return null;
    }
    sess.expires = Date.now() + S().sessionHours * 3600000;
    return { key, sess, admin };
  }

  function killSessions(adminId, exceptKey) {
    for (const [k, s] of sessions)
      if (s.adminId === adminId && k !== exceptKey) sessions.delete(k);
  }

  function cookie(value, maxAge) {
    return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie ? "; Secure" : ""}`;
  }

  // ---------------------------------------------------------------- routes
  const routes = [];
  function route(method, pattern, handler, opts = {}) {
    const keys = [];
    const re = new RegExp(
      `^${pattern.replace(/:([a-zA-Z]+)/g, (_, k) => {
        keys.push(k);
        return "([^/]+)";
      })}$`,
    );
    routes.push({ method, re, keys, handler, opts });
  }

  // ---------- public ----------
  route("GET", "/api/config", () => ({
    settings: publicSettings(),
    rooms: sortedRooms()
      .filter((r) => !r.archived)
      .map(publicRoom),
    departments: store.db.departments,
    holidays: store.db.holidays,
    now: bkkNow(),
    serverUrls: serverUrls(),
  }));

  route("GET", "/api/rooms/:id/photo", (ctx) => {
    const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(
      roomById(ctx.params.id)?.photo || "",
    );
    if (!m) throw new HttpError(404, "ไม่พบรูปห้อง");
    ctx.res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": m[1],
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    ctx.res.end(Buffer.from(m[2], "base64"));
    return undefined;
  });

  route("GET", "/api/bookings", (ctx) => {
    const today = bkkNow().date;
    const from = ctx.query.get("from") || today;
    const to = ctx.query.get("to") || from;
    const room = ctx.query.get("room");
    if (!isDate(from) || !isDate(to) || to < from)
      throw new HttpError(400, "ช่วงวันที่ไม่ถูกต้อง");
    if (diffDays(from, to) > 62)
      throw new HttpError(400, "ช่วงวันที่กว้างเกินไป (ไม่เกิน 62 วัน)");
    const list = store.db.bookings
      .filter(
        (b) =>
          b.date >= from &&
          b.date <= to &&
          ACTIVE.has(b.status) &&
          (!room || b.roomId === room),
      )
      .sort(byDateTime)
      .map(publicView);
    return { from, to, bookings: list, now: bkkNow() };
  });

  route("POST", "/api/bookings", (ctx) => {
    const res = createBookings(ctx, ctx.body, false);
    return {
      token: res.token,
      bookings: res.bookings.map(ownerView),
      skipped: res.skipped,
    };
  });

  route("POST", "/api/my", (ctx) => {
    const rl = limits.my.hit(ctx.ip, limits.my.limit * ipFactor(ctx.ip));
    if (!rl.ok)
      throw new HttpError(429, "เรียกดูบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
    const tokens = Array.isArray(ctx.body.tokens)
      ? ctx.body.tokens
          .filter(
            (t) => typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t),
          )
          .slice(0, 60)
      : [];
    // สแกนการจองครั้งเดียว แล้วจับคู่ด้วยแฮช
    const byHash = new Map(tokens.map((t) => [sha256(t), []]));
    for (const b of store.db.bookings)
      for (const h of b.tokenHashes) byHash.get(h)?.push(b);
    const result = tokens.map((token) => ({
      token,
      bookings: (byHash.get(sha256(token)) || [])
        .sort(byDateTime)
        .map(ownerView),
    }));
    return { items: result };
  });

  route("POST", "/api/feedback", (ctx) => {
    const type = has(FEEDBACK_TYPES, ctx.body.type) ? ctx.body.type : "";
    const message = cleanText(ctx.body.message, 2000);
    if (!type) throw new HttpError(400, "กรุณาเลือกประเภทเรื่อง");
    if (message.length < 5)
      throw new HttpError(400, "กรุณาเขียนรายละเอียดอย่างน้อย 5 ตัวอักษร");
    const rl = limits.feedback.hit(
      ctx.ip,
      limits.feedback.limit * ipFactor(ctx.ip),
    );
    if (!rl.ok)
      throw new HttpError(429, "ส่งเรื่องบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
    const item = {
      id: randomId(),
      ts: Date.now(),
      type,
      message,
      name: cleanStr(ctx.body.name, 100),
      contact: cleanStr(ctx.body.contact, 100),
      status: "new",
    };
    const list = store.db.feedback;
    list.push(item);
    if (list.length > MAX_FEEDBACK) list.splice(0, list.length - MAX_FEEDBACK);
    store.saveDb();
    log(ctx, "feedback.create", `${FEEDBACK_TYPES[type]}: ${cleanStr(message, 120)}`);
    return { ok: true };
  });

  route("POST", "/api/lookup", (ctx) => {
    const rl = limits.lookup.hit(
      ctx.ip,
      limits.lookup.limit * ipFactor(ctx.ip),
    );
    if (!rl.ok) throw new HttpError(429, "ค้นหาบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
    const code = cleanStr(ctx.body.code, 30).toUpperCase();
    const phone = digits(ctx.body.phone);
    if (!limits.lookupCode.check(code).ok)
      throw new HttpError(
        429,
        "รหัสการจองนี้ถูกค้นหาด้วยเบอร์ที่ไม่ตรงหลายครั้ง ระบบพักการค้นหาไว้ 1 ชั่วโมง กรุณาติดต่อผู้ดูแลห้องประชุม",
      );
    const b = store.db.bookings.find((x) => x.code === code);
    if (!b || !phone || digits(b.phone) !== phone) {
      if (b) limits.lookupCode.hit(code);
      log(ctx, "booking.lookup_fail", `ค้นหาการจองไม่พบ รหัส ${code || "-"}`, {
        level: "warn",
        actor: "ผู้ใช้ทั่วไป",
        actorType: "public",
      });
      throw new HttpError(404, "ไม่พบการจองที่ตรงกับรหัสและเบอร์โทรนี้");
    }
    const token = randomToken();
    const h = sha256(token);
    const group = b.seriesId
      ? store.db.bookings.filter((x) => x.seriesId === b.seriesId)
      : [b];
    for (const x of group) x.tokenHashes = [...x.tokenHashes, h].slice(-10);
    store.saveDb();
    log(ctx, "booking.lookup", `ค้นหาและเพิ่มการจอง ${b.code} ลงในอุปกรณ์`, {
      ref: b.code,
      actor: b.organizer,
      actorType: "public",
    });
    return { token, bookings: group.sort(byDateTime).map(ownerView) };
  });

  route("PATCH", "/api/bookings/:id", (ctx) => {
    const s = S();
    if (s.maintenanceMode) throw new HttpError(503, s.maintenanceMessage);
    if (!s.allowUserEdit)
      throw new HttpError(
        403,
        "ระบบไม่เปิดให้ผู้จองแก้ไขเอง กรุณาติดต่อผู้ดูแลห้องประชุม",
      );
    const b = ownerBooking(ctx, ctx.params.id);
    if (!ACTIVE.has(b.status))
      throw new HttpError(400, "การจองนี้ไม่อยู่ในสถานะที่แก้ไขได้");
    if (hasStarted(b))
      throw new HttpError(400, "การประชุมเริ่มแล้ว ไม่สามารถแก้ไขได้");
    ctx.actor = b.organizer || "ผู้จอง";
    const r = applyEdit(ctx, b, ctx.body);
    return { booking: ownerView(b), ...r };
  });

  route("POST", "/api/bookings/:id/cancel", (ctx) => {
    const s = S();
    if (!s.allowUserCancel)
      throw new HttpError(
        403,
        "ระบบไม่เปิดให้ผู้จองยกเลิกเอง กรุณาติดต่อผู้ดูแลห้องประชุม",
      );
    const b = ownerBooking(ctx, ctx.params.id);
    if (!ACTIVE.has(b.status))
      throw new HttpError(400, "การจองนี้ถูกยกเลิกหรือดำเนินการไปแล้ว");
    if (hasStarted(b))
      throw new HttpError(
        400,
        "การประชุมเริ่มแล้ว หากเลิกประชุมแล้วให้ใช้ปุ่ม “คืนห้องก่อนเวลา”",
      );
    if (
      s.cancelDeadlineMinutes &&
      toEpoch(b.date, b.start) - Date.now() < s.cancelDeadlineMinutes * 60000
    ) {
      throw new HttpError(
        400,
        `ต้องยกเลิกล่วงหน้าอย่างน้อย ${fmtDur(s.cancelDeadlineMinutes)} กรุณาติดต่อผู้ดูแลห้องประชุม`,
      );
    }
    const reason = cleanStr(ctx.body.reason, 300);
    ctx.actor = b.organizer || "ผู้จอง";
    let targets = [b];
    if (ctx.body.scope === "series" && b.seriesId) {
      const shared = new Set(b.tokenHashes);
      targets = store.db.bookings.filter(
        (x) =>
          x.seriesId === b.seriesId &&
          ACTIVE.has(x.status) &&
          !hasStarted(x) &&
          (x.date > b.date || x.id === b.id) &&
          x.tokenHashes.some((h) => shared.has(h)),
      );
    }
    for (const t of targets)
      setStatus(
        ctx,
        t,
        "cancelled",
        reason ? `ผู้จองยกเลิก: ${reason}` : "ผู้จองยกเลิก",
      );
    store.saveDb();
    log(
      ctx,
      "booking.cancel",
      `${targets.map((t) => t.code).join(", ")} ยกเลิกโดยผู้จอง ${describe(b)}${reason ? ` เหตุผล: ${reason}` : ""}`,
      {
        ref: b.code,
      },
    );
    bookingsChanged("cancel", targets);
    return { cancelled: targets.map((t) => t.id) };
  });

  route("POST", "/api/bookings/:id/checkin", (ctx) => {
    const s = S();
    if (!s.checkinEnabled)
      throw new HttpError(400, "ระบบไม่ได้เปิดใช้งานการเช็คอิน");
    const b = bookingById(ctx.params.id);
    if (b.status !== "approved" || b.kind === "block")
      throw new HttpError(400, "การจองนี้ไม่สามารถเช็คอินได้");
    const now = Date.now();
    if (now < toEpoch(b.date, b.start) - s.checkinWindowMinutes * 60000) {
      throw new HttpError(
        400,
        `เช็คอินได้ก่อนเวลาเริ่มไม่เกิน ${s.checkinWindowMinutes} นาที`,
      );
    }
    if (now >= toEpoch(b.date, b.end))
      throw new HttpError(400, "การประชุมนี้สิ้นสุดแล้ว");
    if (!b.checkedIn) {
      const token = typeof ctx.body.token === "string" ? ctx.body.token : "";
      const owner = token && b.tokenHashes.includes(sha256(token));
      // ไม่มีโทเคนผู้จอง: ต้องมาจากจอหน้าห้องที่ผู้ดูแลตั้งค่าไว้ (มีรหัสจอ)
      const kiosk =
        !owner && safeEqual(ctx.req.headers["x-kiosk-key"], store.db.kioskKey);
      if (!owner && !kiosk)
        throw new HttpError(
          403,
          "เช็คอินได้จากหน้า “การจองของฉัน” บนอุปกรณ์ที่ใช้จอง หรือจากจอหน้าห้อง",
        );
      ctx.actor = owner ? b.organizer : "หน้าจอหน้าห้อง";
      b.checkedIn = true;
      b.checkedInAt = now;
      pushHistory(b, ctx, "เช็คอินเข้าใช้ห้อง");
      store.saveDb();
      log(ctx, "booking.checkin", `${b.code} เช็คอิน ${describe(b)}`, {
        ref: b.code,
        actorType: owner ? "public" : "kiosk",
      });
      bookingsChanged("checkin", [b]);
    }
    return { booking: publicView(b) };
  });

  route("POST", "/api/bookings/:id/end", (ctx) => {
    const b = ownerBooking(ctx, ctx.params.id);
    if (b.status !== "approved")
      throw new HttpError(400, "การจองนี้ไม่อยู่ในสถานะที่คืนห้องได้");
    if (!hasStarted(b))
      throw new HttpError(
        400,
        "การประชุมยังไม่เริ่ม หากไม่ใช้ห้องให้กดยกเลิกการจองแทน",
      );
    if (hasEnded(b)) throw new HttpError(400, "การประชุมนี้สิ้นสุดแล้ว");
    const nowMin = bkkNow().minutes;
    const newEnd = Math.max(toMin(b.start) + 5, Math.ceil(nowMin / 5) * 5);
    const oldEnd = b.end;
    ctx.actor = b.organizer || "ผู้จอง";
    b.end = toHHMM(newEnd);
    b.endedEarly = true;
    b.updatedAt = Date.now();
    pushHistory(b, ctx, `คืนห้องก่อนเวลา (เดิมสิ้นสุด ${oldEnd} น.)`);
    store.saveDb();
    log(
      ctx,
      "booking.end",
      `${b.code} คืนห้องก่อนเวลา ${describe(b)} (เดิม ${oldEnd} น.)`,
      { ref: b.code },
    );
    bookingsChanged("end", [b]);
    return { booking: ownerView(b) };
  });

  route("GET", "/api/events", (ctx) => {
    if (sseClients.size >= 1000)
      throw new HttpError(503, "มีผู้เชื่อมต่อมากเกินไป");
    const open = ssePerIp.get(ctx.ip) || 0;
    if (open >= SSE_PER_IP * ipFactor(ctx.ip))
      throw new HttpError(
        429,
        "อุปกรณ์นี้เปิดหน้าระบบไว้หลายหน้าต่างเกินไป กรุณาปิดหน้าที่ไม่ใช้",
      );
    const { req, res } = ctx;
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(
      `retry: 4000\nevent: hello\ndata: ${JSON.stringify({ now: bkkNow() })}\n\n`,
    );
    sseClients.add(res);
    ssePerIp.set(ctx.ip, open + 1);
    // ปิดสตรีมตามรอบ (ใช้บน Cloudflare): แจ้ง "bye" ให้หน้าเว็บรู้ว่าไม่ใช่การหลุด แล้วเบราว์เซอร์ต่อใหม่เอง
    if (SSE_MAX_MS) {
      const timer = setTimeout(() => {
        try {
          res.write("event: bye\ndata: {}\n\n");
          res.end();
        } catch {
          /* ปิดไปแล้ว */
        }
      }, SSE_MAX_MS);
      req.on("close", () => clearTimeout(timer));
    }
    req.on("close", () => {
      sseClients.delete(res);
      const n = (ssePerIp.get(ctx.ip) || 1) - 1;
      if (n > 0) ssePerIp.set(ctx.ip, n);
      else ssePerIp.delete(ctx.ip);
    });
    return undefined;
  });

  // ---------- admin: session ----------
  route("POST", "/api/admin/login", async (ctx) => {
    const username = cleanStr(ctx.body.username, 64).toLowerCase();
    const loginLimit = limits.login.limit * ipFactor(ctx.ip);
    const rl = limits.login.check(ctx.ip, loginLimit);
    const rlUser = limits.loginUser.check(username);
    if (!rl.ok || !rlUser.ok) {
      const wait = Math.max(rl.retryAfter || 0, rlUser.retryAfter || 0);
      throw new HttpError(
        429,
        `เข้าสู่ระบบผิดหลายครั้ง ระบบพักการเข้าสู่ระบบไว้ชั่วคราว ลองใหม่ในอีก ${Math.ceil(wait / 60)} นาที`,
      );
    }
    if (hashing >= MAX_HASHING)
      throw new HttpError(
        503,
        "มีผู้เข้าสู่ระบบพร้อมกันหลายคน ลองใหม่อีกครั้งในไม่กี่วินาที",
      );
    const password = String(ctx.body.password || "").slice(0, 1024);
    const admin = store.db.admins.find(
      (a) => a.username === username && a.active !== false,
    );
    let ok = false;
    hashing++;
    try {
      ok = admin
        ? await verifyPassword(password, admin.passHash)
        : (await verifyPassword(password, DUMMY_HASH())) && false;
      // บัญชีที่ยังใช้แฮชแบบเก่า (เร็วกว่า): ใช้เวลาให้เท่ากันเพื่อไม่ให้เดาชื่อผู้ใช้จากเวลาตอบได้
      if (!ok && admin && needsRehash(admin.passHash))
        await verifyPassword(password, DUMMY_HASH());
    } finally {
      hashing--;
    }
    if (!ok) {
      limits.login.hit(ctx.ip, loginLimit);
      limits.loginUser.hit(username);
      log(
        ctx,
        "admin.login_fail",
        `เข้าสู่ระบบไม่สำเร็จ (ชื่อผู้ใช้: ${username || "-"})`,
        {
          level: "security",
          actor: username || "-",
          actorType: "public",
        },
      );
      throw new HttpError(
        401,
        "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ตรวจสอบภาษาแป้นพิมพ์และปุ่ม Caps Lock แล้วลองอีกครั้ง",
      );
    }
    // ไม่ล้างตัวนับความผิดพลาดของ IP (กันการล้างด้วยบัญชีของตนเองแล้วเดารหัสบัญชีอื่นต่อ)
    limits.loginUser.reset(username);
    // อัปเกรดแฮชรหัสผ่านเก่าให้เป็นมาตรฐานปัจจุบัน
    if (needsRehash(admin.passHash))
      admin.passHash = await hashPassword(password);
    // รหัสผ่านที่ตั้งไว้ก่อนมีนโยบายปัจจุบันและไม่ผ่านเกณฑ์: บังคับตั้งใหม่
    if (
      !admin.mustChange &&
      passwordIssue(password, { username: admin.username, name: admin.name })
    ) {
      admin.mustChange = true;
      log(
        ctx,
        "admin.weak_password",
        "รหัสผ่านไม่ผ่านเกณฑ์ปัจจุบัน ระบบให้ตั้งรหัสใหม่",
        {
          level: "security",
          actor: admin.username,
          actorType: "admin",
        },
      );
    }
    const token = randomToken(32);
    const hours = S().sessionHours;
    sessions.set(sha256(token), {
      adminId: admin.id,
      expires: Date.now() + hours * 3600000,
      ip: ctx.ip,
      createdAt: Date.now(),
    });
    admin.lastLogin = Date.now();
    store.saveDb();
    log(ctx, "admin.login", "เข้าสู่ระบบผู้ดูแล", {
      level: "security",
      actor: admin.username,
      actorType: "admin",
    });
    ctx.setCookie = cookie(token, hours * 3600);
    return { admin: adminPublic(admin) };
  });

  route(
    "POST",
    "/api/admin/logout",
    (ctx) => {
      sessions.delete(ctx.session.key);
      log(ctx, "admin.logout", "ออกจากระบบผู้ดูแล", { level: "security" });
      ctx.setCookie = cookie("", 0);
      return { ok: true };
    },
    { auth: "staff", allowMustChange: true },
  );

  route(
    "GET",
    "/api/admin/me",
    (ctx) => ({ admin: adminPublic(ctx.admin), pendingCount: pendingCount() }),
    {
      auth: "staff",
      allowMustChange: true,
    },
  );

  // ยืนยันตัวตนด้วยรหัสผ่านของผู้ที่กำลังใช้งาน (ก่อนทำรายการสำคัญ)
  // ผิดเกิน 5 ครั้งใน 15 นาที → ออกจากระบบทุกอุปกรณ์ของบัญชีนี้
  async function reauth(ctx, password, field) {
    const key = ctx.admin.id;
    const rl = limits.password.check(key);
    if (!rl.ok) {
      killSessions(key);
      throw new HttpError(
        429,
        "ใส่รหัสผ่านผิดหลายครั้ง ระบบออกจากระบบให้แล้ว กรุณาเข้าสู่ระบบใหม่",
      );
    }
    if (hashing >= MAX_HASHING)
      throw new HttpError(
        503,
        "ระบบกำลังตรวจรหัสผ่านหลายรายการ ลองใหม่อีกครั้งในไม่กี่วินาที",
      );
    hashing++;
    let ok;
    try {
      ok = await verifyPassword(
        String(password || "").slice(0, 1024),
        ctx.admin.passHash,
      );
    } finally {
      hashing--;
    }
    if (!ok) {
      limits.password.hit(key);
      log(ctx, "admin.reauth_fail", "ยืนยันรหัสผ่านไม่สำเร็จ", {
        level: "security",
      });
      const msg = "รหัสผ่านของคุณไม่ถูกต้อง";
      throw new HttpError(400, msg, { fields: { [field]: msg } });
    }
    limits.password.reset(key);
  }

  route(
    "POST",
    "/api/admin/password",
    async (ctx) => {
      const { current, next } = ctx.body;
      await reauth(ctx, current, "current");
      const issue =
        typeof next === "string"
          ? passwordIssue(next, {
              username: ctx.admin.username,
              name: ctx.admin.name,
            })
          : "กรุณาตั้งรหัสผ่านใหม่";
      if (issue)
        throw new HttpError(400, `ตั้งรหัสผ่านนี้ไม่ได้: ${issue}`, {
          fields: { next: issue },
        });
      if (next === current)
        throw new HttpError(400, "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม", {
          fields: { next: "ต้องไม่ซ้ำรหัสเดิม" },
        });
      ctx.admin.passHash = await hashPassword(next);
      ctx.admin.mustChange = false;
      killSessions(ctx.admin.id, ctx.session.key);
      store.saveDb();
      store.clearInitialPassword(ctx.admin.username);
      log(ctx, "admin.password", "เปลี่ยนรหัสผ่านของตนเอง", {
        level: "security",
      });
      return { ok: true };
    },
    { auth: "staff", allowMustChange: true },
  );

  // ---------- admin: dashboard ----------
  function pendingCount() {
    return store.db.bookings.filter(
      (b) => b.status === "pending" && !hasEnded(b),
    ).length;
  }

  route(
    "GET",
    "/api/admin/stats",
    (ctx) => {
      const s = S();
      const now = bkkNow();
      const monthStart = `${now.date.slice(0, 8)}01`;
      const from = isDate(ctx.query.get("from"))
        ? ctx.query.get("from")
        : monthStart;
      let to = isDate(ctx.query.get("to"))
        ? ctx.query.get("to")
        : addDays(addDays(monthStart, 32).slice(0, 8) + "01", -1);
      if (to < from) to = from;
      if (diffDays(from, to) > 400)
        throw new HttpError(400, "ช่วงวันที่กว้างเกินไป");
      const all = store.db.bookings;
      const meetings = all.filter((b) => b.kind !== "block");
      const inRange = meetings.filter((b) => b.date >= from && b.date <= to);
      const activeInRange = inRange.filter((b) => ACTIVE.has(b.status));
      const todayActive = meetings.filter(
        (b) => b.date === now.date && ACTIVE.has(b.status),
      );
      const ongoing = todayActive.filter(
        (b) => toMin(b.start) <= now.minutes && now.minutes < toMin(b.end),
      );

      const days = [];
      for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
      const perDay = days.map((d) => ({
        date: d,
        count: activeInRange.filter((b) => b.date === d).length,
      }));
      const workDays = days.filter((d) => {
        const wd = weekdayOf(d);
        return (
          (s.allowWeekends || (wd !== 0 && wd !== 6)) &&
          (s.allowHolidays || !holidayOn(d))
        );
      }).length;
      const openMin = Math.max(0, toMin(s.closeTime) - toMin(s.openTime));
      const minutesOf = (b) => Math.max(0, toMin(b.end) - toMin(b.start));
      const perRoom = sortedRooms()
        .filter((r) => !r.archived)
        .map((r) => {
          const list = activeInRange.filter((b) => b.roomId === r.id);
          const minutes = list.reduce((sum, b) => sum + minutesOf(b), 0);
          return {
            id: r.id,
            name: r.name,
            floor: r.floor,
            color: r.color,
            count: list.length,
            minutes,
            utilization:
              workDays && openMin
                ? Math.min(1, minutes / (workDays * openMin))
                : 0,
          };
        });
      const deptMap = new Map();
      for (const b of activeInRange)
        deptMap.set(
          b.department || "-",
          (deptMap.get(b.department || "-") || 0) + 1,
        );
      const departments = [...deptMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
      for (const b of activeInRange) {
        const wd = weekdayOf(b.date);
        for (
          let h = Math.floor(toMin(b.start) / 60);
          h * 60 < toMin(b.end) && h < 24;
          h++
        )
          heat[wd][h]++;
      }
      const statusCounts = {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      };
      for (const b of inRange)
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      const totalMinutes = activeInRange.reduce(
        (sum, b) => sum + minutesOf(b),
        0,
      );
      const attendees = activeInRange.reduce(
        (sum, b) => sum + (b.attendees || 0),
        0,
      );
      const pendingList = all
        .filter((b) => b.status === "pending" && !hasEnded(b))
        .sort(byDateTime)
        .slice(0, 10)
        .map(adminView);
      return {
        from,
        to,
        now,
        today: {
          count: todayActive.length,
          ongoing: ongoing.length,
          list: todayActive.sort(byDateTime).map(adminView),
        },
        pendingCount: pendingCount(),
        pendingList,
        range: {
          count: activeInRange.length,
          totalMinutes,
          attendees,
          avgAttendees: activeInRange.length
            ? Math.round(attendees / activeInRange.length)
            : 0,
          cancelled: statusCounts.cancelled + statusCounts.rejected,
          statusCounts,
          workDays,
        },
        perDay,
        perRoom,
        departments,
        heat,
        hours: { open: s.openTime, close: s.closeTime },
      };
    },
    { auth: "staff" },
  );

  // ---------- admin: รายงานตัวชี้วัด (KPI) ----------
  route(
    "GET",
    "/api/admin/kpi",
    (ctx) => {
      const s = S();
      const today = bkkNow().date;
      const from = ctx.query.get("from");
      const to = ctx.query.get("to");
      if (!isDate(from) || !isDate(to) || to < from)
        throw new HttpError(400, "ช่วงวันที่ไม่ถูกต้อง");
      if (diffDays(from, to) > 400)
        throw new HttpError(400, "ช่วงวันที่กว้างเกินไป (ไม่เกิน 1 ปี)");
      const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
      const kpi = (id, label, value, unit, target, better, note = "") => ({
        id,
        label,
        value,
        unit,
        target,
        better, // "high" = ยิ่งมากยิ่งดี, "low" = ยิ่งน้อยยิ่งดี
        pass:
          value === null
            ? null
            : better === "high"
              ? value >= target
              : value <= target,
        note,
      });
      const fromMs = toEpoch(from, "00:00");
      const toMs = toEpoch(addDays(to, 1), "00:00");

      // 1) การสำรองข้อมูลอัตโนมัติ: นับวันตั้งแต่ from ถึงวันนี้ (วันที่ยังไม่มาถึงไม่นับ)
      const backed = new Set(store.db.backupDays);
      for (const f of store.listBackups()) {
        const m = /^db-(\d{4}-\d{2}-\d{2})\.json$/.exec(f.name);
        if (m) backed.add(m[1]);
      }
      const checkDays = [];
      for (let d = from; d <= to && d <= today; d = addDays(d, 1))
        checkDays.push(d);
      const missing = checkDays.filter((d) => !backed.has(d));

      // 2) การใช้งานห้อง
      const meetings = store.db.bookings.filter(
        (b) => b.kind !== "block" && b.date >= from && b.date <= to,
      );
      const active = meetings.filter((b) => ACTIVE.has(b.status));
      const minutesOf = (b) => Math.max(0, toMin(b.end) - toMin(b.start));
      const minutes = active.reduce((sum, b) => sum + minutesOf(b), 0);
      let workDays = 0;
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const wd = weekdayOf(d);
        if (
          (s.allowWeekends || (wd !== 0 && wd !== 6)) &&
          (s.allowHolidays || !holidayOn(d))
        )
          workDays++;
      }
      const rooms = sortedRooms().filter((r) => !r.archived);
      const openMin = Math.max(0, toMin(s.closeTime) - toMin(s.openTime));
      const capacityMin = workDays * openMin * rooms.length;
      const perRoom = rooms.map((r) => {
        const list = active.filter((b) => b.roomId === r.id);
        const m = list.reduce((sum, b) => sum + minutesOf(b), 0);
        return {
          name: `${r.name} ${r.floor}`,
          count: list.length,
          hours: Math.round(m / 6) / 10,
          utilization: pct(m, workDays * openMin),
        };
      });
      const cancelled = meetings.filter(
        (b) => b.status === "cancelled" || b.status === "rejected",
      );
      const manual = meetings.filter(
        (b) =>
          b.approvedAt &&
          b.createdBy === "public" &&
          b.approvedBy !== "อัตโนมัติ",
      );
      const approvalHours = manual.length
        ? Math.round(
            (manual.reduce((sum, b) => sum + (b.approvedAt - b.createdAt), 0) /
              manual.length /
              3600000) *
              10,
          ) / 10
        : null;
      const ended = active.filter((b) => b.status === "approved" && hasEnded(b));
      const checked = ended.filter((b) => b.checkedIn).length;
      const released = meetings.filter((b) => b.released).length;
      const depts = new Set(active.map((b) => b.department).filter(Boolean));

      // 3) เรื่องร้องเรียน / แจ้งปัญหา
      const fb = store.db.feedback.filter((f) => f.ts >= fromMs && f.ts < toMs);
      const fbDone = fb.filter((f) => f.status === "done").length;
      const fbTypes = Object.fromEntries(
        Object.entries(FEEDBACK_TYPES).map(([k, label]) => [
          label,
          fb.filter((f) => f.type === k).length,
        ]),
      );

      // 4) ความปลอดภัย (จากบันทึกกิจกรรม)
      const logs = store.logs.filter((l) => l.ts >= fromMs && l.ts < toMs);
      const count = (action) => logs.filter((l) => l.action === action).length;

      return {
        from,
        to,
        generatedAt: Date.now(),
        kpis: [
          kpi(
            "backup",
            "การสำรองข้อมูลอัตโนมัติครบทุกวัน",
            pct(checkDays.length - missing.length, checkDays.length),
            "%",
            KPI_TARGETS.backup,
            "high",
            missing.length
              ? `ไม่พบการสำรอง ${missing.length} วัน: ${missing.slice(0, 31).map(thaiDate).join(", ")}${missing.length > 31 ? " …" : ""}`
              : `สำรองครบ ${checkDays.length} วัน`,
          ),
          kpi(
            "utilization",
            "อัตราการใช้ห้องประชุม",
            pct(minutes, capacityMin),
            "%",
            KPI_TARGETS.utilization,
            "high",
            `ใช้ ${Math.round(minutes / 6) / 10} ชม. จาก ${Math.round(capacityMin / 6) / 10} ชม. ที่เปิดให้จอง (${workDays} วันทำการ × ${rooms.length} ห้อง)`,
          ),
          kpi(
            "cancelRate",
            "อัตราการยกเลิก/ไม่อนุมัติ",
            pct(cancelled.length, meetings.length),
            "%",
            KPI_TARGETS.cancelRate,
            "low",
            `${cancelled.length} จาก ${meetings.length} รายการ`,
          ),
          kpi(
            "approvalHours",
            "ระยะเวลาอนุมัติเฉลี่ย",
            approvalHours,
            "ชม.",
            KPI_TARGETS.approvalHours,
            "low",
            manual.length
              ? `จากคำขอที่ต้องอนุมัติ ${manual.length} รายการ`
              : "ไม่มีคำขอที่ต้องอนุมัติในช่วงนี้",
          ),
          kpi(
            "checkinRate",
            "อัตราการเช็คอินเข้าใช้ห้องจริง",
            s.checkinEnabled ? pct(checked, ended.length) : null,
            "%",
            KPI_TARGETS.checkinRate,
            "high",
            s.checkinEnabled
              ? `เช็คอิน ${checked} จาก ${ended.length} การประชุมที่จบแล้ว · คืนห้องอัตโนมัติ ${released} ครั้ง`
              : "ปิดการเช็คอินอยู่ในการตั้งค่า",
          ),
          kpi(
            "feedbackDone",
            "เรื่องร้องเรียน/แจ้งปัญหาที่ดำเนินการแล้ว",
            pct(fbDone, fb.length),
            "%",
            KPI_TARGETS.feedbackDone,
            "high",
            fb.length
              ? `${fbDone} จาก ${fb.length} เรื่อง`
              : "ไม่มีเรื่องร้องเรียนในช่วงนี้",
          ),
        ],
        usage: {
          bookings: active.length,
          hours: Math.round(minutes / 6) / 10,
          attendees: active.reduce((sum, b) => sum + (b.attendees || 0), 0),
          departments: depts.size,
          cancelled: cancelled.length,
          released,
          perRoom,
        },
        feedback: { total: fb.length, done: fbDone, byType: fbTypes },
        security: {
          logins: count("admin.login"),
          loginFails: count("admin.login_fail") + count("admin.reauth_fail"),
          events: logs.filter((l) => l.level === "security").length,
          manualBackups: count("system.backup"),
        },
      };
    },
    { auth: "staff" },
  );

  // ---------- admin: bookings ----------
  function filterAdminBookings(q) {
    const from = q.get("from");
    const to = q.get("to");
    const room = q.get("room");
    const status = q.get("status") || "all";
    const kind = q.get("kind");
    const text = (q.get("q") || "").trim().toLowerCase();
    const now = bkkNow();
    let list = store.db.bookings.filter((b) => {
      if (isDate(from) && b.date < from) return false;
      if (isDate(to) && b.date > to) return false;
      if (room && b.roomId !== room) return false;
      if (kind && b.kind !== kind) return false;
      if (status === "active" && !ACTIVE.has(b.status)) return false;
      if (
        status === "upcoming" &&
        !(
          ACTIVE.has(b.status) &&
          (b.date > now.date ||
            (b.date === now.date && toMin(b.end) > now.minutes))
        )
      )
        return false;
      if (STATUS_TH[status] && b.status !== status) return false;
      if (text) {
        const hay = [
          b.code,
          b.title,
          b.organizer,
          b.department,
          b.phone,
          b.email,
          b.note,
          b.adminNote,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
    const sort = q.get("sort") || "date_desc";
    if (sort === "date_asc") list.sort(byDateTime);
    else if (sort === "created_desc")
      list.sort((a, b) => b.createdAt - a.createdAt);
    else list.sort((a, b) => byDateTime(b, a));
    return list;
  }

  route(
    "GET",
    "/api/admin/bookings",
    (ctx) => {
      const list = filterAdminBookings(ctx.query);
      const size = Math.max(
        1,
        Math.min(200, parseInt(ctx.query.get("size"), 10) || 25),
      );
      const pages = Math.max(1, Math.ceil(list.length / size));
      const page = Math.max(
        1,
        Math.min(pages, parseInt(ctx.query.get("page"), 10) || 1),
      );
      return {
        items: list.slice((page - 1) * size, page * size).map(adminView),
        total: list.length,
        page,
        pages,
        size,
        pendingCount: pendingCount(),
      };
    },
    { auth: "staff" },
  );

  route(
    "GET",
    "/api/admin/bookings.csv",
    (ctx) => {
      const list = filterAdminBookings(ctx.query);
      const esc = (v) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const head = [
        "รหัสการจอง",
        "ห้อง",
        "วันที่",
        "เวลาเริ่ม",
        "เวลาสิ้นสุด",
        "หัวข้อ",
        "ผู้จอง",
        "หน่วยงาน",
        "เบอร์โทร",
        "อีเมล",
        "ผู้เข้าร่วม",
        "อุปกรณ์",
        "บริการเสริม",
        "หมายเหตุ",
        "สถานะ",
        "ประเภท",
        "เช็คอิน",
        "สร้างเมื่อ",
      ];
      const rows = list.map((b) => [
        b.code,
        roomById(b.roomId)?.name || b.roomId,
        thaiDate(b.date),
        b.start,
        b.end,
        b.title,
        b.organizer,
        b.department,
        b.phone,
        b.email,
        b.attendees,
        (b.equipment || []).join(" / "),
        (b.services || []).join(" / "),
        b.note,
        STATUS_TH[b.status],
        b.kind === "block" ? "ปิดห้อง" : "ประชุม",
        b.checkedIn ? "ใช่" : "",
        new Date(b.createdAt + 7 * 3600000)
          .toISOString()
          .slice(0, 16)
          .replace("T", " "),
      ]);
      const csv = `﻿${[head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")}`;
      log(ctx, "export.csv", `ส่งออกรายการจอง ${list.length} รายการ (CSV)`);
      sendFile(
        ctx.res,
        200,
        csv,
        "text/csv; charset=utf-8",
        `bookings-${bkkNow().date}.csv`,
      );
      return undefined;
    },
    { auth: "staff" },
  );

  route(
    "POST",
    "/api/admin/bookings",
    (ctx) => {
      const res = createBookings(ctx, ctx.body, true);
      return { bookings: res.bookings.map(adminView), skipped: res.skipped };
    },
    { auth: "staff" },
  );

  route(
    "PATCH",
    "/api/admin/bookings/:id",
    (ctx) => {
      const b = bookingById(ctx.params.id);
      const r = applyEdit(ctx, b, ctx.body, {
        admin: true,
        force: ctx.body.force === true,
      });
      return { booking: adminView(b), ...r };
    },
    { auth: "staff" },
  );

  route(
    "POST",
    "/api/admin/bookings/:id/status",
    (ctx) => {
      const b = bookingById(ctx.params.id);
      const status = String(ctx.body.status || "");
      const reason = cleanStr(ctx.body.reason, 300);
      if (setStatus(ctx, b, status, reason)) {
        store.saveDb();
        log(
          ctx,
          `booking.${status === "approved" ? "approve" : status === "rejected" ? "reject" : status === "cancelled" ? "cancel" : "status"}`,
          `${b.code} เปลี่ยนเป็น ${STATUS_TH[status]} ${describe(b)}${reason ? ` เหตุผล: ${reason}` : ""}`,
          { ref: b.code },
        );
        bookingsChanged("status", [b]);
      }
      return { booking: adminView(b) };
    },
    { auth: "staff" },
  );

  route(
    "POST",
    "/api/admin/bookings/bulk",
    (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids.slice(0, 500) : [];
      const action = String(ctx.body.action || "");
      const reason = cleanStr(ctx.body.reason, 300);
      const map = {
        approve: "approved",
        reject: "rejected",
        cancel: "cancelled",
        pending: "pending",
      };
      if (!has(map, action) && action !== "delete")
        throw new HttpError(400, "คำสั่งไม่ถูกต้อง");
      if (action === "delete" && ctx.admin.role !== "admin")
        throw new HttpError(403, "เฉพาะผู้ดูแลระบบเท่านั้นที่ลบข้อมูลได้");
      const done = [];
      const errors = [];
      for (const id of ids) {
        const b = store.db.bookings.find((x) => x.id === id);
        if (!b) continue;
        try {
          if (action === "delete") {
            store.db.bookings.splice(store.db.bookings.indexOf(b), 1);
            done.push(b);
          } else if (setStatus(ctx, b, map[action], reason)) done.push(b);
        } catch (err) {
          errors.push(err.message);
        }
      }
      if (done.length) {
        store.saveDb();
        const label = {
          approve: "อนุมัติ",
          reject: "ไม่อนุมัติ",
          cancel: "ยกเลิก",
          pending: "ตั้งเป็นรออนุมัติ",
          delete: "ลบ",
        }[action];
        log(
          ctx,
          `booking.bulk_${action}`,
          `${label} ${done.length} รายการ: ${done.map((b) => b.code).join(", ")}${reason ? ` เหตุผล: ${reason}` : ""}`,
          {
            level: action === "delete" ? "warn" : "info",
          },
        );
        bookingsChanged(action, done);
      }
      return { done: done.length, errors };
    },
    { auth: "staff" },
  );

  route(
    "DELETE",
    "/api/admin/bookings/:id",
    (ctx) => {
      const b = bookingById(ctx.params.id);
      store.db.bookings.splice(store.db.bookings.indexOf(b), 1);
      store.saveDb();
      log(
        ctx,
        "booking.delete",
        `ลบการจอง ${b.code} ${describe(b)} ออกจากระบบถาวร`,
        { level: "warn", ref: b.code },
      );
      bookingsChanged("delete", [b]);
      return { ok: true };
    },
    { auth: "admin" },
  );

  // ---------- admin: เรื่องร้องเรียน / แจ้งปัญหา / ข้อเสนอแนะ ----------
  route(
    "GET",
    "/api/admin/feedback",
    () => ({ items: [...store.db.feedback].reverse(), types: FEEDBACK_TYPES }),
    { auth: "staff" },
  );

  route(
    "PATCH",
    "/api/admin/feedback/:id",
    (ctx) => {
      const f = store.db.feedback.find((x) => x.id === ctx.params.id);
      if (!f) throw new HttpError(404, "ไม่พบเรื่องนี้");
      f.status = ctx.body.status === "done" ? "done" : "new";
      store.saveDb();
      log(
        ctx,
        "feedback.update",
        `${f.status === "done" ? "ดำเนินการแล้ว" : "เปิดเรื่องใหม่"}: ${FEEDBACK_TYPES[f.type] || ""} ${cleanStr(f.message, 80)}`,
      );
      return { item: f };
    },
    { auth: "staff" },
  );

  // ลบเรื่องถาวร (มีชื่อ/เบอร์ผู้แจ้ง — ลบเมื่อพ้นระยะเก็บข้อมูลส่วนบุคคล หรือเจ้าของข้อมูลขอให้ลบ)
  route(
    "DELETE",
    "/api/admin/feedback/:id",
    (ctx) => {
      const list = store.db.feedback;
      const i = list.findIndex((x) => x.id === ctx.params.id);
      if (i < 0) throw new HttpError(404, "ไม่พบเรื่องนี้");
      const [f] = list.splice(i, 1);
      store.saveDb();
      log(
        ctx,
        "feedback.delete",
        `ลบเรื่อง${FEEDBACK_TYPES[f.type] || ""}ถาวร: ${cleanStr(f.message, 80)}`,
        { level: "warn" },
      );
      return { ok: true };
    },
    { auth: "admin" },
  );

  // ---------- admin: settings ----------
  route("GET", "/api/admin/settings", () => ({ settings: S() }), {
    auth: "admin",
  });

  route(
    "PUT",
    "/api/admin/settings",
    (ctx) => {
      const input =
        ctx.body.settings && typeof ctx.body.settings === "object"
          ? ctx.body.settings
          : {};
      const next = { ...S() };
      const changed = [];
      for (const [k, v] of Object.entries(input)) {
        const val = validateSetting(k, v);
        if (JSON.stringify(val) !== JSON.stringify(next[k])) {
          next[k] = val;
          changed.push(k);
        }
      }
      const issue = settingsIssue(next);
      if (issue) throw issue;
      if (!changed.length) return { settings: S(), changed };
      store.db.settings = next;
      store.saveDb();
      const short = (v) => {
        const s =
          typeof v === "string" && v.startsWith("data:")
            ? "[รูปภาพ]"
            : JSON.stringify(v);
        return s.length > 60 ? `${s.slice(0, 57)}...` : s;
      };
      log(
        ctx,
        "settings.update",
        `แก้ไขการตั้งค่า: ${changed.map((k) => `${k}=${short(next[k])}`).join(", ")}`,
      );
      broadcast("config", { changed });
      return { settings: S(), changed };
    },
    { auth: "admin", limit: 1024 * 1024 },
  );

  // ---------- admin: rooms ----------
  route("GET", "/api/admin/rooms", () => ({ rooms: sortedRooms() }), {
    auth: "staff",
  });

  route(
    "POST",
    "/api/admin/rooms",
    (ctx) => {
      const r = validateRoom(ctx.body, {
        equipment: [],
        color: "#0f766e",
        active: true,
        approval: "inherit",
        description: "",
        floor: "",
        closedMessage: "",
      });
      r.id = `room-${randomId().slice(0, 6)}`;
      r.archived = false;
      r.order = Math.max(0, ...store.db.rooms.map((x) => x.order)) + 1;
      store.db.rooms.push(r);
      store.saveDb();
      log(
        ctx,
        "room.create",
        `เพิ่มห้อง ${r.name} ${r.floor} (ความจุ ${r.capacity} คน)`,
      );
      broadcast("config", { changed: ["rooms"] });
      return { room: r };
    },
    { auth: "admin", limit: 1024 * 1024 },
  );

  route(
    "PUT",
    "/api/admin/rooms/order",
    (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids : [];
      ids.forEach((id, i) => {
        const r = roomById(id);
        if (r) r.order = i + 1;
      });
      store.saveDb();
      log(
        ctx,
        "room.reorder",
        `จัดลำดับห้องใหม่: ${sortedRooms()
          .map((r) => r.name)
          .join(", ")}`,
      );
      broadcast("config", { changed: ["rooms"] });
      return { rooms: sortedRooms() };
    },
    { auth: "admin" },
  );

  route(
    "PUT",
    "/api/admin/rooms/:id",
    (ctx) => {
      const r = roomById(ctx.params.id);
      if (!r || r.archived) throw new HttpError(404, "ไม่พบห้องนี้");
      const next = validateRoom(ctx.body, r);
      const changes = Object.keys(next).filter(
        (k) => JSON.stringify(next[k]) !== JSON.stringify(r[k]),
      );
      Object.assign(r, next);
      store.saveDb();
      if (changes.length) {
        const extra = changes.includes("active")
          ? r.active
            ? " (เปิดให้บริการ)"
            : " (ปิดให้บริการชั่วคราว)"
          : "";
        log(
          ctx,
          "room.update",
          `แก้ไขห้อง ${r.name}: ${changes.join(", ")}${extra}`,
        );
        broadcast("config", { changed: ["rooms"] });
      }
      return { room: r };
    },
    { auth: "admin", limit: 1024 * 1024 },
  );

  route(
    "DELETE",
    "/api/admin/rooms/:id",
    (ctx) => {
      const r = roomById(ctx.params.id);
      if (!r || r.archived) throw new HttpError(404, "ไม่พบห้องนี้");
      const upcoming = store.db.bookings.filter(
        (b) => b.roomId === r.id && ACTIVE.has(b.status) && !hasEnded(b),
      );
      if (upcoming.length && ctx.query.get("force") !== "1") {
        throw new HttpError(
          409,
          `ห้องนี้ยังมีการจองที่ยังไม่ถึงกำหนด ${upcoming.length} รายการ`,
          { upcoming: upcoming.length },
        );
      }
      for (const b of upcoming)
        setStatus(ctx, b, "cancelled", "ยกเลิกเนื่องจากนำห้องออกจากระบบ");
      r.archived = true;
      r.active = false;
      store.saveDb();
      log(
        ctx,
        "room.archive",
        `นำห้อง ${r.name} ออกจากระบบ${upcoming.length ? ` และยกเลิกการจอง ${upcoming.length} รายการ` : ""}`,
        {
          level: "warn",
        },
      );
      broadcast("config", { changed: ["rooms"] });
      if (upcoming.length) bookingsChanged("cancel", upcoming);
      return { ok: true };
    },
    { auth: "admin" },
  );

  // ---------- admin: departments & holidays ----------
  route(
    "PUT",
    "/api/admin/departments",
    (ctx) => {
      const list = cleanList(ctx.body.departments, 200, 120);
      store.db.departments = list;
      store.saveDb();
      log(
        ctx,
        "departments.update",
        `ปรับปรุงรายชื่อหน่วยงาน (${list.length} รายการ)`,
      );
      broadcast("config", { changed: ["departments"] });
      return { departments: list };
    },
    { auth: "admin" },
  );

  route(
    "PUT",
    "/api/admin/holidays",
    (ctx) => {
      const input = Array.isArray(ctx.body.holidays)
        ? ctx.body.holidays.slice(0, 1000)
        : [];
      const map = new Map();
      for (const h of input) {
        const date = cleanStr(h && h.date, 10);
        const name = cleanStr(h && h.name, 100);
        if (!isDate(date))
          throw new HttpError(400, `วันที่ไม่ถูกต้อง: ${date || "-"}`);
        map.set(date, name || "วันหยุด");
      }
      store.db.holidays = [...map.entries()]
        .map(([date, name]) => ({ date, name }))
        .sort((a, b) => a.date.localeCompare(b.date));
      store.saveDb();
      log(
        ctx,
        "holidays.update",
        `ปรับปรุงวันหยุด (${store.db.holidays.length} วัน)`,
      );
      broadcast("config", { changed: ["holidays"] });
      return { holidays: store.db.holidays };
    },
    { auth: "admin" },
  );

  route(
    "GET",
    "/api/admin/holidays/fixed",
    (ctx) => {
      const year = parseInt(ctx.query.get("year"), 10);
      if (!(year >= 2000 && year <= 2200))
        throw new HttpError(400, "ปีไม่ถูกต้อง");
      return { holidays: fixedHolidays(year) };
    },
    { auth: "admin" },
  );

  // ---------- admin: users ----------
  const activeAdmins = () =>
    store.db.admins.filter((a) => a.role === "admin" && a.active !== false);

  route(
    "GET",
    "/api/admin/users",
    () => ({ users: store.db.admins.map(adminPublic) }),
    { auth: "admin" },
  );

  route(
    "POST",
    "/api/admin/users",
    async (ctx) => {
      const username = cleanStr(ctx.body.username, 32).toLowerCase();
      const name = cleanStr(ctx.body.name, 80);
      const role = ctx.body.role === "admin" ? "admin" : "staff";
      const password = String(ctx.body.password || "");
      const fields = {};
      if (!USERNAME_RE.test(username))
        fields.username = "ใช้ a-z, 0-9, . _ - ความยาว 3–32 ตัว";
      else if (store.db.admins.some((a) => a.username === username))
        fields.username = "ชื่อผู้ใช้นี้มีอยู่แล้ว";
      if (!name) fields.name = "กรุณาระบุชื่อ";
      const pwIssue = passwordIssue(password, { username, name });
      if (pwIssue) fields.password = pwIssue;
      throwFieldErrors(fields);
      await reauth(ctx, ctx.body.confirmPassword, "confirmPassword");
      const a = {
        id: randomId(),
        username,
        name,
        role,
        passHash: await hashPassword(password),
        mustChange: true,
        active: true,
        createdAt: Date.now(),
        lastLogin: null,
      };
      store.db.admins.push(a);
      store.saveDb();
      log(
        ctx,
        "user.create",
        `เพิ่มผู้ใช้ ${username} (${role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"})`,
        { level: "security" },
      );
      return { user: adminPublic(a) };
    },
    { auth: "admin" },
  );

  route(
    "PUT",
    "/api/admin/users/:id",
    async (ctx) => {
      const a = store.db.admins.find((x) => x.id === ctx.params.id);
      if (!a) throw new HttpError(404, "ไม่พบผู้ใช้");
      const self = a.id === ctx.admin.id;
      const changes = [];
      if (self && ctx.body.password)
        throw new HttpError(
          400,
          "เปลี่ยนรหัสผ่านของตนเองได้ที่เมนู “เปลี่ยนรหัสผ่าน” (ต้องใส่รหัสผ่านปัจจุบัน)",
          { fields: { password: "ใช้เมนูเปลี่ยนรหัสผ่านแทน" } },
        );
      const roleChange =
        has(ctx.body, "role") &&
        (ctx.body.role === "admin" ? "admin" : "staff") !== a.role;
      // เปลี่ยนสิทธิ์หรือตั้งรหัสผ่านให้ผู้อื่น ต้องยืนยันรหัสผ่านของผู้ดูแลก่อน
      if (roleChange || ctx.body.password)
        await reauth(ctx, ctx.body.confirmPassword, "confirmPassword");
      if (has(ctx.body, "name")) {
        const name = cleanStr(ctx.body.name, 80);
        if (!name)
          throw new HttpError(400, "กรุณาระบุชื่อ", {
            fields: { name: "กรุณาระบุชื่อ" },
          });
        if (name !== a.name) changes.push(`ชื่อเป็น ${name}`);
        a.name = name;
      }
      if (has(ctx.body, "role")) {
        const role = ctx.body.role === "admin" ? "admin" : "staff";
        if (role !== a.role) {
          if (self)
            throw new HttpError(400, "ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้");
          if (a.role === "admin" && activeAdmins().length <= 1)
            throw new HttpError(400, "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน");
          changes.push(
            `สิทธิ์เป็น ${role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}`,
          );
          a.role = role;
        }
      }
      if (has(ctx.body, "active")) {
        const active = ctx.body.active !== false;
        if (active !== (a.active !== false)) {
          if (self)
            throw new HttpError(400, "ไม่สามารถปิดการใช้งานบัญชีของตนเองได้");
          if (!active && a.role === "admin" && activeAdmins().length <= 1)
            throw new HttpError(400, "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน");
          changes.push(active ? "เปิดใช้งาน" : "ปิดใช้งาน");
          a.active = active;
          if (!active) killSessions(a.id);
        }
      }
      if (ctx.body.password) {
        const pw = String(ctx.body.password);
        const pwIssue = passwordIssue(pw, {
          username: a.username,
          name: a.name,
        });
        if (pwIssue)
          throw new HttpError(400, `ตั้งรหัสผ่านนี้ไม่ได้: ${pwIssue}`, {
            fields: { password: pwIssue },
          });
        a.passHash = await hashPassword(pw);
        a.mustChange = true;
        killSessions(a.id);
        changes.push("ตั้งรหัสผ่านใหม่");
      }
      store.saveDb();
      if (changes.length)
        log(
          ctx,
          "user.update",
          `แก้ไขผู้ใช้ ${a.username}: ${changes.join(", ")}`,
          { level: "security" },
        );
      return { user: adminPublic(a) };
    },
    { auth: "admin" },
  );

  route(
    "DELETE",
    "/api/admin/users/:id",
    (ctx) => {
      const a = store.db.admins.find((x) => x.id === ctx.params.id);
      if (!a) throw new HttpError(404, "ไม่พบผู้ใช้");
      if (a.id === ctx.admin.id)
        throw new HttpError(400, "ไม่สามารถลบบัญชีของตนเองได้");
      if (
        a.role === "admin" &&
        a.active !== false &&
        activeAdmins().length <= 1
      )
        throw new HttpError(400, "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน");
      store.db.admins.splice(store.db.admins.indexOf(a), 1);
      killSessions(a.id);
      store.saveDb();
      log(ctx, "user.delete", `ลบผู้ใช้ ${a.username}`, { level: "security" });
      return { ok: true };
    },
    { auth: "admin" },
  );

  // ---------- admin: logs ----------
  function filterLogs(q) {
    const text = (q.get("q") || "").trim().toLowerCase();
    const action = q.get("action") || "";
    const level = q.get("level") || "";
    const from = q.get("from");
    const to = q.get("to");
    const fromMs = isDate(from) ? toEpoch(from, "00:00") : 0;
    const toMs = isDate(to) ? toEpoch(addDays(to, 1), "00:00") : Infinity;
    const out = [];
    for (let i = store.logs.length - 1; i >= 0; i--) {
      const l = store.logs[i];
      if (l.ts < fromMs || l.ts >= toMs) continue;
      if (action && !l.action.startsWith(action)) continue;
      if (level && l.level !== level) continue;
      if (
        text &&
        !`${l.action} ${l.actor} ${l.ip} ${l.detail} ${l.ref}`
          .toLowerCase()
          .includes(text)
      )
        continue;
      out.push(l);
    }
    return out;
  }

  route(
    "GET",
    "/api/admin/logs",
    (ctx) => {
      const list = filterLogs(ctx.query);
      const size = Math.max(
        1,
        Math.min(200, parseInt(ctx.query.get("size"), 10) || 50),
      );
      const pages = Math.max(1, Math.ceil(list.length / size));
      const page = Math.max(
        1,
        Math.min(pages, parseInt(ctx.query.get("page"), 10) || 1),
      );
      const levels = { info: 0, warn: 0, error: 0, security: 0 };
      for (const l of store.logs) levels[l.level] = (levels[l.level] || 0) + 1;
      return {
        items: list.slice((page - 1) * size, page * size),
        total: list.length,
        page,
        pages,
        size,
        levels,
        totalAll: store.logs.length,
      };
    },
    { auth: "admin" },
  );

  route(
    "GET",
    "/api/admin/logs.csv",
    (ctx) => {
      const list = filterLogs(ctx.query);
      const esc = (v) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = list.map((l) => [
        new Date(l.ts + 7 * 3600000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        l.level,
        l.action,
        l.actor,
        l.actorType,
        l.ip,
        l.ref,
        l.detail,
        l.ua,
      ]);
      const head = [
        "เวลา",
        "ระดับ",
        "การกระทำ",
        "ผู้กระทำ",
        "ประเภทผู้กระทำ",
        "IP",
        "อ้างอิง",
        "รายละเอียด",
        "อุปกรณ์",
      ];
      const csv = `﻿${[head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")}`;
      sendFile(
        ctx.res,
        200,
        csv,
        "text/csv; charset=utf-8",
        `logs-${bkkNow().date}.csv`,
      );
      return undefined;
    },
    { auth: "admin" },
  );

  route(
    "DELETE",
    "/api/admin/logs",
    (ctx) => {
      const before = ctx.query.get("before");
      if (!isDate(before)) throw new HttpError(400, "กรุณาระบุวันที่");
      // เก็บบันทึก 30 วันล่าสุดไว้เสมอ เพื่อให้ตรวจสอบย้อนหลังได้แม้บัญชีผู้ดูแลถูกใช้โดยมิชอบ
      const latest = addDays(bkkNow().date, -30);
      if (before > latest)
        throw new HttpError(
          400,
          `ลบได้เฉพาะบันทึกที่เก่ากว่า 30 วัน (ก่อนวันที่ ${thaiDate(latest)} หรือเก่ากว่า)`,
        );
      const cutoff = toEpoch(before, "00:00");
      const n = store.logs.length;
      store.logs = store.logs.filter((l) => l.ts >= cutoff);
      const removed = n - store.logs.length;
      store.saveLogs();
      log(
        ctx,
        "logs.clear",
        `ลบบันทึกกิจกรรมก่อนวันที่ ${thaiDate(before)} จำนวน ${removed} รายการ`,
        { level: "warn" },
      );
      return { removed };
    },
    { auth: "admin" },
  );

  // ---------- admin: backup / restore / system ----------
  route(
    "GET",
    "/api/admin/backup",
    (ctx) => {
      const withLogs = ctx.query.get("logs") === "1";
      const payload = {
        app: "bangrak-room-booking",
        version: 1,
        exportedAt: new Date().toISOString(),
        db: exportDb(),
        ...(withLogs ? { logs: store.logs } : {}),
      };
      log(
        ctx,
        "system.backup",
        `ดาวน์โหลดไฟล์สำรองข้อมูล${withLogs ? " (รวมบันทึกกิจกรรม)" : ""}`,
        { level: "security" },
      );
      const stamp = new Date(Date.now() + 7 * 3600000)
        .toISOString()
        .slice(0, 16)
        .replace(/[-:]/g, "")
        .replace("T", "-");
      sendFile(
        ctx.res,
        200,
        JSON.stringify(payload, null, 1),
        "application/json; charset=utf-8",
        `bangrak-booking-backup-${stamp}.json`,
      );
      return undefined;
    },
    { auth: "admin" },
  );

  // ไฟล์สำรองที่ดาวน์โหลดออกไปไม่มีแฮชรหัสผ่านและรหัสจอหน้าห้อง (ไฟล์อาจถูกคัดลอกไปที่อื่น)
  function exportDb(db = store.db) {
    // eslint-disable-next-line no-unused-vars
    const { kioskKey, ...rest } = db;
    return {
      ...rest,
      admins: (db.admins || []).map(
        // eslint-disable-next-line no-unused-vars
        ({ passHash, ...a }) => a,
      ),
    };
  }

  route("GET", "/api/admin/backups", () => ({ backups: store.listBackups() }), {
    auth: "admin",
  });

  route(
    "GET",
    "/api/admin/backups/:name",
    (ctx) => {
      const raw = store.readBackup(ctx.params.name);
      if (raw === null) throw new HttpError(404, "ไม่พบไฟล์สำรอง");
      log(
        ctx,
        "system.backup",
        `ดาวน์โหลดไฟล์สำรองอัตโนมัติ ${ctx.params.name}`,
        { level: "security" },
      );
      let body;
      try {
        body = JSON.stringify(exportDb(JSON.parse(raw)), null, 1);
      } catch {
        throw new HttpError(500, "ไฟล์สำรองนี้เสียหาย อ่านไม่ได้");
      }
      sendFile(
        ctx.res,
        200,
        body,
        "application/json; charset=utf-8",
        ctx.params.name,
      );
      return undefined;
    },
    { auth: "admin" },
  );

  // ข้อมูลจากไฟล์สำรอง: ทุกค่าต้องผ่านกฎเดียวกับการบันทึกปกติ
  function sanitizeRestore(data) {
    const { settings, rejected } = sanitizeSettings(data.settings);
    const roomIds = new Set();
    const rooms = [];
    for (const raw of data.rooms.slice(0, 200)) {
      if (!raw || typeof raw !== "object") continue;
      const id = cleanStr(raw.id, 64);
      if (!/^[a-z0-9_-]{1,64}$/i.test(id) || roomIds.has(id)) continue;
      try {
        const r = validateRoom(raw, {
          equipment: [],
          active: true,
          approval: "inherit",
          description: "",
          floor: "",
          closedMessage: "",
        });
        r.id = id;
        r.archived = raw.archived === true;
        r.order = Number.isFinite(raw.order) ? raw.order : rooms.length + 1;
        roomIds.add(id);
        rooms.push(r);
      } catch {
        /* ห้องที่ข้อมูลไม่ถูกต้องจะถูกข้าม */
      }
    }
    const bookingIds = new Set();
    const bookings = [];
    for (const raw of data.bookings.slice(0, 200000)) {
      const b = sanitizeBooking(raw);
      if (!b || bookingIds.has(b.id)) continue;
      bookingIds.add(b.id);
      bookings.push(b);
    }
    const holidays = Array.isArray(data.holidays)
      ? data.holidays
          .filter((h) => h && isDate(h.date))
          .slice(0, 1000)
          .map((h) => ({
            date: h.date,
            name: cleanStr(h.name, 100) || "วันหยุด",
          }))
      : [];
    const counters = {};
    if (data.counters && typeof data.counters === "object")
      for (const [k, v] of Object.entries(data.counters))
        if (/^\d{4}$/.test(k) && Number.isInteger(v) && v >= 0) counters[k] = v;
    return {
      db: {
        ...store.db,
        settings,
        rooms,
        bookings,
        departments: cleanList(data.departments, 200, 120),
        holidays,
        counters,
      },
      rejected,
      skipped: {
        rooms: data.rooms.length - rooms.length,
        bookings: data.bookings.length - bookings.length,
      },
    };
  }

  const LOG_LEVELS = new Set(["info", "warn", "security", "error"]);
  function sanitizeLog(l) {
    if (!l || typeof l !== "object" || !Number.isFinite(l.ts)) return null;
    return {
      ts: l.ts,
      level: LOG_LEVELS.has(l.level) ? l.level : "info",
      action: cleanStr(l.action, 60),
      detail: cleanStr(l.detail, 2000),
      actor: cleanStr(l.actor, 100),
      actorType: cleanStr(l.actorType, 20),
      ip: cleanStr(l.ip, 64),
      ua: cleanStr(l.ua, 300),
      ref: cleanStr(l.ref, 40),
      imported: true,
    };
  }

  route(
    "POST",
    "/api/admin/restore",
    async (ctx) => {
      const body = ctx.body;
      await reauth(ctx, body.confirmPassword, "confirmPassword");
      const data = body.db && typeof body.db === "object" ? body.db : body;
      const valid =
        data &&
        typeof data === "object" &&
        data.settings &&
        typeof data.settings === "object" &&
        Array.isArray(data.rooms) &&
        Array.isArray(data.bookings);
      if (!valid)
        throw new HttpError(
          400,
          "ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบจองห้องประชุม เลือกไฟล์ .json ที่ดาวน์โหลดจากเมนูสำรองข้อมูล",
        );
      const clean = sanitizeRestore(data);
      if (!clean.db.rooms.length)
        throw new HttpError(
          400,
          "ไฟล์สำรองนี้ไม่มีข้อมูลห้องที่ใช้ได้ จึงไม่ได้กู้คืน",
        );
      const snap = store.snapshot("prerestore");
      // บัญชีผู้ใช้และรหัสจอหน้าห้องคงเดิมเสมอ (ไฟล์สำรองอาจถูกแก้ไขระหว่างทาง)
      store.replaceDb(clean.db);
      let importedLogs = 0;
      if (Array.isArray(body.logs) && body.restoreLogs) {
        const known = new Set(
          store.logs.map((l) => `${l.ts}|${l.action}|${l.detail}`),
        );
        const add = body.logs
          .slice(-50000)
          .map(sanitizeLog)
          .filter((l) => l && !known.has(`${l.ts}|${l.action}|${l.detail}`));
        importedLogs = add.length;
        for (const l of add) l.id = ++store.logSeq;
        store.logs = [...store.logs, ...add]
          .sort((x, y) => x.ts - y.ts)
          .slice(-50000);
        store.flushLogs();
      }
      store.flushDb();
      log(
        ctx,
        "system.restore",
        `กู้คืนข้อมูลจากไฟล์สำรอง (การจอง ${store.db.bookings.length} รายการ, ห้อง ${store.db.rooms.length} ห้อง` +
          `${importedLogs ? `, นำเข้าบันทึก ${importedLogs} รายการ` : ""}` +
          `${clean.skipped.bookings || clean.skipped.rooms ? `, ข้ามข้อมูลที่ไม่ถูกต้อง: การจอง ${clean.skipped.bookings} ห้อง ${clean.skipped.rooms}` : ""}` +
          `${clean.rejected.length ? `, ใช้ค่าเริ่มต้นแทน: ${clean.rejected.join(", ")}` : ""}) — สำรองข้อมูลเดิมไว้ที่ ${snap}`,
        { level: "security" },
      );
      broadcast("config", { changed: ["all"] });
      broadcast("bookings", {
        action: "restore",
        dates: [],
        rooms: [],
        count: 0,
      });
      return {
        ok: true,
        bookings: store.db.bookings.length,
        rooms: store.db.rooms.length,
        skipped: clean.skipped,
        rejectedSettings: clean.rejected,
        snapshot: snap,
      };
    },
    { auth: "admin", limit: 40 * 1024 * 1024 },
  );

  // ล้างข้อมูลการจอง: ลบการจองที่ผ่านไปแล้วก่อนวันที่กำหนด (ตามระยะเวลาเก็บข้อมูลส่วนบุคคล)
  // หรือลบทั้งหมด (ก่อนเปิดใช้จริง) — ต้องยืนยันรหัสผ่าน และระบบสำรองข้อมูลเดิมไว้ก่อนเสมอ
  const PURGE_ALL_TEXT = "ลบทั้งหมด";
  route(
    "POST",
    "/api/admin/purge",
    async (ctx) => {
      const scope = String(ctx.body.scope || "");
      const before = ctx.body.before;
      const today = bkkNow().date;
      if (scope === "before") {
        if (!isDate(before)) throw new HttpError(400, "กรุณาระบุวันที่");
        if (before > today)
          throw new HttpError(
            400,
            "ลบได้เฉพาะการจองที่ผ่านไปแล้ว เลือกวันที่ไม่เกินวันนี้",
          );
      } else if (scope === "all") {
        if (String(ctx.body.confirmText || "").trim() !== PURGE_ALL_TEXT)
          throw new HttpError(
            400,
            `พิมพ์คำว่า “${PURGE_ALL_TEXT}” เพื่อยืนยันการลบการจองทั้งหมด`,
          );
      } else throw new HttpError(400, "คำสั่งไม่ถูกต้อง");
      await reauth(ctx, ctx.body.confirmPassword, "confirmPassword");
      const drop =
        scope === "all"
          ? store.db.bookings.slice()
          : store.db.bookings.filter((b) => b.date < before);
      if (!drop.length) return { removed: 0, snapshot: null };
      const snap = store.snapshot("prepurge");
      const gone = new Set(drop);
      store.db.bookings = store.db.bookings.filter((b) => !gone.has(b));
      store.flushDb();
      log(
        ctx,
        "system.purge",
        `${scope === "all" ? "ล้างการจองทั้งหมด" : `ลบการจองก่อนวันที่ ${thaiDate(before)}`} จำนวน ${drop.length} รายการ — สำรองข้อมูลเดิมไว้ที่ ${snap}`,
        { level: "security" },
      );
      broadcast("bookings", {
        action: "purge",
        dates: [],
        rooms: [],
        count: drop.length,
      });
      return { removed: drop.length, snapshot: snap };
    },
    { auth: "admin" },
  );

  // รหัสจอหน้าห้อง: ผู้ดูแลใช้สร้างลิงก์สำหรับแท็บเล็ตหน้าห้อง (ให้เช็คอินได้)
  route("GET", "/api/admin/kiosk-key", () => ({ key: store.db.kioskKey }), {
    auth: "admin",
  });
  route(
    "POST",
    "/api/admin/kiosk-key",
    async (ctx) => {
      await reauth(ctx, ctx.body.confirmPassword, "confirmPassword");
      store.db.kioskKey = randomToken(24);
      store.saveDb();
      log(
        ctx,
        "system.kiosk_key",
        "สร้างรหัสจอหน้าห้องใหม่ (จอเดิมต้องเปิดลิงก์ใหม่)",
        {
          level: "security",
        },
      );
      return { key: store.db.kioskKey };
    },
    { auth: "admin" },
  );

  route(
    "GET",
    "/api/admin/system",
    (ctx) => ({
      yourIp: ctx.ip,
      officeNetwork: isOfficeIp(ctx.ip),
      port,
      lanUrls: serverUrls(),
      cloud: !!publicUrl,
      hostname: os.hostname(),
      platform: opts.platform || `${os.type()} ${os.release()} (${os.arch()})`,
      node: process.version || "",
      startedAt,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      dataDir: store.dir,
      sizes: store.sizes(),
      memoryMB:
        typeof process.memoryUsage === "function"
          ? Math.round(process.memoryUsage().rss / 1048576)
          : 0,
      counts: {
        bookings: store.db.bookings.length,
        rooms: store.db.rooms.filter((r) => !r.archived).length,
        admins: store.db.admins.length,
        logs: store.logs.length,
        sse: sseClients.size,
        sessions: sessions.size,
      },
      now: bkkNow(),
    }),
    { auth: "admin" },
  );

  // ---------------------------------------------------------------- dispatcher
  async function handleApi(req, res, url) {
    const method = req.method === "HEAD" ? "GET" : req.method;
    let match = null;
    let methodMismatch = false;
    for (const r of routes) {
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      if (r.method !== method) {
        methodMismatch = true;
        continue;
      }
      match = { r, m };
      break;
    }
    if (!match)
      throw new HttpError(
        methodMismatch ? 405 : 404,
        methodMismatch ? "Method not allowed" : "ไม่พบ API นี้",
      );
    const { r, m } = match;
    const params = {};
    r.keys.forEach((k, i) => {
      try {
        params[k] = decodeURIComponent(m[i + 1]);
      } catch {
        params[k] = m[i + 1];
      }
    });
    const ctx = {
      req,
      res,
      url,
      query: url.searchParams,
      params,
      body: {},
      ip: clientIp(req),
      ua: String(req.headers["user-agent"] || ""),
      actor: "ผู้ใช้ทั่วไป",
      actorType: "public",
      setCookie: null,
    };
    if (method !== "GET") {
      // ป้องกัน CSRF: เบราว์เซอร์ข้ามโดเมนไม่สามารถส่ง header นี้ได้โดยไม่ผ่าน CORS
      if (req.headers["x-requested-with"] !== "br") {
        req.tooLarge = true; // ไม่อ่านข้อมูลที่เหลือ ปิดการเชื่อมต่อหลังตอบ
        throw new HttpError(403, "คำขอไม่ถูกต้อง");
      }
    }
    // ตรวจสิทธิ์ก่อนอ่านข้อมูลที่ส่งมา: ผู้ไม่ได้เข้าสู่ระบบส่งข้อมูลขนาดใหญ่ไม่ได้
    if (r.opts.auth) {
      const session = getSession(req);
      if (!session) {
        req.tooLarge = true;
        throw new HttpError(
          401,
          "กรุณาเข้าสู่ระบบอีกครั้ง (เซสชันหมดอายุหรือออกจากระบบแล้ว)",
        );
      }
      if (r.opts.auth === "admin" && session.admin.role !== "admin") {
        req.tooLarge = true;
        throw new HttpError(403, "สิทธิ์ของคุณไม่เพียงพอสำหรับเมนูนี้");
      }
      // บัญชีที่ต้องเปลี่ยนรหัสผ่าน ใช้ได้เฉพาะการเปลี่ยนรหัสผ่าน/ออกจากระบบ
      if (session.admin.mustChange && !r.opts.allowMustChange) {
        req.tooLarge = true;
        throw new HttpError(403, "กรุณาเปลี่ยนรหัสผ่านก่อนเริ่มใช้งาน", {
          mustChange: true,
        });
      }
      ctx.session = session;
      ctx.admin = session.admin;
      ctx.actor = session.admin.username;
      ctx.actorType = "admin";
    }
    if (method !== "GET")
      ctx.body = await readJson(req, r.opts.limit || 256 * 1024);
    const result = await r.handler(ctx);
    if (result !== undefined)
      sendJson(
        res,
        200,
        result,
        ctx.setCookie ? { "Set-Cookie": ctx.setCookie } : {},
      );
  }

  // หน้าไม่พบ: ตอบ 404 พร้อมหน้าแนะนำทางกลับ (ไม่พาไปหน้าแรกเงียบ ๆ)
  let notFoundHtml = null;
  function sendNotFound(res) {
    if (notFoundHtml === null) {
      try {
        notFoundHtml = fs.readFileSync(path.join(publicDir, "404.html"));
      } catch {
        notFoundHtml = Buffer.from("Not found");
      }
    }
    res.writeHead(404, {
      ...SECURITY_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(notFoundHtml);
  }

  async function handle(req, res) {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      res.writeHead(400).end();
      return;
    }
    try {
      if (!hostAllowed(req.headers.host)) {
        const h = hostName(req.headers.host) || "(ว่าง)";
        if (!warnedHosts.has(h) && warnedHosts.size < 50) {
          warnedHosts.add(h);
          console.warn(
            `[security] ปฏิเสธคำขอที่ใช้ชื่อโฮสต์ "${h}" — หากเป็นชื่อที่หน่วยงานตั้งไว้เอง ให้เพิ่มด้วย --allowed-hosts=${h}`,
          );
          store.addLog({
            level: "security",
            action: "system.host_block",
            detail: `ปฏิเสธคำขอที่ใช้ชื่อโฮสต์ไม่รู้จัก: ${h.slice(0, 100)}`,
            ip: clientIp(req),
          });
        }
        throw new HttpError(
          421,
          "ชื่อโฮสต์นี้ไม่ได้รับอนุญาต กรุณาเปิดผ่านที่อยู่ IP ของเครื่องแม่ข่าย",
        );
      }
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new HttpError(405, "Method not allowed");
      const short = SHORT_PATHS[url.pathname.replace(/\/+$/, "")];
      if (short) {
        redirect(res, short + url.search);
        return;
      }
      if (
        serveStatic(
          req,
          res,
          url.pathname === "/" ? "/index.html" : url.pathname,
        )
      )
        return;
      sendNotFound(res);
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (err instanceof HttpError) {
        sendJson(
          res,
          err.status,
          { error: err.message, ...(err.data || {}) },
          req.tooLarge ? { Connection: "close" } : {},
        );
      } else {
        console.error("[error]", err);
        store.addLog({
          level: "error",
          action: "system.error",
          detail: `${req.method} ${url.pathname}: ${err.message}`,
          ip: clientIp(req),
        });
        sendJson(res, 500, {
          error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
        });
      }
    }
  }

  // ---------------------------------------------------------------- jobs
  function autoRelease() {
    const s = S();
    if (!s.checkinEnabled || !s.autoReleaseMinutes) return;
    const now = Date.now();
    const today = bkkNow().date;
    const released = [];
    const ctx = { actor: "ระบบ", actorType: "system", ip: "", ua: "" };
    for (const b of store.db.bookings) {
      if (
        b.date !== today ||
        b.status !== "approved" ||
        b.kind === "block" ||
        b.checkedIn
      )
        continue;
      const startMs = toEpoch(b.date, b.start);
      if (b.createdAt > startMs) continue;
      if (
        now > startMs + s.autoReleaseMinutes * 60000 &&
        now < toEpoch(b.date, b.end)
      ) {
        setStatus(
          ctx,
          b,
          "cancelled",
          `ไม่มีการเช็คอินภายใน ${s.autoReleaseMinutes} นาที ระบบคืนห้องอัตโนมัติ`,
        );
        b.released = true;
        released.push(b);
        log(
          ctx,
          "booking.release",
          `${b.code} คืนห้องอัตโนมัติ (ไม่เช็คอิน) ${describe(b)}`,
          { ref: b.code, level: "warn" },
        );
      }
    }
    if (released.length) {
      store.saveDb();
      bookingsChanged("release", released);
    }
  }

  function housekeeping() {
    try {
      store.dailyBackup();
      // จดวันที่สำรองสำเร็จไว้ในฐานข้อมูล (ไฟล์สำรองถูกลบตาม backupKeepDays แต่รายงาน KPI ต้องย้อนดูได้)
      const day = bkkNow().date;
      const days = store.db.backupDays;
      if (days.at(-1) !== day) {
        days.push(day);
        if (days.length > MAX_BACKUP_DAYS) days.splice(0, days.length - MAX_BACKUP_DAYS);
        store.saveDb();
      }
    } catch (err) {
      console.error("[backup]", err.message);
    }
    store.pruneLogs();
    Object.values(limits).forEach((l) => l.prune());
    for (const [k, sess] of sessions)
      if (sess.expires < Date.now()) sessions.delete(k);
  }

  function start(info = {}) {
    if (info.port) port = info.port;
    if (info.scheme) scheme = info.scheme;
    // บน Cloudflare ระบบถูกปลุกขึ้นบ่อย จึงไม่บันทึก "เริ่มระบบ" ทุกครั้ง
    if (info.log !== false)
      store.addLog({
        action: "system.start",
        detail: `เริ่มระบบ (พอร์ต ${port}, Node ${process.version})`,
        actor: "ระบบ",
      });
    housekeeping();
    timers.push(setInterval(autoRelease, 30000));
    timers.push(setInterval(housekeeping, 3600000));
    timers.push(
      setInterval(() => {
        for (const c of sseClients) {
          try {
            c.write(": ping\n\n");
          } catch {
            sseClients.delete(c);
          }
        }
      }, 25000),
    );
    timers.forEach((t) => t.unref && t.unref());
  }

  function stop() {
    timers.splice(0).forEach(clearInterval);
    for (const c of sseClients) {
      try {
        c.end();
      } catch {
        /* ignore */
      }
    }
    sseClients.clear();
    store.flushAll();
  }

  return {
    handle,
    start,
    stop,
    store,
    autoRelease,
    housekeeping,
    get firstRun() {
      return store.firstRun;
    },
    get initialPassword() {
      return store.initialPassword;
    },
  };
}

module.exports = { createApp, lanAddresses, SHORT_PATHS };
