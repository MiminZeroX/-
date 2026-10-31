"use strict";

// ตัวตรวจ/ทำความสะอาดข้อมูลที่ใช้ร่วมกัน ทั้งตอนบันทึกปกติ ตอนกู้คืนข้อมูล และตอนโหลดไฟล์ข้อมูล
// (ข้อมูลทุกทางเข้าต้องผ่านกฎเดียวกัน ไม่มีทางลัดที่ข้ามการตรวจ)

const { HttpError } = require("./http");
const { DEFAULT_SETTINGS, SETTINGS_SCHEMA } = require("./defaults");
const { toMin, isDate } = require("./time");

// ตัดอักขระควบคุมและอักขระกลับทิศข้อความ (ใช้ปลอมแปลงชื่อ/ข้อความได้)
const CONTROL_RE =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

// ข้อความหลายบรรทัด (หมายเหตุ)
function cleanText(v, max) {
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v)
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_RE, "")
    .trim()
    .slice(0, max);
}

// ข้อความบรรทัดเดียว: รวมการขึ้นบรรทัด/แท็บเป็นช่องว่าง กันการปลอมบรรทัดใน log และ CSV
function cleanStr(v, max) {
  return cleanText(v, max * 2)
    .replace(/\s*[\n\t\u2028\u2029]+\s*/g, " ")
    .slice(0, max);
}

function cleanList(v, maxItems = 30, maxLen = 60) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => cleanStr(x, maxLen)).filter(Boolean))].slice(
    0,
    maxItems,
  );
}

// SVG ที่มีสคริปต์หรือลิงก์ภายนอก (โลโก้ต้องเป็นรูปภาพล้วน)
function unsafeSvg(dataUrl) {
  const m = /^data:image\/svg\+xml;base64,(.*)$/.exec(dataUrl);
  if (!m) return false;
  const text = Buffer.from(m[1], "base64").toString("utf8").toLowerCase();
  return /<script|<foreignobject|<iframe|<embed|<object|<!entity|\bon[a-z]+\s*=|javascript:|\bhref\s*=\s*["']?(?![\s"']*(#|data:image\/))/.test(
    text,
  );
}

function validateSetting(key, value) {
  const sc = has(SETTINGS_SCHEMA, key) ? SETTINGS_SCHEMA[key] : null;
  const bad = (msg) => new HttpError(400, msg, { field: key });
  if (!sc) throw bad(`ไม่รู้จักการตั้งค่า "${key}"`);
  switch (sc.type) {
    case "bool":
      if (typeof value !== "boolean") throw bad("ค่าต้องเป็น เปิด/ปิด");
      return value;
    case "int": {
      const n =
        typeof value === "number" || typeof value === "string"
          ? Number(value)
          : NaN;
      if (!Number.isInteger(n) || n < sc.min || n > sc.max)
        throw bad(`กรุณาระบุตัวเลข ${sc.min}–${sc.max}`);
      return n;
    }
    case "str": {
      if (typeof value !== "string") throw bad("รูปแบบข้อความไม่ถูกต้อง");
      const v = value.replace(/\r\n?/g, "\n").replace(CONTROL_RE, "").trim();
      if (v.length < (sc.min || 0)) throw bad("กรุณากรอกข้อมูล");
      if (v.length > sc.max) throw bad(`ข้อความยาวเกิน ${sc.max} ตัวอักษร`);
      return v;
    }
    case "time":
      if (typeof value !== "string" || Number.isNaN(toMin(value)))
        throw bad("รูปแบบเวลาไม่ถูกต้อง");
      return value;
    case "enum": {
      const found = sc.values.find((v) => v === value || String(v) === value);
      if (found === undefined) throw bad("ค่าที่เลือกไม่ถูกต้อง");
      return found;
    }
    case "list": {
      if (!Array.isArray(value)) throw bad("รูปแบบรายการไม่ถูกต้อง");
      const list = cleanList(value, 1000, 1000);
      if (list.length > sc.maxItems)
        throw bad(`รายการได้ไม่เกิน ${sc.maxItems} รายการ`);
      if (list.some((v) => v.length > sc.maxLen))
        throw bad(`แต่ละรายการยาวไม่เกิน ${sc.maxLen} ตัวอักษร`);
      return list;
    }
    case "dataurl": {
      if (value === "") return "";
      const ok =
        typeof value === "string" &&
        /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(
          value,
        );
      if (!ok)
        throw bad("ไฟล์รูปภาพไม่ถูกต้อง (รองรับ PNG, JPG, WEBP, GIF, SVG)");
      if (value.length > sc.max)
        throw bad("ไฟล์รูปภาพใหญ่เกินไป (ไม่เกินประมาณ 300KB)");
      if (unsafeSvg(value))
        throw bad(
          "ไฟล์ SVG นี้มีสคริปต์หรือลิงก์ภายนอก กรุณาใช้ไฟล์ PNG หรือ SVG ที่เป็นรูปภาพล้วน",
        );
      return value;
    }
    default:
      throw bad("ไม่รองรับ");
  }
}

