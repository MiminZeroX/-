// จอแสดงผลหน้าห้อง: /display?room=<id>  หรือ /display (ทุกห้อง)
import {
  $,
  html,
  raw,
  setHTML,
  icon,
  api,
  toast,
  toastError,
  openModal,
  confetti,
  liveEvents,
  initEffects,
  syncClock,
  bkkNow,
  nowMs,
  toMin,
  toEpoch,
  fmtDate,
  fmtDuration,
  pad2,
  debounce,
  setFeedback,
} from "./core.js";
import { qrSVG } from "./qr.js";

const S = {
  settings: {},
  rooms: [],
  holidays: new Map(),
  serverUrls: [],
  online: true,
};
const rootEl = $("#ds");
const roomId = new URLSearchParams(location.search).get("room");
let list = [];
let loadedDate = "";
let first = true;

const EMBLEM = raw(
  '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="7" width="22" height="20" rx="4.5"/><path d="M5 13h22M11 4v5M21 4v5"/><path d="m11.5 19.5 3 3 6-6"/></svg>',
);
const col = (r) => (r && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#0284c7");
const ST_COLOR = {
  free: "var(--free)",
  busy: "var(--busy)",
  soon: "var(--soon)",
  closed: "#94a3b8",
  off: "#94a3b8",
};
const ST_ICON = {
  free: "check",
  busy: "users",
  soon: "clock",
  closed: "ban",
  off: "moon",
};

function baseUrl() {
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  return local && S.serverUrls.length ? S.serverUrls[0] : location.origin;
}

const titleOf = (b) => {
  if (b.kind === "block") return `ปิดใช้ห้อง${b.title ? `: ${b.title}` : ""}`;
  return S.settings.displayShowTitle && b.title ? b.title : "การประชุม";
};

function dayOff(date) {
  const s = S.settings;
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  const h = S.holidays.get(date);
  if (h && !s.allowHolidays) return h;
  if (!s.allowWeekends && (wd === 0 || wd === 6)) return "วันหยุดสุดสัปดาห์";
  return null;
}

function stateOf(r, n) {
  const items = list
    .filter((b) => b.roomId === r.id)
    .sort((a, b) => a.start.localeCompare(b.start));
  const cur = items.find(
    (b) => toMin(b.start) <= n.minutes && n.minutes < toMin(b.end),
  );
  const next = items.find((b) => toMin(b.start) > n.minutes);
  const open = toMin(S.settings.openTime);
  const close = toMin(S.settings.closeTime);
  if (!r.active)
    return {
      key: "closed",
      label: "ปิดให้บริการ",
      sub: r.closedMessage || "ปิดให้บริการชั่วคราว",
      items,
      cur,
      next,
    };
  if (cur) {
    const left = toMin(cur.end) - n.minutes;
    return {
      key: "busy",
      label: cur.kind === "block" ? "ปิดใช้ห้อง" : "ไม่ว่าง",
      sub: `ใช้งานถึง ${cur.end} น. (อีก ${fmtDuration(left)})`,
      items,
      cur,
      next,
    };
  }
  if (next && toMin(next.start) - n.minutes <= 15) {
    return {
      key: "soon",
      label: "ใกล้เริ่มประชุม",
      sub: `เริ่ม ${next.start} น. (อีก ${toMin(next.start) - n.minutes} นาที)`,
      items,
      cur,
      next,
    };
  }
  const off = dayOff(n.date);
  if (off) return { key: "off", label: "วันหยุด", sub: off, items, cur, next };
  if (n.minutes < open || n.minutes >= close)
    return {
      key: "off",
      label: "นอกเวลาทำการ",
      sub: `เปิดให้จอง ${S.settings.openTime}–${S.settings.closeTime} น.`,
      items,
      cur,
      next,
    };
  return {
    key: "free",
    label: "ว่าง",
    sub: next ? `ว่างจนถึง ${next.start} น.` : "ว่างตลอดช่วงที่เหลือของวัน",
    items,
    cur,
    next,
  };
}

function canCheckin(b) {
  const s = S.settings;
  if (
    !s.checkinEnabled ||
    !b ||
    b.status !== "approved" ||
    b.kind === "block" ||
    b.checkedIn
  )
    return false;
  const n = nowMs();
  return (
    n >= toEpoch(b.date, b.start) - s.checkinWindowMinutes * 60000 &&
    n < toEpoch(b.date, b.end)
  );
}

function header() {
  const s = S.settings;
  return html`<header class="ds-top">
    <span class="brand-mark"
      >${s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM}</span
    >
    <div class="org"><b>${s.orgName}</b><small>${s.siteName}</small></div>
    <div class="ds-clock">
      <b id="ds-time">--:--</b><small id="ds-date"></small>
    </div>
    <div class="ds-tools">
      <button
        class="btn btn-icon"
        id="ds-fs"
        aria-label="เต็มจอ"
        title="เต็มจอ"
      >
        ${icon("maximize")}
      </button>
    </div>
  </header>`;
}

function footer() {
  return html`<footer class="ds-foot">
    <span class="live ${S.online ? "" : "off"}" id="ds-live"
      >${S.online
        ? "เชื่อมต่อสด · อัปเดตอัตโนมัติ"
        : "กำลังเชื่อมต่อใหม่..."}</span
    ><span>${S.settings.contactText}</span>
  </footer>`;
}

function nowBlock(st) {
  const n = bkkNow();
  if (st.cur) {
    const a = toMin(st.cur.start);
    const z = toMin(st.cur.end);
    const pct = Math.min(100, Math.max(0, ((n.minutes - a) / (z - a)) * 100));
    return html`<div class="ds-now">
      <span class="lbl"
        >${st.cur.kind === "block" ? "ปิดใช้ห้อง" : "กำลังประชุม"}${st.cur
          .checkedIn
          ? " · เช็คอินแล้ว"
          : ""}</span
      >
      <h2>${titleOf(st.cur)}</h2>
      <div class="meta">
        <span>${icon("clock")} ${st.cur.start}–${st.cur.end} น.</span>${st.cur
          .department
          ? html`<span>${icon("building")} ${st.cur.department}</span>`
          : ""}
      </div>
      <div class="ds-progress"><i style="width:${pct}%"></i></div>
    </div>`;
  }
  if (st.next) {
    return html`<div class="ds-now">
      <span class="lbl"
        >การประชุมถัดไป · อีก
        ${fmtDuration(toMin(st.next.start) - n.minutes)}</span
      >
      <h2>${titleOf(st.next)}</h2>
      <div class="meta">
        <span>${icon("clock")} ${st.next.start}–${st.next.end} น.</span>${st
          .next.department
          ? html`<span>${icon("building")} ${st.next.department}</span>`
          : ""}
      </div>
    </div>`;
  }
  return html`<div class="ds-now">
    <span class="lbl">วันนี้</span>
    <h2>ไม่มีการประชุมเพิ่มเติม</h2>
    <div class="meta">
      <span>${icon("calendar-plus")} จองห้องนี้ได้ทันทีผ่านมือถือ</span>
    </div>
  </div>`;
}

function agenda(st) {
  const n = bkkNow();
  if (!st.items.length)
    return html`<div class="ds-empty">
      ${icon("calendar-check")}<span>วันนี้ยังไม่มีการจอง</span>
    </div>`;
  return html`<div class="ds-list">
    ${st.items.map((b, i) => {
      const done = toMin(b.end) <= n.minutes;
      const isNow = !done && toMin(b.start) <= n.minutes;
      return html`<div
        class="ds-item ${done ? "done" : ""} ${isNow ? "now" : ""}"
        style="--i:${i}"
      >
        <span class="t">${b.start}<small>ถึง ${b.end}</small></span>
        <div>
          <b
            >${titleOf(b)}${b.status === "pending"
              ? html`<span class="tag">รออนุมัติ</span>`
              : ""}${isNow ? html`<span class="tag">ขณะนี้</span>` : ""}</b
          >
          <span class="d">${b.department || ""}</span>
        </div>
      </div>`;
    })}
  </div>`;
}

function renderSingle(r) {
  const n = bkkNow();
  const st = stateOf(r, n);
  document.body.style.setProperty("--st", ST_COLOR[st.key]);
  document.body.style.setProperty("--room", col(r));
  document.title = `${r.name} · ${st.label}`;
  const ci = [st.cur, st.next].find(canCheckin);
  const bookUrl = `${baseUrl()}/#/book?room=${encodeURIComponent(r.id)}`;
  setHTML(
    rootEl,
    html`<div class="ds ${first ? "first" : ""}">
      ${header()}
      <main class="ds-main">
        <section class="ds-panel ds-status-panel">
          <div class="ds-room">
            <span class="fl">${r.floor}</span>
            <h1>${r.name}</h1>
            <span class="cap">รองรับ ${r.capacity} คน</span>
          </div>
          <div class="ds-state">
            <div class="ds-ring">${icon(ST_ICON[st.key])}</div>
            <div><b>${st.label}</b><span>${st.sub}</span></div>
          </div>
          ${nowBlock(st)}
          <div class="ds-actions">
            ${ci
              ? html`<button class="btn btn-checkin" data-checkin="${ci.id}">
                  ${icon("check-circle")} เช็คอินเข้าใช้ห้อง
                </button>`
              : ""}
            ${r.active
              ? html`<button class="btn btn-ghosty" data-book>
                  ${icon("calendar-plus")} จองห้องนี้
                </button>`
              : ""}
            <a class="btn btn-ghosty" href="/display"
              >${icon("grid")} ทุกห้อง</a
            >
            ${r.active
              ? html`<div class="ds-qr">
                  <small
                    >สแกนเพื่อจองห้องนี้<br />ด้วยมือถือ (Wi-Fi สำนักงาน)</small
                  >
                  <div class="q">${raw(qrSVG(bookUrl))}</div>
                </div>`
              : ""}
          </div>
        </section>
        <section class="ds-panel">
          <h3>
            ${icon("calendar")} กำหนดการวันนี้
            <small style="margin-left:auto;font-weight:500;opacity:.7"
              >${fmtDate(n.date, "short")}</small
            >
          </h3>
          ${agenda(st)}
        </section>
      </main>
      ${footer()}
    </div>`,
  );
  bindCommon();
  rootEl.querySelector("[data-book]")?.addEventListener("click", () => {
    const body = html`<div class="stack center" style="justify-items:center">
      <div
        style="width:260px;height:260px;padding:10px;background:#fff;border-radius:18px"
      >
        ${raw(qrSVG(bookUrl))}
      </div>
      <p class="muted">
        สแกนด้วยกล้องมือถือที่เชื่อม Wi-Fi สำนักงาน เพื่อจอง${r.name}
      </p>
      <a class="btn btn-primary" href="${bookUrl}"
        >${icon("calendar-plus")} หรือจองบนอุปกรณ์นี้</a
      >
    </div>`;
    openModal({ title: `จอง${r.name}`, body, size: "sm" });
  });
}

function renderLobby() {
  const n = bkkNow();
  document.body.style.setProperty("--st", "var(--free)");
  document.title = `สถานะห้องประชุม · ${S.settings.orgName}`;
  setHTML(
    rootEl,
    html`<div class="ds ${first ? "first" : ""}">
      ${header()}
      <main class="ds-grid">
        ${S.rooms.map((r) => {
          const st = stateOf(r, n);
          return html`<a
            class="ds-panel ds-tile"
            href="/display?room=${encodeURIComponent(r.id)}"
            style="--st:${raw(ST_COLOR[st.key])};--room:${col(r)}"
          >
            <div class="ds-room">
              <span class="fl">${r.floor}</span>
              <h1>${r.name}</h1>
            </div>
            <div class="ds-state">
              <div class="ds-ring">${icon(ST_ICON[st.key])}</div>
              <div><b>${st.label}</b><span>${st.sub}</span></div>
            </div>
            ${nowBlock(st)}
          </a>`;
        })}
      </main>
      ${footer()}
    </div>`,
  );
  bindCommon();
}

function renderDisabled() {
  setHTML(
    rootEl,
    html`<div class="ds">
      ${header()}
      <div class="ds-empty" style="align-self:center">
        ${icon("tablet")}<b>จอแสดงผลหน้าห้องถูกปิดใช้งาน</b
        ><span>เปิดได้ที่หน้าผู้ดูแลระบบ › ตั้งค่า › จอแสดงผลหน้าห้อง</span>
      </div>
      ${footer()}
    </div>`,
  );
  bindCommon();
}

function render() {
  if (!S.settings.displayEnabled) return renderDisabled();
  const r = S.rooms.find((x) => x.id === roomId);
  if (r) renderSingle(r);
  else renderLobby();
  first = false;
  tickClock();
}

function bindCommon() {
  $("#ds-fs")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast("อุปกรณ์นี้ไม่รองรับโหมดเต็มจอ", "warning");
    }
    keepAwake();
  });
  rootEl
    .querySelector("[data-checkin]")
    ?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.classList.add("is-loading");
      try {
        await api(`/api/bookings/${btn.dataset.checkin}/checkin`, {
          method: "POST",
          body: {},
        });
        toast("เช็คอินเรียบร้อย ขอให้การประชุมราบรื่น", "success");
        confetti({ count: 70 });
        await load();
      } catch (err) {
        btn.classList.remove("is-loading");
        toastError(err);
      }
    });
}

