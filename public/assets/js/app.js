// หน้าผู้ใช้งาน: หน้าแรก / ปฏิทิน / จองห้อง / การจองของฉัน
import {
  $,
  $$,
  html,
  raw,
  setHTML,
  icon,
  api,
  store,
  toast,
  toastError,
  openModal,
  confirmDialog,
  confetti,
  liveEvents,
  swap,
  stagger,
  initSeg,
  segSelect,
  applyAppearance,
  setFeedback,
  initEffects,
  haptic,
  shake,
  syncClock,
  bkkNow,
  nowMs,
  toMin,
  toHHMM,
  addDays,
  weekdayOf,
  diffDays,
  toEpoch,
  startOfWeek,
  fmtDate,
  fmtDuration,
  greeting,
  statusBadge,
  liveStatus,
  downloadICS,
  copyText,
  debounce,
  pad2,
  countUp,
  TH_DAYS_SHORT,
  TH_DAYS_MIN,
  TH_MONTHS_SHORT,
} from "./core.js";
import { qrSVG } from "./qr.js";

const S = {
  settings: {},
  rooms: [],
  departments: [],
  holidays: new Map(),
  serverUrls: [],
  online: true,
};
const viewEl = $("#view");
let current = { name: null };

const isDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const roomOf = (id) => S.rooms.find((r) => r.id === id);
const col = (r) =>
  r && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "var(--brand)";
const openMin = () => toMin(S.settings.openTime);
const closeMin = () => toMin(S.settings.closeTime);
const isActive = (b) => b.status === "approved" || b.status === "pending";
const hasStarted = (b) => toEpoch(b.date, b.start) <= nowMs();
const hasEnded = (b) => toEpoch(b.date, b.end) <= nowMs();
const byTime = (a, b) =>
  a.date === b.date
    ? a.start.localeCompare(b.start)
    : a.date.localeCompare(b.date);
const titleOf = (b) =>
  b.kind === "block"
    ? `ปิดใช้ห้อง: ${b.title || "งานซ่อมบำรุง"}`
    : b.title || "การประชุม";
const PHONE_RE = /^[0-9+()#\-\s,./]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dayClosed(date) {
  const s = S.settings;
  const wd = weekdayOf(date);
  const h = S.holidays.get(date);
  if (h && !s.allowHolidays) return `วันหยุดราชการ: ${h}`;
  if (!s.allowWeekends && (wd === 0 || wd === 6))
    return "วันเสาร์–อาทิตย์ ไม่เปิดให้จอง";
  return null;
}

function baseUrl() {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  return local && S.serverUrls.length ? S.serverUrls[0] : location.origin;
}

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

const EMBLEM = raw(
  '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="7" width="22" height="20" rx="4.5"/><path d="M5 13h22M11 4v5M21 4v5"/><path d="m11.5 19.5 3 3 6-6"/></svg>',
);

// เส้นขอบฟ้าย่านบางรัก (ตึกสูง โดม และสายน้ำเจ้าพระยา) แบบเรียบง่าย
const SKYLINE =
  raw(`<svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" fill="currentColor" aria-hidden="true">
<path d="M0 220V150h40v-18h30v88h20V112h46v108h14V138h52v82h18v-96l14-22 14 22v-14l16-34 16 34v14l14-22 14 22v96h22V96h40v124h16V128h58v92h18V60h16v-14h12V30h14v-10h8v200h14V118h50v102h18V104h22V86h50v18h22v116h20V140h40v-18h18v98h22V70h12V50h30v20h12v150h18V128h64v92h24V100h40v120h20V146h70v74z"/>
<circle cx="826" cy="76" r="18"/><rect x="824" y="34" width="4" height="26"/>
<path class="wave" d="M-120 204c60-14 120-14 180 0s120 14 180 0 120-14 180 0 120 14 180 0 120-14 180 0 120 14 180 0 120-14 180 0 120 14 180 0V230H-120z" opacity=".55"/>
<path class="wave2" d="M-120 212c50-10 100-10 150 0s100 10 150 0 100-10 150 0 100 10 150 0 100-10 150 0 100 10 150 0 100-10 150 0 100 10 150 0 100-10 150 0V230H-120z" opacity=".8"/>
</svg>`);

// ------------------------------------------------------------------ my bookings (โทเคนในอุปกรณ์นี้)
const MY_KEY = "br.my";
const my = {
  items: [],
  byId: new Map(),
  tokens() {
    return store
      .get(MY_KEY, [])
      .filter((t) => t && typeof t.token === "string");
  },
  add(token) {
    const list = my.tokens().filter((t) => t.token !== token);
    list.unshift({ token, at: Date.now() });
    store.set(MY_KEY, list.slice(0, 100));
  },
  remove(token) {
    store.set(
      MY_KEY,
      my.tokens().filter((t) => t.token !== token),
    );
  },
  async load() {
    const tokens = my.tokens().map((t) => t.token);
    if (!tokens.length) {
      my.items = [];
      my.byId.clear();
      updateMyCount();
      return my.items;
    }
    const res = await api("/api/my", { method: "POST", body: { tokens } });
    const alive = new Set();
    my.items = [];
    my.byId.clear();
    for (const it of res.items) {
      if (it.bookings.length) alive.add(it.token);
      for (const b of it.bookings) {
        if (my.byId.has(b.id)) continue;
        const entry = { token: it.token, b };
        my.byId.set(b.id, entry);
        my.items.push(entry);
      }
    }
    const kept = my.tokens().filter((t) => alive.has(t.token));
    if (kept.length !== tokens.length) store.set(MY_KEY, kept);
    updateMyCount();
    return my.items;
  },
  upcoming() {
    return my.items
      .filter(({ b }) => isActive(b) && !hasEnded(b))
      .sort((x, y) => byTime(x.b, y.b));
  },
};

function updateMyCount() {
  const n = my.upcoming().length;
  const badge = $("#nav-my-count");
  if (badge) {
    badge.hidden = !n;
    badge.textContent = n;
  }
  const dot = $("#tab-my-dot");
  if (dot) dot.hidden = !n;
}

async function fetchBookings(from, to) {
  const out = [];
  for (let a = from; a <= to; a = addDays(a, 61)) {
    const b = addDays(a, 60) < to ? addDays(a, 60) : to;
    const res = await api(`/api/bookings?from=${a}&to=${b}`);
    out.push(...res.bookings);
  }
  return out;
}

// ------------------------------------------------------------------ config & chrome
async function loadConfig() {
  const cfg = await api("/api/config");
  syncClock(cfg.now.ms);
  S.settings = cfg.settings;
  S.rooms = cfg.rooms;
  S.departments = cfg.departments;
  S.holidays = new Map(cfg.holidays.map((h) => [h.date, h.name]));
  S.serverUrls = cfg.serverUrls || [];
  const s = S.settings;
  store.set("br.cfg.appearance", {
    themeColor: s.themeColor,
    defaultThemeMode: s.defaultThemeMode,
    motionLevel: s.motionLevel,
  });
  applyAppearance(s);
  setFeedback({
    haptic: s.hapticFeedback,
    sound: store.get("br.sound", s.clickSound),
  });
  renderChrome();
}

function renderChrome() {
  const s = S.settings;
  $("#brand-site").textContent = s.siteName;
  $("#brand-org").textContent = s.subtitle
    ? `${s.orgName} · ${s.subtitle}`
    : s.orgName;
  document.title = `${s.siteName} · ${s.orgName}`;
  setHTML(
    $("#brand-mark"),
    s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM,
  );
  $$("[data-icon]").forEach((el) => setHTML(el, icon(el.dataset.icon)));
  setHTML($("#btn-prefs"), icon("sliders"));
  renderBanner();
  setHTML(
    $("#site-foot"),
    html`<span>${s.contactText}</span><span class="spacer"></span
      ><a href="/display">${icon("tablet", "i-sm")} จอแสดงผลหน้าห้อง</a
      ><a href="/admin">${icon("shield", "i-sm")} สำหรับผู้ดูแลระบบ</a>`,
  );
}

function renderBanner() {
  const s = S.settings;
  const parts = [];
  if (s.maintenanceMode) {
    parts.push(
      html`<div class="notice notice-danger">
        ${icon("alert")}
        <div class="notice-text">
          <b>ปิดรับการจองชั่วคราว</b><br />${s.maintenanceMessage}
        </div>
      </div>`,
    );
  }
  const dismissed = store.get("br.ann.dismissed");
  if (
    s.announcementEnabled &&
    s.announcementText &&
    dismissed !== s.announcementText
  ) {
    const lvl =
      {
        info: "",
        success: "notice-success",
        warning: "notice-warning",
        danger: "notice-danger",
      }[s.announcementLevel] || "";
    parts.push(
      html`<div class="notice ${lvl}">
        ${icon("megaphone")}
        <div class="notice-text">${s.announcementText}</div>
        <button
          class="btn btn-ghost btn-icon btn-sm"
          data-dismiss
          aria-label="ปิดประกาศ"
        >
          ${icon("x")}
        </button>
      </div>`,
    );
  }
  const el = $("#banner");
  setHTML(
    el,
    parts.length ? html`<div class="announce stack">${parts}</div>` : "",
  );
  const btn = el.querySelector("[data-dismiss]");
  if (btn) {
    btn.onclick = () => {
      store.set("br.ann.dismissed", s.announcementText);
      const n = btn.closest(".notice");
      n.style.transition = "opacity .25s, transform .25s";
      n.style.opacity = "0";
      n.style.transform = "translateY(-6px)";
      setTimeout(renderBanner, 260);
    };
  }
}

function updateNav(name) {
  $$("[data-nav]").forEach((a) =>
    a.classList.toggle("active", a.dataset.nav === name),
  );
  const nav = $(".topnav");
  const act = nav.querySelector(".nav-link.active");
  const ind = nav.querySelector(".nav-ind");
  if (act) {
    ind.style.opacity = "1";
    ind.style.width = `${act.offsetWidth}px`;
    ind.style.transform = `translateX(${act.offsetLeft}px)`;
  } else ind.style.opacity = "0";
}

// ------------------------------------------------------------------ router
const ROUTES = {
  "": viewHome,
  calendar: viewCalendar,
  book: viewBook,
  my: viewMy,
};
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { name: path.split("/")[0], query: new URLSearchParams(qs || "") };
}
async function route() {
  const { name, query } = parseHash();
  const key = name in ROUTES ? name : "";
  updateNav(key);
  try {
    current.cleanup?.();
  } catch {
    /* ignore */
  }
  const ctx = { name: key };
  current = ctx;
  await swap(viewEl, () => {
    window.scrollTo(0, 0);
    // แต่ละหน้าได้ container ใหม่ เพื่อไม่ให้ event listener ของหน้าก่อนค้างอยู่
    const page = document.createElement("div");
    viewEl.replaceChildren(page);
    ROUTES[key](page, query, ctx);
  });
}

// ------------------------------------------------------------------ shared UI parts
function agendaItem(b, { showDate = false } = {}) {
  const r = roomOf(b.roomId);
  return html`<button
    class="agenda-item ${liveStatus(b) === "live" ? "live" : ""}"
    style="--room:${col(r)}"
    data-id="${b.id}"
  >
    <div class="agenda-time">
      ${b.start}<small
        >${showDate ? fmtDate(b.date, "short") : `ถึง ${b.end}`}</small
      >
    </div>
    <div class="agenda-main">
      <b>${titleOf(b)}</b>
      <span
        >${r ? `${r.name} ${r.floor}` : ""}${b.department
          ? ` · ${b.department}`
          : ""}${showDate ? ` · ${b.start}–${b.end} น.` : ""}</span
      >
    </div>
    ${statusBadge(b)}
  </button>`;
}

function emptyState(iconName, title, text, action = "") {
  return html`<div class="empty card">
    <div class="empty-art">${icon(iconName)}</div>
    <b>${title}</b>
    <p class="small">${text}</p>
    ${action}
  </div>`;
}

function bindAgenda(container, list) {
  container.onclick = (e) => {
    const it = e.target.closest("[data-id]");
    if (!it) return;
    const b =
      list.find((x) => x.id === it.dataset.id) || my.byId.get(it.dataset.id)?.b;
    if (b) openDetail(b);
  };
}

// ------------------------------------------------------------------ HOME
function roomState(r, list, now) {
  const items = list.filter((b) => b.roomId === r.id).sort(byTime);
  const cur = items.find(
    (b) => toMin(b.start) <= now.minutes && now.minutes < toMin(b.end),
  );
  const next = items.find((b) => toMin(b.start) > now.minutes);
  if (!r.active) return { cls: "closed", label: "ปิดให้บริการ", cur, next };
  if (cur)
    return {
      cls: "busy",
      label: cur.kind === "block" ? "ปิดใช้ห้อง" : "กำลังใช้งาน",
      cur,
      next,
    };
  if (next && toMin(next.start) - now.minutes <= 30)
    return {
      cls: "soon",
      label: `ใกล้เริ่ม (อีก ${toMin(next.start) - now.minutes} นาที)`,
      next,
    };
  if (dayClosed(now.date)) return { cls: "off", label: "วันหยุด", next };
  if (now.minutes < openMin() || now.minutes >= closeMin())
    return { cls: "off", label: "นอกเวลาทำการ", next };
  return { cls: "free", label: "ว่าง", next };
}

