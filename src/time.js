"use strict";

// เวลาประเทศไทย (Asia/Bangkok) ไม่มี daylight saving จึงใช้ offset คงที่ +07:00
const TZ_OFFSET_MIN = 7 * 60;

const pad2 = (n) => String(n).padStart(2, "0");

function bkkNow(ms = Date.now()) {
  const d = new Date(ms + TZ_OFFSET_MIN * 60000);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return {
    ms,
    date: d.toISOString().slice(0, 10),
    minutes,
    time: toHHMM(minutes),
    weekday: d.getUTCDay(),
  };
}

function toMin(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return NaN;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi !== 0)) return NaN;
  return h * 60 + mi;
}

function toHHMM(min) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function diffDays(a, b) {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000,
  );
}

// แปลงวันที่+เวลาท้องถิ่นเป็น epoch ms
function toEpoch(dateStr, hhmm) {
  return (
    Date.parse(`${dateStr}T00:00:00Z`) + (toMin(hhmm) - TZ_OFFSET_MIN) * 60000
  );
}

module.exports = {
  TZ_OFFSET_MIN,
  pad2,
  bkkNow,
  toMin,
  toHHMM,
  isDate,
  addDays,
  weekdayOf,
  diffDays,
  toEpoch,
};
