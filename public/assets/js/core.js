// โค้ดส่วนกลางที่ใช้ร่วมกันทุกหน้า
import { ICONS } from "./icons.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ safe HTML templating
class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const raw = (s) => new Raw(String(s));
export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function renderVal(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderVal).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
}
// ทุกค่าที่แทรกจะถูก escape อัตโนมัติ ยกเว้นค่าที่สร้างจาก html`` หรือ raw()
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++)
    out += renderVal(vals[i]) + strings[i + 1];
  return new Raw(out);
}
export function setHTML(el, tpl) {
  el.innerHTML = renderVal(tpl);
  return el;
}
export function icon(name, cls = "") {
  return raw(
    `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`,
  );
}

// ------------------------------------------------------------ storage (ปลอดภัยเมื่อถูกบล็อก)
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// ------------------------------------------------------------ API
export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.error) || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    this.status = status;
    this.data = data || {};
  }
}

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        "X-Requested-With": "br",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, {
      error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi",
    });
  }
  let data = null;
  if ((res.headers.get("content-type") || "").includes("json"))
    data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ------------------------------------------------------------ เวลาไทย
export const TH_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
export const TH_MONTHS_SHORT = [
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
export const TH_DAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];
export const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const TH_DAYS_MIN = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const TZ = 7 * 60;
let clockSkew = 0;
export function syncClock(serverMs) {
  if (typeof serverMs === "number") clockSkew = serverMs - Date.now();
}
export const nowMs = () => Date.now() + clockSkew;
export const pad2 = (n) => String(n).padStart(2, "0");
export function bkkNow() {
  const ms = nowMs();
  const d = new Date(ms + TZ * 60000);
  return {
    ms,
    date: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}
export function toMin(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
export const toHHMM = (min) =>
  `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const diffDays = (a, b) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000,
  );
export const toEpoch = (date, hhmm) =>
  Date.parse(`${date}T00:00:00Z`) + (toMin(hhmm) - TZ) * 60000;
export function startOfWeek(date) {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd); // เริ่มวันจันทร์
}

export function fmtDate(date, style = "medium") {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const wd = weekdayOf(date);
  const be = y + 543;
  switch (style) {
    case "long":
      return `วัน${TH_DAYS[wd]}ที่ ${d} ${TH_MONTHS[m - 1]} ${be}`;
    case "full":
      return `${d} ${TH_MONTHS[m - 1]} ${be}`;
    case "short":
      return `${d} ${TH_MONTHS_SHORT[m - 1]}`;
    case "wd":
      return `${TH_DAYS_SHORT[wd]} ${d} ${TH_MONTHS_SHORT[m - 1]}`;
    case "wd-year":
      return `${TH_DAYS_SHORT[wd]} ${d} ${TH_MONTHS_SHORT[m - 1]} ${be}`;
    case "month":
      return `${TH_MONTHS[m - 1]} ${be}`;
    default:
      return `${d} ${TH_MONTHS_SHORT[m - 1]} ${be}`;
  }
}
export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} นาที`;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชั่วโมง`;
}
export function fmtDateTime(ms) {
  const d = new Date(ms + TZ * 60000);
  const date = d.toISOString().slice(0, 10);
  return `${fmtDate(date)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
export function timeAgo(ms) {
  const s = Math.round((nowMs() - ms) / 1000);
  if (s < 45) return "เมื่อสักครู่";
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงที่แล้ว`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} วันที่แล้ว`;
  return fmtDateTime(ms);
}
export function greeting(minutes) {
  if (minutes < 11 * 60) return "สวัสดีตอนเช้า";
  if (minutes < 13 * 60) return "สวัสดีตอนเที่ยง";
  if (minutes < 16 * 60 + 30) return "สวัสดีตอนบ่าย";
  if (minutes < 19 * 60) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนค่ำ";
}

export const STATUS = {
  pending: { label: "รออนุมัติ", icon: "hourglass" },
  approved: { label: "อนุมัติแล้ว", icon: "check-circle" },
  rejected: { label: "ไม่อนุมัติ", icon: "x-circle" },
  cancelled: { label: "ยกเลิกแล้ว", icon: "ban" },
};
// สถานะตามเวลา: กำลังประชุม / เสร็จสิ้น
export function liveStatus(b) {
  if (b.status !== "approved" && b.status !== "pending") return b.status;
  const now = nowMs();
  if (toEpoch(b.date, b.end) <= now)
    return b.status === "approved" ? "done" : "expired";
  if (toEpoch(b.date, b.start) <= now)
    return b.status === "approved" ? "live" : b.status;
  return b.status;
}
export function statusBadge(b) {
  const st = liveStatus(b);
  const map = {
    done: ["badge-done", "check", "เสร็จสิ้น"],
    expired: ["badge-cancelled", "clock", "หมดเวลา"],
    live: ["badge-live", "activity", "กำลังประชุม"],
  };
  if (map[st])
    return html`<span class="badge ${map[st][0]}"
      >${icon(map[st][1])}${map[st][2]}</span
    >`;
  const s = STATUS[st] || STATUS.pending;
  return html`<span class="badge badge-${st}">${icon(s.icon)}${s.label}</span>`;
}

// ------------------------------------------------------------ appearance
const mqDark = matchMedia("(prefers-color-scheme: dark)");
const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
let appearanceSettings = {
  themeColor: "green",
  defaultThemeMode: "auto",
  motionLevel: "full",
};
export function applyAppearance(settings = appearanceSettings) {
  appearanceSettings = settings;
  const root = document.documentElement;
  root.dataset.brand = settings.themeColor || "green";
  const mode = store.get("br.theme") || settings.defaultThemeMode || "auto";
  root.dataset.theme =
    mode === "dark" || (mode === "auto" && mqDark.matches) ? "dark" : "light";
  let motion = store.get("br.motion") || settings.motionLevel || "full";
  if (!store.get("br.motion") && mqReduce.matches && motion === "full")
    motion = "reduced";
  root.dataset.motion = motion;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.content =
      getComputedStyle(root).getPropertyValue("--bg").trim() || "#f3f6f4";
}
mqDark.addEventListener?.("change", () => applyAppearance());
mqReduce.addEventListener?.("change", () => applyAppearance());
export const motionLevel = () =>
  document.documentElement.dataset.motion || "full";

// ------------------------------------------------------------ feedback effects
const fx = { haptic: true, sound: false };
let audioCtx = null;
export function setFeedback(opts) {
  Object.assign(fx, opts);
}
export function haptic(ms = 8) {
  if (fx.haptic && navigator.vibrate && motionLevel() !== "off") {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
export function tick(freq = 1700, dur = 0.035, vol = 0.05) {
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* ignore */
  }
}
export function chime() {
  [880, 1320].forEach((f, i) => setTimeout(() => tick(f, 0.28, 0.08), i * 140));
}

function spawnRipple(el, e) {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.1;
  const s = document.createElement("span");
  s.className = "ripple";
  s.style.width = s.style.height = `${size}px`;
  const x = e.clientX || r.left + r.width / 2;
  const y = e.clientY || r.top + r.height / 2;
  s.style.left = `${x - r.left - size / 2}px`;
  s.style.top = `${y - r.top - size / 2}px`;
  el.appendChild(s);
  s.addEventListener("animationend", () => s.remove());
  setTimeout(() => s.remove(), 1200);
}

export function initEffects() {
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest(
        ".btn, .chip, .ripple-host, .seg button, .nav-link, .tab-link",
      );
      if (!el || el.disabled || el.classList.contains("is-disabled")) return;
      if (motionLevel() !== "off") spawnRipple(el, e);
      haptic();
      if (fx.sound) tick();
    },
    { passive: true },
  );
}

export function shake(el) {
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  haptic(30);
  setTimeout(() => el.classList.remove("shake"), 500);
}

// สลับเนื้อหาพร้อมทรานซิชัน
export async function swap(el, render, dir = "up") {
  const level = motionLevel();
  const all = ["up", "left", "right", "fade"].flatMap((d) => [
    `v-out-${d}`,
    `v-in-${d}`,
  ]);
  if (level === "off" || !el.firstElementChild) {
    el.classList.remove(...all);
    await render();
    return;
  }
  el.classList.remove(...all);
  el.classList.add(`v-out-${dir}`);
  await wait(level === "full" ? 150 : 70);
  await render();
  el.classList.remove(`v-out-${dir}`);
  void el.offsetWidth;
  el.classList.add(`v-in-${dir}`);
  setTimeout(() => el.classList.remove(`v-in-${dir}`), 700);
}

export function stagger(container, selector = ":scope > *") {
  $$(selector, container).forEach((c, i) =>
    c.style.setProperty("--i", Math.min(i, 16)),
  );
}

export function countUp(el, to, duration = 900) {
  const from = 0;
  if (motionLevel() === "off" || !Number.isFinite(to)) {
    el.textContent = to.toLocaleString("th-TH");
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    const eased = 1 - (1 - p) ** 4;
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString(
      "th-TH",
    );
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// segmented control พร้อมตัวชี้ที่เลื่อนได้
export function initSeg(seg) {
  let ind = seg.querySelector(".seg-ind");
  if (!ind) {
    ind = document.createElement("span");
    ind.className = "seg-ind";
    seg.prepend(ind);
  }
  const place = () => {
    const sel = seg.querySelector('[aria-selected="true"]');
    if (!sel) {
      ind.style.width = "0px";
      return;
    }
    ind.style.width = `${sel.offsetWidth}px`;
    ind.style.transform = `translateX(${sel.offsetLeft}px)`;
  };
  place();
  requestAnimationFrame(place);
  if (document.fonts?.ready) document.fonts.ready.then(place);
  return place;
}
export function segSelect(seg, value) {
  $$("button", seg).forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.value === String(value))),
  );
  initSeg(seg);
}

// ------------------------------------------------------------ toast
function rootEl(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}
const TOAST_ICON = {
  info: "info",
  success: "check-circle",
  warning: "alert",
  danger: "x-circle",
};
export function toast(
  message,
  type = "info",
  { title = "", duration = 3800 } = {},
) {
  const root = rootEl("toasts");
  root.setAttribute("aria-live", "polite");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.setAttribute("role", type === "danger" ? "alert" : "status");
  setHTML(
    el,
    html`<span class="toast-icon">${icon(TOAST_ICON[type] || "info")}</span>
      <div class="toast-body">
        ${title ? html`<b>${title}</b>` : ""}<span>${message}</span>
      </div>
      <button class="toast-x" aria-label="ปิดข้อความ">
        ${icon("x", "i-sm")}
      </button>
      <i class="toast-bar" style="animation-duration:${duration}ms"></i>`,
  );
  root.appendChild(el);
  while (root.children.length > 4) root.firstElementChild.remove();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.classList.add("in")),
  );
  let timer;
  const close = () => {
    clearTimeout(timer);
    el.classList.remove("in");
    el.classList.add("out");
    setTimeout(() => el.remove(), 320);
  };
  el.querySelector(".toast-x").addEventListener("click", close);
  timer = setTimeout(close, duration);
  if (type === "danger" || type === "warning")
    haptic(type === "danger" ? 40 : 20);
  return close;
}
export function toastError(err, fallback = "เกิดข้อผิดพลาด") {
  toast(err?.message || fallback, err?.status === 409 ? "warning" : "danger");
}