function roomCard(r, list, now) {
  const st = roomState(r, list, now);
  const o = openMin();
  const c = closeMin();
  const span = Math.max(1, c - o);
  const segs = list
    .filter((b) => b.roomId === r.id)
    .map((b, i) => {
      const a = Math.max(o, toMin(b.start));
      const z = Math.min(c, toMin(b.end));
      if (z <= a) return "";
      return html`<i
        class="day-seg ${b.status === "pending" ? "pending" : ""} ${b.kind ===
        "block"
          ? "block"
          : ""}"
        style="left:${((a - o) / span) * 100}%;width:${((z - a) / span) *
        100}%;animation-delay:${i * 60}ms"
        title="${b.start}–${b.end} ${titleOf(b)}"
      ></i>`;
    });
  const nowPct = ((now.minutes - o) / span) * 100;
  const ticks = [];
  for (let m = Math.ceil(o / 120) * 120; m <= c; m += 120)
    ticks.push(pad2(Math.floor(m / 60)));
  let nowBlock;
  if (!r.active) {
    nowBlock = html`<span class="label">สถานะ</span><b>ปิดให้บริการชั่วคราว</b
      ><span class="sub"
        >${r.closedMessage || "กรุณาติดต่อผู้ดูแลห้องประชุม"}</span
      >`;
  } else if (st.cur) {
    const a = toMin(st.cur.start);
    const z = toMin(st.cur.end);
    const pct = Math.min(100, Math.max(0, ((now.minutes - a) / (z - a)) * 100));
    nowBlock = html`<span class="label"
        >${st.cur.kind === "block" ? "ปิดใช้ห้อง" : "กำลังประชุม"} · เหลืออีก
        ${fmtDuration(z - now.minutes)}</span
      >
      <b>${titleOf(st.cur)}</b>
      <span class="sub"
        >${st.cur.start}–${st.cur.end}
        น.${st.cur.department ? ` · ${st.cur.department}` : ""}</span
      >
      <div class="progress"><i style="width:${pct}%"></i></div>`;
  } else if (st.next) {
    nowBlock = html`<span class="label"
        >การประชุมถัดไป · อีก
        ${fmtDuration(toMin(st.next.start) - now.minutes)}</span
      >
      <b>${titleOf(st.next)}</b>
      <span class="sub"
        >${st.next.start}–${st.next.end}
        น.${st.next.department ? ` · ${st.next.department}` : ""}</span
      >`;
  } else {
    nowBlock = html`<span class="label">วันนี้</span
      ><b>${dayClosed(now.date) ? "วันหยุด" : "ว่างตลอดช่วงที่เหลือของวัน"}</b
      ><span class="sub"
        >${dayClosed(now.date) ||
        `เปิดให้จอง ${S.settings.openTime}–${S.settings.closeTime} น.`}</span
      >`;
  }
  return html`<article
    class="room-card ${r.active ? "" : "inactive"}"
    style="--room:${col(r)}"
    data-room="${r.id}"
  >
    <div class="room-top">
      <span class="room-floor">${icon("layers", "i-sm")} ${r.floor}</span>
      <span class="status-pill ${st.cls}"><i class="dot"></i>${st.label}</span>
    </div>
    <div class="room-title">
      <div class="room-icon">${icon("door")}</div>
      <div>
        <h3>${r.name}</h3>
        <p>
          รองรับ ${r.capacity} คน ·
          ${r.needsApproval ? "ต้องรอการอนุมัติ" : "ยืนยันทันที"}
        </p>
      </div>
    </div>
    ${r.description ? html`<p class="room-desc">${r.description}</p>` : ""}
    <div class="room-now">${nowBlock}</div>
    <div class="day-bar" aria-label="ตารางการใช้ห้องวันนี้">
      <div class="day-track">
        ${segs}${nowPct >= 0 && nowPct <= 100
          ? html`<i class="day-now" style="left:${nowPct}%"></i>`
          : ""}
      </div>
      <div class="day-ticks">${ticks.map((t) => html`<span>${t}</span>`)}</div>
    </div>
    ${r.equipment.length
      ? html`<div class="chips">
          ${r.equipment.map(
            (e) => html`<span class="chip chip-static">${e}</span>`,
          )}
        </div>`
      : ""}
    <div class="room-actions">
      ${r.active
        ? html`<a
            class="btn btn-primary"
            href="#/book?room=${encodeURIComponent(r.id)}"
            >${icon("calendar-plus")} จองห้องนี้</a
          >`
        : ""}
      <a
        class="btn btn-soft"
        href="#/calendar?v=day&room=${encodeURIComponent(r.id)}"
        >${icon("calendar")} ดูตาราง</a
      >
    </div>
  </article>`;
}

function viewHome(el, q, ctx) {
  const s = S.settings;
  const now = bkkNow();
  setHTML(
    el,
    html`<section class="hero">
        <div class="hero-orb" aria-hidden="true"></div>
        <div class="skyline" aria-hidden="true">${SKYLINE}</div>
        <div class="hero-text">
          <span class="eyebrow"
            >${icon("building", "i-sm")}
            ${s.orgName}${s.subtitle ? ` · ${s.subtitle}` : ""}</span
          >
          <h1>
            <span class="greet" id="h-greet">${greeting(now.minutes)}</span
            >${s.siteName}
          </h1>
          <p class="hero-date" id="h-date">${fmtDate(now.date, "long")}</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg shine" href="#/book"
              >${icon("calendar-plus")} จองห้องประชุม</a
            >
            <a class="btn btn-glass btn-lg" href="#/calendar"
              >${icon("calendar")} ดูตารางห้อง</a
            >
          </div>
        </div>
        <div class="hero-clock">
          <div class="clock-digits" id="h-clock" aria-hidden="true"></div>
          <div class="clock-caption">เวลาประเทศไทย</div>
          <div class="hero-stats">
            <div class="hero-stat">
              <b id="h-today">–</b><span>การประชุมวันนี้</span>
            </div>
            <div class="hero-stat">
              <b id="h-free">–</b><span>ห้องว่างขณะนี้</span>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>สถานะห้องประชุม</h2>
          <span class="live-dot ${S.online ? "" : "off"}">อัปเดตอัตโนมัติ</span>
        </div>
        <div class="room-grid ${S.rooms.length > 2 ? "many" : ""}" id="h-rooms">
          ${S.rooms.map(
            () =>
              html`<div
                class="skel"
                style="height:360px;border-radius:28px"
              ></div>`,
          )}
        </div>
      </section>
      <section class="section two-col">
        <div>
          <div class="section-head">
            <h2>กำหนดการวันนี้</h2>
            <span class="spacer"></span>
            <a class="btn btn-ghost btn-sm" href="#/calendar"
              >ดูปฏิทิน ${icon("arrow-right", "i-sm")}</a
            >
          </div>
          <div class="agenda" id="h-agenda">
            ${[1, 2, 3].map(
              () => html`<div class="skel" style="height:66px"></div>`,
            )}
          </div>
        </div>
        <div>
          <div class="section-head">
            <h2>การจองของฉัน</h2>
            <span class="spacer"></span>
            <a class="btn btn-ghost btn-sm" href="#/my"
              >ทั้งหมด ${icon("arrow-right", "i-sm")}</a
            >
          </div>
          <div class="agenda" id="h-my"></div>
        </div>
      </section>`,
  );
  let todays = [];
  let first = true;

  function renderRooms() {
    const n = bkkNow();
    const grid = $("#h-rooms", el);
    if (!grid) return;
    setHTML(
      grid,
      S.rooms.length
        ? S.rooms.map((r) => roomCard(r, todays, n))
        : emptyState(
            "door",
            "ยังไม่มีห้องประชุม",
            "ผู้ดูแลระบบสามารถเพิ่มห้องได้ที่หน้าผู้ดูแล",
          ),
    );
    if (first) {
      grid.classList.add("stagger");
      stagger(grid);
    } else grid.classList.remove("stagger");
    const free = S.rooms.filter(
      (r) => roomState(r, todays, n).cls === "free",
    ).length;
    const meetings = todays.filter((b) => b.kind !== "block").length;
    const tEl = $("#h-today", el);
    const fEl = $("#h-free", el);
    if (first) {
      countUp(tEl, meetings);
      countUp(fEl, free);
    } else {
      tEl.textContent = meetings;
      fEl.textContent = free;
    }
  }
  function renderAgenda() {
    const box = $("#h-agenda", el);
    const list = [...todays].sort(byTime);
    setHTML(
      box,
      list.length
        ? list.map((b) => agendaItem(b))
        : emptyState(
            "calendar-check",
            "วันนี้ยังไม่มีการจอง",
            "ห้องประชุมว่างทั้งวัน จองได้เลย",
            html`<a class="btn btn-soft btn-sm" href="#/book"
              >${icon("plus")} จองห้อง</a
            >`,
          ),
    );
    if (first) {
      box.classList.add("stagger");
      stagger(box);
    } else box.classList.remove("stagger");
    bindAgenda(box, list);
  }
  function renderMine() {
    const box = $("#h-my", el);
    if (!box) return;
    const up = my.upcoming().slice(0, 4);
    setHTML(
      box,
      up.length
        ? up.map(({ b }) => agendaItem(b, { showDate: true }))
        : emptyState(
            "user",
            "ยังไม่มีการจองจากอุปกรณ์นี้",
            "เมื่อจองแล้ว รายการจะแสดงที่นี่ หรือค้นหาด้วยรหัสการจองในเมนู “การจองของฉัน”",
            html`<a class="btn btn-soft btn-sm" href="#/my"
              >${icon("search")} ค้นหาการจอง</a
            >`,
          ),
    );
    bindAgenda(
      box,
      up.map((x) => x.b),
    );
  }
  async function load() {
    try {
      todays = await fetchBookings(bkkNow().date, bkkNow().date);
    } catch (err) {
      toastError(err);
    }
    if (current !== ctx) return;
    renderRooms();
    renderAgenda();
    first = false;
  }
  ctx.clock = (n) => {
    const c = $("#h-clock", el);
    if (!c) return;
    const d = new Date(n.ms + 7 * 3600000);
    setHTML(
      c,
      html`${pad2(d.getUTCHours())}<span class="colon">:</span>${pad2(
          d.getUTCMinutes(),
        )}<span class="sec">${pad2(d.getUTCSeconds())}</span>`,
    );
    if (n.seconds === 0) {
      $("#h-greet", el).textContent = greeting(n.minutes);
      $("#h-date", el).textContent = fmtDate(n.date, "long");
    }
  };
  ctx.clock(now);
  ctx.tick = () => renderRooms();
  ctx.refresh = () => {
    load();
    renderMine();
  };
  load();
  renderMine();
  my.load()
    .then(() => current === ctx && renderMine())
    .catch(() => {});
}

// ------------------------------------------------------------------ CALENDAR
const PPM = 1.2; // พิกเซลต่อนาที

