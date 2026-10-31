// ที่เก็บข้อมูลบน Cloudflare: ใช้ SQLite ของ Durable Object แทนไฟล์ใน data/
// เมธอดและรูปแบบข้อมูลเหมือน Store (src/store.js) ทุกอย่าง ระบบส่วนอื่นจึงใช้ได้โดยไม่ต้องแก้
// - db.json และไฟล์สำรอง เก็บเป็นข้อความ JSON (แบ่งเป็นท่อน เพราะแต่ละแถวจำกัดขนาด)
// - บันทึกกิจกรรม เก็บแถวละรายการ (เพิ่มทีละแถว ไม่ต้องเขียนใหม่ทั้งก้อน)

import { Store } from "../src/store.js";
import { randomPassword } from "../src/security.js";
import { bkkNow } from "../src/time.js";

const CHUNK = 400000; // ตัวอักษรต่อแถว (ภาษาไทย 3 ไบต์/ตัว ยังต่ำกว่าเพดาน 2MB ต่อแถว)
const MAX_LOGS = 50000;
const BACKUP_RE = /^[a-z]+-[0-9-]+\.json$/;

export class CloudStore extends Store {
  constructor(sql, opts = {}) {
    super("/cloudflare", { ...opts, noDisk: true });
    this.sql = sql;
    this.dir = "Cloudflare Durable Object (SQLite)";
    this.appending = false;
    sql.exec(`CREATE TABLE IF NOT EXISTS blobs (
      name TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, mtime INTEGER NOT NULL,
      PRIMARY KEY (name, part))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, data TEXT NOT NULL)`);
  }

  getBlob(name) {
    const rows = this.sql
      .exec("SELECT data FROM blobs WHERE name = ? ORDER BY part", name)
      .toArray();
    return rows.length ? rows.map((r) => r.data).join("") : null;
  }

  putBlob(name, text) {
    this.sql.exec("DELETE FROM blobs WHERE name = ?", name);
    const now = Date.now();
    let part = 0;
    for (let i = 0; i === 0 || i < text.length; i += CHUNK)
      this.sql.exec(
        "INSERT INTO blobs (name, part, data, mtime) VALUES (?, ?, ?, ?)",
        name,
        part++,
        text.slice(i, i + CHUNK),
        now,
      );
  }

  deleteBlob(name) {
    this.sql.exec("DELETE FROM blobs WHERE name = ?", name);
  }

  load() {
    const raw = this.getBlob("db.json");
    if (raw === null) {
      this.firstRun = true;
      this.initialPassword = this.presetPassword || randomPassword();
      this.db = Store.seed(this.initialPassword);
      this.flushDb();
      if (!this.presetPassword)
        this.writeInitialPassword("admin", this.initialPassword);
    } else {
      this.db = Store.normalize(JSON.parse(raw));
    }
    this.logs = this.sql
      .exec("SELECT data FROM logs ORDER BY id")
      .toArray()
      .map((r) => JSON.parse(r.data));
    this.logSeq = this.logs.reduce((m, l) => Math.max(m, l.id || 0), 0);
    return this;
  }

  // SQLite ของ Durable Object เขียนแบบ synchronous และรวมการเขียนให้อัตโนมัติ จึงบันทึกทันที
  saveDb() {
    this.flushDb();
  }

  flushDb() {
    this.putBlob("db.json", JSON.stringify(this.db));
  }

  addLog(entry) {
    this.appending = true;
    let log;
    try {
      log = super.addLog(entry);
    } finally {
      this.appending = false;
    }
    this.sql.exec(
      "INSERT OR REPLACE INTO logs (id, ts, data) VALUES (?, ?, ?)",
      log.id,
      log.ts,
      JSON.stringify(log),
    );
    if (this.logs.length >= MAX_LOGS)
      this.sql.exec("DELETE FROM logs WHERE id < ?", this.logs[0].id);
    return log;
  }