// ------------------------------------------------------------ modal / bottom sheet
const modalStack = [];
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalStack.length) {
    const top = modalStack[modalStack.length - 1];
    if (top.dismissible) top.close(null);
  }
});

export function openModal({
  title = "",
  body = "",
  footer = "",
  size = "md",
  className = "",
  dismissible = true,
  onClose,
} = {}) {
  const root = rootEl("modal-root");
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  setHTML(
    wrap,
    html`<div class="modal-backdrop"></div>
      <div
        class="modal modal-${size} ${className}"
        role="dialog"
        aria-modal="true"
        aria-label="${title}"
      >
        <div class="sheet-handle" aria-hidden="true"></div>
        <header class="modal-head">
          <h3>${title}</h3>
          <button
            class="btn btn-ghost btn-icon btn-sm modal-x"
            aria-label="ปิด"
          >
            ${icon("x")}
          </button>
        </header>
        <div class="modal-body"></div>
        <footer class="modal-foot"></footer>
      </div>`,
  );
  const modal = wrap.querySelector(".modal");
  const bodyEl = wrap.querySelector(".modal-body");
  const footEl = wrap.querySelector(".modal-foot");
  if (body instanceof Node) bodyEl.appendChild(body);
  else setHTML(bodyEl, body);
  if (footer instanceof Node) footEl.appendChild(footer);
  else setHTML(footEl, footer);
  if (!title) wrap.querySelector(".modal-head h3").remove();
  root.appendChild(wrap);
  document.body.classList.add("modal-open");
  const prevFocus = document.activeElement;

  let resolveFn;
  const done = new Promise((r) => {
    resolveFn = r;
  });
  const ctrl = {
    el: modal,
    body: bodyEl,
    foot: footEl,
    dismissible,
    done,
    closed: false,
    close(result) {
      if (ctrl.closed) return;
      ctrl.closed = true;
      modalStack.splice(modalStack.indexOf(ctrl), 1);
      wrap.classList.add("closing");
      wrap.classList.remove("open");
      setTimeout(
        () => {
          wrap.remove();
          if (!modalStack.length) document.body.classList.remove("modal-open");
        },
        motionLevel() === "off" ? 0 : 260,
      );
      try {
        prevFocus?.focus?.({ preventScroll: true });
      } catch {
        /* ignore */
      }
      onClose?.(result);
      resolveFn(result);
    },
  };
  modalStack.push(ctrl);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => wrap.classList.add("open")),
  );
  wrap
    .querySelector(".modal-x")
    .addEventListener("click", () => ctrl.close(null));
  wrap
    .querySelector(".modal-backdrop")
    .addEventListener("click", () => dismissible && ctrl.close(null));
  setTimeout(() => {
    const f = modal.querySelector(
      "[autofocus], .modal-body input:not([type=hidden]), .modal-body textarea, .modal-foot .btn-primary",
    );
    if (f && matchMedia("(pointer: fine)").matches)
      f.focus({ preventScroll: true });
  }, 60);

  // ลากลงเพื่อปิด (มือถือ)
  const handle = wrap.querySelector(".sheet-handle");
  let startY = null;
  handle.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    modal.classList.add("dragging");
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    modal.style.setProperty("--drag", `${Math.max(0, e.clientY - startY)}px`);
  });
  const end = (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    modal.classList.remove("dragging");
    modal.style.setProperty("--drag", "0px");
    if (dy > 110 && dismissible) ctrl.close(null);
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  return ctrl;
}