function viewCalendar(el, q, ctx) {
  const now = bkkNow();
  const st = {
    date: isDate(q.get("d")) ? q.get("d") : now.date,
    view: ["day", "week", "month"].includes(q.get("v")) ? q.get("v") : "day",
    room: S.rooms.some((r) => r.id === q.get("room")) ? q.get("room") : "all",
  };
  setHTML(
    el,
    html`<div class="cal-toolbar">
        <div class="cal-nav">
          <button class="btn btn-icon" data-act="prev" aria-label="ก่อนหน้า">
            ${icon("chevron-left")}
          </button>
          <button class="btn" data-act="today">วันนี้</button>
          <button class="btn btn-icon" data-act="next" aria-label="ถัดไป">
            ${icon("chevron-right")}
          </button>
        </div>
        <label class="cal-title"
          ><span id="c-title"></span>${icon("chevron-down", "i-sm")}<input
            type="date"
            id="c-pick"
            aria-label="เลือกวันที่"
        /></label>
        <div class="seg" role="tablist" id="c-seg">
          <button data-value="day" role="tab">รายวัน</button>
          <button data-value="week" role="tab">รายสัปดาห์</button>
          <button data-value="month" role="tab">รายเดือน</button>
        </div>
      </div>
      <div class="cal-filters">
        <div class="chips" id="c-rooms">
          <button class="chip" data-room="all">
            ${icon("grid", "i-sm")} ทุกห้อง
          </button>
          ${S.rooms.map(
            (r) =>
              html`<button
                class="chip"
                data-room="${r.id}"
                style="--room:${col(r)}"
              >
                <i class="dot"></i>${r.name}
                <span class="faint">${r.floor}</span>
              </button>`,
          )}
        </div>
        <div class="legend">
          <span><i></i>อนุมัติแล้ว</span
          ><span><i class="pend"></i>รออนุมัติ</span
          ><span><i class="blk"></i>ปิดใช้ห้อง</span>
        </div>
      </div>
      <div class="cal-body" id="c-body"></div>`,
  );
  const body = $("#c-body", el);
  const seg = $("#c-seg", el);
  let list = [];
  let seq = 0;

  const visibleRooms = () =>
    st.room === "all" ? S.rooms : S.rooms.filter((r) => r.id === st.room);
  function range() {
    if (st.view === "day") return [st.date, st.date];
    if (st.view === "week") {
      const a = startOfWeek(st.date);
      return [a, addDays(a, 6)];
    }
    const first = `${st.date.slice(0, 8)}01`;
    const a = startOfWeek(first);
    return [a, addDays(a, 41)];
  }
  function title() {
    if (st.view === "day") return fmtDate(st.date, "long");
    if (st.view === "week") {
      const [a, b] = range();
      return `${fmtDate(a, "short")} – ${fmtDate(b, "full")}`;
    }
    return fmtDate(st.date, "month");
  }
  function shift(dir) {
    if (st.view === "day") st.date = addDays(st.date, dir);
    else if (st.view === "week") st.date = addDays(st.date, 7 * dir);
    else {
      const [y, m] = st.date.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      st.date = d.toISOString().slice(0, 10);
    }
    render(dir > 0 ? "left" : "right");
  }

  async function render(dir = "fade", animate = true) {
    $("#c-title", el).textContent = title();
    $("#c-pick", el).value = st.date;
    history.replaceState(
      null,
      "",
      `#/calendar?v=${st.view}&d=${st.date}${st.room !== "all" ? `&room=${encodeURIComponent(st.room)}` : ""}`,
    );
    segSelect(seg, st.view);
    $$("#c-rooms .chip", el).forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.room === st.room)),
    );
    const token = ++seq;
    const [from, to] = range();
    try {
      list = await fetchBookings(from, to);
    } catch (err) {
      toastError(err);
      list = [];
    }
    if (token !== seq || current !== ctx) return;
    const draw = () => {
      if (st.view === "day") drawDay();
      else if (st.view === "week") drawWeek();
      else drawMonth();
    };
    if (animate) await swap(body, draw, dir);
    else draw();
  }

  function eventHtml(b, o, c, i, extraCls = "") {
    const a = Math.max(o, toMin(b.start));
    const z = Math.min(c, toMin(b.end));
    if (z <= a) return "";
    const h = Math.max(20, (z - a) * PPM - 3);
    const ls = liveStatus(b);
    const cls = [
      b.status === "pending" ? "pending" : "",
      b.kind === "block" ? "block" : "",
      ls === "done" ? "past" : "",
      ls === "live" ? "live" : "",
      h < 44 ? "tiny" : "",
      extraCls,
    ].join(" ");
    return html`<button
      class="ev ${cls}"
      data-id="${b.id}"
      style="--room:${col(roomOf(b.roomId))};top:${(a - o) * PPM +
      1}px;height:${h}px;--i:${i}"
      title="${b.start}–${b.end} ${titleOf(b)}${b.department
        ? ` · ${b.department}`
        : ""}"
    >
      <span class="t"
        >${b.start}–${b.end}${b.status === "pending"
          ? " · รออนุมัติ"
          : ""}</span
      >
      <b>${titleOf(b)}</b>
      <span class="d">${b.department || ""}</span>
    </button>`;
  }

  function timesCol(o, c) {
    const labels = [];
    for (let m = Math.ceil(o / 60) * 60; m <= c; m += 60) {
      const edge = m === o ? "first" : m === c ? "last" : "";
      labels.push(
        html`<span class="${edge}" style="top:${(m - o) * PPM}px"
          >${toHHMM(m)}</span
        >`,
      );
    }
    return html`<div class="tg-times">${labels}</div>`;
  }

  function pastHeight(date, o, c) {
    const n = bkkNow();
    if (date < n.date) return (c - o) * PPM;
    if (date > n.date) return 0;
    return Math.max(0, Math.min(c, n.minutes) - o) * PPM;
  }

  function nowLine(o, c) {
    const n = bkkNow();
    if (n.minutes < o || n.minutes >= c) return "";
    const top = (n.minutes - o) * PPM;
    return html`<div
        class="now-line"
        style="top:${top}px;left:var(--gut)"
      ></div>
      <span class="now-tag" style="top:${top}px">${toHHMM(n.minutes)}</span>`;
  }

  function gridVars(cols, rows, extra = "") {
    const slot = S.settings.slotMinutes;
    return `--cols:${cols};--rows:${rows};--row-h:${slot * PPM}px;--per-hour:${60 / slot};${extra}`;
  }

  function drawDay() {
    const o = openMin();
    const c = closeMin();
    const rooms = visibleRooms();
    const closed = dayClosed(st.date);
    const rows = (c - o) / S.settings.slotMinutes;
    const today = bkkNow().date;
    const extra = list.filter((b) => toMin(b.end) <= o || toMin(b.start) >= c);
    setHTML(
      body,
      html`${closed
          ? html`<div class="notice notice-warning cal-notice">
              ${icon("calendar-x")}
              <div>${closed}</div>
            </div>`
          : ""}
        ${extra.length
          ? html`<div class="notice cal-notice">
              ${icon("info")}
              <div>
                มีรายการนอกเวลาทำการ ${extra.length} รายการ:
                ${extra
                  .map((b) => `${b.start}–${b.end} ${titleOf(b)}`)
                  .join(", ")}
              </div>
            </div>`
          : ""}
        <div
          class="tgrid"
          style="${gridVars(
            rooms.length,
            rows,
            `--colmin:${rooms.length > 2 ? 150 : 120}px`,
          )}"
        >
          <div class="tgrid-scroll">
            <div class="tg-head">
              <div></div>
              ${rooms.map(
                (r) =>
                  html`<div class="tg-room" style="--room:${col(r)}">
                    <i class="sw"></i><span class="nm">${r.name}</span
                    ><small>${r.floor}</small>
                  </div>`,
              )}
            </div>
            <div class="tg-body">
              ${timesCol(o, c)}
              ${rooms.map(
                (r) =>
                  html`<div
                    class="tg-col ${closed || !r.active
                      ? "off"
                      : ""} ${st.date === today ? "today" : ""}"
                    data-room="${r.id}"
                    data-date="${st.date}"
                  >
                    <div
                      class="tg-past"
                      style="height:${pastHeight(st.date, o, c)}px"
                    ></div>
                    ${list
                      .filter((b) => b.roomId === r.id)
                      .map((b, i) => eventHtml(b, o, c, i))}
                  </div>`,
              )}
              ${st.date === today ? nowLine(o, c) : ""}
            </div>
          </div>
        </div>`,
    );
  }

  function drawWeek() {
    const o = openMin();
    const c = closeMin();
    const rooms = visibleRooms();
    const [a] = range();
    const days = Array.from({ length: 7 }, (_, i) => addDays(a, i));
    const today = bkkNow().date;
    if (innerWidth < 760) {
      setHTML(
        body,
        html`<div class="agenda">
          ${days.map((d) => {
            const items = list.filter(
              (b) => b.date === d && rooms.some((r) => r.id === b.roomId),
            );
            const closed = dayClosed(d);
            return html`<div class="agenda-day ${d === today ? "today" : ""}">
                ${icon("calendar", "i-sm")} ${fmtDate(d, "wd")}
                ${d === today ? "(วันนี้)" : ""}
                ${S.holidays.get(d)
                  ? html`<span class="badge badge-danger"
                      >${S.holidays.get(d)}</span
                    >`
                  : ""}
              </div>
              ${items.length
                ? items.map((b) => agendaItem(b))
                : html`<div class="faint small" style="padding:4px 6px 8px">
                    ${closed ? "ปิดทำการ" : "ไม่มีการจอง"}
                  </div>`}`;
          })}
        </div>`,
      );
      bindAgenda(body.firstElementChild, list);
      return;
    }
    const rows = (c - o) / S.settings.slotMinutes;
    setHTML(
      body,
      html`<div
        class="tgrid"
        style="${gridVars(
          7,
          rows,
          `--sub:${rooms.length};--colmin:${rooms.length > 2 ? 140 : 110}px`,
        )}"
      >
        <div class="tgrid-scroll">
          <div class="tg-head">
            <div></div>
            ${days.map(
              (d) =>
                html`<button
                  class="tg-day ${d === today ? "today" : ""} ${S.holidays.get(
                    d,
                  )
                    ? "hol"
                    : ""}"
                  data-goto="${d}"
                  title="${S.holidays.get(d) || ""}"
                >
                  ${TH_DAYS_SHORT[weekdayOf(d)]}<b>${Number(d.slice(8))}</b>
                </button>`,
            )}
          </div>
          <div class="tg-body">
            ${timesCol(o, c)}
            ${days.map((d) => {
              const closed = dayClosed(d);
              return html`<div class="tg-week-col">
                ${rooms.map(
                  (r) =>
                    html`<div
                      class="tg-col ${closed || !r.active ? "off" : ""} ${d ===
                      today
                        ? "today"
                        : ""}"
                      data-room="${r.id}"
                      data-date="${d}"
                      title="${r.name}"
                    >
                      <div
                        class="tg-past"
                        style="height:${pastHeight(d, o, c)}px"
                      ></div>
                      ${list
                        .filter((b) => b.date === d && b.roomId === r.id)
                        .map((b, i) => eventHtml(b, o, c, i, "tiny"))}
                    </div>`,
                )}
              </div>`;
            })}
          </div>
        </div>
      </div>`,
    );
  }

  function drawMonth() {
    const [a] = range();
    const month = st.date.slice(0, 7);
    const today = bkkNow().date;
    const rooms = visibleRooms();
    const cells = Array.from({ length: 42 }, (_, i) => addDays(a, i));
    const heads = [1, 2, 3, 4, 5, 6, 0].map((d) => TH_DAYS_MIN[d]);
    setHTML(
      body,
      html`<div class="month">
        <div class="month-head">
          ${heads.map((h) => html`<span>${h}</span>`)}
        </div>
        <div class="month-grid">
          ${cells.map((d, i) => {
            const items = list
              .filter(
                (b) => b.date === d && rooms.some((r) => r.id === b.roomId),
              )
              .sort(byTime);
            const wd = weekdayOf(d);
            const hol = S.holidays.get(d);
            const cls = [
              d.slice(0, 7) !== month ? "other" : "",
              d === today ? "today" : "",
              wd === 0 || wd === 6 ? "weekend" : "",
              hol ? "hol" : "",
            ].join(" ");
            return html`<button
              class="mcell ${cls}"
              data-goto="${d}"
              style="--i:${i}"
              aria-label="${fmtDate(d, "long")} ${items.length} รายการ"
            >
              <span class="mnum">${Number(d.slice(8))}</span>
              ${hol ? html`<span class="mhol">${hol}</span>` : ""}
              ${items
                .slice(0, 3)
                .map(
                  (b) =>
                    html`<span
                      class="mpill ${b.status === "pending" ? "pending" : ""}"
                      style="--room:${col(roomOf(b.roomId))}"
                      >${b.start} ${titleOf(b)}</span
                    >`,
                )}
              ${items.length > 3
                ? html`<span class="mmore">+${items.length - 3} รายการ</span>`
                : ""}
              <span class="mdots"
                >${items
                  .slice(0, 5)
                  .map(
                    (b) =>
                      html`<i style="--room:${col(roomOf(b.roomId))}"></i>`,
                  )}</span
              >
            </button>`;
          })}
        </div>
      </div>`,
    );
  }

  // ---------- interactions
  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "prev") return shift(-1);
    if (act === "next") return shift(1);
    if (act === "today") {
      const t = bkkNow().date;
      const dir = t > st.date ? "left" : "right";
      st.date = t;
      return render(dir);
    }
    const segBtn = e.target.closest("#c-seg button");
    if (segBtn) {
      st.view = segBtn.dataset.value;
      return render("fade");
    }
    const chip = e.target.closest("#c-rooms .chip");
    if (chip) {
      st.room = chip.dataset.room;
      return render("fade");
    }
    const ev = e.target.closest(".ev");
    if (ev) {
      const b = list.find((x) => x.id === ev.dataset.id);
      if (b) openDetail(b);
      return;
    }
    const go = e.target.closest("[data-goto]");
    if (go) {
      st.date = go.dataset.goto;
      st.view = "day";
      return render("fade");
    }
    const colEl = e.target.closest(".tg-col");
    if (colEl) slotClick(colEl, e);
  });

  function minuteAt(colEl, clientY) {
    const rect = colEl.getBoundingClientRect();
    const slot = S.settings.slotMinutes;
    const o = openMin();
    const m = o + Math.floor((clientY - rect.top) / PPM / slot) * slot;
    return Math.max(o, Math.min(closeMin() - slot, m));
  }

  function slotClick(colEl, e) {
    const room = roomOf(colEl.dataset.room);
    const date = colEl.dataset.date;
    const m = minuteAt(colEl, e.clientY);
    if (!room?.active)
      return toast(`${room?.name || "ห้องนี้"}ปิดให้บริการชั่วคราว`, "warning");
    const closed = dayClosed(date);
    if (closed) return toast(closed, "warning");
    if (toEpoch(date, toHHMM(m)) + S.settings.slotMinutes * 60000 <= nowMs())
      return toast("ช่วงเวลานี้ผ่านไปแล้ว", "warning");
    haptic();
    location.hash = `#/book?room=${encodeURIComponent(room.id)}&date=${date}&start=${toHHMM(m)}`;
  }

  // ghost preview เมื่อชี้เมาส์
  if (matchMedia("(pointer: fine)").matches) {
    let ghost = null;
    body.addEventListener("pointermove", (e) => {
      const colEl = e.target.closest(".tg-col");
      if (
        !colEl ||
        colEl.classList.contains("off") ||
        e.target.closest(".ev")
      ) {
        ghost?.classList.remove("show");
        return;
      }
      const m = minuteAt(colEl, e.clientY);
      if (
        toEpoch(colEl.dataset.date, toHHMM(m)) +
          S.settings.slotMinutes * 60000 <=
        nowMs()
      ) {
        ghost?.classList.remove("show");
        return;
      }
      if (!ghost || ghost.parentElement !== colEl) {
        ghost?.remove();
        ghost = document.createElement("div");
        ghost.className = "ghost";
        ghost.style.setProperty("--room", col(roomOf(colEl.dataset.room)));
        colEl.appendChild(ghost);
      }
      ghost.style.top = `${(m - openMin()) * PPM + 1}px`;
      ghost.style.height = `${Math.min(60, closeMin() - m) * PPM - 3}px`;
      ghost.textContent = `+ จอง ${toHHMM(m)}`;
      requestAnimationFrame(() => ghost?.classList.add("show"));
    });
    body.addEventListener("pointerleave", () =>
      ghost?.classList.remove("show"),
    );
  }

  // ปัดซ้าย/ขวาเพื่อเปลี่ยนวัน
  let touch = null;
  body.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1)
        touch = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          t: Date.now(),
        };
    },
    { passive: true },
  );
  body.addEventListener(
    "touchend",
    (e) => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.x;
      const dy = e.changedTouches[0].clientY - touch.y;
      const fast = Date.now() - touch.t < 600;
      touch = null;
      const scroller = e.target.closest(".tgrid-scroll");
      if (scroller && scroller.scrollWidth > scroller.clientWidth + 4) return;
      if (fast && Math.abs(dx) > 70 && Math.abs(dy) < 50)
        shift(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  $("#c-pick", el).addEventListener("change", (e) => {
    if (!isDate(e.target.value)) return;
    const dir = e.target.value > st.date ? "left" : "right";
    st.date = e.target.value;
    render(dir);
  });
  const onKey = (e) => {
    if (
      e.target.closest("input, textarea, select") ||
      document.body.classList.contains("modal-open")
    )
      return;
    if (e.key === "ArrowLeft") shift(-1);
    if (e.key === "ArrowRight") shift(1);
  };
  document.addEventListener("keydown", onKey);
  const onResize = debounce(
    () => st.view === "week" && render("fade", false),
    250,
  );
  window.addEventListener("resize", onResize);
  ctx.cleanup = () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
  };
  ctx.refresh = () => render("fade", false);
  ctx.tick = () => {
    const o = openMin();
    const c = closeMin();
    const n = bkkNow();
    const line = $(".now-line", body);
    const tag = $(".now-tag", body);
    if (line && n.minutes >= o && n.minutes < c) {
      line.style.top = tag.style.top = `${(n.minutes - o) * PPM}px`;
      tag.textContent = toHHMM(n.minutes);
    }
    $$(".tg-col", body).forEach((colEl) => {
      const p = colEl.querySelector(".tg-past");
      if (p) p.style.height = `${pastHeight(colEl.dataset.date, o, c)}px`;
    });
  };
  initSeg(seg);
  render("fade", false).then(() => {
    // เลื่อนไปยังเวลาปัจจุบันในมุมมองรายวัน
    const line = $(".now-line", body);
    if (line && st.view !== "month") {
      const top = line.getBoundingClientRect().top;
      if (top > innerHeight * 0.85)
        window.scrollTo({
          top: top + scrollY - innerHeight / 3,
          behavior: "smooth",
        });
    }
  });
}

// ------------------------------------------------------------------ BOOKING DETAIL
function detailRow(ic, label, value) {
  if (value === "" || value === null || value === undefined) return "";
  return html`<div class="detail-row">
    ${icon(ic)}<span>${label}</span><b>${value}</b>
  </div>`;
}

