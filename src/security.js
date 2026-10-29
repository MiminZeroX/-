"use strict";

const crypto = require("crypto");

const SCRYPT = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const expected = Buffer.from(parts[2], "base64");
  const actual = crypto.scryptSync(
    String(password),
    Buffer.from(parts[1], "base64"),
    expected.length,
    SCRYPT,
  );
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
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

  check(key, limit = this.limit) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter(
      (t) => now - t < this.windowMs,
    );
    this.hits.set(key, list);
    if (list.length >= limit) {
      return {
        ok: false,
        retryAfter: Math.ceil((this.windowMs - (now - list[0])) / 1000),
      };
    }
    return { ok: true };
  }

  hit(key, limit = this.limit) {
    const res = this.check(key, limit);
    if (res.ok) this.hits.get(key).push(Date.now());
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
  verifyPassword,
  randomToken,
  randomId,
  sha256,
  RateLimiter,
};
