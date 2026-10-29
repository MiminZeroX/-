"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_SETTINGS,
  defaultRooms,
  DEFAULT_DEPARTMENTS,
  fixedHolidays,
} = require("./defaults");
const { hashPassword, randomId } = require("./security");
const { bkkNow } = require("./time");

const MAX_LOGS = 50000;

function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
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
  constructor(dataDir) {
    this.dir = path.resolve(dataDir);
    this.dbFile = path.join(this.dir, "db.json");
    this.logFile = path.join(this.dir, "logs.json");
    this.backupDir = path.join(this.dir, "backups");
    fs.mkdirSync(this.backupDir, { recursive: true });
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
      this.db = Store.seed();
      this.flushDb();
    } else {
      this.db = Store.normalize(raw);
    }
    const logs = readJsonFile(this.logFile);
    this.logs = Array.isArray(logs) ? logs : [];
    this.logSeq = this.logs.reduce((m, l) => Math.max(m, l.id || 0), 0);
    return this;
  }

  static seed() {
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
          passHash: hashPassword("admin1234"),
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
    const settings = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      settings[key] =
        raw.settings && key in raw.settings
          ? raw.settings[key]
          : DEFAULT_SETTINGS[key];
    }
    db.settings = settings;
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
      r.color = /^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : "#0284c7";
    });
    db.departments = Array.isArray(raw.departments)
      ? raw.departments
      : [...DEFAULT_DEPARTMENTS];
    db.holidays = Array.isArray(raw.holidays) ? raw.holidays : [];
    db.bookings = Array.isArray(raw.bookings) ? raw.bookings : [];
    db.bookings.forEach((b) => {
      b.tokenHashes = Array.isArray(b.tokenHashes) ? b.tokenHashes : [];
      b.equipment = Array.isArray(b.equipment) ? b.equipment : [];
      b.services = Array.isArray(b.services) ? b.services : [];
      b.kind = b.kind === "block" ? "block" : "meeting";
    });
    db.admins = Array.isArray(raw.admins) ? raw.admins : [];
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
    return `BR${key}-${String(this.db.counters[key]).padStart(4, "0")}`;
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
    const keepMs = this.db.settings.backupKeepDays * 86400000;
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