function openDetail(b0) {
  const mine = my.byId.get(b0.id);
  const b = mine ? mine.b : b0;
  const r = roomOf(b.roomId);
  const dur = toMin(b.end) - toMin(b.start);
  const body = html`<div class="detail-head" style="--room:${col(r)}">
      <div class="row-wrap">
        ${statusBadge(b)} <span class="code">${b.code}</span>
        ${mine
          ? html`<span class="badge badge-brand"
              >${icon("user")} การจองของคุณ</span
            >`
          : ""}
        ${b.checkedIn
          ? html`<span class="badge badge-ok"
              >${icon("check")} เช็คอินแล้ว</span
            >`
          : ""}
      </div>
      <h2>${titleOf(b)}</h2>
    </div>
    <div class="detail-rows">
      ${detailRow("door", "ห้อง", r ? `${r.name} ${r.floor}` : "-")}
      ${detailRow("calendar", "วันที่", fmtDate(b.date, "long"))}
      ${detailRow(
        "clock",
        "เวลา",
        `${b.start}–${b.end} น. (${fmtDuration(dur)})`,
      )}
      ${detailRow("building", "หน่วยงาน", b.department)}
      ${detailRow("user", "ผู้จอง", b.organizer)}
      ${b.kind !== "block"
        ? detailRow(
            "users",
            "ผู้เข้าร่วม",
            b.attendees ? `${b.attendees} คน` : "",
          )
        : ""}
      ${mine ? detailRow("phone", "เบอร์โทร", b.phone) : ""}
      ${mine ? detailRow("mail", "อีเมล", b.email) : ""}
      ${mine && b.equipment?.length
        ? detailRow("monitor", "อุปกรณ์", b.equipment.join(", "))
        : ""}
      ${mine && b.services?.length
        ? detailRow("coffee", "บริการเสริม", b.services.join(", "))
        : ""}
      ${mine ? detailRow("file-text", "หมายเหตุ", b.note) : ""}
      ${b.rejectReason
        ? detailRow("x-circle", "เหตุผลที่ไม่อนุมัติ", b.rejectReason)
        : ""}
      ${b.cancelReason
        ? detailRow("ban", "เหตุผลการยกเลิก", b.cancelReason)
        : ""}
      ${b.seriesId
        ? detailRow("repeat", "การจองซ้ำ", "เป็นส่วนหนึ่งของชุดการจองซ้ำ")
        : ""}
    </div>`;
  const foot = document.createElement("div");
  foot.className = "row-wrap";
  foot.style.cssText = "width:100%;justify-content:flex-end";
  const m = openModal({
    title: "รายละเอียดการจอง",
    body,
    footer: foot,
    size: "md",
  });
  if (mine) {
    renderOwnerActions(foot, b, mine.token, () => m.close());
  } else if (r?.active) {
    setHTML(
      foot,
      html`<a
          class="btn btn-soft"
          href="#/calendar?v=day&d=${b.date}&room=${encodeURIComponent(r.id)}"
          >${icon("calendar")} ดูตารางห้องนี้</a
        >
        <a
          class="btn btn-primary"
          href="#/book?room=${encodeURIComponent(r.id)}&date=${b.date}"
          >${icon("calendar-plus")} จองห้องนี้วันเดียวกัน</a
        >`,
    );
    foot.addEventListener("click", (e) => e.target.closest("a") && m.close());
  } else {
    m.foot.hidden = true;
  }
}

function ownerActions(b) {
  const s = S.settings;
  const n = nowMs();
  const acts = [];
  const active = isActive(b);
  const started = hasStarted(b);
  const ended = hasEnded(b);
  if (
    s.checkinEnabled &&
    b.status === "approved" &&
    !b.checkedIn &&
    b.kind !== "block" &&
    n >= toEpoch(b.date, b.start) - s.checkinWindowMinutes * 60000 &&
    !ended
  ) {
    acts.push({
      key: "checkin",
      label: "เช็คอินเข้าใช้ห้อง",
      ic: "check-circle",
      cls: "btn-ok",
    });
  }
  if (b.status === "approved" && started && !ended)
    acts.push({
      key: "end",
      label: "คืนห้องก่อนเวลา",
      ic: "square",
      cls: "btn-soft",
    });
  if (s.allowUserEdit && active && !started)
    acts.push({ key: "edit", label: "แก้ไข", ic: "edit", cls: "btn-soft" });
  if (active && !ended)
    acts.push({
      key: "ics",
      label: "เพิ่มลงปฏิทิน",
      ic: "calendar-plus",
      cls: "btn-ghost",
    });
  acts.push({ key: "print", label: "พิมพ์", ic: "printer", cls: "btn-ghost" });
  if (s.allowUserCancel && active && !started)
    acts.push({
      key: "cancel",
      label: "ยกเลิกการจอง",
      ic: "x-circle",
      cls: "btn-danger-soft",
    });
  return acts;
}

function renderOwnerActions(container, b, token, done, extra = []) {
  const acts = [...ownerActions(b), ...extra];
  setHTML(
    container,
    acts.map(
      (a) =>
        html`<button class="btn btn-sm ${a.cls}" data-oa="${a.key}">
          ${icon(a.ic, "i-sm")} ${a.label}
        </button>`,
    ),
  );
  container.onclick = async (e) => {
    const btn = e.target.closest("[data-oa]");
    if (!btn) return;
    const key = btn.dataset.oa;
    const custom = extra.find((x) => x.key === key);
    try {
      if (custom) return await custom.run(btn);
      if (key === "edit") {
        done?.();
        location.hash = `#/book?edit=${b.id}`;
      } else if (key === "ics")
        downloadICS(b, roomOf(b.roomId), S.settings.orgName);
      else if (key === "print") printSlip(b);
      else if (key === "cancel") {
        if (await cancelFlow(b, token)) {
          done?.();
          current.refresh?.();
        }
      } else if (key === "checkin") {
        btn.classList.add("is-loading");
        await api(`/api/bookings/${b.id}/checkin`, {
          method: "POST",
          body: { token },
        });
        toast("เช็คอินเรียบร้อย ขอให้การประชุมราบรื่น", "success");
        await my.load();
        done?.();
        current.refresh?.();
      } else if (key === "end") {
        const ok = await confirmDialog({
          title: "คืนห้องก่อนเวลา?",
          message:
            "ระบบจะปรับเวลาสิ้นสุดเป็นเวลาปัจจุบัน เพื่อให้หน่วยงานอื่นจองห้องต่อได้",
          confirmText: "คืนห้อง",
          iconName: "door",
        });
        if (!ok) return;
        await api(`/api/bookings/${b.id}/end`, {
          method: "POST",
          body: { token },
        });
        toast("คืนห้องเรียบร้อย ขอบคุณที่ช่วยแบ่งปันห้องประชุม", "success");
        await my.load();
        done?.();
        current.refresh?.();
      }
    } catch (err) {
      btn.classList.remove("is-loading");
      toastError(err);
    }
  };
}

async function cancelFlow(b, token) {
  const siblings = b.seriesId
    ? my.items.filter(
        ({ b: x }) =>
          x.seriesId === b.seriesId &&
          isActive(x) &&
          !hasStarted(x) &&
          x.date >= b.date,
      )
    : [];
  const r = await confirmDialog({
    title: "ยกเลิกการจองนี้?",
    message: `${titleOf(b)}\n${fmtDate(b.date, "long")} เวลา ${b.start}–${b.end} น.`,
    confirmText: "ยืนยันยกเลิก",
    cancelText: "ไม่ยกเลิก",
    danger: true,
    input: { label: "เหตุผล (ไม่บังคับ)", placeholder: "เช่น เลื่อนการประชุม" },
    choices:
      siblings.length > 1
        ? [
            { value: "one", label: "เฉพาะครั้งนี้" },
            {
              value: "series",
              label: `ครั้งนี้และครั้งถัดไปทั้งหมด (${siblings.length} ครั้ง)`,
              hint: "ในชุดการจองซ้ำเดียวกัน",
            },
          ]
        : null,
  });
  if (!r) return false;
  const res = await api(`/api/bookings/${b.id}/cancel`, {
    method: "POST",
    body: { token, reason: r.value, scope: r.choice || "one" },
  });
  toast(
    res.cancelled.length > 1
      ? `ยกเลิกการจองแล้ว ${res.cancelled.length} รายการ`
      : "ยกเลิกการจองเรียบร้อยแล้ว",
    "success",
  );
  await my.load();
  return true;
}

function printSlip(b) {
  const s = S.settings;
  const r = roomOf(b.roomId);
  const url = `${baseUrl()}/#/my?code=${encodeURIComponent(b.code)}`;
  const n = bkkNow();
  const st = {
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ",
    cancelled: "ยกเลิก",
  }[b.status];
  const row = (k, v) =>
    v
      ? html`<tr>
          <td>${k}</td>
          <td>${v}</td>
        </tr>`
      : "";
  setHTML(
    $("#print-root"),
    html`<div class="slip">
      <div class="slip-head">
        ${s.logo ? html`<img src="${s.logo}" alt="" />` : ""}
        <div>
          <h1>${s.orgName}</h1>
          <p>${s.siteName}${s.subtitle ? ` · ${s.subtitle}` : ""}</p>
        </div>
      </div>
      <h2 class="slip-title">ใบยืนยันการจองห้องประชุม</h2>
      <div class="slip-code">รหัสการจอง ${b.code}</div>
      <table>
        ${row("ห้องประชุม", r ? `${r.name} ${r.floor}` : b.roomId)}
        ${row("วันที่", fmtDate(b.date, "long"))}
        ${row(
          "เวลา",
          `${b.start} – ${b.end} น. (${fmtDuration(toMin(b.end) - toMin(b.start))})`,
        )}
        ${row("หัวข้อการประชุม", b.title)} ${row("ผู้จอง", b.organizer)}
        ${row("หน่วยงาน", b.department)} ${row("เบอร์โทรติดต่อ", b.phone)}
        ${row("จำนวนผู้เข้าร่วม", b.attendees ? `${b.attendees} คน` : "")}
        ${row("อุปกรณ์ที่ต้องการ", (b.equipment || []).join(", "))}
        ${row("บริการเสริม", (b.services || []).join(", "))}
        ${row("หมายเหตุ", b.note)} ${row("สถานะ", st)}
      </table>
      <div class="slip-foot">
        <div>
          พิมพ์เมื่อ ${fmtDate(n.date, "full")} เวลา ${toHHMM(n.minutes)} น.<br />${s.contactText}
          <div class="slip-sign">
            ลงชื่อ .....................................................
            ผู้จอง<br />(${b.organizer})
          </div>
        </div>
        <div class="slip-qr">
          ${raw(qrSVG(url))}
          <div>สแกนเพื่อตรวจสอบสถานะ</div>
        </div>
      </div>
    </div>`,
  );
  setTimeout(() => window.print(), 50);
}

// ------------------------------------------------------------------ BOOK
function firstBookableDate() {
  const s = S.settings;
  const n = bkkNow();
  for (let i = 0; i <= Math.min(60, s.advanceDays); i++) {
    const d = addDays(n.date, i);
    if (dayClosed(d)) continue;
    if (
      i === 0 &&
      n.minutes + s.minNoticeMinutes + s.minDurationMinutes > closeMin()
    )
      continue;
    return d;
  }
  return n.date;
}