// ตรวจความสัมพันธ์ระหว่างค่าต่าง ๆ คืนข้อผิดพลาด (HttpError) หรือ null
function settingsIssue(s) {
  if (toMin(s.openTime) >= toMin(s.closeTime))
    return new HttpError(400, "เวลาเปิดต้องก่อนเวลาปิด", {
      field: "closeTime",
    });
  if (s.minDurationMinutes > s.maxDurationMinutes)
    return new HttpError(400, "ระยะเวลาขั้นต่ำต้องไม่มากกว่าระยะเวลาสูงสุด", {
      field: "minDurationMinutes",
    });
  return null;
}

// การตั้งค่าจากไฟล์ (โหลดตอนเริ่มระบบหรือกู้คืน): ค่าที่ไม่ผ่านกฎจะใช้ค่าเริ่มต้นแทน
// คืน { settings, rejected: [ชื่อการตั้งค่าที่ถูกแทนด้วยค่าเริ่มต้น] }
function sanitizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const settings = {};
  const rejected = [];
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!has(src, key)) {
      settings[key] = DEFAULT_SETTINGS[key];
      continue;
    }
    try {
      settings[key] = validateSetting(key, src[key]);
    } catch {
      settings[key] = DEFAULT_SETTINGS[key];
      rejected.push(key);
    }
  }
  if (settingsIssue(settings)) {
    for (const k of [
      "openTime",
      "closeTime",
      "minDurationMinutes",
      "maxDurationMinutes",
    ]) {
      if (settings[k] !== DEFAULT_SETTINGS[k]) rejected.push(k);
      settings[k] = DEFAULT_SETTINGS[k];
    }
  }
  return { settings, rejected };
}

// การจองจากไฟล์: ต้องมีวันที่/เวลา/สถานะที่ถูกต้อง ข้อความถูกทำความสะอาดเหมือนการบันทึกปกติ
const STATUSES = new Set(["pending", "approved", "rejected", "cancelled"]);
const HASH_RE = /^[0-9a-f]{64}$/;
const BOOKING_TEXT = {
  title: 200,
  organizer: 100,
  department: 120,
  phone: 30,
  email: 120,
};
const BOOKING_OPTIONAL_TEXT = {
  cancelReason: 300,
  rejectReason: 300,
  approvedBy: 100,
  rejectedBy: 100,
  cancelledBy: 100,
  createdBy: 100,
  createdIp: 64,
};
function sanitizeBooking(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanStr(raw.id, 40);
  const code = cleanStr(raw.code, 30);
  const date = cleanStr(raw.date, 10);
  const start = cleanStr(raw.start, 5);
  const end = cleanStr(raw.end, 5);
  if (!id || !code || !isDate(date)) return null;
  const sm = toMin(start);
  const em = toMin(end);
  if (Number.isNaN(sm) || Number.isNaN(em) || em <= sm) return null;
  if (!STATUSES.has(raw.status)) return null;
  const b = {
    id,
    code,
    roomId: cleanStr(raw.roomId, 64),
    date,
    start,
    end,
    kind: raw.kind === "block" ? "block" : "meeting",
    note: cleanText(raw.note, 1000),
    adminNote: cleanText(raw.adminNote, 500),
    attendees: Math.max(0, Math.min(10000, parseInt(raw.attendees, 10) || 0)),
    equipment: cleanList(raw.equipment),
    services: cleanList(raw.services),
    tokenHashes: Array.isArray(raw.tokenHashes)
      ? raw.tokenHashes
          .filter((h) => typeof h === "string" && HASH_RE.test(h))
          .slice(-10)
      : [],
    seriesId: raw.seriesId ? cleanStr(raw.seriesId, 40) : null,
    checkedIn: raw.checkedIn === true,
    endedEarly: raw.endedEarly === true,
    released: raw.released === true,
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((h) => h && typeof h === "object")
          .slice(-40)
          .map((h) => ({
            ts: Number(h.ts) || 0,
            actor: cleanStr(h.actor, 100),
            text: cleanStr(h.text, 600),
          }))
      : [],
  };
  b.status = raw.status;
  for (const [k, max] of Object.entries(BOOKING_TEXT))
    b[k] = cleanStr(raw[k], max);
  for (const [k, max] of Object.entries(BOOKING_OPTIONAL_TEXT))
    if (has(raw, k)) b[k] = cleanStr(raw[k], max);
  for (const k of [
    "createdAt",
    "updatedAt",
    "approvedAt",
    "rejectedAt",
    "cancelledAt",
    "checkedInAt",
  ])
    if (has(raw, k)) b[k] = Number(raw[k]) || 0;
  return b;
}

module.exports = {
  CONTROL_RE,
  has,
  cleanText,
  cleanStr,
  cleanList,
  unsafeSvg,
  validateSetting,
  settingsIssue,
  sanitizeSettings,
  sanitizeBooking,
};