function tickClock() {
  const n = bkkNow();
  const d = new Date(n.ms + 7 * 3600000);
  const t = $("#ds-time");
  if (t) t.textContent = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  const dd = $("#ds-date");
  if (dd) dd.textContent = fmtDate(n.date, "long");
}

let wakeLock = null;
async function keepAwake() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    }
  } catch {
    /* ต้องใช้ HTTPS — ให้ตั้งค่าหน้าจอไม่ล็อกบนแท็บเล็ตแทน */
  }
}

async function loadConfig() {
  const cfg = await api("/api/config");
  syncClock(cfg.now.ms);
  S.settings = cfg.settings;
  S.rooms = cfg.rooms;
  S.holidays = new Map(cfg.holidays.map((h) => [h.date, h.name]));
  S.serverUrls = cfg.serverUrls || [];
  setFeedback({ haptic: cfg.settings.hapticFeedback, sound: false });
  document.documentElement.dataset.brand = cfg.settings.themeColor;
  document.documentElement.dataset.motion = cfg.settings.motionLevel;
}

async function load() {
  const today = bkkNow().date;
  try {
    list = (await api(`/api/bookings?from=${today}&to=${today}`)).bookings;
    loadedDate = today;
  } catch (err) {
    toastError(err);
  }
  render();
}