function viewBook(el, q, ctx) {
  const s = S.settings;
  const editId = q.get("edit");
  const profile = store.get("br.profile", {});
  const f = {
    step: 1,
    roomId: q.get("room") || "",
    date: isDate(q.get("date")) ? q.get("date") : "",
    start: /^\d{2}:\d{2}$/.test(q.get("start") || "") ? q.get("start") : "",
    end: "",
    pick: "start",
    title: "",
    organizer: profile.organizer || "",
    department: profile.department || "",
    deptOther: "",
    phone: profile.phone || "",
    email: profile.email || "",
    attendees: "",
    equipment: new Set(),
    services: new Set(),
    note: "",
    repeat: "none",
    repeatCount: 4,
    agree: false,
    remember: true,
    editing: null,
    token: null,
  };
  if (f.department && !S.departments.includes(f.department)) {
    f.deptOther = f.department;
    f.department = "__other";
  }
  if (!S.rooms.some((r) => r.id === f.roomId && r.active))
    f.roomId = S.rooms.find((r) => r.active)?.id || "";
  if (!f.date) f.date = firstBookableDate();
  let dayList = [];
  let daySeq = 0;
  let loadedFor = "";
  let repeatInfo = null;

  if (s.maintenanceMode && !editId) {
    setHTML(
      el,
      html`<div class="page-head">
          <div><h1>จองห้องประชุม</h1></div>
        </div>
        ${emptyState(
          "alert",
          "ปิดรับการจองชั่วคราว",
          s.maintenanceMessage,
          html`<a class="btn btn-soft" href="#/calendar"
            >${icon("calendar")} ดูตารางห้อง</a
          >`,
        )}`,
    );
    return;
  }

  setHTML(
    el,
    html`<div class="page-head">
        <div>
          <h1 id="b-h1">${editId ? "แก้ไขการจอง" : "จองห้องประชุม"}</h1>
          <p>
            ${editId
              ? "ปรับรายละเอียดการจอง แล้วกดบันทึก"
              : "เลือกห้อง วัน และเวลาที่ต้องการ — ทำรายการได้ในไม่ถึง 1 นาที"}
          </p>
        </div>
      </div>
      <div class="book-layout">
        <div class="card book-main">
          <div class="steps">
            <div class="steps-track"><i id="b-track"></i></div>
            <button class="step" data-step="1" type="button">
              <span class="num">1</span>ห้องและเวลา
            </button>
            <button class="step" data-step="2" type="button">
              <span class="num">2</span>รายละเอียด
            </button>
            <button class="step" data-step="3" type="button">
              <span class="num">3</span>ตรวจสอบและยืนยัน
            </button>
          </div>
          <div id="b-pane"></div>
          <div class="book-actions">
            <button class="btn btn-ghost" id="b-back" type="button">
              ${icon("arrow-left")} ย้อนกลับ
            </button>
            <div class="mini-sum" id="b-mini"></div>
            <button class="btn btn-primary" id="b-next" type="button">
              ถัดไป ${icon("arrow-right")}
            </button>
          </div>
        </div>
        <aside class="card sum-card" id="b-sum" aria-label="สรุปการจอง"></aside>
      </div>`,
  );
  const pane = $("#b-pane", el);
  const nextBtn = $("#b-next", el);
  const backBtn = $("#b-back", el);
  const room = () => roomOf(f.roomId);

  // ---------- slots
  function computeSlots() {
    const step = s.slotMinutes;
    const buf = s.bufferMinutes;
    const busy = dayList.filter(
      (b) => b.roomId === f.roomId && (!f.editing || b.id !== f.editing.id),
    );
    const limit = nowMs() + s.minNoticeMinutes * 60000;
    const out = [];
    for (let m = openMin(); m + step <= closeMin(); m += step) {
      out.push({
        m,
        past: toEpoch(f.date, toHHMM(m)) < limit,
        busy:
          busy.find(
            (b) => m < toMin(b.end) + buf && toMin(b.start) < m + step + buf,
          ) || null,
      });
    }
    return out;
  }
  let slots = [];
  const rangeFree = (a, z) =>
    z <= closeMin() &&
    slots
      .filter((sl) => sl.m >= a && sl.m < z)
      .every((sl) => !sl.busy && !sl.past) &&
    slots.some((sl) => sl.m === a);
  const defaultLen = () =>
    Math.max(
      s.slotMinutes,
      Math.ceil(Math.max(60, s.minDurationMinutes) / s.slotMinutes) *
        s.slotMinutes,
    );

  function setStart(m) {
    const len = defaultLen();
    const step = s.slotMinutes;
    f.start = toHHMM(m);
    let end = m + step;
    for (let z = m + len; z > m + step; z -= step) {
      if (rangeFree(m, z) && z - m <= s.maxDurationMinutes) {
        end = z;
        break;
      }
    }
    f.end = toHHMM(end);
    f.pick = "end";
  }

  function renderSlots() {
    const grid = $("#b-slots", el);
    if (!grid || loadedFor !== f.date) {
      renderSummary();
      return;
    }
    slots = computeSlots();
    const closed = dayClosed(f.date);
    const r = room();
    const sm = toMin(f.start);
    const em = toMin(f.end);
    const step = s.slotMinutes;
    setHTML(
      grid,
      slots.map((sl) => {
        const inR = f.start && f.end && sl.m >= sm && sl.m < em;
        const cls = [
          sl.busy ? "busy" : "",
          sl.past ? "past" : "",
          inR ? "in" : "",
          inR && sl.m === sm ? "first" : "",
          inR && sl.m + step === em ? "last" : "",
        ].join(" ");
        const tip = sl.busy
          ? `ไม่ว่าง ${sl.busy.start}–${sl.busy.end} น. ${titleOf(sl.busy)}`
          : sl.past
            ? "ผ่านไปแล้ว"
            : `${toHHMM(sl.m)}–${toHHMM(sl.m + step)} น.`;
        return html`<button
          type="button"
          class="slot ${cls}"
          data-m="${sl.m}"
          title="${tip}"
          ${sl.busy || sl.past || closed || !r?.active
            ? raw('aria-disabled="true"')
            : ""}
        >
          ${toHHMM(sl.m)}
        </button>`;
      }),
    );
    // hint
    const hint = $("#b-hint", el);
    if (closed) setHTML(hint, html`${icon("calendar-x")} ${closed}`);
    else if (!r?.active)
      setHTML(hint, html`${icon("ban")} ห้องนี้ปิดให้บริการชั่วคราว`);
    else if (!f.start)
      setHTML(hint, html`${icon("info")} แตะเลือก <b>เวลาเริ่ม</b>`);
    else if (f.pick === "end")
      setHTML(
        hint,
        html`${icon("info")} เริ่ม <b>${f.start}</b> —
          แตะช่วงเวลาสุดท้ายที่ต้องการ หรือเลือกระยะเวลาด้านล่าง`,
      );
    else
      setHTML(
        hint,
        html`${icon("check-circle")} เลือกแล้ว <b>${f.start}–${f.end} น.</b> ·
          แตะช่องอื่นเพื่อเริ่มเลือกใหม่`,
      );
    // durations
    const durBox = $("#b-durs", el);
    if (f.start && !closed) {
      const durs = [30, 60, 90, 120, 180, 240, 300].filter(
        (d) =>
          d % step === 0 &&
          d >= s.minDurationMinutes &&
          d <= s.maxDurationMinutes,
      );
      setHTML(
        durBox,
        durs.map((d) => {
          const ok = rangeFree(sm, sm + d);
          return html`<button
            type="button"
            class="chip"
            data-dur="${d}"
            aria-pressed="${em - sm === d}"
            ${ok ? "" : raw("disabled")}
          >
            ${fmtDuration(d)}
          </button>`;
        }),
      );
    } else setHTML(durBox, "");
    // presets
    const o = openMin();
    const c = closeMin();
    const presets = [
      { label: "ช่วงเช้า", a: o, z: Math.min(c, 12 * 60) },
      { label: "ช่วงบ่าย", a: Math.max(o, 13 * 60), z: c },
      { label: "ทั้งวัน", a: o, z: c },
    ].filter(
      (p) =>
        p.z - p.a >= s.minDurationMinutes &&
        p.z - p.a <= s.maxDurationMinutes &&
        (p.a - o) % step === 0 &&
        (p.z - o) % step === 0,
    );
    setHTML(
      $("#b-presets", el),
      presets.map(
        (p) =>
          html`<button
            type="button"
            class="chip"
            data-preset="${p.a}-${p.z}"
            aria-pressed="${sm === p.a && em === p.z}"
            ${rangeFree(p.a, p.z) && !closed ? "" : raw("disabled")}
          >
            ${icon("clock", "i-sm")} ${p.label} ${toHHMM(p.a)}–${toHHMM(p.z)}
          </button>`,
      ),
    );
    // summary
    const ts = $("#b-timesum", el);
    setHTML(
      ts,
      f.start && f.end
        ? html`<div class="time-summary">
            <span class="big">${f.start} – ${f.end} น.</span
            ><span class="badge badge-brand"
              >${icon("clock")} ${fmtDuration(em - sm)}</span
            >
            ${em - sm < s.minDurationMinutes
              ? html`<span class="badge badge-warn"
                  >ต้องจองอย่างน้อย ${fmtDuration(s.minDurationMinutes)}</span
                >`
              : ""}
          </div>`
        : "",
    );
    renderSummary();
  }

  async function loadDay({ quiet = false } = {}) {
    const token = ++daySeq;
    const date = f.date;
    let list = [];
    try {
      list = (await api(`/api/bookings?from=${date}&to=${date}`)).bookings;
    } catch (err) {
      if (!quiet) toastError(err);
    }
    if (token !== daySeq || current !== ctx) return;
    dayList = list;
    loadedFor = date;
    slots = computeSlots();
    if (f.start && !f.end) setStart(toMin(f.start));
    if (f.start && f.end && !rangeFree(toMin(f.start), toMin(f.end))) {
      toast("ช่วงเวลาที่เลือกไม่ว่างแล้ว กรุณาเลือกเวลาใหม่", "warning");
      f.start = f.end = "";
      f.pick = "start";
    }
    renderSlots();
  }

  // ---------- step templates
  function dchip(d, today) {
    const closed = dayClosed(d);
    const wd = weekdayOf(d);
    return html`<button
      type="button"
      class="dchip ${d === f.date ? "on" : ""} ${closed ? "off" : ""}"
      data-date="${d}"
      title="${closed || fmtDate(d, "long")}"
    >
      <span>${d === today ? "วันนี้" : TH_DAYS_SHORT[wd]}</span
      ><b>${Number(d.slice(8))}</b
      ><span>${TH_MONTHS_SHORT[Number(d.slice(5, 7)) - 1]}</span>
    </button>`;
  }

  function step1() {
    const today = bkkNow().date;
    const dates = [];
    for (let i = 0; dates.length < 14 && i <= s.advanceDays; i++)
      dates.push(addDays(today, i));
    const closed = dayClosed(f.date);
    return html`<div class="step-pane">
      <div class="step-block">
        <h3><span class="n">1</span>เลือกห้องประชุม</h3>
        <div class="room-opts">
          ${S.rooms.map(
            (r) =>
              html`<button
                type="button"
                class="room-opt ${f.roomId === r.id ? "on" : ""}"
                data-room="${r.id}"
                style="--room:${col(r)}"
                ${r.active ? "" : raw("disabled")}
                aria-pressed="${f.roomId === r.id}"
              >
                <span class="room-icon">${icon("door")}</span>
                <b>${r.name}</b>
                <span
                  >${r.floor} · ${r.capacity}
                  ที่นั่ง${r.active ? "" : " · ปิดชั่วคราว"}${r.needsApproval
                    ? " · ต้องอนุมัติ"
                    : ""}</span
                >
                <span class="ro-check">${icon("check")}</span>
              </button>`,
          )}
        </div>
      </div>
      <div class="step-block">
        <h3>
          <span class="n">2</span>เลือกวันที่
          <small>${fmtDate(f.date, "long")}</small>
        </h3>
        <div class="date-strip" id="b-dates">
          ${dates.map((d) => dchip(d, today))}
          <label class="dchip pick"
            >${icon("calendar")}<span>วันอื่น</span
            ><input
              type="date"
              id="b-date-input"
              min="${today}"
              max="${addDays(today, s.advanceDays)}"
              value="${f.date}"
          /></label>
        </div>
        ${closed
          ? html`<div class="notice notice-warning">
              ${icon("calendar-x")}
              <div>${closed} กรุณาเลือกวันอื่น</div>
            </div>`
          : ""}
      </div>
      <div class="step-block">
        <h3>
          <span class="n">3</span>เลือกช่วงเวลา
          <small>เปิดให้จอง ${s.openTime}–${s.closeTime} น.</small>
        </h3>
        <div class="chips" id="b-presets"></div>
        <div class="slot-grid" id="b-slots">
          ${Array.from(
            { length: 12 },
            () => html`<div class="skel" style="height:44px"></div>`,
          )}
        </div>
        <div class="slot-hint" id="b-hint"></div>
        <div class="chips" id="b-durs"></div>
        <div class="slot-legend">
          <span><i></i>ว่าง</span><span><i class="b"></i>ไม่ว่าง</span
          ><span><i class="s"></i>ช่วงที่เลือก</span>
        </div>
        <div id="b-timesum"></div>
      </div>
    </div>`;
  }

  function step2() {
    const r = room();
    const deptOpts = [...S.departments];
    return html`<div class="step-pane">
      <div class="form-grid">
        <label class="field full" data-f="title"
          ><span>หัวข้อการประชุม <i class="req">*</i></span>
          <input
            class="input"
            name="title"
            maxlength="200"
            value="${f.title}"
            placeholder="เช่น ประชุมประจำเดือนฝ่ายปกครอง"
            autocomplete="off"
        /></label>
        <label class="field" data-f="organizer"
          ><span>ชื่อ–นามสกุลผู้จอง <i class="req">*</i></span>
          <input
            class="input"
            name="organizer"
            maxlength="100"
            value="${f.organizer}"
            autocomplete="name"
        /></label>
        <label class="field" data-f="department"
          ><span>หน่วยงาน <i class="req">*</i></span>
          <select class="select" name="department">
            <option value="">— เลือกหน่วยงาน —</option>
            ${deptOpts.map(
              (d) =>
                html`<option
                  value="${d}"
                  ${f.department === d ? raw("selected") : ""}
                >
                  ${d}
                </option>`,
            )}
            <option
              value="__other"
              ${f.department === "__other" ? raw("selected") : ""}
            >
              อื่น ๆ (โปรดระบุ)
            </option>
          </select></label
        >
        <label
          class="field ${f.department === "__other" ? "" : "hidden-field"}"
          data-f="deptOther"
          ${f.department === "__other" ? "" : raw("hidden")}
        >
          <span>ระบุหน่วยงาน <i class="req">*</i></span
          ><input
            class="input"
            name="deptOther"
            maxlength="120"
            value="${f.deptOther}"
        /></label>
        <label class="field" data-f="phone"
          ><span
            >เบอร์โทรติดต่อ
            ${s.requirePhone ? html`<i class="req">*</i>` : ""}</span
          >
          <input
            class="input"
            name="phone"
            type="tel"
            inputmode="tel"
            maxlength="30"
            value="${f.phone}"
            placeholder="มือถือหรือเบอร์ภายใน"
            autocomplete="tel"
        /></label>
        <label class="field" data-f="email"
          ><span
            >อีเมล
            ${s.requireEmail
              ? html`<i class="req">*</i>`
              : html`<small class="faint">(ไม่บังคับ)</small>`}</span
          >
          <input
            class="input"
            name="email"
            type="email"
            inputmode="email"
            maxlength="120"
            value="${f.email}"
            autocomplete="email"
        /></label>
        <div class="field" data-f="attendees">
          <span>จำนวนผู้เข้าร่วม <i class="req">*</i></span>
          <div class="row" style="flex-wrap:wrap;align-items:center;gap:12px">
            <div class="stepper">
              <button type="button" data-step-btn="-1" aria-label="ลดจำนวน">
                ${icon("minus")}
              </button>
              <input
                type="number"
                name="attendees"
                min="1"
                max="9999"
                inputmode="numeric"
                value="${f.attendees}"
                placeholder="0"
              />
              <button type="button" data-step-btn="1" aria-label="เพิ่มจำนวน">
                ${icon("plus")}
              </button>
            </div>
            <div
              class="cap-meter"
              id="b-cap"
              style="flex:1;min-width:150px"
            ></div>
          </div>
        </div>
        ${s.equipmentOptions.length
          ? html`<div class="field full">
              <span>อุปกรณ์ที่ต้องการ</span>
              <div class="chips">
                ${s.equipmentOptions.map(
                  (e) =>
                    html`<button
                      type="button"
                      class="chip"
                      data-equip="${e}"
                      aria-pressed="${f.equipment.has(e)}"
                    >
                      <span class="chip-check">${icon("check", "i-sm")}</span
                      >${e}${r?.equipment.includes(e)
                        ? html`<small class="faint">· มีในห้อง</small>`
                        : ""}
                    </button>`,
                )}
              </div>
            </div>`
          : ""}
        ${s.serviceOptions.length
          ? html`<div class="field full">
              <span>บริการเสริม</span>
              <div class="chips">
                ${s.serviceOptions.map(
                  (e) =>
                    html`<button
                      type="button"
                      class="chip"
                      data-service="${e}"
                      aria-pressed="${f.services.has(e)}"
                    >
                      <span class="chip-check">${icon("check", "i-sm")}</span
                      >${e}
                    </button>`,
                )}
              </div>
            </div>`
          : ""}
        <label class="field full" data-f="note"
          ><span>หมายเหตุ <small class="faint">(ไม่บังคับ)</small></span>
          <textarea
            class="textarea"
            name="note"
            rows="3"
            maxlength="1000"
            placeholder="เช่น ต้องการจัดโต๊ะรูปตัว U, มีผู้เข้าร่วมจากภายนอก"
          >
${f.note}</textarea
          >
        </label>
        ${s.enableRecurring && !f.editing
          ? html`<div class="field full">
              <span>จองซ้ำ</span>
              <div class="repeat-box">
                <div class="row-wrap">
                  <div class="seg" id="b-repeat">
                    <button
                      type="button"
                      data-value="none"
                      aria-selected="${f.repeat === "none"}"
                    >
                      ไม่ซ้ำ
                    </button>
                    <button
                      type="button"
                      data-value="weekly"
                      aria-selected="${f.repeat === "weekly"}"
                    >
                      ทุกสัปดาห์
                    </button>
                    <button
                      type="button"
                      data-value="daily"
                      aria-selected="${f.repeat === "daily"}"
                    >
                      ทุกวันทำการ
                    </button>
                  </div>
                  <div
                    class="row"
                    id="b-repeat-count"
                    ${f.repeat === "none" ? raw("hidden") : ""}
                  >
                    <span class="small muted">จำนวน</span>
                    <div class="stepper">
                      <button type="button" data-rc="-1" aria-label="ลด">
                        ${icon("minus")}
                      </button>
                      <input
                        type="number"
                        name="repeatCount"
                        min="2"
                        max="${s.maxRecurring}"
                        value="${f.repeatCount}"
                      />
                      <button type="button" data-rc="1" aria-label="เพิ่ม">
                        ${icon("plus")}
                      </button>
                    </div>
                    <span class="small muted">ครั้ง</span>
                  </div>
                </div>
                <div id="b-repeat-preview"></div>
              </div>
            </div>`
          : ""}
        <label class="check full"
          ><input
            type="checkbox"
            name="remember"
            ${f.remember ? raw("checked") : ""}
          /><span
            >จดจำชื่อ หน่วยงาน และเบอร์โทรไว้ในอุปกรณ์นี้
            สำหรับการจองครั้งถัดไป</span
          ></label
        >
      </div>
    </div>`;
  }

  function step3() {
    const r = room();
    const dept = f.department === "__other" ? f.deptOther : f.department;
    const rows = [
      ["door", "ห้อง", r ? `${r.name} ${r.floor}` : ""],
      ["calendar", "วันที่", fmtDate(f.date, "long")],
      [
        "clock",
        "เวลา",
        `${f.start}–${f.end} น. (${fmtDuration(toMin(f.end) - toMin(f.start))})`,
      ],
      ["file-text", "หัวข้อ", f.title],
      ["user", "ผู้จอง", f.organizer],
      ["building", "หน่วยงาน", dept],
      ["phone", "เบอร์โทร", f.phone],
      ["mail", "อีเมล", f.email],
      ["users", "ผู้เข้าร่วม", `${f.attendees} คน`],
      ["monitor", "อุปกรณ์", [...f.equipment].join(", ")],
      ["coffee", "บริการเสริม", [...f.services].join(", ")],
      ["file-text", "หมายเหตุ", f.note],
    ];
    if (f.repeat !== "none" && !f.editing) {
      const ok = repeatInfo
        ? repeatInfo.filter((x) => !x.reason).length
        : f.repeatCount;
      rows.push([
        "repeat",
        "จองซ้ำ",
        `${f.repeat === "weekly" ? "ทุกสัปดาห์" : "ทุกวันทำการ"} รวม ${f.repeatCount} ครั้ง${repeatInfo ? ` (ว่าง ${ok} ครั้ง)` : ""}`,
      ]);
    }
    return html`<div class="step-pane">
      <div class="step-block">
        <h3>${icon("check-circle")} ตรวจสอบข้อมูลการจอง</h3>
        <div class="detail-rows">
          ${rows.map(([ic, k, v]) => detailRow(ic, k, v))}
        </div>
      </div>
      ${r?.needsApproval && !f.editing
        ? html`<div class="notice notice-warning">
            ${icon("hourglass")}
            <div>
              ห้องนี้ต้องได้รับการอนุมัติจากผู้ดูแลก่อน การจองจะอยู่ในสถานะ
              “รออนุมัติ”
            </div>
          </div>`
        : ""}
      ${s.termsText
        ? html`<div class="step-block">
            <h3>${icon("shield")} ระเบียบการใช้ห้องประชุม</h3>
            <div class="terms">${s.termsText}</div>
            <label class="check" data-f="agree"
              ><input
                type="checkbox"
                name="agree"
                ${f.agree ? raw("checked") : ""}
              /><span
                >ข้าพเจ้าได้อ่านและยินยอมปฏิบัติตามระเบียบการใช้ห้องประชุม</span
              ></label
            >
          </div>`
        : ""}
    </div>`;
  }

  // ---------- summary
  function renderSummary() {
    const r = room();
    const sum = $("#b-sum", el);
    if (!sum) return;
    const dept = f.department === "__other" ? f.deptOther : f.department;
    const v = (val, empty) =>
      val ? html`<b>${val}</b>` : html`<span class="empty-val">${empty}</span>`;
    setHTML(
      sum,
      html`<div class="sum-head" style="--room:${col(r)}">
          <small>${r ? r.floor : "ยังไม่ได้เลือก"}</small>
          <h3>${r ? r.name : "เลือกห้องประชุม"}</h3>
        </div>
        <div class="sum-body">
          <div class="sum-row">
            ${icon("calendar")}
            <div>
              ${v(f.date ? fmtDate(f.date, "long") : "", "ยังไม่ได้เลือกวัน")}
            </div>
          </div>
          <div class="sum-row">
            ${icon("clock")}
            <div>
              ${v(
                f.start && f.end ? `${f.start}–${f.end} น.` : "",
                "ยังไม่ได้เลือกเวลา",
              )}
              ${f.start && f.end
                ? html`<span
                    >${fmtDuration(toMin(f.end) - toMin(f.start))}</span
                  >`
                : ""}
            </div>
          </div>
          <div class="sum-row">
            ${icon("file-text")}
            <div>${v(f.title, "ยังไม่ได้ระบุหัวข้อ")}</div>
          </div>
          <div class="sum-row">
            ${icon("building")}
            <div>
              ${v(dept, "หน่วยงาน")}${f.organizer
                ? html`<span>${f.organizer}</span>`
                : ""}
            </div>
          </div>
          <div class="sum-row">
            ${icon("users")}
            <div>
              ${v(
                f.attendees ? `${f.attendees} คน` : "",
                "จำนวนผู้เข้าร่วม",
              )}${r ? html`<span>ห้องรองรับ ${r.capacity} คน</span>` : ""}
            </div>
          </div>
          ${f.repeat !== "none" && !f.editing
            ? html`<div class="sum-row">
                ${icon("repeat")}
                <div>
                  <b>จองซ้ำ ${f.repeatCount} ครั้ง</b
                  ><span
                    >${f.repeat === "weekly"
                      ? "ทุกสัปดาห์"
                      : "ทุกวันทำการ"}</span
                  >
                </div>
              </div>`
            : ""}
          <div class="sum-row">
            ${icon(r?.needsApproval ? "hourglass" : "zap")}
            <div>
              <b
                >${r?.needsApproval
                  ? "ต้องรอผู้ดูแลอนุมัติ"
                  : "ยืนยันการจองทันที"}</b
              >
            </div>
          </div>
        </div>`,
    );
    setHTML(
      $("#b-mini", el),
      html`<b>${r ? r.name : "เลือกห้อง"} · ${fmtDate(f.date, "short")}</b
        >${f.start && f.end ? `${f.start}–${f.end} น.` : "ยังไม่ได้เลือกเวลา"}`,
    );
  }

  // ---------- step navigation
  function renderStep(dir = "up") {
    $$(".step", el).forEach((b) => {
      const n = Number(b.dataset.step);
      b.classList.toggle("active", n === f.step);
      b.classList.toggle("done", n < f.step);
      setHTML(
        b.querySelector(".num"),
        n < f.step ? icon("check", "i-sm") : String(n),
      );
    });
    $("#b-track", el).style.width = `${(f.step - 1) * 50}%`;
    backBtn.hidden = f.step === 1;
    setHTML(
      nextBtn,
      f.step < 3
        ? html`ถัดไป ${icon("arrow-right")}`
        : f.editing
          ? html`${icon("check")} บันทึกการแก้ไข`
          : html`${icon("check")} ยืนยันการจอง`,
    );
    nextBtn.classList.toggle("shine", f.step === 3);
    swap(
      pane,
      () => {
        setHTML(
          pane,
          f.step === 1 ? step1() : f.step === 2 ? step2() : step3(),
        );
        bindStep();
      },
      dir,
    );
    renderSummary();
    const top =
      el.querySelector(".book-layout").getBoundingClientRect().top +
      scrollY -
      90;
    if (scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }

  function go(step) {
    if (step === f.step) return;
    const dir = step > f.step ? "left" : "right";
    f.step = step;
    renderStep(dir);
  }

  function clearErrors() {
    $$(".field.invalid", pane).forEach((x) => x.classList.remove("invalid"));
    $$(".field-error", pane).forEach((x) => x.remove());
  }
  function fieldError(name, msg) {
    const fieldEl = pane.querySelector(`[data-f="${name}"]`);
    if (!fieldEl) return null;
    fieldEl.classList.add("invalid");
    fieldEl.insertAdjacentHTML(
      "beforeend",
      `<span class="field-error"></span>`,
    );
    setHTML(fieldEl.lastElementChild, html`${icon("alert", "i-sm")} ${msg}`);
    return fieldEl;
  }

  function validate(step) {
    clearErrors();
    const r = room();
    if (step === 1) {
      if (!r || !r.active)
        return failToast("กรุณาเลือกห้องประชุม", ".room-opts");
      const closed = dayClosed(f.date);
      if (closed) return failToast(closed, "#b-dates");
      if (!f.start || !f.end)
        return failToast("กรุณาเลือกช่วงเวลาที่ต้องการจอง", "#b-slots");
      const dur = toMin(f.end) - toMin(f.start);
      if (dur < s.minDurationMinutes)
        return failToast(
          `ต้องจองอย่างน้อย ${fmtDuration(s.minDurationMinutes)}`,
          "#b-slots",
        );
      if (dur > s.maxDurationMinutes)
        return failToast(
          `จองได้ไม่เกิน ${fmtDuration(s.maxDurationMinutes)} ต่อครั้ง`,
          "#b-slots",
        );
      if (!rangeFree(toMin(f.start), toMin(f.end)))
        return failToast("ช่วงเวลาที่เลือกไม่ว่าง กรุณาเลือกใหม่", "#b-slots");
      return true;
    }
    if (step === 2) {
      const errs = {};
      if (!f.title.trim()) errs.title = "กรุณาระบุหัวข้อการประชุม";
      if (!f.organizer.trim()) errs.organizer = "กรุณาระบุชื่อผู้จอง";
      if (!f.department) errs.department = "กรุณาเลือกหน่วยงาน";
      else if (f.department === "__other" && !f.deptOther.trim())
        errs.deptOther = "กรุณาระบุหน่วยงาน";
      if (f.phone ? !PHONE_RE.test(f.phone) : s.requirePhone)
        errs.phone = f.phone
          ? "รูปแบบเบอร์โทรไม่ถูกต้อง"
          : "กรุณาระบุเบอร์โทรติดต่อ";
      if (f.email ? !EMAIL_RE.test(f.email) : s.requireEmail)
        errs.email = f.email ? "รูปแบบอีเมลไม่ถูกต้อง" : "กรุณาระบุอีเมล";
      const n = Number(f.attendees);
      if (!(n >= 1)) errs.attendees = "กรุณาระบุจำนวนผู้เข้าร่วม";
      else if (s.enforceCapacity && r && n > r.capacity)
        errs.attendees = `เกินความจุห้อง (รองรับได้ ${r.capacity} คน)`;
      const keys = Object.keys(errs);
      keys.forEach((k) => fieldError(k, errs[k]));
      if (keys.length) {
        const firstEl = pane.querySelector(".field.invalid");
        shake(firstEl);
        firstEl
          ?.querySelector("input, select, textarea")
          ?.focus({ preventScroll: true });
        firstEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      }
      return true;
    }
    if (step === 3 && s.termsText && !f.agree) {
      const fe = fieldError("agree", "กรุณายอมรับระเบียบการใช้ห้องประชุม");
      shake(fe);
      return false;
    }
    return true;
  }
  function failToast(msg, sel) {
    toast(msg, "warning");
    shake(pane.querySelector(sel));
    return false;
  }

  // ---------- binding
  function updateCap() {
    const capEl = $("#b-cap", el);
    if (!capEl) return;
    const r = room();
    const n = Number(f.attendees) || 0;
    const pct = r ? Math.min(100, (n / r.capacity) * 100) : 0;
    capEl.className = `cap-meter ${n > (r?.capacity || 0) ? "over" : pct >= 80 ? "mid" : ""}`;
    setHTML(
      capEl,
      html`<div class="bar"><i style="width:${pct}%"></i></div>
        <small
          >${r
            ? n > r.capacity
              ? `เกินความจุห้อง ${n - r.capacity} คน (รองรับ ${r.capacity} คน)`
              : `${r.name} รองรับ ${r.capacity} คน`
            : ""}</small
        >`,
    );
  }

  const loadRepeat = debounce(async () => {
    const box = $("#b-repeat-preview", el);
    if (!box) return;
    if (f.repeat === "none") {
      repeatInfo = null;
      setHTML(box, "");
      return;
    }
    const dates = [f.date];
    if (f.repeat === "weekly")
      for (let i = 1; i < f.repeatCount; i++)
        dates.push(addDays(f.date, 7 * i));
    else {
      let d = f.date;
      let guard = 0;
      while (dates.length < f.repeatCount && guard++ < 200) {
        d = addDays(d, 1);
        const wd = weekdayOf(d);
        if (!s.allowWeekends && (wd === 0 || wd === 6)) continue;
        if (!s.allowHolidays && S.holidays.get(d)) continue;
        dates.push(d);
      }
    }
    setHTML(box, html`<div class="faint small">กำลังตรวจสอบห้องว่าง...</div>`);
    let list = [];
    try {
      list = await fetchBookings(dates[0], dates[dates.length - 1]);
    } catch (err) {
      toastError(err);
    }
    const today = bkkNow().date;
    const sm = toMin(f.start);
    const em = toMin(f.end);
    const buf = s.bufferMinutes;
    repeatInfo = dates.map((d) => {
      let reason = dayClosed(d);
      if (!reason && diffDays(today, d) > s.advanceDays)
        reason = `เกิน ${s.advanceDays} วัน`;
      if (!reason) {
        const c = list.find(
          (b) =>
            b.date === d &&
            b.roomId === f.roomId &&
            sm < toMin(b.end) + buf &&
            toMin(b.start) < em + buf,
        );
        if (c) reason = `ไม่ว่าง ${c.start}–${c.end}`;
      }
      return { date: d, reason };
    });
    const bad = repeatInfo.filter((x) => x.reason).length;
    if (!$("#b-repeat-preview", el)) return;
    setHTML(
      $("#b-repeat-preview", el),
      html`<div class="small ${bad ? "" : "muted"}" style="margin-bottom:6px">
          ${bad
            ? html`<b style="color:var(--danger)">${bad} วันไม่ว่าง</b> —
                ระบบจะถามก่อนจองเฉพาะวันที่ว่าง`
            : `ห้องว่างครบทั้ง ${repeatInfo.length} ครั้ง`}
        </div>
        <div class="repeat-list stagger">
          ${repeatInfo.map(
            (x) =>
              html`<span
                class="chip chip-static ${x.reason ? "bad" : "ok"}"
                title="${x.reason || "ว่าง"}"
                >${icon(x.reason ? "x" : "check", "i-sm")}
                ${fmtDate(x.date, "wd")}</span
              >`,
          )}
        </div>`,
    );
    stagger($(".repeat-list", el));
    renderSummary();
  }, 300);

  function bindStep() {
    if (f.step === 1) {
      renderSlots();
      if (loadedFor !== f.date) loadDay({ quiet: true });
      $(".room-opts", pane).onclick = (e) => {
        const b = e.target.closest("[data-room]");
        if (!b || b.disabled) return;
        f.roomId = b.dataset.room;
        $$(".room-opt", pane).forEach((x) => {
          x.classList.toggle("on", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
        if (f.start && f.end) {
          slots = computeSlots();
          if (!rangeFree(toMin(f.start), toMin(f.end))) {
            toast(
              "ช่วงเวลาที่เลือกไม่ว่างในห้องนี้ กรุณาเลือกเวลาใหม่",
              "warning",
            );
            f.start = f.end = "";
            f.pick = "start";
          }
        }
        renderSlots();
      };
      const pickDate = (d) => {
        if (!isDate(d)) return;
        f.date = d;
        swap(
          pane,
          () => {
            setHTML(pane, step1());
            bindStep();
          },
          "fade",
        );
      };
      $("#b-dates", pane).onclick = (e) => {
        const b = e.target.closest("[data-date]");
        if (b) pickDate(b.dataset.date);
      };
      $("#b-date-input", pane).onchange = (e) => pickDate(e.target.value);
      requestAnimationFrame(() => {
        const on = $(".dchip.on", pane);
        on?.scrollIntoView({ block: "nearest", inline: "center" });
      });
      $("#b-slots", pane).onclick = (e) => {
        const btn = e.target.closest(".slot");
        if (!btn) return;
        const m = Number(btn.dataset.m);
        const sl = slots.find((x) => x.m === m);
        const closed = dayClosed(f.date);
        if (closed) return toast(closed, "warning");
        if (!room()?.active)
          return toast("ห้องนี้ปิดให้บริการชั่วคราว", "warning");
        if (sl.past) {
          shake(btn);
          return toast("ช่วงเวลานี้ผ่านไปแล้ว", "warning");
        }
        if (sl.busy) {
          shake(btn);
          return toast(
            `ไม่ว่าง: ${sl.busy.start}–${sl.busy.end} น. ${titleOf(sl.busy)}`,
            "warning",
          );
        }
        const sm = toMin(f.start);
        if (f.pick === "end" && f.start && m >= sm) {
          const z = m + s.slotMinutes;
          if (!rangeFree(sm, z)) {
            shake(btn);
            return toast(
              "ช่วงที่เลือกทับกับการจองอื่น กรุณาเลือกช่วงเวลาที่ต่อเนื่องกัน",
              "warning",
            );
          }
          if (z - sm > s.maxDurationMinutes) {
            shake(btn);
            return toast(
              `จองได้ไม่เกิน ${fmtDuration(s.maxDurationMinutes)} ต่อครั้ง`,
              "warning",
            );
          }
          f.end = toHHMM(z);
          f.pick = "done";
        } else setStart(m);
        haptic();
        renderSlots();
      };
      $("#b-durs", pane).onclick = (e) => {
        const b = e.target.closest("[data-dur]");
        if (!b || b.disabled) return;
        f.end = toHHMM(toMin(f.start) + Number(b.dataset.dur));
        f.pick = "done";
        renderSlots();
      };
      $("#b-presets", pane).onclick = (e) => {
        const b = e.target.closest("[data-preset]");
        if (!b || b.disabled) return;
        const [a, z] = b.dataset.preset.split("-").map(Number);
        f.start = toHHMM(a);
        f.end = toHHMM(z);
        f.pick = "done";
        renderSlots();
      };
    } else if (f.step === 2) {
      updateCap();
      pane.oninput = (e) => {
        const t = e.target;
        if (!t.name) return;
        if (t.name === "remember") f.remember = t.checked;
        else if (t.name === "repeatCount") {
          f.repeatCount = Math.max(
            2,
            Math.min(s.maxRecurring, Number(t.value) || 2),
          );
          loadRepeat();
        } else if (t.name in f) f[t.name] = t.value;
        if (t.name === "department") {
          const other = pane.querySelector('[data-f="deptOther"]');
          other.hidden = t.value !== "__other";
          if (!other.hidden) other.querySelector("input").focus();
        }
        if (t.name === "attendees") updateCap();
        const fe = t.closest(".field.invalid");
        if (fe) {
          fe.classList.remove("invalid");
          fe.querySelector(".field-error")?.remove();
        }
        renderSummary();
      };
      pane.onchange = pane.oninput;
      pane.onclick = (e) => {
        const stepBtn = e.target.closest("[data-step-btn]");
        if (stepBtn) {
          const inp = pane.querySelector('input[name="attendees"]');
          const v = Math.max(
            1,
            (Number(inp.value) || 0) + Number(stepBtn.dataset.stepBtn),
          );
          inp.value = v;
          f.attendees = String(v);
          updateCap();
          renderSummary();
          return;
        }
        const rc = e.target.closest("[data-rc]");
        if (rc) {
          const inp = pane.querySelector('input[name="repeatCount"]');
          f.repeatCount = Math.max(
            2,
            Math.min(
              s.maxRecurring,
              (Number(inp.value) || 2) + Number(rc.dataset.rc),
            ),
          );
          inp.value = f.repeatCount;
          loadRepeat();
          renderSummary();
          return;
        }
        const eq = e.target.closest("[data-equip],[data-service]");
        if (eq) {
          const set = eq.dataset.equip !== undefined ? f.equipment : f.services;
          const key = eq.dataset.equip ?? eq.dataset.service;
          if (set.has(key)) set.delete(key);
          else set.add(key);
          eq.setAttribute("aria-pressed", String(set.has(key)));
          return;
        }
        const rep = e.target.closest("#b-repeat button");
        if (rep) {
          f.repeat = rep.dataset.value;
          segSelect($("#b-repeat", pane), f.repeat);
          $("#b-repeat-count", pane).hidden = f.repeat === "none";
          loadRepeat();
          renderSummary();
        }
      };
      const repSeg = $("#b-repeat", pane);
      if (repSeg) {
        initSeg(repSeg);
        if (f.repeat !== "none") loadRepeat();
      }
    } else {
      pane.onchange = (e) => {
        if (e.target.name === "agree") {
          f.agree = e.target.checked;
          const fe = e.target.closest(".invalid");
          if (fe) {
            fe.classList.remove("invalid");
            fe.querySelector(".field-error")?.remove();
          }
        }
      };
    }
  }

  // ---------- submit
  async function submit(skipConflicts = false) {
    const dept = f.department === "__other" ? f.deptOther.trim() : f.department;
    const body = {
      roomId: f.roomId,
      date: f.date,
      start: f.start,
      end: f.end,
      title: f.title.trim(),
      organizer: f.organizer.trim(),
      department: dept,
      phone: f.phone.trim(),
      email: f.email.trim(),
      attendees: Number(f.attendees),
      equipment: [...f.equipment],
      services: [...f.services],
      note: f.note.trim(),
    };
    if (f.remember)
      store.set("br.profile", {
        organizer: body.organizer,
        department: dept,
        phone: body.phone,
        email: body.email,
      });
    else store.del("br.profile");
    nextBtn.classList.add("is-loading");
    try {
      if (f.editing) {
        const res = await api(`/api/bookings/${f.editing.id}`, {
          method: "PATCH",
          body: { ...body, token: f.token },
        });
        await my.load();
        toast(
          res.statusReset
            ? "บันทึกแล้ว — การเปลี่ยนเวลาต้องรอผู้ดูแลอนุมัติอีกครั้ง"
            : res.changed
              ? "บันทึกการแก้ไขเรียบร้อย"
              : "ไม่มีข้อมูลที่เปลี่ยนแปลง",
          "success",
        );
        location.hash = "#/my";
        return;
      }
      if (f.repeat !== "none")
        body.repeat = { type: f.repeat, count: f.repeatCount };
      if (skipConflicts) body.skipConflicts = true;
      const res = await api("/api/bookings", { method: "POST", body });
      my.add(res.token);
      my.load().catch(() => {});
      showSuccess(res);
    } catch (err) {
      nextBtn.classList.remove("is-loading");
      const d = err.data || {};
      if (
        err.status === 409 &&
        d.conflicts &&
        f.repeat !== "none" &&
        !skipConflicts
      ) {
        const total = f.repeatCount;
        const bad = d.conflicts;
        const okN = total - bad.length;
        if (okN > 0) {
          const ok = await confirmDialog({
            title: `มี ${bad.length} วันที่จองไม่ได้`,
            message: `${bad.map((c) => `• ${fmtDate(c.date, "wd-year")} — ${c.reason}`).join("\n")}\n\nต้องการจองเฉพาะวันที่ว่าง (${okN} ครั้ง) หรือไม่?`,
            confirmText: `จอง ${okN} ครั้งที่ว่าง`,
            iconName: "repeat",
          });
          if (ok) return submit(true);
          return;
        }
      }
      if (d.fields) {
        const keys = Object.keys(d.fields);
        const s1 = ["roomId", "date", "start", "end"];
        const target = keys.some((k) => s1.includes(k)) ? 1 : 2;
        if (target !== f.step) {
          f.step = target;
          renderStep("right");
          await new Promise((r) => setTimeout(r, 420));
        }
        keys.forEach((k) =>
          fieldError(
            k === "department" && f.department === "__other" ? "deptOther" : k,
            d.fields[k],
          ),
        );
        toast(err.message, "warning");
        return;
      }
      if (err.status === 409 || err.status === 400) {
        toast(err.message, "warning");
        if (f.step !== 1) {
          f.step = 1;
          renderStep("right");
        }
        loadDay({ quiet: true });
        return;
      }
      toastError(err);
    }
  }

  function showSuccess(res) {
    const list = res.bookings;
    const b = list[0];
    const pending = b.status === "pending";
    // ฟอร์มจบแล้ว: หยุดอัปเดตช่องเวลา (การจองของเราเองจะทำให้ช่วงที่เลือกไม่ว่าง)
    ctx.refresh = null;
    ctx.tick = null;
    swap(
      el,
      () => {
        window.scrollTo(0, 0);
        setHTML(
          el,
          html`<div class="card success">
            <svg
              class="check-anim ${pending ? "pending" : ""}"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle class="bg" cx="50" cy="50" r="46" />
              <circle cx="50" cy="50" r="46" />
              <path d="${pending ? "M50 27v25l15 9" : "M30 52l13 13 27-29"}" />
            </svg>
            <h2>${pending ? "ส่งคำขอจองเรียบร้อย" : "จองห้องประชุมสำเร็จ!"}</h2>
            <p>
              ${pending
                ? "การจองอยู่ระหว่างรอผู้ดูแลอนุมัติ ติดตามสถานะได้ที่เมนู “การจองของฉัน” — หน้าจอจะอัปเดตอัตโนมัติเมื่อได้รับการอนุมัติ"
                : "ระบบยืนยันการจองเรียบร้อยแล้ว เก็บรหัสการจองไว้เพื่อใช้ค้นหาหรือยกเลิกจากอุปกรณ์อื่น"}
            </p>
            <div class="code-box">
              <span>${b.code}</span
              ><button
                class="btn btn-ghost btn-icon btn-sm"
                data-act="copy"
                aria-label="คัดลอกรหัส"
              >
                ${icon("copy")}
              </button>
            </div>
            <div class="success-list">
              ${list.map((x) => agendaItem(x, { showDate: true }))}
            </div>
            ${res.skipped?.length
              ? html`<div class="notice notice-warning">
                  ${icon("alert")}
                  <div>
                    ไม่ได้จอง ${res.skipped.length} วัน:
                    ${res.skipped
                      .map((x) => `${fmtDate(x.date, "short")} (${x.reason})`)
                      .join(", ")}
                  </div>
                </div>`
              : ""}
            <div class="success-actions">
              <button class="btn btn-soft" data-act="ics">
                ${icon("calendar-plus")} เพิ่มลงปฏิทิน
              </button>
              <button class="btn btn-soft" data-act="print">
                ${icon("printer")} พิมพ์ใบยืนยัน
              </button>
              <a class="btn btn-ghost" href="#/my"
                >${icon("calendar-check")} การจองของฉัน</a
              >
              <button class="btn btn-primary" data-act="again">
                ${icon("plus")} จองเพิ่ม
              </button>
            </div>
          </div>`,
        );
        el.querySelector(".success").onclick = async (e) => {
          const act = e.target.closest("[data-act]")?.dataset.act;
          const item = e.target.closest("[data-id]");
          if (act === "copy") {
            if (await copyText(b.code))
              toast(`คัดลอกรหัส ${b.code} แล้ว`, "success");
          } else if (act === "ics") downloadICS(b, roomOf(b.roomId), s.orgName);
          else if (act === "print") printSlip(b);
          else if (act === "again") navigate("#/book");
          else if (item) openDetail(list.find((x) => x.id === item.dataset.id));
        };
      },
      "up",
    );
    if (s.confettiOnBooking && !pending) setTimeout(() => confetti(), 380);
    haptic(25);
  }

  // ---------- events
  nextBtn.onclick = () => {
    if (!validate(f.step)) return;
    if (f.step < 3) go(f.step + 1);
    else submit();
  };
  backBtn.onclick = () => f.step > 1 && go(f.step - 1);
  $(".steps", el).onclick = (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    const n = Number(b.dataset.step);
    if (n < f.step) return go(n);
    for (let i = f.step; i < n; i++) if (!validate(i)) return;
    go(n);
  };

  ctx.refresh = () => loadDay({ quiet: true });
  ctx.tick = () => f.step === 1 && renderSlots();

  async function init() {
    if (editId) {
      try {
        await my.load();
      } catch (err) {
        toastError(err);
      }
      if (current !== ctx) return;
      const entry = my.byId.get(editId);
      if (
        !entry ||
        !isActive(entry.b) ||
        hasStarted(entry.b) ||
        !s.allowUserEdit
      ) {
        setHTML(
          el,
          html`<div class="page-head">
              <div><h1>แก้ไขการจอง</h1></div>
            </div>
            ${emptyState(
              "lock",
              "ไม่สามารถแก้ไขการจองนี้ได้",
              entry
                ? "การจองเริ่มแล้ว ถูกยกเลิก หรือระบบไม่เปิดให้แก้ไข"
                : "ไม่พบการจองนี้ในอุปกรณ์ของคุณ",
              html`<a class="btn btn-soft" href="#/my"
                >${icon("arrow-left")} การจองของฉัน</a
              >`,
            )}`,
        );
        return;
      }
      const b = entry.b;
      Object.assign(f, {
        editing: b,
        token: entry.token,
        roomId: b.roomId,
        date: b.date,
        start: b.start,
        end: b.end,
        pick: "done",
        title: b.title,
        organizer: b.organizer,
        department: S.departments.includes(b.department)
          ? b.department
          : "__other",
        deptOther: S.departments.includes(b.department) ? "" : b.department,
        phone: b.phone,
        email: b.email,
        attendees: String(b.attendees || ""),
        equipment: new Set(b.equipment),
        services: new Set(b.services),
        note: b.note,
        agree: true,
      });
      $("#b-h1", el).textContent = `แก้ไขการจอง ${b.code}`;
    }
    renderStep("fade");
  }
  init();
}

// ------------------------------------------------------------------ MY BOOKINGS
function viewMy(el, q, ctx) {
  let tab = "upcoming";
  setHTML(
    el,
    html`<div class="page-head">
        <div>
          <h1>การจองของฉัน</h1>
          <p>
            รายการที่จองจากอุปกรณ์นี้
            หรือค้นหาด้วยรหัสการจองและเบอร์โทรที่ใช้จอง
          </p>
        </div>
      </div>
      <form class="card lookup" id="m-lookup" autocomplete="off">
        <label class="field"
          ><span>รหัสการจอง</span
          ><input
            class="input mono"
            name="code"
            placeholder="เช่น BR6910-0001"
            required
            value="${q.get("code") || ""}"
        /></label>
        <label class="field"
          ><span>เบอร์โทรที่ใช้จอง</span
          ><input
            class="input"
            name="phone"
            type="tel"
            inputmode="tel"
            required
        /></label>
        <button class="btn btn-primary" type="submit">
          ${icon("search")} ค้นหาและเพิ่ม
        </button>
      </form>
      <div class="row" style="margin-top:24px;flex-wrap:wrap">
        <div class="seg" id="m-seg">
          <button data-value="upcoming" aria-selected="true">
            กำลังจะถึง <span id="m-c-up"></span>
          </button>
          <button data-value="past">ที่ผ่านมา</button>
          <button data-value="cancelled">ยกเลิก/ไม่อนุมัติ</button>
        </div>
        <span class="spacer"></span>
        <span class="live-dot ${S.online ? "" : "off"}"
          >อัปเดตสถานะอัตโนมัติ</span
        >
      </div>
      <div class="my-list" id="m-list">
        ${[1, 2].map(
          () =>
            html`<div
              class="skel"
              style="height:120px;border-radius:20px"
            ></div>`,
        )}
      </div>`,
  );
  const seg = $("#m-seg", el);
  initSeg(seg);
  const listEl = $("#m-list", el);

  function groups() {
    const up = [];
    const past = [];
    const cancelled = [];
    for (const it of my.items) {
      const b = it.b;
      if (!isActive(b)) cancelled.push(it);
      else if (hasEnded(b)) past.push(it);
      else up.push(it);
    }
    up.sort((x, y) => byTime(x.b, y.b));
    past.sort((x, y) => byTime(y.b, x.b));
    cancelled.sort((x, y) => byTime(y.b, x.b));
    return { upcoming: up, past, cancelled };
  }

  function card({ b }) {
    const r = roomOf(b.roomId);
    const [, mo, d] = b.date.split("-").map(Number);
    return html`<article
      class="my-card"
      style="--room:${col(r)}"
      data-id="${b.id}"
    >
      <div class="date-block">
        <span>${TH_DAYS_SHORT[weekdayOf(b.date)]}</span><b>${d}</b
        ><span>${TH_MONTHS_SHORT[mo - 1]}</span>
      </div>
      <div class="my-info">
        <div class="row-wrap">
          ${statusBadge(b)}<span class="code">${b.code}</span>${b.seriesId
            ? html`<span class="badge">${icon("repeat")} จองซ้ำ</span>`
            : ""}
          ${b.checkedIn
            ? html`<span class="badge badge-ok"
                >${icon("check")} เช็คอินแล้ว</span
              >`
            : ""}
        </div>
        <h3>${titleOf(b)}</h3>
        <div class="my-meta">
          <span>${icon("clock", "i-sm")} ${b.start}–${b.end} น.</span>
          <span
            >${icon("door", "i-sm")} ${r ? `${r.name} ${r.floor}` : "-"}</span
          >
          <span>${icon("users", "i-sm")} ${b.attendees} คน</span>
        </div>
        ${b.rejectReason
          ? html`<div class="reason">เหตุผล: ${b.rejectReason}</div>`
          : ""}
        ${b.status === "cancelled" && b.cancelReason
          ? html`<div class="reason">${b.cancelReason}</div>`
          : ""}
      </div>
      <div class="my-actions" data-actions></div>
    </article>`;
  }

  function render(animate = true) {
    const g = groups();
    $("#m-c-up", el).textContent = g.upcoming.length
      ? `(${g.upcoming.length})`
      : "";
    const items = g[tab];
    const draw = () => {
      if (!my.tokens().length && !my.items.length) {
        setHTML(
          listEl,
          emptyState(
            "calendar-check",
            "ยังไม่มีการจองในอุปกรณ์นี้",
            "จองห้องประชุมได้เลย หรือค้นหาการจองเดิมด้วยรหัสการจองและเบอร์โทร",
            html`<a class="btn btn-primary" href="#/book"
              >${icon("calendar-plus")} จองห้องประชุม</a
            >`,
          ),
        );
        return;
      }
      if (!items.length) {
        const msg = {
          upcoming: "ไม่มีการจองที่กำลังจะถึง",
          past: "ยังไม่มีประวัติการใช้ห้อง",
          cancelled: "ไม่มีรายการที่ยกเลิก",
        }[tab];
        setHTML(
          listEl,
          emptyState(
            "calendar",
            msg,
            "รายการจะแสดงที่นี่โดยอัตโนมัติ",
            tab === "upcoming"
              ? html`<a class="btn btn-soft" href="#/book"
                  >${icon("plus")} จองห้อง</a
                >`
              : "",
          ),
        );
        return;
      }
      setHTML(listEl, items.map(card));
      listEl.classList.add("stagger");
      stagger(listEl);
      $$("[data-actions]", listEl).forEach((box) => {
        const id = box.closest("[data-id]").dataset.id;
        const it = my.byId.get(id);
        renderOwnerActions(box, it.b, it.token, () => render(false), [
          {
            key: "forget",
            label: "ลบจากอุปกรณ์นี้",
            ic: "trash",
            cls: "btn-ghost",
            run: async () => {
              const same = my.items.filter((x) => x.token === it.token).length;
              const ok = await confirmDialog({
                title: "ลบออกจากอุปกรณ์นี้?",
                message: `${same > 1 ? `รายการในชุดเดียวกัน ${same} รายการจะถูกลบออกจากรายการในอุปกรณ์นี้` : "รายการจะถูกลบออกจากอุปกรณ์นี้เท่านั้น"} (การจองในระบบไม่ถูกยกเลิก — ค้นหากลับมาได้ด้วยรหัสการจองและเบอร์โทร)`,
                confirmText: "ลบจากอุปกรณ์",
                iconName: "trash",
              });
              if (!ok) return;
              const cardEl = box.closest(".my-card");
              cardEl.classList.add("leaving");
              my.remove(it.token);
              await my.load();
              setTimeout(() => render(false), 260);
            },
          },
        ]);
      });
    };
    if (animate) swap(listEl, draw, "fade");
    else draw();
  }

  seg.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    tab = b.dataset.value;
    segSelect(seg, tab);
    render();
  };

  $("#m-lookup", el).onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector("button");
    btn.classList.add("is-loading");
    try {
      const res = await api("/api/lookup", {
        method: "POST",
        body: { code: form.code.value.trim(), phone: form.phone.value.trim() },
      });
      my.add(res.token);
      await my.load();
      toast(
        `พบการจอง ${res.bookings[0].code} และเพิ่มลงในอุปกรณ์นี้แล้ว`,
        "success",
      );
      form.reset();
      const b = res.bookings[0];
      tab = isActive(b) ? (hasEnded(b) ? "past" : "upcoming") : "cancelled";
      segSelect(seg, tab);
      render();
    } catch (err) {
      toastError(err);
      shake(form);
    } finally {
      btn.classList.remove("is-loading");
    }
  };

  async function load(animate = true) {
    try {
      await my.load();
    } catch (err) {
      toastError(err);
    }
    if (current !== ctx) return;
    render(animate);
  }
  ctx.refresh = () => load(false);
  ctx.tick = () => render(false);
  load(false);
  if (q.get("code")) $('#m-lookup input[name="phone"]', el).focus();
}

// ------------------------------------------------------------------ PREFS
function openPrefs() {
  const theme = store.get("br.theme") || "auto";
  const motion = store.get("br.motion") || "";
  const sound = store.get("br.sound", S.settings.clickSound);
  const url = baseUrl();
  const body = document.createElement("div");
  setHTML(
    body,
    html`<div class="pref-group">
        <b>ธีมสี</b>
        <div class="pref-opts" data-group="theme">
          <button
            class="pref-opt ${theme === "auto" ? "on" : ""}"
            data-v="auto"
          >
            ${icon("sun-moon")}ตามระบบ
          </button>
          <button
            class="pref-opt ${theme === "light" ? "on" : ""}"
            data-v="light"
          >
            ${icon("sun")}สว่าง
          </button>
          <button
            class="pref-opt ${theme === "dark" ? "on" : ""}"
            data-v="dark"
          >
            ${icon("moon")}มืด
          </button>
        </div>
      </div>
      <div class="pref-group">
        <b>เอฟเฟกต์การเคลื่อนไหว</b>
        <div class="pref-opts" data-group="motion">
          <button
            class="pref-opt ${motion === "full" ? "on" : ""}"
            data-v="full"
          >
            ${icon("sparkles")}เต็มรูปแบบ
          </button>
          <button
            class="pref-opt ${motion === "reduced" ? "on" : ""}"
            data-v="reduced"
          >
            ${icon("activity")}เรียบง่าย
          </button>
          <button class="pref-opt ${motion === "off" ? "on" : ""}" data-v="off">
            ${icon("ban")}ปิด
          </button>
        </div>
        <span class="field-hint"
          >${motion
            ? html`<a href="#" data-reset>ใช้ค่าเริ่มต้นของระบบ</a>`
            : "ขณะนี้ใช้ค่าเริ่มต้นที่ผู้ดูแลกำหนด"}</span
        >
      </div>
      <div class="pref-group">
        <label class="row" style="justify-content:space-between"
          ><span
            ><b>เสียงคลิกเมื่อกดปุ่ม</b><br /><small class="faint"
              >เสียงสั้น ๆ เบา ๆ ทุกครั้งที่กด</small
            ></span
          >
          <span class="switch"
            ><input
              type="checkbox"
              data-sound
              ${sound ? raw("checked") : ""} /><span class="track"></span
            ><span class="thumb"></span></span
        ></label>
      </div>
      <div class="pref-group">
        <b>เปิดบนมือถือ/แท็บเล็ต</b>
        <div class="row" style="align-items:center;gap:16px">
          <div
            style="width:120px;flex:none;border-radius:12px;overflow:hidden;border:1px solid var(--border)"
          >
            ${raw(qrSVG(url))}
          </div>
          <div class="small muted">
            สแกน QR นี้ด้วยกล้องมือถือที่เชื่อม Wi-Fi ของสำนักงาน<br /><b
              class="mono"
              >${url}</b
            ><br />แล้วกด “เพิ่มไปยังหน้าจอหลัก” เพื่อใช้งานเหมือนแอป
          </div>
        </div>
      </div>`,
  );
  const m = openModal({ title: "ตั้งค่าการแสดงผล", body, size: "sm" });
  body.onclick = (e) => {
    const opt = e.target.closest(".pref-opt");
    if (opt) {
      const g = opt.closest("[data-group]").dataset.group;
      $$(".pref-opt", opt.parentElement).forEach((x) =>
        x.classList.toggle("on", x === opt),
      );
      store.set(g === "theme" ? "br.theme" : "br.motion", opt.dataset.v);
      applyAppearance(S.settings);
      return;
    }
    if (e.target.closest("[data-reset]")) {
      e.preventDefault();
      store.del("br.motion");
      applyAppearance(S.settings);
      m.close();
      toast("ใช้ค่าเริ่มต้นของระบบแล้ว", "success");
    }
  };
  body.querySelector("[data-sound]").onchange = (e) => {
    store.set("br.sound", e.target.checked);
    setFeedback({ sound: e.target.checked });
  };
}

// ------------------------------------------------------------------ boot
async function boot() {
  initEffects();
  try {
    await loadConfig();
  } catch (err) {
    setHTML(
      viewEl,
      html`<div class="empty card" style="margin-top:40px">
        <div class="empty-art">${icon("wifi")}</div>
        <b>เชื่อมต่อระบบไม่ได้</b>
        <p class="small">${err.message}</p>
        <button class="btn btn-primary">ลองใหม่</button>
      </div>`,
    );
    $$("[data-icon]").forEach((x) => setHTML(x, icon(x.dataset.icon)));
    viewEl.querySelector(".btn").onclick = () => location.reload();
    return;
  }
  $("#btn-prefs").onclick = openPrefs;
  $("#tab-prefs").onclick = openPrefs;
  window.addEventListener("hashchange", route);
  window.addEventListener(
    "scroll",
    () => $("#topbar").classList.toggle("scrolled", scrollY > 8),
    { passive: true },
  );
  window.addEventListener(
    "resize",
    debounce(() => updateNav(current.name), 150),
  );
  if (document.fonts?.ready)
    document.fonts.ready.then(() => updateNav(current.name));
  await route();
  my.load().catch(() => {});

  let lastTick = 0;
  setInterval(() => {
    const n = bkkNow();
    $("#top-clock").textContent =
      `${pad2(Math.floor(n.minutes / 60))}:${pad2(n.minutes % 60)} น.`;
    current.clock?.(n);
    if (Date.now() - lastTick > 30000) {
      lastTick = Date.now();
      current.tick?.();
    }
  }, 1000);

  const onBookings = debounce(async () => {
    if (my.tokens().length) await my.load().catch(() => {});
    current.refresh?.();
  }, 250);
  liveEvents({
    bookings: onBookings,
    config: debounce(async () => {
      await loadConfig().catch(() => {});
      // ไม่รีเซ็ตฟอร์มระหว่างกำลังจอง
      if (current.name === "book") current.refresh?.();
      else route();
    }, 300),
    status: (ok) => {
      const was = S.online;
      S.online = ok;
      $$(".live-dot").forEach((d) => d.classList.toggle("off", !ok));
      if (ok && !was) onBookings();
    },
  });
  document.addEventListener(
    "visibilitychange",
    () => document.visibilityState === "visible" && onBookings(),
  );
}

boot();
