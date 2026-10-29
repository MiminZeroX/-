"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

// scrypt ตามค่าที่ OWASP แนะนำ (N=2^15, r=8, p=3 ใช้หน่วยความจำ ~32MB ต่อครั้ง)
// รูปแบบที่เก็บ:  scrypt2$N$r$p$salt$hash  — รูปแบบเดิม scrypt$salt$hash (N=2^14,p=1) ยังตรวจได้
// และจะถูกแฮชใหม่อัตโนมัติเมื่อเข้าสู่ระบบสำเร็จ
// การตรวจรหัสผ่านทำแบบ async บน thread pool เพื่อไม่ให้ทั้งเซิร์ฟเวอร์หยุดรอ
const SCRYPT = { N: 32768, r: 8, p: 3 };
const LEGACY = { N: 16384, r: 8, p: 1 };
const MAXMEM = 96 * 1024 * 1024;
const MAX_COST = SCRYPT.N * SCRYPT.r * SCRYPT.p;
const scryptAsync = promisify(crypto.scrypt);

function encode(salt, hash) {
  const { N, r, p } = SCRYPT;
  return `scrypt2$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// ใช้ตอนเริ่มระบบ/สคริปต์บรรทัดคำสั่งเท่านั้น (ยังไม่มีผู้ใช้รอคำตอบ)
function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, {
    ...SCRYPT,
    maxmem: MAXMEM,
  });
  return encode(salt, hash);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(String(password), salt, 64, {
    ...SCRYPT,
    maxmem: MAXMEM,
  });
  return encode(salt, hash);
}

function parseHash(stored) {
  const parts = String(stored || "").split("$");
  let h = null;
  if (parts.length === 3 && parts[0] === "scrypt")
    h = { ...LEGACY, salt: parts[1], hash: parts[2], legacy: true };
  else if (parts.length === 6 && parts[0] === "scrypt2") {
    const [N, r, p] = parts.slice(1, 4).map(Number);
    h = { N, r, p, salt: parts[4], hash: parts[5], legacy: false };
  }
  if (!h) return null;
  const { N, r, p } = h;
  // ค่าที่มาจากไฟล์ข้อมูล (อาจถูกแก้ไข/กู้คืน) ต้องอยู่ในกรอบ ไม่ให้สั่งใช้หน่วยความจำหรือเวลามหาศาล
  const sane =
    [N, r, p].every(Number.isInteger) &&
    N >= 16384 &&
    (N & (N - 1)) === 0 &&
    r >= 1 &&
    r <= 16 &&
    p >= 1 &&
    p <= 8 &&
    128 * N * r <= MAXMEM / 2 &&
    N * r * p <= MAX_COST;
  if (!sane) return null;
  h.saltBuf = Buffer.from(h.salt, "base64");
  h.hashBuf = Buffer.from(h.hash, "base64");
  if (h.saltBuf.length < 16 || h.saltBuf.length > 64) return null;
  if (h.hashBuf.length < 32 || h.hashBuf.length > 64) return null;
  return h;
}

async function verifyPassword(password, stored) {
  const h = parseHash(stored);
  if (!h) return false;
  try {
    const actual = await scryptAsync(
      String(password),
      h.saltBuf,
      h.hashBuf.length,
      { N: h.N, r: h.r, p: h.p, maxmem: MAXMEM },
    );
    return crypto.timingSafeEqual(actual, h.hashBuf);
  } catch {
    return false;
  }
}

// แฮชเก่ากว่ามาตรฐานปัจจุบันหรือไม่ (ใช้แฮชใหม่หลังเข้าสู่ระบบสำเร็จ)
function needsRehash(stored) {
  const h = parseHash(stored);
  return (
    !h || h.legacy || h.N !== SCRYPT.N || h.r !== SCRYPT.r || h.p !== SCRYPT.p
  );
}

// คำที่พบบ่อยในรหัสผ่านที่ถูกเดาได้ (ตรวจทั้งแบบตรงตัว และแบบเติมตัวเลข/สัญลักษณ์หน้า-หลัง
// เช่น password1234, admin@2569) ตรวจแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ และแปลง 0→o 1→i 3→e 4→a 5→s @→a
const COMMON_WORDS = new Set([
  "password",
  "passwd",
  "pass",
  "qwerty",
  "qwertyuiop",
  "asdfgh",
  "asdfghjkl",
  "zxcvbn",
  "zaqxsw",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "welcome",
  "letmein",
  "trustno",
  "superman",
  "starwars",
  "dragon",
  "monkey",
  "master",
  "admin",
  "administrator",
  "root",
  "user",
  "guest",
  "test",
  "changeme",
  "default",
  "secret",
  "computer",
  "internet",
  "login",
  "bangkok",
  "bangrak",
  "khetbangrak",
  "thailand",
  "meeting",
  "booking",
  "office",
]);

function leet(s) {
  return s.replace(
    /[013457@$]/g,
    (c) =>
      ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" })[c],
  );
}

function isCommon(low) {
  const core = low.replace(/^[^a-z]+|[^a-z]+$/g, "");
  const variants = [
    low,
    core,
    leet(core),
    leet(low).replace(/^[^a-z]+|[^a-z]+$/g, ""),
  ];
  return variants.some(
    (v) => COMMON_WORDS.has(v) || COMMON_WORDS.has(v.replace(/[^a-z]/g, "")),
  );
}

function isSequence(s) {
  if (s.length < 4) return false;
  const codes = [...s].map((c) => c.charCodeAt(0));
  const step = codes[1] - codes[0];
  if (Math.abs(step) !== 1) return false;
  return codes.every((c, i) => i === 0 || c - codes[i - 1] === step);
}

// ตรวจคุณภาพรหัสผ่าน (แนวทาง NIST 800-63B: ความยาว + รายการรหัสที่เดาง่าย)
// คืนข้อความภาษาไทยที่บอกวิธีแก้ หรือ null ถ้าใช้ได้
function passwordIssue(password, { username = "", name = "" } = {}) {
  const pw = String(password || "");
  if (pw.length < 12) return "ต้องมีอย่างน้อย 12 ตัวอักษร";
  if (pw.length > 200) return "ยาวได้ไม่เกิน 200 ตัวอักษร";
  const low = pw.toLowerCase();
  if (isCommon(low))
    return "รหัสผ่านนี้เดาง่ายเกินไป ลองตั้งเป็นวลีที่จำง่ายแทน";
  if (/^(.)\1+$/.test(pw)) return "ห้ามใช้ตัวอักษรซ้ำกันทั้งหมด";
  if (isSequence(low)) return "ห้ามใช้ตัวอักษรหรือตัวเลขเรียงกัน";
  if (/^\d+$/.test(pw) && pw.length < 14)
    return "ตัวเลขล้วนเดาง่าย (เช่น วันเกิด เบอร์โทร) ให้ผสมตัวอักษรด้วย";
  if (new Set(pw).size < 4) return "ใช้ตัวอักษรที่หลากหลายกว่านี้";
  const u = String(username || "").toLowerCase();
  if (u.length >= 3 && low.includes(u)) return "ห้ามมีชื่อผู้ใช้อยู่ในรหัสผ่าน";
  const n = String(name || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (n.length >= 4 && low.replace(/\s+/g, "").includes(n))
    return "ห้ามมีชื่อของคุณอยู่ในรหัสผ่าน";
  return null;
}

// รหัสผ่านเริ่มต้นแบบสุ่ม อ่านง่ายและพิมพ์ง่าย (ไม่มีตัวที่สับสน เช่น 0/O, 1/l)
function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const pick = (n) =>
    Array.from(
      { length: n },
      () => alphabet[crypto.randomInt(alphabet.length)],
    ).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

const randomToken = (bytes = 24) =>
  crypto.randomBytes(bytes).toString("base64url");
const randomId = () => crypto.randomBytes(6).toString("hex");
const sha256 = (s) =>
  crypto.createHash("sha256").update(String(s)).digest("hex");

// จำกัดจำนวนครั้งต่อช่วงเวลา (เก็บในหน่วยความจำ)
class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  check(key, limit = this.limit, n = 1) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter(
      (t) => now - t < this.windowMs,
    );
    this.hits.set(key, list);
    if (list.length + n > limit) {
      return {
        ok: false,
        retryAfter: Math.max(
          1,
          Math.ceil((this.windowMs - (now - (list[0] ?? now))) / 1000),
        ),
      };
    }
    return { ok: true };
  }

  // บันทึก n ครั้งพร้อมกัน (เช่น การจองซ้ำหลายวันในคำขอเดียว)
  hit(key, limit = this.limit, n = 1) {
    const res = this.check(key, limit, n);
    if (res.ok) {
      const list = this.hits.get(key);
      const now = Date.now();
      for (let i = 0; i < n; i++) list.push(now);
    }
    return res;
  }

  reset(key) {
    this.hits.delete(key);
  }

  prune() {
    const now = Date.now();
    for (const [key, list] of this.hits) {
      if (!list.some((t) => now - t < this.windowMs)) this.hits.delete(key);
    }
  }
}

module.exports = {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  needsRehash,
  passwordIssue,
  randomPassword,
  randomToken,
  randomId,
  sha256,
  RateLimiter,
};
