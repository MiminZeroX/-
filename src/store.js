"use strict";

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const {
  DEFAULT_SETTINGS,
  defaultRooms,
  DEFAULT_DEPARTMENTS,
  fixedHolidays,
} = require("./defaults");
const { hashPasswordSync, randomId, randomPassword } = require("./security");
const { bkkNow } = require("./time");
const { sanitizeSettings, sanitizeBooking } = require("./sanitize");

// รหัสการจองแบบสุ่ม (เดาลำดับไม่ได้) ไม่มีตัวที่สับสน เช่น 0/O 1/I
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const MAX_LOGS = 50000;

// ไฟล์ข้อมูลมีแฮชรหัสผ่านและเบอร์โทร จึงให้เฉพาะบัญชีที่รันระบบอ่านได้ (บน Linux/macOS)
function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new Error(`อ่านไฟล์ข้อมูลไม่สำเร็จ (${file}): ${err.message}`);
  }
}

class Store {
  constructor(dataDir, opts = {}) {
    this.dir = path.resolve(dataDir);
    this.dbFile = path.join(this.dir, "db.json");
    this.logFile = path.join(this.dir, "logs.json");
    this.backupDir = path.join(this.dir, "backups");
    this.initialPasswordFile = path.join(
      this.dir,
      "initial-admin-password.txt",
    );
    this.presetPassword = opts.initialPassword || "";
    this.initialPassword = "";
    // ที่เก็บข้อมูลแบบอื่น (คลาสลูก) ไม่ใช้โฟลเดอร์บนดิสก์
    if (!opts.noDisk)
      fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o700 });
    this.db = null;
    this.logs = [];
    this.logSeq = 0;
    this.timers = { db: null, logs: null };
    this.firstRun = false;
  }

  load() {
    const raw = readJsonFile(this.dbFile);
    if (!raw) {
      this.firstRun = true;
      // ไม่มีรหัสผ่านเริ่มต้นตายตัว: สุ่มใหม่ทุกการติดตั้ง แสดงบนหน้าจอเซิร์ฟเวอร์และเก็บในไฟล์
      // ซึ่งจะถูกลบทันทีที่ผู้ดูแลเปลี่ยนรหัสผ่าน
      this.initialPassword = this.presetPassword || randomPassword();
      this.db = Store.seed(this.initialPassword);
      this.flushDb();
      if (!this.presetPassword)
        this.writeInitialPassword("admin", this.initialPassword);
    } else {
      this.db = Store.normalize(raw);
    }
    const logs = readJsonFile(this.logFile);
    this.logs = Array.isArray(logs) ? logs : [];
    this.logSeq = this.logs.reduce((m, l) => Math.max(m, l.id || 0), 0);
    return this;
  }

  writeInitialPassword(username, password) {
    fs.writeFileSync(
      this.initialPasswordFile,
      [
        "ระบบจองห้องประชุม สำนักงานเขตบางรัก — บัญชีผู้ดูแลเริ่มต้น",
        `ชื่อผู้ใช้: ${username}`,
        `รหัสผ่าน: ${password}`,
        "",
        "ระบบจะให้ตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก และจะลบไฟล์นี้ให้อัตโนมัติ",
        "",
      ].join("\r\n"),
      { mode: 0o600 },
    );
  }

  clearInitialPassword(username) {
    if (username !== "admin") return;
    try {
      fs.unlinkSync(this.initialPasswordFile);
    } catch {
      /* ไม่มีไฟล์ */
    }
  }

  static seed(initialPassword) {
    const year = Number(bkkNow().date.slice(0, 4));
    return Store.normalize({
      version: 1,
      createdAt: Date.now(),
      settings: { ...DEFAULT_SETTINGS },
      rooms: defaultRooms(),
      departments: [...DEFAULT_DEPARTMENTS],
      holidays: [...fixedHolidays(year), ...fixedHolidays(year + 1)],
      bookings: [],
      admins: [
        {
          id: randomId(),
          username: "admin",
          name: "ผู้ดูแลระบบ",
          role: "admin",
          passHash: hashPasswordSync(initialPassword || randomPassword()),
          mustChange: true,
          active: true,
          createdAt: Date.now(),
          lastLogin: null,
        },
      ],
      counters: {},
    });
  }

  // เติมค่าที่ขาด (รองรับการอัปเกรดเวอร์ชัน และการกู้คืนข้อมูลจากไฟล์สำรอง)
  static normalize(raw) {
    const db = { ...raw };
    db.version = 1;
    // ค่าที่ไม่ผ่านกฎ (ไฟล์ถูกแก้ไขหรือเสียหาย) จะใช้ค่าเริ่มต้นแทน
    db.settings = sanitizeSettings(raw.settings).settings;
    db.rooms = Array.isArray(raw.rooms) ? raw.rooms : defaultRooms();
    db.rooms.forEach((r, i) => {
      r.equipment = Array.isArray(r.equipment) ? r.equipment : [];
      r.active = r.active !== false;
      r.archived = !!r.archived;
      r.approval = ["inherit", "yes", "no"].includes(r.approval)
        ? r.approval
        : "inherit";
      r.order = Number.isFinite(r.order) ? r.order : i + 1;
      r.capacity = Number(r.capacity) || 0;
      r.closedMessage = r.closedMessage || "";
      r.photo = typeof r.photo === "string" ? r.photo : "";
      r.color = /^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : "#0284c7";
    });
    db.departments = Array.isArray(raw.departments)
      ? raw.departments
      : [...DEFAULT_DEPARTMENTS];
    db.holidays = Array.isArray(raw.holidays) ? raw.holidays : [];
    // การจองที่วันที่/เวลา/สถานะไม่ถูกต้องจะถูกตัดออก (กันการเปรียบเทียบกับค่า NaN)
    db.bookings = (Array.isArray(raw.bookings) ? raw.bookings : [])
      .map(sanitizeBooking)
      .filter(Boolean);
    db.admins = Array.isArray(raw.admins) ? raw.admins : [];
    // เรื่องร้องเรียน แจ้งปัญหา และข้อเสนอแนะจากผู้ใช้
    db.feedback = (Array.isArray(raw.feedback) ? raw.feedback : []).filter(
      (f) => f && typeof f.id === "string" && typeof f.message === "string",
    );
    db.backupDays = (Array.isArray(raw.backupDays) ? raw.backupDays : []).filter(
      (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
    );
    db.counters =
      raw.counters && typeof raw.counters === "object" ? raw.counters : {};
    return db;
  }

  saveDb() {
    if (this.timers.db) return;
    this.timers.db = setTimeout(() => {
      this.timers.db = null;
      this.flushDb();
    }, 30);
  }

  flushDb() {
    if (this.timers.db) {
      clearTimeout(this.timers.db);
      this.timers.db = null;
    }
    writeAtomic(this.dbFile, JSON.stringify(this.db));
  }

  saveLogs() {
    if (this.timers.logs) return;
    this.timers.logs = setTimeout(() => {
      this.timers.logs = null;
      this.flushLogs();
    }, 500);
  }

  flushLogs() {
    if (this.timers.logs) {
      clearTimeout(this.timers.logs);
      this.timers.logs = null;
    }
    writeAtomic(this.logFile, JSON.stringify(this.logs));
  }

  flushAll() {
    this.flushDb();
    this.flushLogs();
  }

  addLog(entry) {
    const log = {
      id: ++this.logSeq,
      ts: Date.now(),
      level: entry.level || "info",
      action: entry.action,
      actor: entry.actor || "ระบบ",
      actorType: entry.actorType || "system",
      ip: entry.ip || "",
      ua: (entry.ua || "").slice(0, 200),
      detail: (entry.detail || "").slice(0, 1000),
      ref: entry.ref || "",
    };
    this.logs.push(log);
    if (this.logs.length > MAX_LOGS)
      this.logs.splice(0, this.logs.length - MAX_LOGS);
    this.saveLogs();
    return log;
  }

  pruneLogs() {
    const days = this.db.settings.logRetentionDays;
    if (!Number.isFinite(days) || days < 1) return;
    const cutoff = Date.now() - days * 86400000;
    const before = this.logs.length;
    this.logs = this.logs.filter((l) => l.ts >= cutoff);
    if (this.logs.length !== before) this.saveLogs();
    return before - this.logs.length;
  }

  nextBookingCode() {
    const now = bkkNow();
    const beYear = (Number(now.date.slice(0, 4)) + 543) % 100;
    const key = `${String(beYear).padStart(2, "0")}${now.date.slice(5, 7)}`;
    this.db.counters[key] = (this.db.counters[key] || 0) + 1;
    const used = new Set(this.db.bookings.map((b) => b.code));
    for (;;) {
      let tail = "";
      for (let i = 0; i < 4; i++)
        tail += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
      const code = `BR${key}-${tail}`;
      if (!used.has(code)) return code;
    }
  }

  // ---------- สำรองข้อมูล ----------
  dailyBackup() {
    const name = `db-${bkkNow().date}.json`;
    const file = path.join(this.backupDir, name);
    if (!fs.existsSync(file)) {
      this.flushDb();
      fs.copyFileSync(this.dbFile, file);
    }
    this.pruneBackups();
    return name;
  }

  snapshot(label) {
    this.flushDb();
    const stamp = new Date(Date.now() + 7 * 3600000)
      .toISOString()
      .slice(0, 19)
      .replace(/[-:T]/g, "");
    const name = `${label}-${stamp}.json`;
    fs.copyFileSync(this.dbFile, path.join(this.backupDir, name));
    return name;
  }

  pruneBackups() {
    const days = this.db.settings.backupKeepDays;
    if (!Number.isFinite(days) || days < 1) return;
    const keepMs = days * 86400000;
    for (const f of this.listBackups()) {
      if (Date.now() - f.mtime > keepMs)
        fs.rmSync(path.join(this.backupDir, f.name), { force: true });
    }
  }

  listBackups() {
    return fs
      .readdirSync(this.backupDir)
      .filter((n) => /^[a-z]+-[0-9-]+\.json$/.test(n))
      .map((name) => {
        const st = fs.statSync(path.join(this.backupDir, name));
        return { name, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  backupPath(name) {
    if (!/^[a-z]+-[0-9-]+\.json$/.test(name)) return null;
    const file = path.join(this.backupDir, name);
    return fs.existsSync(file) ? file : null;
  }

  // เนื้อหาไฟล์สำรอง (ข้อความ JSON) หรือ null ถ้าไม่มี
  readBackup(name) {
    const file = this.backupPath(name);
    return file ? fs.readFileSync(file, "utf8") : null;
  }

  replaceDb(data) {
    this.db = Store.normalize(data);
    this.flushDb();
  }

  sizes() {
    const size = (f) => {
      try {
        return fs.statSync(f).size;
      } catch {
        return 0;
      }
    };
    return { db: size(this.dbFile), logs: size(this.logFile) };
  }
}

module.exports = { Store };