  // เรียกหลังแก้ this.logs ทั้งชุด (ลบบันทึกเก่า/กู้คืน) — การเพิ่มทีละรายการบันทึกใน addLog แล้ว
  saveLogs() {
    if (!this.appending) this.flushLogs();
  }

  flushLogs() {
    this.sql.exec("DELETE FROM logs");
    for (const l of this.logs)
      this.sql.exec(
        "INSERT OR REPLACE INTO logs (id, ts, data) VALUES (?, ?, ?)",
        l.id,
        l.ts,
        JSON.stringify(l),
      );
  }

  pruneLogs() {
    const days = this.db.settings.logRetentionDays;
    if (!Number.isFinite(days) || days < 1) return 0;
    const cutoff = Date.now() - days * 86400000;
    const before = this.logs.length;
    this.logs = this.logs.filter((l) => l.ts >= cutoff);
    if (this.logs.length !== before)
      this.sql.exec("DELETE FROM logs WHERE ts < ?", cutoff);
    return before - this.logs.length;
  }

  // ---------- สำรองข้อมูล ----------
  dailyBackup() {
    const name = `db-${bkkNow().date}.json`;
    if (this.getBlob(`backup/${name}`) === null)
      this.putBlob(`backup/${name}`, JSON.stringify(this.db));
    this.pruneBackups();
    return name;
  }

  snapshot(label) {
    const stamp = new Date(Date.now() + 7 * 3600000)
      .toISOString()
      .slice(0, 19)
      .replace(/[-:T]/g, "");
    const name = `${label}-${stamp}.json`;
    this.putBlob(`backup/${name}`, JSON.stringify(this.db));
    return name;
  }

  pruneBackups() {
    const days = this.db.settings.backupKeepDays;
    if (!Number.isFinite(days) || days < 1) return;
    const cutoff = Date.now() - days * 86400000;
    for (const f of this.listBackups())
      if (f.mtime < cutoff) this.deleteBlob(`backup/${f.name}`);
  }

  listBackups() {
    return this.sql
      .exec(
        `SELECT name, SUM(LENGTH(CAST(data AS BLOB))) AS size, MAX(mtime) AS mtime
         FROM blobs WHERE name LIKE 'backup/%' GROUP BY name ORDER BY mtime DESC`,
      )
      .toArray()
      .map((r) => ({ name: r.name.slice(7), size: r.size, mtime: r.mtime }))
      .filter((f) => BACKUP_RE.test(f.name));
  }

  backupPath(name) {
    if (!BACKUP_RE.test(name)) return null;
    return this.getBlob(`backup/${name}`) === null ? null : name;
  }

  readBackup(name) {
    if (!BACKUP_RE.test(name)) return null;
    return this.getBlob(`backup/${name}`);
  }

  sizes() {
    const one = (q, ...a) => this.sql.exec(q, ...a).toArray()[0] || {};
    return {
      db:
        one(
          "SELECT SUM(LENGTH(CAST(data AS BLOB))) AS n FROM blobs WHERE name = ?",
          "db.json",
        ).n || 0,
      logs: one("SELECT SUM(LENGTH(CAST(data AS BLOB))) AS n FROM logs").n || 0,
    };
  }

  // ไม่มีหน้าต่างเซิร์ฟเวอร์ให้ดู: แสดงในบันทึกของ Worker (Cloudflare dashboard › Workers › Logs)
  // แนะนำให้ตั้ง Secret ADMIN_INITIAL_PASSWORD ไว้ก่อนเปิดใช้ครั้งแรกแทน
  writeInitialPassword(username, password) {
    this.putBlob("initial-password", `${username}\n${password}`);
    console.log(
      `[setup] บัญชีผู้ดูแลเริ่มต้น  ชื่อผู้ใช้: ${username}  รหัสผ่าน: ${password}  (ระบบจะให้ตั้งรหัสใหม่เมื่อเข้าครั้งแรก)`,
    );
  }

  clearInitialPassword(username) {
    if (username === "admin") this.deleteBlob("initial-password");
  }
}