export function confirmDialog({
  title = "ยืนยันการทำรายการ",
  message = "",
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  danger = false,
  input = null,
  choices = null,
  iconName = danger ? "alert" : "info",
} = {}) {
  const body = document.createElement("div");
  body.className = "confirm-body";
  setHTML(
    body,
    html`<div class="confirm-icon ${danger ? "danger" : ""}">
        ${icon(iconName)}
      </div>
      <div class="confirm-msg">${message}</div>
      ${choices
        ? html`<div class="confirm-choices">
            ${choices.map(
              (c, i) =>
                html`<label class="choice"
                  ><input
                    type="radio"
                    name="cchoice"
                    value="${c.value}"
                    ${i === 0 ? raw("checked") : ""}
                  /><span
                    ><b>${c.label}</b>${c.hint
                      ? html`<small>${c.hint}</small>`
                      : ""}</span
                  ></label
                >`,
            )}
          </div>`
        : ""}
      ${input
        ? html`<label class="field"
            ><span>${input.label}</span
            ><textarea
              class="textarea"
              rows="2"
              maxlength="300"
              placeholder="${input.placeholder || ""}"
            ></textarea>
          </label>`
        : ""}`,
  );
  const foot = document.createElement("div");
  foot.className = "row";
  foot.style.cssText =
    "width:100%;justify-content:flex-end;gap:10px;flex-wrap:wrap";
  setHTML(
    foot,
    html`<button class="btn btn-ghost" data-act="cancel">${cancelText}</button>
      <button
        class="btn ${danger ? "btn-danger" : "btn-primary"}"
        data-act="ok"
      >
        ${confirmText}
      </button>`,
  );
  const m = openModal({
    title,
    body,
    footer: foot,
    size: "sm",
    className: "confirm-modal",
  });
  foot.querySelector('[data-act="cancel"]').onclick = () => m.close(false);
  foot.querySelector('[data-act="ok"]').onclick = () => {
    const ta = body.querySelector("textarea");
    if (input?.required && ta && !ta.value.trim()) {
      shake(ta);
      ta.focus();
      return;
    }
    m.close({
      value: ta ? ta.value.trim() : "",
      choice: body.querySelector('input[name="cchoice"]:checked')?.value,
    });
  };
  return m.done.then((r) => r || false);
}