async function boot() {
  initEffects();
  try {
    await loadConfig();
  } catch (err) {
    setHTML(
      rootEl,
      html`<div class="ds">
        <div class="ds-empty">
          ${icon("wifi")}<b>เชื่อมต่อระบบไม่ได้</b
          ><span>${err.message} — ระบบจะลองใหม่อัตโนมัติ</span>
        </div>
      </div>`,
    );
    setTimeout(() => location.reload(), 15000);
    return;
  }
  await load();
  keepAwake();
  setInterval(() => {
    tickClock();
    if (bkkNow().date !== loadedDate) load();
  }, 1000);
  setInterval(render, 30000);
  // โหลดหน้าใหม่ทุก 6 ชั่วโมง เพื่อรับการอัปเดตของระบบ
  setTimeout(() => location.reload(), 6 * 3600000);
  liveEvents({
    bookings: debounce(load, 300),
    config: debounce(async () => {
      await loadConfig().catch(() => {});
      render();
    }, 300),
    status: (ok) => {
      S.online = ok;
      const live = $("#ds-live");
      if (live) {
        live.classList.toggle("off", !ok);
        live.textContent = ok
          ? "เชื่อมต่อสด · อัปเดตอัตโนมัติ"
          : "กำลังเชื่อมต่อใหม่...";
      }
    },
  });
  document.addEventListener(
    "visibilitychange",
    () => document.visibilityState === "visible" && (keepAwake(), load()),
  );
}

boot();