// ------------------------------------------------------------ confetti
export function confetti({ x, y, count = 140, colors } = {}) {
  if (motionLevel() !== "full") return;
  const cs = getComputedStyle(document.documentElement);
  const palette = colors || [
    cs.getPropertyValue("--brand").trim(),
    cs.getPropertyValue("--accent").trim(),
    "#38bdf8",
    "#f472b6",
    "#a78bfa",
    "#facc15",
  ];
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:300";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const ox = x ?? innerWidth / 2;
  const oy = y ?? innerHeight * 0.35;
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      c: palette[Math.floor(Math.random() * palette.length)],
      shape: Math.random() < 0.3 ? "circle" : "rect",
    };
  });
  const t0 = performance.now();
  const frame = (t) => {
    const el = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - el / 2600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else
        ctx.fillRect(
          -p.w / 2,
          -p.h / 2,
          p.w,
          p.h * Math.abs(Math.cos(p.r * 2)) + 1,
        );
      ctx.restore();
    }
    if (el < 2700) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ live updates (SSE)
export function liveEvents(handlers) {
  if (!window.EventSource) return () => {};
  const es = new EventSource("/api/events");
  es.addEventListener("bookings", (e) =>
    handlers.bookings?.(JSON.parse(e.data)),
  );
  es.addEventListener("config", (e) => handlers.config?.(JSON.parse(e.data)));
  es.addEventListener("hello", (e) => handlers.hello?.(JSON.parse(e.data)));
  es.onopen = () => handlers.status?.(true);
  es.onerror = () => handlers.status?.(false);
  return () => es.close();
}

// ------------------------------------------------------------ files
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadICS(b, room, orgName) {
  const dt = (date, time) =>
    `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const e = (s) =>
    String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BangRak District Office//Room Booking//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Bangkok",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${b.id}@bangrak-room-booking`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Bangkok:${dt(b.date, b.start)}`,
    `DTEND;TZID=Asia/Bangkok:${dt(b.date, b.end)}`,
    `SUMMARY:${e(b.title)}`,
    `LOCATION:${e(`${room ? `${room.name} ${room.floor}` : ""} ${orgName}`.trim())}`,
    `DESCRIPTION:${e(`รหัสการจอง ${b.code}\nผู้จอง ${b.organizer} (${b.department})`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${e(b.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  downloadBlob(
    new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }),
    `${b.code}.ics`,
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// ตัวอักษรย่อสำหรับโลโก้
export function initials(name) {
  const clean = String(name || "")
    .replace(/^สำนักงาน/, "")
    .replace(/^เขต/, "")
    .trim();
  return clean.slice(0, 2) || "บร";
}
