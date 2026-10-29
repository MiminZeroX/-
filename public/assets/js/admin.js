// หน้าผู้ดูแลระบบ
import {
  $,
  $$,
  html,
  raw,
  setHTML,
  icon,
  api,
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
  shake,
  chime,
  syncClock,
  bkkNow,
  toMin,
  addDays,
  weekdayOf,
  startOfWeek,
  fmtDate,
  fmtDuration,
  fmtDateTime,
  timeAgo,
  statusBadge,
  countUp,
  debounce,
  copyText,
  store,
  TH_DAYS,
  TH_DAYS_SHORT,
} from "./core.js";
import { qrSVG } from "./qr.js";

const A = {
  me: null,
  settings: {},
  rooms: [],
  departments: [],
  holidays: [],
  pending: 0,
  serverUrls: [],
  online: true,
};
const root = $("#root");
let current = { id: null };

const EMBLEM = raw(
  '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="7" width="22" height="20" rx="4.5"/><path d="M5 13h22M11 4v5M21 4v5"/><path d="m11.5 19.5 3 3 6-6"/></svg>',
);
// ชุดสีห้องที่ผ่านการตรวจสอบสำหรับผู้มีภาวะตาบอดสี (ทั้งธีมสว่างและมืด)
const ROOM_SWATCHES = ["#0284c7", "#7c3aed", "#ea580c", "#0d9488"];
const BRANDS = [
  ["green", "#0b7a4b", "เขียว กทม."],
  ["teal", "#0f766e", "เขียวน้ำทะเล"],
  ["blue", "#1d4ed8", "น้ำเงิน"],
  ["indigo", "#4338ca", "คราม"],
  ["purple", "#7e22ce", "ม่วง"],
  ["rose", "#be123c", "แดงกุหลาบ"],
  ["orange", "#c2410c", "ส้ม"],
  ["gold", "#a16207", "ทอง"],
];
const STATUS_TH = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

const isAdmin = () => A.me?.role === "admin";
const roomOf = (id) => A.rooms.find((r) => r.id === id);
const col = (r) =>
  r && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "var(--brand)";
const titleOf = (b) =>
  b.kind === "block" ? `ปิดใช้ห้อง: ${b.title}` : b.title;
const roomLabel = (id) => {
  const r = roomOf(id);
  return r ? `${r.name} ${r.floor}` : id;
};

const SECTIONS = [
  {
    id: "dashboard",
    label: "แดชบอร์ด",
    icon: "chart",
    role: "staff",
    group: "ภาพรวม",
  },
  {
    id: "bookings",
    label: "รายการจอง",
    icon: "calendar",
    role: "staff",
    group: "ภาพรวม",
  },
  {
    id: "rooms",
    label: "ห้องประชุม",
    icon: "door",
    role: "admin",
    group: "จัดการข้อมูล",
  },
  {
    id: "data",
    label: "หน่วยงานและวันหยุด",
    icon: "tag",
    role: "admin",
    group: "จัดการข้อมูล",
  },
  {
    id: "settings",
    label: "ตั้งค่าและฟังก์ชัน",
    icon: "settings",
    role: "admin",
    group: "ระบบ",
  },
  {
    id: "users",
    label: "ผู้ใช้งานระบบ",
    icon: "users",
    role: "admin",
    group: "ระบบ",
  },
  {
    id: "logs",
    label: "บันทึกกิจกรรม (Log)",
    icon: "file-text",
    role: "admin",
    group: "ระบบ",
  },
  {
    id: "backup",
    label: "สำรอง/กู้คืนข้อมูล",
    icon: "database",
    role: "admin",
    group: "ระบบ",
  },
  {
    id: "connect",
    label: "การเชื่อมต่อและ QR",
    icon: "wifi",
    role: "admin",
    group: "ระบบ",
  },
];

// ------------------------------------------------------------------ chart tooltip
function initTooltips() {
  const tip = $("#viz-tip");
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) {
      tip.hidden = true;
      return;
    }
    tip.textContent = t.dataset.tip;
    const r = t.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - 140, Math.max(140, r.left + r.width / 2))}px`;
    tip.style.top = `${Math.max(60, r.top)}px`;
    tip.hidden = false;
  });
  document.addEventListener("scroll", () => (tip.hidden = true), {
    passive: true,
    capture: true,
  });
}

// ------------------------------------------------------------------ boot / auth
async function loadPublic() {
  const cfg = await api("/api/config");
  syncClock(cfg.now.ms);
  A.settings = { ...A.settings, ...cfg.settings };
  A.departments = cfg.departments;
  A.holidays = cfg.holidays;
  A.serverUrls = cfg.serverUrls || [];
  if (!A.rooms.length) A.rooms = cfg.rooms;
  store.set("br.cfg.appearance", {
    themeColor: cfg.settings.themeColor,
    defaultThemeMode: cfg.settings.defaultThemeMode,
    motionLevel: cfg.settings.motionLevel,
  });
  applyAppearance(cfg.settings);
  setFeedback({
    haptic: cfg.settings.hapticFeedback,
    sound: store.get("br.sound", cfg.settings.clickSound),
  });
}

async function loadRooms() {
  A.rooms = (await api("/api/admin/rooms")).rooms;
}

async function boot() {
  initEffects();
  initTooltips();
  try {
    await loadPublic();
  } catch (err) {
    setHTML(
      root,
      html`<div class="login-wrap">
        <div class="card login-card">
          <b>เชื่อมต่อระบบไม่ได้</b>
          <p class="muted">${err.message}</p>
        </div>
      </div>`,
    );
    return;
  }
  try {
    const me = await api("/api/admin/me");
    A.me = me.admin;
    A.pending = me.pendingCount;
    await enter();
  } catch (err) {
    if (err.status === 401) showLogin();
    else toastError(err);
  }
}

function showLogin() {
  const s = A.settings;
  document.title = `เข้าสู่ระบบผู้ดูแล · ${s.siteName}`;
  setHTML(
    root,
    html`<div class="login-wrap">
      <form class="card login-card" id="login" autocomplete="on">
        <div class="login-head">
          <span class="brand-mark"
            >${s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM}</span
          >
          <div>
            <h1>เข้าสู่ระบบผู้ดูแล</h1>
            <p>${s.siteName} · ${s.orgName}</p>
          </div>
        </div>
        <label class="field"
          ><span>ชื่อผู้ใช้</span>
          <div class="input-icon">
            ${icon("user")}<input
              class="input"
              name="username"
              autocomplete="username"
              autocapitalize="none"
              required
            /></div
        ></label>
        <label class="field"
          ><span>รหัสผ่าน</span>
          <div class="input-icon pw-wrap">
            ${icon("lock")}<input
              class="input"
              name="password"
              type="password"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="btn btn-ghost btn-icon btn-sm pw-eye"
              aria-label="แสดงรหัสผ่าน"
            >
              ${icon("eye")}
            </button>
          </div></label
        >
        <div id="login-err"></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">
          ${icon("log-in")} เข้าสู่ระบบ
        </button>
        <div class="login-foot">
          <a href="/">${icon("arrow-left", "i-sm")} กลับหน้าจองห้อง</a>
          <span>${icon("shield", "i-sm")} ทุกการเข้าสู่ระบบถูกบันทึกไว้</span>
        </div>
      </form>
    </div>`,
  );
  const form = $("#login");
  form.username.focus();
  $(".pw-eye", form).onclick = (e) => {
    const inp = form.password;
    inp.type = inp.type === "password" ? "text" : "password";
    setHTML(e.currentTarget, icon(inp.type === "password" ? "eye" : "eye-off"));
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.classList.add("is-loading");
    try {
      const res = await api("/api/admin/login", {
        method: "POST",
        body: {
          username: form.username.value.trim(),
          password: form.password.value,
        },
      });
      A.me = res.admin;
      const me = await api("/api/admin/me");
      A.pending = me.pendingCount;
      toast(`ยินดีต้อนรับ ${A.me.name}`, "success");
      await enter();
    } catch (err) {
      btn.classList.remove("is-loading");
      setHTML(
        $("#login-err"),
        html`<div class="notice notice-danger">
          ${icon("alert")}
          <div>${err.message}</div>
        </div>`,
      );
      shake(form);
      form.password.select();
    }
  };
}

async function enter() {
  try {
    await loadRooms();
    if (isAdmin()) A.settings = (await api("/api/admin/settings")).settings;
  } catch (err) {
    toastError(err);
  }
  renderShell();
  window.onhashchange = route;
  await route();
  startLive();
  if (A.me.mustChange) changePassword(true);
}

// ------------------------------------------------------------------ shell
function renderShell() {
  const s = A.settings;
  document.title = `ผู้ดูแลระบบ · ${s.siteName}`;
  const visible = SECTIONS.filter((x) => x.role === "staff" || isAdmin());
  const groups = [...new Set(visible.map((x) => x.group))];
  setHTML(
    root,
    html`<div class="adm">
      <aside class="side" id="side" aria-label="เมนูผู้ดูแล">
        <div class="side-brand">
          <span class="brand-mark"
            >${s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM}</span
          >
          <div><b>ผู้ดูแลระบบ</b><small>${s.orgName}</small></div>
        </div>
        <nav class="side-nav">
          ${groups.map(
            (g) =>
              html`<div class="side-group">${g}</div>
                ${visible
                  .filter((x) => x.group === g)
                  .map(
                    (x) =>
                      html`<a
                        class="side-link"
                        href="#${x.id}"
                        data-sec="${x.id}"
                        >${icon(x.icon)} <span>${x.label}</span>${x.id ===
                        "bookings"
                          ? html`<span
                              class="pill"
                              id="pending-pill"
                              hidden
                            ></span>`
                          : ""}</a
                      >`,
                  )}`,
          )}
        </nav>
        <div class="side-foot">
          <div class="me">
            <span class="avatar"
              >${(A.me.name || A.me.username).slice(0, 1)}</span
            >
            <div>
              <b>${A.me.name}</b
              ><small
                >@${A.me.username} ·
                ${isAdmin() ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}</small
              >
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-pass">
            ${icon("key", "i-sm")} เปลี่ยนรหัสผ่าน
          </button>
          <button class="btn btn-danger-soft btn-sm" id="btn-logout">
            ${icon("log-out", "i-sm")} ออกจากระบบ
          </button>
        </div>
      </aside>
      <div class="side-scrim" id="scrim"></div>
      <div class="adm-main">
        <header class="adm-top">
          <button
            class="btn btn-ghost btn-icon menu-btn"
            id="btn-menu"
            aria-label="เปิดเมนู"
          >
            ${icon("menu")}
          </button>
          <h1 id="sec-title"></h1>
          <span class="live-dot" id="live-dot">อัปเดตสด</span>
          <a class="btn btn-soft btn-sm" href="/" target="_blank" rel="noopener"
            >${icon("external", "i-sm")} <span>หน้าจองห้อง</span></a
          >
        </header>
        <div class="adm-content" id="sec"></div>
      </div>
    </div>`,
  );
  const side = $("#side");
  $("#btn-menu").onclick = () => side.classList.add("open");
  $("#scrim").onclick = () => side.classList.remove("open");
  side.addEventListener(
    "click",
    (e) => e.target.closest(".side-link") && side.classList.remove("open"),
  );
  $("#btn-pass").onclick = () => changePassword(false);
  $("#btn-logout").onclick = async () => {
    const ok = await confirmDialog({
      title: "ออกจากระบบ?",
      message: "คุณต้องการออกจากระบบผู้ดูแลใช่หรือไม่",
      confirmText: "ออกจากระบบ",
      iconName: "log-out",
    });
    if (!ok) return;
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    location.hash = "";
    location.reload();
  };
  updatePending();
}

function updatePending(n = A.pending) {
  A.pending = n;
  const pill = $("#pending-pill");
  if (pill) {
    pill.hidden = !n;
    pill.textContent = n;
  }
  const base = `ผู้ดูแลระบบ · ${A.settings.siteName}`;
  document.title = n ? `(${n}) ${base}` : base;
}

async function refreshPending() {
  try {
    const me = await api("/api/admin/me");
    updatePending(me.pendingCount);
  } catch (err) {
    if (err.status === 401) location.reload();
  }
}

let routing = false;
async function route() {
  if (routing) return;
  const id = location.hash.replace(/^#/, "").split("?")[0] || "dashboard";
  let sec =
    SECTIONS.find((x) => x.id === id && (x.role === "staff" || isAdmin())) ||
    SECTIONS[0];
  if (current.dirty?.() && current.id !== sec.id) {
    routing = true;
    const ok = await confirmDialog({
      title: "ยังไม่ได้บันทึกการเปลี่ยนแปลง",
      message: "หากออกจากหน้านี้ การตั้งค่าที่แก้ไขไว้จะหายไป",
      confirmText: "ออกโดยไม่บันทึก",
      cancelText: "อยู่ต่อ",
      danger: true,
    });
    routing = false;
    if (!ok) {
      history.replaceState(null, "", `#${current.id}`);
      return;
    }
  }
  if (current.id === sec.id && current.el) return;
  try {
    current.cleanup?.();
  } catch {
    /* ignore */
  }
  $$(".side-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.sec === sec.id),
  );
  $("#sec-title").textContent = sec.label;
  const el = $("#sec");
  const ctx = { id: sec.id, el };
  current = ctx;
  await swap(el, async () => {
    window.scrollTo(0, 0);
    // แต่ละเมนูได้ container ใหม่ เพื่อไม่ให้ event listener ของเมนูก่อนค้างอยู่
    const view = document.createElement("div");
    el.replaceChildren(view);
    ctx.el = view;
    await RENDER[sec.id](view, ctx);
  });
}

function startLive() {
  liveEvents({
    bookings: debounce(async (ev) => {
      await refreshPending();
      if (ev.action === "create" && ev.pending) {
        toast(
          `มีคำขอจองใหม่ ${ev.count > 1 ? `${ev.count} รายการ ` : ""}รออนุมัติ`,
          "warning",
          { title: "คำขอจองใหม่" },
        );
        if (A.settings.adminNotifySound) chime();
      }
      current.refresh?.(ev);
    }, 300),
    config: debounce(async () => {
      await loadPublic().catch(() => {});
      await loadRooms().catch(() => {});
    }, 300),
    status: (ok) => {
      A.online = ok;
      $("#live-dot")?.classList.toggle("off", !ok);
    },
  });
}

// ------------------------------------------------------------------ shared UI
function sectionHead(title, desc, actions = "") {
  return html`<div class="sec-head">
    <h2>${title}</h2>
    <span class="spacer"></span>${actions}${desc ? html`<p>${desc}</p>` : ""}
  </div>`;
}

function emptyBox(ic, title, text = "", action = "") {
  return html`<div class="empty card">
    <div class="empty-art">${icon(ic)}</div>
    <b>${title}</b>${text ? html`<p class="small">${text}</p>` : ""}${action}
  </div>`;
}

function row(ic, label, value) {
  if (value === "" || value === null || value === undefined) return "";
  return html`<div class="detail-row">
    ${icon(ic)}<span>${label}</span><b>${value}</b>
  </div>`;
}

function changePassword(forced) {
  const body = document.createElement("form");
  body.className = "stack";
  setHTML(
    body,
    html`${forced
        ? html`<div class="notice notice-warning">
            ${icon("shield")}
            <div>
              เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน
              (รหัสผ่านเริ่มต้นไม่ปลอดภัย)
            </div>
          </div>`
        : ""}
      <label class="field" data-f="current"
        ><span>รหัสผ่านปัจจุบัน</span
        ><input
          class="input"
          type="password"
          name="current"
          autocomplete="current-password"
          required
      /></label>
      <label class="field" data-f="next"
        ><span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span
        ><input
          class="input"
          type="password"
          name="next"
          autocomplete="new-password"
          minlength="8"
          required
      /></label>
      <label class="field" data-f="confirm"
        ><span>ยืนยันรหัสผ่านใหม่</span
        ><input
          class="input"
          type="password"
          name="confirm"
          autocomplete="new-password"
          required
      /></label>
      <button type="submit" hidden></button>`,
  );
  const foot = document.createElement("div");
  foot.className = "row";
  setHTML(
    foot,
    html`${forced
        ? ""
        : html`<button class="btn btn-ghost" data-x>ยกเลิก</button>`}<button
        class="btn btn-primary"
        data-ok
      >
        ${icon("check")} บันทึกรหัสผ่าน
      </button>`,
  );
  const m = openModal({
    title: "เปลี่ยนรหัสผ่าน",
    body,
    footer: foot,
    size: "sm",
    dismissible: !forced,
  });
  if (forced) m.el.querySelector(".modal-x").hidden = true;
  foot.querySelector("[data-x]")?.addEventListener("click", () => m.close());
  const submit = async () => {
    $$(".field-error", body).forEach((x) => x.remove());
    $$(".invalid", body).forEach((x) => x.classList.remove("invalid"));
    const f = body;
    const err = (k, msg) => {
      const fe = f.querySelector(`[data-f="${k}"]`);
      fe.classList.add("invalid");
      fe.insertAdjacentHTML("beforeend", "<span class='field-error'></span>");
      fe.lastElementChild.textContent = msg;
      shake(fe);
    };
    if (f.next.value.length < 8) return err("next", "อย่างน้อย 8 ตัวอักษร");
    if (f.next.value !== f.confirm.value)
      return err("confirm", "รหัสผ่านไม่ตรงกัน");
    const btn = foot.querySelector("[data-ok]");
    btn.classList.add("is-loading");
    try {
      await api("/api/admin/password", {
        method: "POST",
        body: { current: f.current.value, next: f.next.value },
      });
      A.me.mustChange = false;
      m.close();
      toast("เปลี่ยนรหัสผ่านเรียบร้อย", "success");
    } catch (e) {
      btn.classList.remove("is-loading");
      const fields = e.data?.fields || {};
      if (Object.keys(fields).length)
        Object.entries(fields).forEach(([k, v]) => err(k, v));
      else toastError(e);
    }
  };
  foot.querySelector("[data-ok]").onclick = submit;
  body.onsubmit = (e) => {
    e.preventDefault();
    submit();
  };
}

// ------------------------------------------------------------------ booking detail / actions
async function setStatus(b, status, opts = {}) {
  let reason = "";
  if (status === "rejected" || status === "cancelled") {
    const r = await confirmDialog({
      title:
        status === "rejected" ? "ไม่อนุมัติการจองนี้?" : "ยกเลิกการจองนี้?",
      message: `${b.code} · ${titleOf(b)}\n${fmtDate(b.date, "long")} ${b.start}–${b.end} น.`,
      confirmText: status === "rejected" ? "ไม่อนุมัติ" : "ยกเลิกการจอง",
      cancelText: "กลับ",
      danger: true,
      input: {
        label: "เหตุผล (ผู้จองจะเห็นข้อความนี้)",
        placeholder:
          status === "rejected"
            ? "เช่น ห้องถูกใช้จัดกิจกรรมของเขต"
            : "เช่น ผู้จองแจ้งยกเลิกทางโทรศัพท์",
      },
    });
    if (!r) return false;
    reason = r.value;
  }
  try {
    const res = await api(`/api/admin/bookings/${b.id}/status`, {
      method: "POST",
      body: { status, reason },
    });
    Object.assign(b, res.booking);
    toast(
      {
        approved: "อนุมัติการจองแล้ว",
        rejected: "บันทึกการไม่อนุมัติแล้ว",
        cancelled: "ยกเลิกการจองแล้ว",
        pending: "ตั้งเป็นรออนุมัติแล้ว",
      }[status],
      "success",
    );
    if (status === "approved" && opts.celebrate) confetti({ count: 60 });
    refreshPending();
    return true;
  } catch (err) {
    toastError(err);
    return false;
  }
}

function statusActions(b) {
  const acts = [];
  if (b.status === "pending") {
    acts.push({ k: "approved", label: "อนุมัติ", ic: "check", cls: "btn-ok" });
    acts.push({
      k: "rejected",
      label: "ไม่อนุมัติ",
      ic: "x",
      cls: "btn-danger-soft",
    });
  } else if (b.status === "approved") {
    acts.push({
      k: "cancelled",
      label: "ยกเลิกการจอง",
      ic: "ban",
      cls: "btn-danger-soft",
    });
  } else {
    acts.push({
      k: "approved",
      label: "คืนสถานะเป็นอนุมัติ",
      ic: "refresh",
      cls: "btn-soft",
    });
  }
  return acts;
}

function openBooking(b, onChange) {
  const r = roomOf(b.roomId);
  const body = html`<div class="detail-head" style="--room:${col(r)}">
      <div class="row-wrap">
        ${statusBadge(b)}<span class="code">${b.code}</span>${b.kind === "block"
          ? html`<span class="badge">${icon("ban")} ปิดใช้ห้อง</span>`
          : ""}
        ${b.seriesId
          ? html`<span class="badge">${icon("repeat")} จองซ้ำ</span>`
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
      ${row("door", "ห้อง", roomLabel(b.roomId))}
      ${row("calendar", "วันที่", fmtDate(b.date, "long"))}
      ${row(
        "clock",
        "เวลา",
        `${b.start}–${b.end} น. (${fmtDuration(toMin(b.end) - toMin(b.start))})`,
      )}
      ${row("user", "ผู้จอง", b.organizer)}
      ${row("building", "หน่วยงาน", b.department)}
      ${row("phone", "เบอร์โทร", b.phone)} ${row("mail", "อีเมล", b.email)}
      ${b.kind !== "block"
        ? row("users", "ผู้เข้าร่วม", `${b.attendees} คน`)
        : ""}
      ${row("monitor", "อุปกรณ์", (b.equipment || []).join(", "))}
      ${row("coffee", "บริการเสริม", (b.services || []).join(", "))}
      ${row("file-text", "หมายเหตุ", b.note)}
      ${row("lock", "บันทึกภายใน", b.adminNote)}
      ${row("x-circle", "เหตุผลไม่อนุมัติ", b.rejectReason)}
      ${row(
        "ban",
        "เหตุผลยกเลิก",
        b.status === "cancelled" ? b.cancelReason : "",
      )}
      ${row(
        "info",
        "สร้างเมื่อ",
        `${fmtDateTime(b.createdAt)} ${b.createdBy === "public" ? "(ผู้จองทำรายการเอง)" : `โดย ${b.createdBy}`}${b.createdIp ? ` · IP ${b.createdIp}` : ""}`,
      )}
    </div>
    ${b.history?.length
      ? html`<h3 style="margin:18px 0 8px;font-size:.98rem">
            ${icon("history")} ประวัติการดำเนินการ
          </h3>
          <div class="timeline">
            ${[...b.history].reverse().map(
              (h) =>
                html`<div class="tl-item">
                  <span class="tl-dot"></span>
                  <div class="tl-body">
                    ${h.text}<small>${fmtDateTime(h.ts)} · ${h.actor}</small>
                  </div>
                </div>`,
            )}
          </div>`
      : ""}`;
  const foot = document.createElement("div");
  foot.className = "row-wrap";
  foot.style.cssText = "width:100%;justify-content:flex-end";
  const acts = statusActions(b);
  setHTML(
    foot,
    html`${isAdmin()
        ? html`<button
            class="btn btn-ghost btn-sm"
            data-a="delete"
            style="margin-right:auto;color:var(--danger)"
          >
            ${icon("trash", "i-sm")} ลบถาวร
          </button>`
        : ""}
      <button class="btn btn-soft btn-sm" data-a="edit">
        ${icon("edit", "i-sm")} แก้ไข
      </button>
      ${acts.map(
        (a) =>
          html`<button class="btn btn-sm ${a.cls}" data-a="${a.k}">
            ${icon(a.ic, "i-sm")} ${a.label}
          </button>`,
      )}`,
  );
  const m = openModal({
    title: "รายละเอียดการจอง",
    body,
    footer: foot,
    size: "lg",
  });
  foot.onclick = async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (!a) return;
    if (a === "edit") {
      m.close();
      bookingForm(b, onChange);
    } else if (a === "delete") {
      const ok = await confirmDialog({
        title: "ลบการจองถาวร?",
        message: `${b.code} · ${titleOf(b)}\nข้อมูลจะถูกลบออกจากระบบและกู้คืนไม่ได้ (แนะนำให้ใช้ “ยกเลิก” แทน เพื่อเก็บประวัติ)`,
        confirmText: "ลบถาวร",
        danger: true,
        iconName: "trash",
      });
      if (!ok) return;
      try {
        await api(`/api/admin/bookings/${b.id}`, { method: "DELETE" });
        toast("ลบการจองแล้ว", "success");
        m.close();
        onChange?.();
        refreshPending();
      } catch (err) {
        toastError(err);
      }
    } else if (await setStatus(b, a, { celebrate: true })) {
      m.close();
      onChange?.();
    }
  };
}

function bookingForm(existing, onSaved, preset = {}) {
  const s = A.settings;
  const n = bkkNow();
  const editing = !!existing;
  const b = existing
    ? { ...existing }
    : {
        kind: "meeting",
        roomId: A.rooms.find((r) => !r.archived)?.id || "",
        date: n.date,
        start: "09:00",
        end: "10:00",
        title: "",
        organizer: "",
        department: "",
        phone: "",
        email: "",
        attendees: 1,
        equipment: [],
        services: [],
        note: "",
        adminNote: "",
        ...preset,
      };
  const equip = new Set(b.equipment);
  const serv = new Set(b.services);
  const rooms = A.rooms.filter((r) => !r.archived || r.id === b.roomId);
  const body = document.createElement("form");
  body.className = "stack";
  body.noValidate = true;
  const optList = (opts, set, attr) =>
    [...new Set([...opts, ...set])].map(
      (e) =>
        html`<button
          type="button"
          class="chip"
          ${raw(attr)}="${e}"
          aria-pressed="${set.has(e)}"
        >
          <span class="chip-check">${icon("check", "i-sm")}</span>${e}
        </button>`,
    );
  setHTML(
    body,
    html`<div class="seg" id="f-kind">
        <button
          type="button"
          data-value="meeting"
          aria-selected="${b.kind !== "block"}"
        >
          ${icon("users", "i-sm")} การประชุม
        </button>
        <button
          type="button"
          data-value="block"
          aria-selected="${b.kind === "block"}"
        >
          ${icon("ban", "i-sm")} ปิดใช้ห้อง
        </button>
      </div>
      <div class="form-grid">
        <label class="field" data-f="roomId"
          ><span>ห้อง</span>
          <select class="select" name="roomId">
            ${rooms.map(
              (r) =>
                html`<option
                  value="${r.id}"
                  ${r.id === b.roomId ? raw("selected") : ""}
                >
                  ${r.name} ${r.floor}${r.active ? "" : " (ปิดชั่วคราว)"}
                </option>`,
            )}
          </select></label
        >
        <label class="field" data-f="date"
          ><span>วันที่</span
          ><input
            class="input"
            type="date"
            name="date"
            value="${b.date}"
            required
        /></label>
        <label class="field" data-f="start"
          ><span>เวลาเริ่ม</span
          ><input
            class="input"
            type="time"
            name="start"
            step="300"
            value="${b.start}"
            required
        /></label>
        <label class="field" data-f="end"
          ><span>เวลาสิ้นสุด</span
          ><input
            class="input"
            type="time"
            name="end"
            step="300"
            value="${b.end}"
            required
        /></label>
        <label class="field full" data-f="title"
          ><span id="f-title-lbl"
            >${b.kind === "block"
              ? "เหตุผลการปิดห้อง"
              : "หัวข้อการประชุม"}</span
          ><input class="input" name="title" maxlength="200" value="${b.title}"
        /></label>
        <label class="field mt" data-f="organizer"
          ><span>ผู้จอง</span
          ><input
            class="input"
            name="organizer"
            maxlength="100"
            value="${b.organizer}"
        /></label>
        <label class="field mt" data-f="department"
          ><span>หน่วยงาน</span
          ><input
            class="input"
            name="department"
            maxlength="120"
            list="dept-list"
            value="${b.department}"
          />
          <datalist id="dept-list">
            ${A.departments.map((d) => html`<option value="${d}"></option>`)}
          </datalist></label
        >
        <label class="field mt" data-f="phone"
          ><span>เบอร์โทร</span
          ><input
            class="input"
            name="phone"
            type="tel"
            maxlength="30"
            value="${b.phone}"
        /></label>
        <label class="field mt" data-f="email"
          ><span>อีเมล</span
          ><input
            class="input"
            name="email"
            type="email"
            maxlength="120"
            value="${b.email}"
        /></label>
        <label class="field mt" data-f="attendees"
          ><span>จำนวนผู้เข้าร่วม</span
          ><input
            class="input"
            name="attendees"
            type="number"
            min="1"
            max="9999"
            value="${b.attendees}"
        /></label>
        ${!editing
          ? html`<label class="field"
              ><span>สถานะเมื่อบันทึก</span
              ><select class="select" name="status">
                <option value="approved">อนุมัติทันที</option>
                <option value="pending">รออนุมัติ</option>
              </select></label
            >`
          : html`<div></div>`}
        <div class="field full mt">
          <span>อุปกรณ์</span>
          <div class="chips" id="f-equip">
            ${optList(s.equipmentOptions || [], equip, "data-eq")}
          </div>
        </div>
        <div class="field full mt">
          <span>บริการเสริม</span>
          <div class="chips" id="f-serv">
            ${optList(s.serviceOptions || [], serv, "data-sv")}
          </div>
        </div>
        <label class="field full mt" data-f="note"
          ><span>หมายเหตุ (ผู้จองเห็น)</span
          ><textarea class="textarea" name="note" rows="2" maxlength="1000">
${b.note}</textarea
          >
        </label>
        <label class="field full" data-f="adminNote"
          ><span>บันทึกภายใน (เฉพาะผู้ดูแล)</span
          ><textarea class="textarea" name="adminNote" rows="2" maxlength="500">
${b.adminNote || ""}</textarea
          >
        </label>
        ${!editing && s.enableRecurring
          ? html`<div class="field full">
              <span>จองซ้ำ</span>
              <div class="row-wrap">
                <select class="select" name="repeat" style="max-width:220px">
                  <option value="none">ไม่ซ้ำ</option>
                  <option value="weekly">ทุกสัปดาห์</option>
                  <option value="daily">ทุกวันทำการ</option>
                </select>
                <input
                  class="input"
                  type="number"
                  name="repeatCount"
                  min="2"
                  max="${s.maxRecurring}"
                  value="4"
                  style="max-width:110px"
                />
                <span class="small muted">ครั้ง</span>
              </div>
            </div>`
          : ""}
        <label class="check full"
          ><input type="checkbox" name="force" /><span
            >ข้ามกฎการจอง
            <small class="faint"
              >(เวลาทำการ วันหยุด จองย้อนหลัง ความจุ ระยะเวลา) —
              ยังคงตรวจสอบการจองซ้อนเสมอ</small
            ></span
          ></label
        >
      </div>`,
  );
  const foot = document.createElement("div");
  foot.className = "row";
  setHTML(
    foot,
    html`<button class="btn btn-ghost" data-x>ยกเลิก</button
      ><button class="btn btn-primary" data-ok>
        ${icon("check")} ${editing ? "บันทึกการแก้ไข" : "สร้างการจอง"}
      </button>`,
  );
  const m = openModal({
    title: editing ? `แก้ไขการจอง ${b.code}` : "เพิ่มการจองโดยผู้ดูแล",
    body,
    footer: foot,
    size: "lg",
  });
  const kindSeg = $("#f-kind", body);
  initSeg(kindSeg);
  const applyKind = () => {
    $$(".mt", body).forEach((x) => (x.hidden = b.kind === "block"));
    $("#f-title-lbl", body).textContent =
      b.kind === "block" ? "เหตุผลการปิดห้อง" : "หัวข้อการประชุม";
  };
  applyKind();
  kindSeg.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    b.kind = btn.dataset.value;
    segSelect(kindSeg, b.kind);
    applyKind();
  };
  body.addEventListener("click", (e) => {
    const c = e.target.closest("[data-eq],[data-sv]");
    if (!c) return;
    const set = c.dataset.eq !== undefined ? equip : serv;
    const key = c.dataset.eq ?? c.dataset.sv;
    if (set.has(key)) set.delete(key);
    else set.add(key);
    c.setAttribute("aria-pressed", String(set.has(key)));
  });
  foot.querySelector("[data-x]").onclick = () => m.close();
  const save = async (skipConflicts = false) => {
    $$(".field-error", body).forEach((x) => x.remove());
    $$(".invalid", body).forEach((x) => x.classList.remove("invalid"));
    const f = body;
    const payload = {
      kind: b.kind,
      roomId: f.roomId.value,
      date: f.date.value,
      start: f.start.value,
      end: f.end.value,
      title: f.title.value.trim(),
      organizer: f.organizer.value.trim(),
      department: f.department.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      attendees: Number(f.attendees.value) || 0,
      equipment: [...equip],
      services: [...serv],
      note: f.note.value.trim(),
      adminNote: f.adminNote.value.trim(),
      force: f.force.checked,
    };
    if (!editing) {
      payload.status = f.status.value;
      if (f.repeat && f.repeat.value !== "none")
        payload.repeat = {
          type: f.repeat.value,
          count: Number(f.repeatCount.value) || 2,
        };
      if (skipConflicts) payload.skipConflicts = true;
    }
    const btn = foot.querySelector("[data-ok]");
    btn.classList.add("is-loading");
    try {
      if (editing)
        await api(`/api/admin/bookings/${b.id}`, {
          method: "PATCH",
          body: payload,
        });
      else {
        const res = await api("/api/admin/bookings", {
          method: "POST",
          body: payload,
        });
        if (res.skipped?.length)
          toast(`ข้าม ${res.skipped.length} วันที่ไม่ว่าง`, "warning");
      }
      m.close();
      toast(
        editing
          ? "บันทึกการแก้ไขแล้ว"
          : b.kind === "block"
            ? "ปิดใช้ห้องเรียบร้อย"
            : "สร้างการจองเรียบร้อย",
        "success",
      );
      onSaved?.();
      refreshPending();
    } catch (err) {
      btn.classList.remove("is-loading");
      const d = err.data || {};
      if (
        err.status === 409 &&
        d.conflicts?.length > 1 &&
        !editing &&
        !skipConflicts
      ) {
        const ok = await confirmDialog({
          title: "มีบางวันจองไม่ได้",
          message: `${d.conflicts.map((c) => `• ${fmtDate(c.date, "wd-year")} — ${c.reason}`).join("\n")}\n\nจองเฉพาะวันที่ว่าง?`,
          confirmText: "จองเฉพาะวันที่ว่าง",
        });
        if (ok) save(true);
        return;
      }
      if (d.fields) {
        Object.entries(d.fields).forEach(([k, v]) => {
          const fe = body.querySelector(`[data-f="${k}"]`);
          if (!fe) return;
          fe.classList.add("invalid");
          fe.insertAdjacentHTML(
            "beforeend",
            "<span class='field-error'></span>",
          );
          fe.lastElementChild.textContent = v;
        });
        shake(body.querySelector(".invalid"));
      }
      toastError(err);
    }
  };
  foot.querySelector("[data-ok]").onclick = () => save();
}

// ------------------------------------------------------------------ DASHBOARD
function barChart(perDay, width) {
  const W = Math.max(320, width);
  const H = 220;
  const pl = 30;
  const pb = 24;
  const pt = 10;
  const n = perDay.length;
  const max = Math.max(4, ...perDay.map((d) => d.count));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const slot = (W - pl) / n;
  const bw = Math.max(3, Math.min(28, slot - 2));
  const y = (v) => H - pb - (v / nice) * (H - pb - pt);
  const today = bkkNow().date;
  const grid = [0, nice / 2, nice].map(
    (v) =>
      html`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" /><text
          x="${pl - 8}"
          y="${y(v) + 3}"
          text-anchor="end"
          >${v}</text
        >`,
  );
  const labelEvery = n > 20 ? 5 : n > 10 ? 2 : 1;
  const cols = perDay.map((d, i) => {
    const x = pl + i * slot + (slot - bw) / 2;
    const h = Math.max(d.count ? 2 : 0, H - pb - y(d.count));
    const wd = weekdayOf(d.date);
    const day = Number(d.date.slice(8));
    const r = Math.min(4, bw / 2, h);
    const path = h
      ? `M${x} ${H - pb}V${H - pb - h + r}Q${x} ${H - pb - h} ${x + r} ${H - pb - h}H${x + bw - r}Q${x + bw} ${H - pb - h} ${x + bw} ${H - pb - h + r}V${H - pb}Z`
      : "";
    return html`<g
      class="col"
      data-tip="${fmtDate(d.date, "wd-year")}
${d.count} การจอง"
    >
      <rect
        class="hit"
        x="${pl + i * slot}"
        y="${pt}"
        width="${slot}"
        height="${H - pb - pt}"
      />
      ${path
        ? html`<path
            class="bar ${wd === 0 || wd === 6 ? "weekend" : ""} ${d.date ===
            today
              ? "today"
              : ""}"
            style="--i:${i}"
            d="${path}"
          />`
        : ""}
      ${day === 1 || day % labelEvery === 0 || i === n - 1
        ? html`<text
            x="${pl + i * slot + slot / 2}"
            y="${H - 6}"
            text-anchor="middle"
            >${day}</text
          >`
        : ""}
    </g>`;
  });
  return html`<svg
    class="vbar"
    viewBox="0 0 ${W} ${H}"
    width="${W}"
    height="${H}"
    role="img"
    aria-label="กราฟจำนวนการจองรายวัน"
  >
    <g class="grid">${grid}</g>
    <g class="axis">${cols}</g>
  </svg>`;
}

async function secDashboard(el, ctx) {
  let month = bkkNow().date.slice(0, 7);
  let stats = null;
  setHTML(
    el,
    html`<div class="kpis" id="d-kpis">
        ${[1, 2, 3, 4].map(
          () =>
            html`<div
              class="skel"
              style="height:140px;border-radius:20px"
            ></div>`,
        )}
      </div>
      <div class="dash-grid" id="d-grid"></div>`,
  );
  const monthRange = () => {
    const from = `${month}-01`;
    const to = addDays(`${addDays(from, 32).slice(0, 7)}-01`, -1);
    return [from, to];
  };
  function kpis(first) {
    const st = stats;
    const util = st.perRoom.length
      ? st.perRoom.reduce((s2, r) => s2 + r.utilization, 0) / st.perRoom.length
      : 0;
    const box = $("#d-kpis", el);
    setHTML(
      box,
      html`<div class="kpi">
          <span class="k-ic">${icon("calendar-check")}</span>
          <div class="k-val" data-v="${st.today.count}">0</div>
          <div class="k-label">การประชุมวันนี้</div>
          <div class="k-sub">กำลังใช้งาน ${st.today.ongoing} ห้อง</div>
        </div>
        <a
          class="kpi warn"
          href="#bookings?status=pending"
          style="text-decoration:none;color:inherit"
          ><span class="k-ic">${icon("hourglass")}</span>
          <div class="k-val" data-v="${st.pendingCount}">0</div>
          <div class="k-label">รออนุมัติ</div>
          <div class="k-sub">
            ${st.pendingCount ? "คลิกเพื่อจัดการ →" : "ไม่มีรายการค้าง"}
          </div></a
        >
        <div class="kpi info">
          <span class="k-ic">${icon("chart")}</span>
          <div class="k-val" data-v="${st.range.count}">0</div>
          <div class="k-label">
            การจองเดือน${fmtDate(`${month}-01`, "month").split(" ")[0]}
          </div>
          <div class="k-sub">
            รวม ${fmtDuration(st.range.totalMinutes)} · เฉลี่ย
            ${st.range.avgAttendees} คน/ครั้ง
          </div>
        </div>
        <div class="kpi ok">
          <span class="k-ic">${icon("activity")}</span>
          <div class="k-val">
            <span data-v="${Math.round(util * 100)}">0</span><small>%</small>
          </div>
          <div class="k-label">อัตราการใช้ห้องเฉลี่ย</div>
          <div class="k-sub">
            คิดจาก ${st.range.workDays} วันทำการ ×
            ${st.hours.open}–${st.hours.close} น.
          </div>
        </div>`,
    );
    $$("[data-v]", box).forEach((x) =>
      first ? countUp(x, Number(x.dataset.v)) : (x.textContent = x.dataset.v),
    );
    if (first) {
      box.classList.add("stagger");
      stagger(box);
    }
  }
  function panels(first) {
    const st = stats;
    const grid = $("#d-grid", el);
    const [from] = monthRange();
    const maxDept = Math.max(1, ...st.departments.map((d) => d.count));
    const sc = st.range.statusCounts;
    const total = Object.values(sc).reduce((a, b) => a + b, 0);
    const statusDefs = [
      ["approved", "var(--ok)", "check-circle", "อนุมัติแล้ว"],
      ["pending", "var(--warn)", "hourglass", "รออนุมัติ"],
      ["rejected", "var(--danger)", "x-circle", "ไม่อนุมัติ"],
      ["cancelled", "var(--text-3)", "ban", "ยกเลิก"],
    ];
    // heatmap
    const o = Math.floor(toMin(st.hours.open) / 60);
    const c = Math.ceil(toMin(st.hours.close) / 60);
    const hours = Array.from({ length: Math.max(1, c - o) }, (_, i) => o + i);
    const days = [1, 2, 3, 4, 5, 6, 0].filter((d) =>
      d >= 1 && d <= 5 ? true : st.heat[d].some((v) => v > 0),
    );
    const hmax = Math.max(
      1,
      ...days.flatMap((d) => hours.map((h) => st.heat[d][h])),
    );
    setHTML(
      grid,
      html`<section class="card panel">
          <div class="panel-head">
            <h3>${icon("chart")} การจองรายวัน</h3>
            <span class="spacer"></span>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-m="-1"
              aria-label="เดือนก่อน"
            >
              ${icon("chevron-left")}
            </button>
            <b style="min-width:120px;text-align:center"
              >${fmtDate(from, "month")}</b
            >
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-m="1"
              aria-label="เดือนถัดไป"
            >
              ${icon("chevron-right")}
            </button>
          </div>
          <div id="d-bars" style="overflow:hidden"></div>
          <div class="legend-row">
            <span
              ><i
                style="width:12px;height:12px;border-radius:3px;background:var(--brand)"
              ></i
              >วันทำการ</span
            >
            <span
              ><i
                style="width:12px;height:12px;border-radius:3px;background:color-mix(in srgb,var(--brand) 45%,var(--surface))"
              ></i
              >เสาร์–อาทิตย์</span
            >
            <span
              ><i
                style="width:12px;height:12px;border-radius:3px;background:var(--accent)"
              ></i
              >วันนี้</span
            >
          </div>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("hourglass")} รออนุมัติ</h3>
            <span class="spacer"></span
            ><a class="btn btn-ghost btn-sm" href="#bookings?status=pending"
              >ทั้งหมด ${icon("arrow-right", "i-sm")}</a
            >
          </div>
          <div class="mini-list" id="d-pending">
            ${st.pendingList.length
              ? st.pendingList.map(
                  (b) =>
                    html`<div
                      class="mini-item"
                      style="--room:${col(roomOf(b.roomId))}"
                      data-id="${b.id}"
                    >
                      <div>
                        <b data-open>${b.title}</b>
                        <div class="meta">
                          ${fmtDate(b.date, "wd")} · ${b.start}–${b.end} ·
                          ${roomOf(b.roomId)?.name || ""} · ${b.department}
                        </div>
                      </div>
                      <div class="acts">
                        <button
                          class="btn btn-ok btn-icon btn-sm"
                          data-st="approved"
                          aria-label="อนุมัติ"
                          title="อนุมัติ"
                        >
                          ${icon("check")}
                        </button>
                        <button
                          class="btn btn-danger-soft btn-icon btn-sm"
                          data-st="rejected"
                          aria-label="ไม่อนุมัติ"
                          title="ไม่อนุมัติ"
                        >
                          ${icon("x")}
                        </button>
                      </div>
                    </div>`,
                )
              : html`<div class="empty" style="padding:18px">
                  ${icon("check-circle", "i-lg")}<span class="small"
                    >ไม่มีรายการรออนุมัติ</span
                  >
                </div>`}
          </div>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("door")} อัตราการใช้ห้อง</h3>
            <span class="spacer"></span
            ><small>ชั่วโมงที่จอง ÷ ชั่วโมงทำการ</small>
          </div>
          <div class="hbars">
            ${st.perRoom.map(
              (r, i) =>
                html`<div
                  class="hbar"
                  style="--c:${col(r)};--i:${i}"
                  data-tip="${r.name} ${r.floor}
${r.count} การจอง · ${fmtDuration(r.minutes)}"
                >
                  <div class="hbar-top">
                    <i class="sw"></i><b>${r.name} ${r.floor}</b
                    ><span class="v"
                      >${Math.round(r.utilization * 100)}% · ${r.count}
                      ครั้ง</span
                    >
                  </div>
                  <div class="hbar-track">
                    <i style="width:${Math.max(0.5, r.utilization * 100)}%"></i>
                  </div>
                </div>`,
            )}
          </div>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("check-circle")} สถานะการจองในเดือน</h3>
            <span class="spacer"></span><small>ทั้งหมด ${total} รายการ</small>
          </div>
          ${total
            ? html`<div class="stackbar">
                ${statusDefs.map(([k, c2], i) =>
                  sc[k]
                    ? html`<i
                        style="width:${(sc[k] / total) * 100}%;background:${raw(
                          c2,
                        )};animation-delay:${i * 80}ms"
                        data-tip="${STATUS_TH[k]} ${sc[k]} รายการ"
                      ></i>`
                    : "",
                )}
              </div>`
            : html`<div class="faint small">ยังไม่มีข้อมูลในเดือนนี้</div>`}
          <div class="legend-row">
            ${statusDefs.map(
              ([k, c2, ic, label]) =>
                html`<span
                  ><span style="color:${raw(c2)};display:inline-flex"
                    >${icon(ic)}</span
                  >${label} <b>${sc[k] || 0}</b></span
                >`,
            )}
          </div>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("clock")} ช่วงเวลาที่มีการใช้ห้องมาก</h3>
            <span class="spacer"></span
            ><small>จำนวนการจองตามวันและชั่วโมง</small>
          </div>
          <div class="heat" style="--hcols:${hours.length}">
            <span></span>${hours.map(
              (h) =>
                html`<span class="hh">${String(h).padStart(2, "0")}</span>`,
            )}
            ${days.map(
              (d, di) =>
                html`<span class="hl">${TH_DAYS_SHORT[d]}</span>${hours.map(
                    (h, hi) => {
                      const v = st.heat[d][h];
                      return html`<span
                        class="cell"
                        style="--v:${v / hmax};--i:${di * hours.length + hi}"
                        data-tip="${TH_DAYS[d]} ${String(h).padStart(
                          2,
                          "0",
                        )}:00–${String(h + 1).padStart(2, "0")}:00
${v} การจอง"
                      ></span>`;
                    },
                  )}`,
            )}
          </div>
          <div class="heat-scale">
            น้อย
            ${[0, 0.25, 0.5, 0.75, 1].map(
              (v) =>
                html`<i
                  style="background:color-mix(in srgb,var(--brand) ${v *
                  88}%,var(--surface-2))"
                ></i>`,
            )}
            มาก
          </div>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("building")} หน่วยงานที่ใช้ห้องมากที่สุด</h3>
          </div>
          ${st.departments.length
            ? html`<div class="hbars">
                ${st.departments.map(
                  (d, i) =>
                    html`<div
                      class="hbar"
                      style="--i:${i}"
                      data-tip="${d.name}
${d.count} การจอง"
                    >
                      <div class="hbar-top">
                        <b>${d.name}</b><span class="v">${d.count} ครั้ง</span>
                      </div>
                      <div class="hbar-track">
                        <i style="width:${(d.count / maxDept) * 100}%"></i>
                      </div>
                    </div>`,
                )}
              </div>`
            : html`<div class="faint small">ยังไม่มีข้อมูลในเดือนนี้</div>`}
        </section>
        <section class="card panel span-2">
          <div class="panel-head">
            <h3>${icon("calendar")} กำหนดการวันนี้</h3>
            <span class="spacer"></span
            ><small>${fmtDate(bkkNow().date, "long")}</small>
          </div>
          <div class="mini-list" id="d-today">
            ${st.today.list.length
              ? st.today.list.map(
                  (b) =>
                    html`<div
                      class="mini-item"
                      style="--room:${col(roomOf(b.roomId))}"
                      data-id="${b.id}"
                    >
                      <div>
                        <b data-open>${b.start}–${b.end} · ${titleOf(b)}</b>
                        <div class="meta">
                          ${roomLabel(b.roomId)} · ${b.department} ·
                          ${b.organizer}
                        </div>
                      </div>
                      <div class="acts">${statusBadge(b)}</div>
                    </div>`,
                )
              : html`<div class="faint small">วันนี้ยังไม่มีการจอง</div>`}
          </div>
        </section>`,
    );
    let drawnWidth = 0;
    const drawBars = () => {
      const box = $("#d-bars", grid);
      if (!box || box.clientWidth === drawnWidth) return;
      drawnWidth = box.clientWidth;
      setHTML(box, barChart(st.perDay, drawnWidth));
    };
    drawBars();
    if (first) {
      grid.classList.add("stagger");
      stagger(grid);
    }
    ctx.onResize = debounce(drawBars, 200);
  }
  async function load(first = false) {
    const [from, to] = monthRange();
    try {
      stats = await api(`/api/admin/stats?from=${from}&to=${to}`);
    } catch (err) {
      toastError(err);
      return;
    }
    if (current !== ctx) return;
    updatePending(stats.pendingCount);
    kpis(first);
    panels(first);
  }
  el.addEventListener("click", async (e) => {
    const mBtn = e.target.closest("[data-m]");
    if (mBtn) {
      const [y, mo] = month.split("-").map(Number);
      const d = new Date(Date.UTC(y, mo - 1 + Number(mBtn.dataset.m), 1));
      month = d.toISOString().slice(0, 7);
      return load(false);
    }
    const item = e.target.closest(".mini-item");
    if (!item) return;
    const all = [...stats.pendingList, ...stats.today.list];
    const b = all.find((x) => x.id === item.dataset.id);
    if (!b) return;
    const stBtn = e.target.closest("[data-st]");
    if (stBtn) {
      if (await setStatus(b, stBtn.dataset.st, { celebrate: true })) {
        item.classList.add("leaving");
        setTimeout(() => load(false), 300);
      }
    } else if (e.target.closest("[data-open]"))
      openBooking(b, () => load(false));
  });
  const onResize = () => ctx.onResize?.();
  window.addEventListener("resize", onResize);
  ctx.cleanup = () => window.removeEventListener("resize", onResize);
  ctx.refresh = () => load(false);
  await load(true);
}

// ------------------------------------------------------------------ BOOKINGS
async function secBookings(el, ctx) {
  const q0 = new URLSearchParams(location.hash.split("?")[1] || "");
  const today = bkkNow().date;
  const st = {
    q: "",
    room: "",
    status: q0.get("status") || "upcoming",
    from: "",
    to: "",
    sort: "date_asc",
    page: 1,
    size: 25,
    sel: new Set(),
    preset: q0.get("status") === "pending" ? "pending" : "upcoming",
  };
  let data = { items: [], total: 0, page: 1, pages: 1 };
  const presets = [
    [
      "upcoming",
      "กำลังจะถึง",
      { status: "upcoming", from: "", to: "", sort: "date_asc" },
    ],
    [
      "pending",
      "รออนุมัติ",
      { status: "pending", from: "", to: "", sort: "date_asc" },
    ],
    [
      "today",
      "วันนี้",
      { status: "all", from: today, to: today, sort: "date_asc" },
    ],
    [
      "week",
      "สัปดาห์นี้",
      {
        status: "all",
        from: startOfWeek(today),
        to: addDays(startOfWeek(today), 6),
        sort: "date_asc",
      },
    ],
    [
      "month",
      "เดือนนี้",
      {
        status: "all",
        from: `${today.slice(0, 7)}-01`,
        to: addDays(
          `${addDays(`${today.slice(0, 7)}-01`, 32).slice(0, 7)}-01`,
          -1,
        ),
        sort: "date_asc",
      },
    ],
    ["all", "ทั้งหมด", { status: "all", from: "", to: "", sort: "date_desc" }],
  ];
  setHTML(
    el,
    html`${sectionHead(
        "รายการจองทั้งหมด",
        "ค้นหา อนุมัติ แก้ไข ยกเลิก หรือส่งออกข้อมูลเป็นไฟล์ Excel (CSV)",
        html`<div class="row-wrap">
          <button class="btn btn-soft" id="b-block">
            ${icon("ban")} ปิดใช้ห้อง
          </button>
          <button class="btn btn-soft" id="b-csv">
            ${icon("download")} ส่งออก CSV
          </button>
          <button class="btn btn-primary" id="b-add">
            ${icon("plus")} เพิ่มการจอง
          </button>
        </div>`,
      )}
      <div class="quick" id="b-quick">
        ${presets.map(
          ([k, label]) =>
            html`<button
              class="chip"
              data-p="${k}"
              aria-pressed="${st.preset === k}"
            >
              ${label}${k === "pending" ? html` <b id="q-pend"></b>` : ""}
            </button>`,
        )}
      </div>
      <div class="toolbar card" style="padding:12px">
        <label class="field grow"
          ><span>ค้นหา</span>
          <div class="input-icon">
            ${icon("search")}<input
              class="input"
              id="f-q"
              placeholder="รหัส หัวข้อ ชื่อผู้จอง หน่วยงาน เบอร์โทร"
            /></div
        ></label>
        <label class="field"
          ><span>ห้อง</span
          ><select class="select" id="f-room">
            <option value="">ทุกห้อง</option>
            ${A.rooms.map(
              (r) =>
                html`<option value="${r.id}">
                  ${r.name} ${r.floor}${r.archived ? " (นำออกแล้ว)" : ""}
                </option>`,
            )}
          </select></label
        >
        <label class="field"
          ><span>สถานะ</span
          ><select class="select" id="f-status">
            <option value="all">ทั้งหมด</option>
            <option value="upcoming">กำลังจะถึง</option>
            <option value="active">ใช้งานอยู่</option>
            ${Object.entries(STATUS_TH).map(
              ([k, v]) => html`<option value="${k}">${v}</option>`,
            )}
          </select></label
        >
        <label class="field"
          ><span>ตั้งแต่</span><input class="input" type="date" id="f-from"
        /></label>
        <label class="field"
          ><span>ถึง</span><input class="input" type="date" id="f-to"
        /></label>
        <label class="field"
          ><span>เรียงตาม</span
          ><select class="select" id="f-sort">
            <option value="date_asc">วันที่ใช้ (เก่า→ใหม่)</option>
            <option value="date_desc">วันที่ใช้ (ใหม่→เก่า)</option>
            <option value="created_desc">จองล่าสุด</option>
          </select></label
        >
      </div>
      <div id="b-bulk"></div>
      <div id="b-list"></div>`,
  );
  const f = {
    q: $("#f-q", el),
    room: $("#f-room", el),
    status: $("#f-status", el),
    from: $("#f-from", el),
    to: $("#f-to", el),
    sort: $("#f-sort", el),
  };
  const syncInputs = () => {
    f.q.value = st.q;
    f.room.value = st.room;
    f.status.value = st.status;
    f.from.value = st.from;
    f.to.value = st.to;
    f.sort.value = st.sort;
    $$("#b-quick .chip", el).forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.p === st.preset)),
    );
  };
  const params = (withPage = true) => {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q);
    if (st.room) p.set("room", st.room);
    if (st.status) p.set("status", st.status);
    if (st.from) p.set("from", st.from);
    if (st.to) p.set("to", st.to);
    p.set("sort", st.sort);
    if (withPage) {
      p.set("page", st.page);
      p.set("size", st.size);
    }
    return p;
  };

  function renderBulk() {
    const box = $("#b-bulk", el);
    if (!st.sel.size) return setHTML(box, "");
    setHTML(
      box,
      html`<div class="bulkbar">
        <b>${icon("check-circle")} เลือก ${st.sel.size} รายการ</b>
        <button class="btn btn-sm" data-bulk="approve">
          ${icon("check", "i-sm")} อนุมัติ
        </button>
        <button class="btn btn-sm" data-bulk="reject">
          ${icon("x", "i-sm")} ไม่อนุมัติ
        </button>
        <button class="btn btn-sm" data-bulk="cancel">
          ${icon("ban", "i-sm")} ยกเลิก
        </button>
        ${isAdmin()
          ? html`<button class="btn btn-sm" data-bulk="delete">
              ${icon("trash", "i-sm")} ลบ
            </button>`
          : ""}
        <button class="btn btn-sm" data-bulk="clear">
          ${icon("x", "i-sm")} ล้างที่เลือก
        </button>
      </div>`,
    );
  }

  function renderList(animate) {
    const box = $("#b-list", el);
    const q = $("#q-pend", el);
    if (q) q.textContent = data.pendingCount ? `(${data.pendingCount})` : "";
    const draw = () => {
      if (!data.items.length) {
        setHTML(
          box,
          emptyBox(
            "search",
            "ไม่พบรายการจอง",
            "ลองเปลี่ยนตัวกรอง หรือเลือก “ทั้งหมด”",
          ),
        );
        return;
      }
      const allSel = data.items.every((b) => st.sel.has(b.id));
      setHTML(
        box,
        html`<div class="table-wrap table-desktop">
            <table class="table">
              <thead>
                <tr>
                  <th class="cb">
                    <label class="check"
                      ><input
                        type="checkbox"
                        data-selall
                        ${allSel ? raw("checked") : ""}
                        aria-label="เลือกทั้งหมด"
                    /></label>
                  </th>
                  <th>รหัส</th>
                  <th>วันที่ / เวลา</th>
                  <th>ห้อง</th>
                  <th>หัวข้อ / ผู้จอง</th>
                  <th>สถานะ</th>
                  <th style="text-align:right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map((b) => {
                  const r = roomOf(b.roomId);
                  return html`<tr
                    class="clickable ${st.sel.has(b.id) ? "sel" : ""}"
                    data-id="${b.id}"
                  >
                    <td class="cb">
                      <label class="check"
                        ><input
                          type="checkbox"
                          data-sel
                          ${st.sel.has(b.id) ? raw("checked") : ""}
                          aria-label="เลือก ${b.code}"
                      /></label>
                    </td>
                    <td class="code">${b.code}</td>
                    <td class="nowrap">
                      <b>${fmtDate(b.date, "wd-year")}</b>
                      <div class="t-sub">${b.start}–${b.end} น.</div>
                    </td>
                    <td>
                      <span class="t-room" style="--room:${col(r)}"
                        ><i></i>${r ? r.name : b.roomId}</span
                      >
                      <div class="t-sub">${r?.floor || ""}</div>
                    </td>
                    <td>
                      <div class="t-title">${titleOf(b)}</div>
                      <div class="t-sub">
                        ${b.kind === "block"
                          ? "ปิดใช้ห้องโดยผู้ดูแล"
                          : `${b.organizer} · ${b.department} · ${b.attendees} คน`}
                      </div>
                    </td>
                    <td>${statusBadge(b)}</td>
                    <td>
                      <div class="row-acts">
                        ${statusActions(b)
                          .slice(0, 2)
                          .map(
                            (a) =>
                              html`<button
                                class="btn btn-icon btn-sm ${a.cls}"
                                data-st="${a.k}"
                                title="${a.label}"
                                aria-label="${a.label}"
                              >
                                ${icon(a.ic, "i-sm")}
                              </button>`,
                          )}
                        <button
                          class="btn btn-ghost btn-icon btn-sm"
                          data-edit
                          title="แก้ไข"
                          aria-label="แก้ไข"
                        >
                          ${icon("edit", "i-sm")}
                        </button>
                      </div>
                    </td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
          <div class="cards-mobile">
            ${data.items.map((b) => {
              const r = roomOf(b.roomId);
              return html`<div
                class="bk-card"
                style="--room:${col(r)}"
                data-id="${b.id}"
              >
                <label class="check"
                  ><input
                    type="checkbox"
                    data-sel
                    ${st.sel.has(b.id) ? raw("checked") : ""}
                    aria-label="เลือก"
                /></label>
                <div>
                  <div class="row-wrap">
                    ${statusBadge(b)}<span class="code">${b.code}</span>
                  </div>
                  <b>${titleOf(b)}</b>
                  <div class="t-sub small muted">
                    ${fmtDate(b.date, "wd")} · ${b.start}–${b.end} ·
                    ${r ? r.name : ""} · ${b.department}
                  </div>
                </div>
                <div class="full row-wrap">
                  ${statusActions(b).map(
                    (a) =>
                      html`<button class="btn btn-sm ${a.cls}" data-st="${a.k}">
                        ${icon(a.ic, "i-sm")} ${a.label}
                      </button>`,
                  )}
                  <button class="btn btn-ghost btn-sm" data-edit>
                    ${icon("edit", "i-sm")} แก้ไข
                  </button>
                </div>
              </div>`;
            })}
          </div>
          <div class="pager">
            <span
              >แสดง
              ${(data.page - 1) * data.size + 1}–${Math.min(
                data.total,
                data.page * data.size,
              )}
              จาก ${data.total} รายการ</span
            >
            <div class="row">
              <button
                class="btn btn-sm"
                data-page="${data.page - 1}"
                ${data.page <= 1 ? raw("disabled") : ""}
              >
                ${icon("chevron-left", "i-sm")} ก่อนหน้า
              </button>
              <span>หน้า ${data.page}/${data.pages}</span>
              <button
                class="btn btn-sm"
                data-page="${data.page + 1}"
                ${data.page >= data.pages ? raw("disabled") : ""}
              >
                ถัดไป ${icon("chevron-right", "i-sm")}
              </button>
            </div>
          </div>`,
      );
      $$("tbody tr, .bk-card", box).forEach((x, i) => {
        x.style.animation = `rise .45s var(--ease-out) both ${Math.min(i, 15) * 25}ms`;
      });
    };
    if (animate) swap(box, draw, "fade");
    else draw();
    renderBulk();
  }

  async function load(animate = true) {
    try {
      data = await api(`/api/admin/bookings?${params()}`);
    } catch (err) {
      toastError(err);
      return;
    }
    if (current !== ctx) return;
    updatePending(data.pendingCount);
    renderList(animate);
  }

  const reload = () => {
    st.page = 1;
    st.sel.clear();
    load();
  };
  f.q.addEventListener(
    "input",
    debounce(() => {
      st.q = f.q.value.trim();
      reload();
    }, 300),
  );
  for (const k of ["room", "status", "from", "to", "sort"]) {
    f[k].addEventListener("change", () => {
      st[k] = f[k].value;
      st.preset = "";
      syncInputs();
      reload();
    });
  }
  $("#b-quick", el).onclick = (e) => {
    const c = e.target.closest("[data-p]");
    if (!c) return;
    const p = presets.find((x) => x[0] === c.dataset.p);
    Object.assign(st, p[2], { preset: p[0] });
    syncInputs();
    reload();
  };
  $("#b-add", el).onclick = () => bookingForm(null, () => load(false));
  $("#b-block", el).onclick = () =>
    bookingForm(null, () => load(false), {
      kind: "block",
      title: "",
      start: A.settings.openTime,
      end: A.settings.closeTime,
    });
  $("#b-csv", el).onclick = () => {
    location.href = `/api/admin/bookings.csv?${params(false)}`;
    toast("กำลังดาวน์โหลดไฟล์ CSV (เปิดด้วย Excel ได้)", "success");
  };

  el.addEventListener("click", async (e) => {
    const bulk = e.target.closest("[data-bulk]");
    if (bulk) {
      const action = bulk.dataset.bulk;
      if (action === "clear") {
        st.sel.clear();
        return renderList(false);
      }
      const label = {
        approve: "อนุมัติ",
        reject: "ไม่อนุมัติ",
        cancel: "ยกเลิก",
        delete: "ลบถาวร",
      }[action];
      const r = await confirmDialog({
        title: `${label} ${st.sel.size} รายการ?`,
        message:
          action === "delete"
            ? "ข้อมูลจะถูกลบและกู้คืนไม่ได้"
            : "ระบบจะบันทึกการดำเนินการนี้ใน Log",
        confirmText: label,
        danger: action !== "approve",
        input:
          action === "reject" || action === "cancel"
            ? { label: "เหตุผล (ไม่บังคับ)" }
            : null,
      });
      if (!r) return;
      try {
        const res = await api("/api/admin/bookings/bulk", {
          method: "POST",
          body: { ids: [...st.sel], action, reason: r.value },
        });
        toast(
          `${label}แล้ว ${res.done} รายการ${res.errors.length ? ` (ไม่สำเร็จ ${res.errors.length})` : ""}`,
          res.errors.length ? "warning" : "success",
        );
        if (res.errors.length)
          res.errors.slice(0, 3).forEach((m2) => toast(m2, "warning"));
        if (action === "approve" && res.done) confetti({ count: 80 });
        st.sel.clear();
        load(false);
        refreshPending();
      } catch (err) {
        toastError(err);
      }
      return;
    }
    const pg = e.target.closest("[data-page]");
    if (pg && !pg.disabled) {
      st.page = Number(pg.dataset.page);
      load();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (e.target.closest("[data-selall]")) {
      const on = e.target.checked;
      data.items.forEach((b) => (on ? st.sel.add(b.id) : st.sel.delete(b.id)));
      return renderList(false);
    }
    const rowEl = e.target.closest("[data-id]");
    if (!rowEl) return;
    const b = data.items.find((x) => x.id === rowEl.dataset.id);
    if (!b) return;
    if (e.target.closest("[data-sel]")) {
      if (e.target.checked) st.sel.add(b.id);
      else st.sel.delete(b.id);
      rowEl.classList.toggle("sel", e.target.checked);
      renderBulk();
      return;
    }
    if (e.target.closest(".check")) return;
    const stBtn = e.target.closest("[data-st]");
    if (stBtn) {
      if (await setStatus(b, stBtn.dataset.st, { celebrate: true }))
        load(false);
      return;
    }
    if (e.target.closest("[data-edit]"))
      return bookingForm(b, () => load(false));
    openBooking(b, () => load(false));
  });
  ctx.refresh = () => load(false);
  syncInputs();
  await load(false);
}

// ------------------------------------------------------------------ ROOMS
async function secRooms(el, ctx) {
  async function render(animate = false) {
    await loadRooms().catch(toastError);
    if (current !== ctx) return;
    const rooms = A.rooms.filter((r) => !r.archived);
    const approvalTh = {
      inherit: `ตามค่าระบบ (${A.settings.requireApproval ? "ต้องอนุมัติ" : "ยืนยันทันที"})`,
      yes: "ต้องอนุมัติเสมอ",
      no: "ยืนยันทันทีเสมอ",
    };
    const draw = () =>
      setHTML(
        el,
        html`${sectionHead(
            "ห้องประชุม",
            "เพิ่ม/แก้ไขห้อง ความจุ อุปกรณ์ สี การอนุมัติ และเปิด/ปิดให้บริการชั่วคราว",
            html`<button class="btn btn-primary" id="r-add">
              ${icon("plus")} เพิ่มห้องประชุม
            </button>`,
          )}
          <div class="room-admin-grid stagger">
            ${rooms.map(
              (r, i) =>
                html`<article
                  class="room-admin ${r.active ? "" : "off"}"
                  style="--room:${col(r)}"
                  data-id="${r.id}"
                >
                  <div class="room-top">
                    <span class="room-floor"
                      >${icon("layers", "i-sm")} ${r.floor || "-"}</span
                    >
                    <label
                      class="row"
                      style="margin-left:auto;gap:8px;font-size:.88rem"
                      >${r.active ? "เปิดให้บริการ" : "ปิดชั่วคราว"}
                      <span class="switch"
                        ><input
                          type="checkbox"
                          data-active
                          ${r.active ? raw("checked") : ""}
                          aria-label="เปิด/ปิดให้บริการ" /><span
                          class="track"
                        ></span
                        ><span class="thumb"></span></span
                    ></label>
                  </div>
                  <div class="room-title">
                    <div class="room-icon">${icon("door")}</div>
                    <div>
                      <h3>${r.name}</h3>
                      <p>รองรับ ${r.capacity} คน · ${approvalTh[r.approval]}</p>
                    </div>
                  </div>
                  ${r.description
                    ? html`<p class="room-desc">${r.description}</p>`
                    : ""}
                  ${!r.active && r.closedMessage
                    ? html`<div class="notice notice-warning">
                        ${icon("alert")}
                        <div>${r.closedMessage}</div>
                      </div>`
                    : ""}
                  ${r.equipment.length
                    ? html`<div class="chips">
                        ${r.equipment.map(
                          (e) =>
                            html`<span class="chip chip-static">${e}</span>`,
                        )}
                      </div>`
                    : ""}
                  <div class="acts">
                    <button class="btn btn-soft btn-sm" data-edit>
                      ${icon("edit", "i-sm")} แก้ไข
                    </button>
                    <button
                      class="btn btn-ghost btn-icon btn-sm"
                      data-move="-1"
                      ${i === 0 ? raw("disabled") : ""}
                      aria-label="เลื่อนขึ้น"
                      title="เลื่อนขึ้น"
                    >
                      ${icon("chevron-up")}
                    </button>
                    <button
                      class="btn btn-ghost btn-icon btn-sm"
                      data-move="1"
                      ${i === rooms.length - 1 ? raw("disabled") : ""}
                      aria-label="เลื่อนลง"
                      title="เลื่อนลง"
                    >
                      ${icon("chevron-down")}
                    </button>
                    <a
                      class="btn btn-ghost btn-sm"
                      href="/display?room=${encodeURIComponent(r.id)}"
                      target="_blank"
                      rel="noopener"
                      >${icon("tablet", "i-sm")} จอหน้าห้อง</a
                    >
                    <span class="spacer"></span>
                    <button
                      class="btn btn-ghost btn-sm"
                      data-archive
                      style="color:var(--danger)"
                    >
                      ${icon("trash", "i-sm")} นำออก
                    </button>
                  </div>
                </article>`,
            )}
          </div>
          ${rooms.length
            ? ""
            : emptyBox(
                "door",
                "ยังไม่มีห้องประชุม",
                "กดปุ่ม “เพิ่มห้องประชุม” เพื่อเริ่มต้น",
              )}`,
      );
    if (animate) await swap(el, draw, "fade");
    else draw();
    stagger($(".room-admin-grid", el));
    $("#r-add", el).onclick = () => roomForm(null, () => render());
  }

  el.onclick = async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const r = roomOf(card.dataset.id);
    if (e.target.closest("[data-edit]")) return roomForm(r, () => render());
    const mv = e.target.closest("[data-move]");
    if (mv) {
      const ids = A.rooms.filter((x) => !x.archived).map((x) => x.id);
      const i = ids.indexOf(r.id);
      const j = i + Number(mv.dataset.move);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      try {
        await api("/api/admin/rooms/order", { method: "PUT", body: { ids } });
        render(true);
      } catch (err) {
        toastError(err);
      }
      return;
    }
    if (e.target.closest("[data-archive]")) {
      const ok = await confirmDialog({
        title: `นำ${r.name}ออกจากระบบ?`,
        message:
          "ห้องจะไม่แสดงให้จองอีก แต่ประวัติการจองเดิมยังคงอยู่\n(หากต้องการปิดชั่วคราว ให้ใช้สวิตช์ “เปิดให้บริการ” แทน)",
        confirmText: "นำออก",
        danger: true,
      });
      if (!ok) return;
      try {
        await api(`/api/admin/rooms/${r.id}`, { method: "DELETE" });
      } catch (err) {
        if (err.status === 409) {
          const ok2 = await confirmDialog({
            title: "ห้องนี้ยังมีการจองค้างอยู่",
            message: `${err.message}\nต้องการยกเลิกการจองเหล่านั้นและนำห้องออกหรือไม่?`,
            confirmText: "ยกเลิกการจองและนำออก",
            danger: true,
          });
          if (!ok2) return;
          try {
            await api(`/api/admin/rooms/${r.id}?force=1`, { method: "DELETE" });
          } catch (err2) {
            return toastError(err2);
          }
        } else return toastError(err);
      }
      toast(`นำ${r.name}ออกแล้ว`, "success");
      render(true);
    }
  };
  el.onchange = async (e) => {
    if (!e.target.matches("[data-active]")) return;
    const card = e.target.closest("[data-id]");
    const r = roomOf(card.dataset.id);
    const active = e.target.checked;
    let closedMessage = r.closedMessage;
    if (!active) {
      const res = await confirmDialog({
        title: `ปิด${r.name}ชั่วคราว?`,
        message:
          "ผู้ใช้จะจองห้องนี้ไม่ได้จนกว่าจะเปิดอีกครั้ง (การจองเดิมไม่ถูกยกเลิก)",
        confirmText: "ปิดชั่วคราว",
        input: {
          label: "ข้อความแจ้งผู้ใช้ (ไม่บังคับ)",
          placeholder: "เช่น ปิดปรับปรุงระบบปรับอากาศถึงวันที่ 15",
        },
      });
      if (!res) {
        e.target.checked = true;
        return;
      }
      closedMessage = res.value;
    }
    try {
      await api(`/api/admin/rooms/${r.id}`, {
        method: "PUT",
        body: { active, closedMessage },
      });
      toast(
        active ? `เปิดให้บริการ${r.name}แล้ว` : `ปิด${r.name}ชั่วคราวแล้ว`,
        "success",
      );
      render();
    } catch (err) {
      e.target.checked = !active;
      toastError(err);
    }
  };
  ctx.refresh = null;
  await render();
}

function roomForm(r, onSaved) {
  const editing = !!r;
  const used = new Set(A.rooms.filter((x) => !x.archived).map((x) => x.color));
  const d = r
    ? { ...r }
    : {
        name: "",
        floor: "",
        capacity: 10,
        description: "",
        equipment: [],
        color: ROOM_SWATCHES.find((c) => !used.has(c)) || ROOM_SWATCHES[0],
        active: true,
        approval: "inherit",
        closedMessage: "",
      };
  const equip = new Set(d.equipment);
  const opts = [
    ...new Set([...(A.settings.equipmentOptions || []), ...d.equipment]),
  ];
  const body = document.createElement("form");
  body.className = "stack";
  setHTML(
    body,
    html`<div class="form-grid">
      <label class="field" data-f="name"
        ><span>ชื่อห้อง</span
        ><input
          class="input"
          name="name"
          maxlength="80"
          value="${d.name}"
          placeholder="เช่น ห้องประชุมเล็ก"
      /></label>
      <label class="field" data-f="floor"
        ><span>ชั้น / ตำแหน่ง</span
        ><input
          class="input"
          name="floor"
          maxlength="40"
          value="${d.floor}"
          placeholder="เช่น ชั้น 2"
      /></label>
      <label class="field" data-f="capacity"
        ><span>ความจุ (คน)</span
        ><input
          class="input"
          name="capacity"
          type="number"
          min="1"
          max="10000"
          value="${d.capacity}"
      /></label>
      <label class="field" data-f="approval"
        ><span>การอนุมัติ</span
        ><select class="select" name="approval">
          <option
            value="inherit"
            ${d.approval === "inherit" ? raw("selected") : ""}
          >
            ตามค่าระบบ
          </option>
          <option value="yes" ${d.approval === "yes" ? raw("selected") : ""}>
            ต้องอนุมัติเสมอ
          </option>
          <option value="no" ${d.approval === "no" ? raw("selected") : ""}>
            ยืนยันทันทีเสมอ
          </option>
        </select></label
      >
      <label class="field full"
        ><span>คำอธิบาย</span
        ><textarea class="textarea" name="description" rows="2" maxlength="300">
${d.description}</textarea
        >
      </label>
      <div class="field full" data-f="color">
        <span
          >สีประจำห้อง
          <small class="faint"
            >(ชุดสีแนะนำแยกแยะได้ดีแม้ผู้มีภาวะตาบอดสี)</small
          ></span
        >
        <div class="swatches" id="rf-sw">
          ${ROOM_SWATCHES.map(
            (c) =>
              html`<button
                type="button"
                class="swatch ${d.color === c ? "on" : ""}"
                style="--c:${c}"
                data-c="${c}"
                aria-label="สี ${c}"
              ></button>`,
          )}
          <label class="swatch-custom" title="เลือกสีเอง"
            >${icon("palette", "i-sm")}<input type="color" value="${d.color}"
          /></label>
        </div>
      </div>
      <div class="field full">
        <span>อุปกรณ์ที่มีในห้อง</span>
        <div class="chips" id="rf-eq">
          ${opts.map(
            (e) =>
              html`<button
                type="button"
                class="chip"
                data-eq="${e}"
                aria-pressed="${equip.has(e)}"
              >
                <span class="chip-check">${icon("check", "i-sm")}</span>${e}
              </button>`,
          )}
        </div>
      </div>
      <label class="check full"
        ><input
          type="checkbox"
          name="active"
          ${d.active ? raw("checked") : ""}
        /><span>เปิดให้บริการ</span></label
      >
      <label class="field full"
        ><span>ข้อความเมื่อปิดชั่วคราว</span
        ><input
          class="input"
          name="closedMessage"
          maxlength="200"
          value="${d.closedMessage}"
      /></label>
    </div>`,
  );
  const foot = document.createElement("div");
  foot.className = "row";
  setHTML(
    foot,
    html`<button class="btn btn-ghost" data-x>ยกเลิก</button
      ><button class="btn btn-primary" data-ok>
        ${icon("check")} ${editing ? "บันทึก" : "เพิ่มห้อง"}
      </button>`,
  );
  const m = openModal({
    title: editing ? `แก้ไข${r.name}` : "เพิ่มห้องประชุม",
    body,
    footer: foot,
    size: "lg",
  });
  const sw = $("#rf-sw", body);
  sw.onclick = (e) => {
    const b = e.target.closest("[data-c]");
    if (!b) return;
    d.color = b.dataset.c;
    $$(".swatch", sw).forEach((x) => x.classList.toggle("on", x === b));
  };
  sw.querySelector('input[type="color"]').oninput = (e) => {
    d.color = e.target.value;
    $$(".swatch", sw).forEach((x) => x.classList.remove("on"));
  };
  $("#rf-eq", body).onclick = (e) => {
    const c = e.target.closest("[data-eq]");
    if (!c) return;
    if (equip.has(c.dataset.eq)) equip.delete(c.dataset.eq);
    else equip.add(c.dataset.eq);
    c.setAttribute("aria-pressed", String(equip.has(c.dataset.eq)));
  };
  foot.querySelector("[data-x]").onclick = () => m.close();
  foot.querySelector("[data-ok]").onclick = async () => {
    const f = body;
    const payload = {
      name: f.name.value.trim(),
      floor: f.floor.value.trim(),
      capacity: Number(f.capacity.value),
      approval: f.approval.value,
      description: f.description.value.trim(),
      color: d.color,
      equipment: [...equip],
      active: f.active.checked,
      closedMessage: f.closedMessage.value.trim(),
    };
    try {
      if (editing)
        await api(`/api/admin/rooms/${r.id}`, { method: "PUT", body: payload });
      else await api("/api/admin/rooms", { method: "POST", body: payload });
      m.close();
      toast(
        editing ? "บันทึกข้อมูลห้องแล้ว" : "เพิ่มห้องประชุมแล้ว",
        "success",
      );
      onSaved?.();
    } catch (err) {
      const fields = err.data?.fields || {};
      Object.keys(fields).forEach((k) => {
        const fe = body.querySelector(`[data-f="${k}"]`);
        fe?.classList.add("invalid");
        shake(fe);
      });
      toastError(err);
    }
  };
}

// ------------------------------------------------------------------ DEPARTMENTS & HOLIDAYS
async function secData(el, ctx) {
  let depts = [...A.departments];
  let hols = [...A.holidays];
  let year = Number(bkkNow().date.slice(0, 4));
  setHTML(
    el,
    html`${sectionHead(
        "หน่วยงานและวันหยุด",
        "รายชื่อหน่วยงานใช้ในแบบฟอร์มจอง · วันหยุดราชการจะปิดการจองอัตโนมัติ (ตั้งค่าได้)",
      )}
      <div class="split">
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("building")} รายชื่อหน่วยงาน</h3>
            <span class="spacer"></span><small id="d-count"></small>
          </div>
          <form class="tag-add" id="d-add" style="max-width:none">
            <input
              class="input"
              name="v"
              maxlength="120"
              placeholder="เพิ่มหน่วยงาน เช่น ฝ่ายทะเบียน"
            /><button class="btn btn-soft" type="submit">
              ${icon("plus")} เพิ่ม
            </button>
          </form>
          <div class="edit-list" id="d-list"></div>
          <button class="btn btn-primary" id="d-save">
            ${icon("check")} บันทึกรายชื่อหน่วยงาน
          </button>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("calendar-x")} วันหยุดราชการ</h3>
            <span class="spacer"></span>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-y="-1"
              aria-label="ปีก่อน"
            >
              ${icon("chevron-left")}</button
            ><b id="h-year"></b>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-y="1"
              aria-label="ปีถัดไป"
            >
              ${icon("chevron-right")}
            </button>
          </div>
          <form class="row-wrap" id="h-add">
            <input
              class="input"
              type="date"
              name="date"
              required
              style="max-width:180px"
            /><input
              class="input"
              name="name"
              maxlength="100"
              placeholder="ชื่อวันหยุด"
              required
              style="flex:1;min-width:160px"
            />
            <button class="btn btn-soft" type="submit">
              ${icon("plus")} เพิ่ม
            </button>
          </form>
          <div class="notice">
            ${icon("info")}
            <div>
              วันหยุดตามจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา)
              และวันหยุดชดเชย/วันหยุดพิเศษ เปลี่ยนทุกปี กรุณาเพิ่มเองตามประกาศ
            </div>
          </div>
          <button class="btn btn-soft" id="h-fixed">
            ${icon("sparkles")} เติมวันหยุดที่วันที่ตายตัวของปีนี้
          </button>
          <div class="edit-list" id="h-list"></div>
          <button class="btn btn-primary" id="h-save">
            ${icon("check")} บันทึกวันหยุด
          </button>
        </section>
      </div>`,
  );
  const renderDepts = () => {
    $("#d-count", el).textContent = `${depts.length} หน่วยงาน`;
    setHTML(
      $("#d-list", el),
      depts.map(
        (d, i) =>
          html`<div class="edit-item" data-i="${i}">
            <span class="grow">${d}</span>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-mv="-1"
              ${i === 0 ? raw("disabled") : ""}
              aria-label="ขึ้น"
            >
              ${icon("chevron-up", "i-sm")}
            </button>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-mv="1"
              ${i === depts.length - 1 ? raw("disabled") : ""}
              aria-label="ลง"
            >
              ${icon("chevron-down", "i-sm")}
            </button>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              data-del
              aria-label="ลบ"
            >
              ${icon("x", "i-sm")}
            </button>
          </div>`,
      ),
    );
  };
  const renderHols = () => {
    $("#h-year", el).textContent = `พ.ศ. ${year + 543}`;
    const list = hols
      .filter((h) => h.date.startsWith(String(year)))
      .sort((a, b) => a.date.localeCompare(b.date));
    setHTML(
      $("#h-list", el),
      list.length
        ? list.map(
            (h) =>
              html`<div class="edit-item" data-date="${h.date}">
                <span class="date">${fmtDate(h.date, "wd-year")}</span
                ><span class="grow">${h.name}</span>
                <button
                  class="btn btn-ghost btn-icon btn-sm"
                  data-del
                  aria-label="ลบ"
                >
                  ${icon("x", "i-sm")}
                </button>
              </div>`,
          )
        : html`<div class="faint small" style="padding:10px">
            ยังไม่มีวันหยุดในปีนี้
          </div>`,
    );
  };
  renderDepts();
  renderHols();
  $("#d-add", el).onsubmit = (e) => {
    e.preventDefault();
    const v = e.target.v.value.trim();
    if (!v) return;
    if (depts.includes(v)) return toast("มีหน่วยงานนี้แล้ว", "warning");
    depts.push(v);
    e.target.reset();
    renderDepts();
  };
  $("#d-list", el).onclick = (e) => {
    const it = e.target.closest("[data-i]");
    if (!it) return;
    const i = Number(it.dataset.i);
    const mv = e.target.closest("[data-mv]");
    if (mv) {
      const j = i + Number(mv.dataset.mv);
      [depts[i], depts[j]] = [depts[j], depts[i]];
      renderDepts();
    } else if (e.target.closest("[data-del]")) {
      it.classList.add("leaving");
      setTimeout(() => {
        depts.splice(i, 1);
        renderDepts();
      }, 180);
    }
  };
  $("#d-save", el).onclick = async () => {
    try {
      const res = await api("/api/admin/departments", {
        method: "PUT",
        body: { departments: depts },
      });
      A.departments = depts = res.departments;
      toast("บันทึกรายชื่อหน่วยงานแล้ว", "success");
    } catch (err) {
      toastError(err);
    }
  };
  $("#h-add", el).onsubmit = (e) => {
    e.preventDefault();
    const date = e.target.date.value;
    const name = e.target.name.value.trim();
    if (!date || !name) return;
    hols = hols.filter((h) => h.date !== date).concat({ date, name });
    year = Number(date.slice(0, 4));
    e.target.reset();
    renderHols();
  };
  $("#h-list", el).onclick = (e) => {
    const it = e.target.closest("[data-date]");
    if (!it || !e.target.closest("[data-del]")) return;
    it.classList.add("leaving");
    setTimeout(() => {
      hols = hols.filter((h) => h.date !== it.dataset.date);
      renderHols();
    }, 180);
  };
  el.addEventListener("click", (e) => {
    const y = e.target.closest("[data-y]");
    if (!y) return;
    year += Number(y.dataset.y);
    renderHols();
  });
  $("#h-fixed", el).onclick = async () => {
    try {
      const res = await api(`/api/admin/holidays/fixed?year=${year}`);
      let added = 0;
      for (const h of res.holidays) {
        if (!hols.some((x) => x.date === h.date)) {
          hols.push(h);
          added++;
        }
      }
      renderHols();
      toast(
        added
          ? `เติมวันหยุด ${added} วัน — อย่าลืมกดบันทึก`
          : "มีวันหยุดเหล่านี้ครบแล้ว",
        added ? "success" : "info",
      );
    } catch (err) {
      toastError(err);
    }
  };
  $("#h-save", el).onclick = async () => {
    try {
      const res = await api("/api/admin/holidays", {
        method: "PUT",
        body: { holidays: hols },
      });
      A.holidays = hols = res.holidays;
      toast("บันทึกวันหยุดแล้ว", "success");
    } catch (err) {
      toastError(err);
    }
  };
}

// ------------------------------------------------------------------ SETTINGS
const SET_GROUPS = [
  {
    id: "org",
    icon: "building",
    title: "ข้อมูลหน่วยงาน",
    desc: "ชื่อและโลโก้ที่แสดงบนทุกหน้า",
    fields: [
      { k: "orgName", label: "ชื่อหน่วยงาน", type: "text" },
      { k: "siteName", label: "ชื่อระบบ", type: "text" },
      {
        k: "subtitle",
        label: "ข้อความรอง",
        hint: "เช่น กรุงเทพมหานคร",
        type: "text",
      },
      {
        k: "contactText",
        label: "ข้อมูลติดต่อ",
        hint: "แสดงท้ายหน้าเว็บและในใบยืนยันการจอง",
        type: "text",
      },
      {
        k: "logo",
        label: "โลโก้หน่วยงาน",
        hint: "PNG / JPG / SVG ขนาดไม่เกิน 300KB (ไม่ใส่ = ใช้สัญลักษณ์เริ่มต้น)",
        type: "logo",
      },
    ],
  },
  {
    id: "announce",
    icon: "megaphone",
    title: "ประกาศหน้าแรก",
    desc: "ข้อความแจ้งผู้ใช้ทุกคนบนหน้าจองห้อง",
    fields: [
      { k: "announcementEnabled", label: "แสดงประกาศ", type: "switch" },
      {
        k: "announcementLevel",
        label: "รูปแบบ",
        type: "seg",
        options: [
          ["info", "ข้อมูล"],
          ["success", "สำเร็จ"],
          ["warning", "เตือน"],
          ["danger", "สำคัญ"],
        ],
      },
      {
        k: "announcementText",
        label: "ข้อความประกาศ",
        type: "textarea",
        rows: 3,
        wide: true,
      },
    ],
  },
  {
    id: "time",
    icon: "clock",
    title: "เวลาและกฎการจอง",
    fields: [
      { k: "openTime", label: "เวลาเปิดให้จอง", type: "time" },
      { k: "closeTime", label: "เวลาปิด", type: "time" },
      {
        k: "slotMinutes",
        label: "ช่วงเวลาย่อย",
        hint: "ความละเอียดของช่องเวลาในการเลือก",
        type: "select",
        options: [
          [10, "10 นาที"],
          [15, "15 นาที"],
          [20, "20 นาที"],
          [30, "30 นาที"],
          [60, "1 ชั่วโมง"],
        ],
      },
      {
        k: "minDurationMinutes",
        label: "จองขั้นต่ำ",
        type: "number",
        suffix: "นาที",
        min: 5,
        max: 1440,
      },
      {
        k: "maxDurationMinutes",
        label: "จองสูงสุดต่อครั้ง",
        type: "number",
        suffix: "นาที",
        min: 10,
        max: 1440,
      },
      {
        k: "bufferMinutes",
        label: "เวลาเว้นระหว่างการประชุม",
        hint: "สำหรับจัดห้องหรือทำความสะอาด (0 = ไม่เว้น)",
        type: "number",
        suffix: "นาที",
        min: 0,
        max: 120,
      },
      {
        k: "advanceDays",
        label: "จองล่วงหน้าได้ไม่เกิน",
        type: "number",
        suffix: "วัน",
        min: 1,
        max: 730,
      },
      {
        k: "minNoticeMinutes",
        label: "ต้องจองก่อนเวลาเริ่มอย่างน้อย",
        type: "number",
        suffix: "นาที",
        min: 0,
        max: 10080,
      },
      {
        k: "allowWeekends",
        label: "เปิดให้จองวันเสาร์–อาทิตย์",
        type: "switch",
      },
      { k: "allowHolidays", label: "เปิดให้จองวันหยุดราชการ", type: "switch" },
    ],
  },
  {
    id: "features",
    icon: "toggle",
    title: "ฟังก์ชันการจอง",
    desc: "เปิด/ปิดความสามารถต่าง ๆ ของระบบ",
    fields: [
      {
        k: "requireApproval",
        label: "ต้องได้รับอนุมัติก่อน",
        hint: "การจองใหม่จะอยู่ในสถานะ “รออนุมัติ” (กำหนดแยกรายห้องได้ที่เมนูห้องประชุม)",
        type: "switch",
      },
      { k: "allowUserEdit", label: "ผู้จองแก้ไขการจองเองได้", type: "switch" },
      {
        k: "allowUserCancel",
        label: "ผู้จองยกเลิกการจองเองได้",
        type: "switch",
      },
      {
        k: "cancelDeadlineMinutes",
        label: "ต้องยกเลิกล่วงหน้าอย่างน้อย",
        hint: "0 = ยกเลิกได้จนถึงเวลาเริ่ม",
        type: "number",
        suffix: "นาที",
        min: 0,
        max: 10080,
      },
      {
        k: "enableRecurring",
        label: "การจองซ้ำ (ทุกสัปดาห์ / ทุกวันทำการ)",
        type: "switch",
      },
      {
        k: "maxRecurring",
        label: "จองซ้ำได้สูงสุด",
        type: "number",
        suffix: "ครั้ง",
        min: 2,
        max: 52,
      },
      {
        k: "enforceCapacity",
        label: "จำกัดผู้เข้าร่วมไม่เกินความจุห้อง",
        type: "switch",
      },
      {
        k: "requirePhone",
        label: "บังคับกรอกเบอร์โทร",
        hint: "ใช้ค้นหาการจองจากอุปกรณ์อื่น",
        type: "switch",
      },
      { k: "requireEmail", label: "บังคับกรอกอีเมล", type: "switch" },
      {
        k: "maxActivePerPhone",
        label: "การจองที่ยังไม่ถึงกำหนดสูงสุดต่อเบอร์โทร",
        hint: "0 = ไม่จำกัด",
        type: "number",
        suffix: "รายการ",
        min: 0,
        max: 500,
      },
      {
        k: "bookingRateLimitPerHour",
        label: "ป้องกันการจองถี่ผิดปกติ",
        hint: "จำนวนครั้งต่อชั่วโมงต่อเครื่อง",
        type: "number",
        suffix: "ครั้ง/ชม.",
        min: 1,
        max: 1000,
      },
    ],
  },
  {
    id: "privacy",
    icon: "eye",
    title: "ความเป็นส่วนตัว",
    desc: "เบอร์โทรและอีเมลของผู้จองจะไม่แสดงต่อสาธารณะเสมอ",
    fields: [
      {
        k: "showTitlePublic",
        label: "แสดงหัวข้อการประชุมในปฏิทิน",
        type: "switch",
      },
      {
        k: "showOrganizerPublic",
        label: "แสดงชื่อผู้จองในปฏิทิน",
        type: "switch",
      },
    ],
  },
  {
    id: "checkin",
    icon: "check-circle",
    title: "เช็คอินและคืนห้องอัตโนมัติ",
    desc: "ลดปัญหา “จองแล้วไม่มาใช้ห้อง”",
    fields: [
      {
        k: "checkinEnabled",
        label: "เปิดใช้การเช็คอิน",
        hint: "เช็คอินได้จากจอหน้าห้องหรือมือถือของผู้จอง",
        type: "switch",
      },
      {
        k: "checkinWindowMinutes",
        label: "เช็คอินได้ก่อนเวลาเริ่ม",
        type: "number",
        suffix: "นาที",
        min: 0,
        max: 120,
      },
      {
        k: "autoReleaseMinutes",
        label: "คืนห้องอัตโนมัติหากไม่เช็คอินภายใน",
        hint: "นับจากเวลาเริ่ม (0 = ไม่คืนห้องอัตโนมัติ)",
        type: "number",
        suffix: "นาที",
        min: 0,
        max: 240,
      },
    ],
  },
  {
    id: "options",
    icon: "monitor",
    title: "อุปกรณ์และบริการเสริม",
    desc: "ตัวเลือกที่ผู้จองกดขอได้ในแบบฟอร์ม",
    fields: [
      { k: "equipmentOptions", label: "อุปกรณ์", type: "tags", wide: true },
      { k: "serviceOptions", label: "บริการเสริม", type: "tags", wide: true },
    ],
  },
  {
    id: "terms",
    icon: "shield",
    title: "ระเบียบการใช้ห้องประชุม",
    desc: "ผู้จองต้องกดยอมรับก่อนยืนยัน (เว้นว่าง = ไม่แสดง)",
    fields: [
      {
        k: "termsText",
        label: "ข้อความระเบียบ",
        type: "textarea",
        rows: 6,
        wide: true,
      },
    ],
  },
  {
    id: "look",
    icon: "palette",
    title: "รูปลักษณ์และเอฟเฟกต์",
    desc: "สีธีม ทรานซิชัน และเอฟเฟกต์เมื่อกดปุ่ม (ผู้ใช้แต่ละคนปรับเพิ่มเติมได้จากเมนูตั้งค่าการแสดงผล)",
    fields: [
      { k: "themeColor", label: "สีหลักของระบบ", type: "brand" },
      {
        k: "defaultThemeMode",
        label: "ธีมเริ่มต้น",
        type: "seg",
        options: [
          ["auto", "ตามอุปกรณ์"],
          ["light", "สว่าง"],
          ["dark", "มืด"],
        ],
      },
      {
        k: "motionLevel",
        label: "เอฟเฟกต์การเคลื่อนไหว",
        hint: "ทรานซิชันเปลี่ยนหน้า, ripple เมื่อกดปุ่ม, แอนิเมชัน",
        type: "seg",
        options: [
          ["full", "เต็มรูปแบบ"],
          ["reduced", "เรียบง่าย"],
          ["off", "ปิด"],
        ],
      },
      {
        k: "hapticFeedback",
        label: "สั่นเบา ๆ เมื่อกดปุ่ม",
        hint: "รองรับมือถือ Android",
        type: "switch",
      },
      {
        k: "clickSound",
        label: "เสียงคลิกเมื่อกดปุ่ม (ค่าเริ่มต้น)",
        type: "switch",
      },
      {
        k: "confettiOnBooking",
        label: "พลุกระดาษฉลองเมื่อจองสำเร็จ",
        type: "switch",
      },
    ],
    extra: true,
  },
  {
    id: "display",
    icon: "tablet",
    title: "จอแสดงผลหน้าห้อง",
    desc: "สำหรับแท็บเล็ตติดหน้าห้องประชุม (เมนู “การเชื่อมต่อและ QR”)",
    fields: [
      { k: "displayEnabled", label: "เปิดใช้จอแสดงผลหน้าห้อง", type: "switch" },
      {
        k: "displayShowTitle",
        label: "แสดงหัวข้อการประชุมบนจอ",
        type: "switch",
      },
    ],
  },
  {
    id: "system",
    icon: "server",
    title: "ระบบและความปลอดภัย",
    fields: [
      {
        k: "maintenanceMode",
        label: "ปิดรับการจองชั่วคราว (โหมดปรับปรุง)",
        hint: "ผู้ใช้ยังดูปฏิทินได้ แต่จองใหม่ไม่ได้",
        type: "switch",
      },
      {
        k: "maintenanceMessage",
        label: "ข้อความแจ้งเมื่อปิดรับการจอง",
        type: "textarea",
        rows: 2,
        wide: true,
      },
      {
        k: "adminNotifySound",
        label: "เสียงแจ้งเตือนเมื่อมีคำขอจองใหม่",
        hint: "ดังบนหน้าผู้ดูแลที่เปิดค้างไว้",
        type: "switch",
      },
      {
        k: "sessionHours",
        label: "ออกจากระบบอัตโนมัติเมื่อไม่ใช้งาน",
        type: "number",
        suffix: "ชั่วโมง",
        min: 1,
        max: 168,
      },
      {
        k: "logRetentionDays",
        label: "เก็บบันทึกกิจกรรม",
        type: "number",
        suffix: "วัน",
        min: 7,
        max: 3650,
      },
      {
        k: "backupKeepDays",
        label: "เก็บไฟล์สำรองอัตโนมัติ",
        type: "number",
        suffix: "วัน",
        min: 1,
        max: 365,
      },
    ],
  },
];

async function secSettings(el, ctx) {
  try {
    A.settings = (await api("/api/admin/settings")).settings;
  } catch (err) {
    toastError(err);
  }
  const orig = JSON.parse(JSON.stringify(A.settings));
  let draft = JSON.parse(JSON.stringify(A.settings));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const changed = () =>
    Object.keys(draft).filter((k) => !same(draft[k], orig[k]));
  ctx.dirty = () => changed().length > 0;

  function control(fd) {
    const v = draft[fd.k];
    switch (fd.type) {
      case "switch":
        return html`<span class="switch"
          ><input
            type="checkbox"
            data-k="${fd.k}"
            ${v ? raw("checked") : ""}
            aria-label="${fd.label}" /><span class="track"></span
          ><span class="thumb"></span
        ></span>`;
      case "text":
        return html`<input class="input" data-k="${fd.k}" value="${v}" />`;
      case "textarea":
        return html`<textarea
          class="textarea"
          data-k="${fd.k}"
          rows="${fd.rows || 3}"
        >
${v}</textarea
        >`;
      case "number":
        return html`<input
            class="input num"
            type="number"
            data-k="${fd.k}"
            value="${v}"
            min="${fd.min}"
            max="${fd.max}"
          />${fd.suffix ? html`<span class="suffix">${fd.suffix}</span>` : ""}`;
      case "time":
        return html`<input
          class="input num"
          type="time"
          step="300"
          data-k="${fd.k}"
          value="${v}"
        />`;
      case "select":
        return html`<select class="select" data-k="${fd.k}">
          ${fd.options.map(
            ([val, label]) =>
              html`<option
                value="${val}"
                ${String(val) === String(v) ? raw("selected") : ""}
              >
                ${label}
              </option>`,
          )}
        </select>`;
      case "seg":
        return html`<div class="seg" data-seg="${fd.k}">
          ${fd.options.map(
            ([val, label]) =>
              html`<button
                type="button"
                data-value="${val}"
                aria-selected="${val === v}"
              >
                ${label}
              </button>`,
          )}
        </div>`;
      case "brand":
        return html`<div class="swatches brand-swatches" data-brand-k="${fd.k}">
          ${BRANDS.map(
            ([key, hex, label]) =>
              html`<button
                type="button"
                class="swatch ${v === key ? "on" : ""}"
                style="--sw:${hex}"
                data-v="${key}"
                title="${label}"
                aria-label="${label}"
              ></button>`,
          )}
        </div>`;
      case "tags":
        return html`<div class="tag-editor" data-tags="${fd.k}">
          <div class="tag-list">
            ${v.map(
              (t, i) =>
                html`<span class="tag"
                  >${t}<button
                    type="button"
                    data-rm="${i}"
                    aria-label="ลบ ${t}"
                  >
                    ${icon("x", "i-sm")}
                  </button></span
                >`,
            )}
          </div>
          <div class="tag-add">
            <input
              class="input"
              placeholder="พิมพ์แล้วกด Enter เพื่อเพิ่ม"
              maxlength="60"
            /><button type="button" class="btn btn-soft" data-add>
              ${icon("plus")} เพิ่ม
            </button>
          </div>
        </div>`;
      case "logo":
        return html`<div class="logo-box" data-logo="${fd.k}">
          <div class="logo-prev">
            ${v
              ? html`<img src="${v}" alt="โลโก้" />`
              : icon("building", "i-lg")}
          </div>
          <label class="btn btn-soft btn-sm"
            >${icon("upload", "i-sm")} เลือกไฟล์<input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              hidden
          /></label>
          ${v
            ? html`<button
                type="button"
                class="btn btn-ghost btn-sm"
                data-logo-rm
              >
                ${icon("trash", "i-sm")} ลบโลโก้
              </button>`
            : ""}
        </div>`;
      default:
        return "";
    }
  }

  function rowHtml(fd) {
    const cls = [
      fd.wide ? "wide" : "",
      fd.type === "switch" ? "switch-row" : "",
      same(draft[fd.k], orig[fd.k]) ? "" : "changed",
    ].join(" ");
    return html`<div class="set-row ${cls}" data-row="${fd.k}">
      <div class="lbl">
        <b>${fd.label}</b>${fd.hint ? html`<small>${fd.hint}</small>` : ""}
      </div>
      <div class="ctl">${control(fd)}</div>
    </div>`;
  }

  setHTML(
    el,
    html`${sectionHead(
        "ตั้งค่าและฟังก์ชัน",
        "ปรับแต่งการทำงานของระบบ การเปลี่ยนแปลงมีผลกับทุกอุปกรณ์ทันทีหลังบันทึก และถูกบันทึกใน Log",
      )}
      <div class="set-jump" id="s-jump">
        ${SET_GROUPS.map(
          (g) =>
            html`<button class="chip" data-jump="${g.id}">
              ${icon(g.icon, "i-sm")} ${g.title}
            </button>`,
        )}
      </div>
      <div class="set-sections stagger">
        ${SET_GROUPS.map(
          (g) =>
            html`<section class="card set-card" id="set-${g.id}">
              <header>
                <span class="k-ic">${icon(g.icon)}</span>
                <div>
                  <h3>${g.title}</h3>
                  ${g.desc ? html`<p>${g.desc}</p>` : ""}
                </div>
              </header>
              ${g.fields.map(rowHtml)}
              ${g.extra
                ? html`<div class="row-wrap" style="padding-top:12px">
                    <button class="btn btn-soft" id="s-preview">
                      ${icon("sparkles")} ทดลองเอฟเฟกต์
                    </button>
                  </div>`
                : ""}
            </section>`,
        )}
      </div>
      <div
        class="savebar"
        id="s-bar"
        role="region"
        aria-label="บันทึกการตั้งค่า"
      >
        <b>${icon("edit", "i-sm")} <span id="s-count"></span></b>
        <button class="btn btn-ghost btn-sm" id="s-reset">
          ยกเลิกการเปลี่ยนแปลง
        </button>
        <button class="btn btn-primary btn-sm" id="s-save">
          ${icon("check", "i-sm")} บันทึก
        </button>
      </div>`,
  );
  stagger($(".set-sections", el));
  $$(".seg", el).forEach((s2) => initSeg(s2));

  const fieldDef = (k) =>
    SET_GROUPS.flatMap((g) => g.fields).find((x) => x.k === k);
  function refreshRow(k) {
    const rowEl = el.querySelector(`[data-row="${k}"]`);
    if (!rowEl) return;
    rowEl.classList.toggle("changed", !same(draft[k], orig[k]));
    rowEl.classList.remove("err");
    const n = changed().length;
    $("#s-count", el).textContent = `แก้ไข ${n} รายการ (ยังไม่บันทึก)`;
    $("#s-bar", el).classList.toggle("show", n > 0);
  }
  function rerenderRow(k) {
    const rowEl = el.querySelector(`[data-row="${k}"]`);
    const tmp = document.createElement("div");
    setHTML(tmp, rowHtml(fieldDef(k)));
    rowEl.replaceWith(tmp.firstElementChild);
    $$(`[data-row="${k}"] .seg`, el).forEach((s2) => initSeg(s2));
    refreshRow(k);
  }
  const preview = () => {
    // แสดงผลรูปลักษณ์ทันทีที่ปรับ (ยังไม่บันทึก)
    applyAppearance({ ...draft });
  };

  el.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const fd = fieldDef(k);
    if (fd.type === "switch") draft[k] = e.target.checked;
    else if (fd.type === "number")
      draft[k] = e.target.value === "" ? "" : Number(e.target.value);
    else if (fd.type === "select")
      draft[k] =
        typeof orig[k] === "number" ? Number(e.target.value) : e.target.value;
    else draft[k] = e.target.value;
    refreshRow(k);
  });
  el.addEventListener("change", (e) => {
    const logo = e.target.closest("[data-logo]");
    if (logo && e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > 290 * 1024) {
        toast("ไฟล์ใหญ่เกินไป (ไม่เกินประมาณ 300KB)", "warning");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        draft.logo = reader.result;
        rerenderRow("logo");
      };
      reader.readAsDataURL(file);
    }
  });
  el.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump]");
    if (jump) {
      $(`#set-${jump.dataset.jump}`, el).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    const segBtn = e.target.closest("[data-seg] button");
    if (segBtn) {
      const k = segBtn.closest("[data-seg]").dataset.seg;
      draft[k] = segBtn.dataset.value;
      segSelect(segBtn.parentElement, draft[k]);
      refreshRow(k);
      if (k === "defaultThemeMode" || k === "motionLevel") preview();
      return;
    }
    const sw = e.target.closest("[data-brand-k] .swatch");
    if (sw) {
      const k = sw.closest("[data-brand-k]").dataset.brandK;
      draft[k] = sw.dataset.v;
      $$(".swatch", sw.parentElement).forEach((x) =>
        x.classList.toggle("on", x === sw),
      );
      refreshRow(k);
      preview();
      return;
    }
    const tags = e.target.closest("[data-tags]");
    if (tags) {
      const k = tags.dataset.tags;
      const rm = e.target.closest("[data-rm]");
      if (rm) {
        draft[k] = draft[k].filter((_, i) => i !== Number(rm.dataset.rm));
        rerenderRow(k);
      } else if (e.target.closest("[data-add]")) addTag(tags);
      return;
    }
    if (e.target.closest("[data-logo-rm]")) {
      draft.logo = "";
      rerenderRow("logo");
      return;
    }
    if (e.target.closest("#s-preview")) {
      toast(
        "นี่คือตัวอย่างข้อความแจ้งเตือน พร้อมเอฟเฟกต์การเคลื่อนไหว",
        "success",
        { title: "ทดลองเอฟเฟกต์" },
      );
      confetti();
    }
  });
  function addTag(tags) {
    const k = tags.dataset.tags;
    const inp = tags.querySelector("input");
    const v = inp.value.trim();
    if (!v) return;
    if (draft[k].includes(v)) {
      shake(inp);
      return;
    }
    draft[k] = [...draft[k], v];
    rerenderRow(k);
    el.querySelector(`[data-tags="${k}"] input`).focus();
  }
  el.addEventListener("keydown", (e) => {
    const tags = e.target.closest("[data-tags]");
    if (tags && e.key === "Enter") {
      e.preventDefault();
      addTag(tags);
    }
  });
  $("#s-reset", el).onclick = () => {
    draft = JSON.parse(JSON.stringify(orig));
    applyAppearance(orig);
    current.dirty = () => false;
    current.el = null;
    route();
  };
  $("#s-save", el).onclick = async (e) => {
    const keys = changed();
    if (!keys.length) return;
    const payload = {};
    keys.forEach((k) => (payload[k] = draft[k]));
    const btn = e.currentTarget;
    btn.classList.add("is-loading");
    try {
      const res = await api("/api/admin/settings", {
        method: "PUT",
        body: { settings: payload },
      });
      A.settings = res.settings;
      Object.assign(orig, JSON.parse(JSON.stringify(res.settings)));
      draft = JSON.parse(JSON.stringify(res.settings));
      keys.forEach(refreshRow);
      store.set("br.cfg.appearance", {
        themeColor: res.settings.themeColor,
        defaultThemeMode: res.settings.defaultThemeMode,
        motionLevel: res.settings.motionLevel,
      });
      applyAppearance(res.settings);
      toast(`บันทึกการตั้งค่า ${keys.length} รายการเรียบร้อย`, "success");
      if (keys.some((k) => ["orgName", "logo", "siteName"].includes(k)))
        renderShellKeep();
    } catch (err) {
      const k = err.data?.field;
      if (k) {
        const rowEl = el.querySelector(`[data-row="${k}"]`);
        rowEl?.classList.add("err");
        rowEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        shake(rowEl);
      }
      toastError(err);
    } finally {
      btn.classList.remove("is-loading");
    }
  };
  ctx.cleanup = () => {
    if (changed().length) applyAppearance(orig);
  };
}

function renderShellKeep() {
  const s = A.settings;
  const mark = $(".side-brand .brand-mark");
  if (mark)
    setHTML(mark, s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM);
  const org = $(".side-brand small");
  if (org) org.textContent = s.orgName;
  updatePending();
}

// ------------------------------------------------------------------ USERS
async function secUsers(el, ctx) {
  async function render() {
    let users = [];
    try {
      users = (await api("/api/admin/users")).users;
    } catch (err) {
      return toastError(err);
    }
    if (current !== ctx) return;
    setHTML(
      el,
      html`${sectionHead(
          "ผู้ใช้งานระบบ",
          "ผู้ดูแลระบบ: จัดการได้ทุกเมนู · เจ้าหน้าที่: ดูแดชบอร์ดและจัดการ/อนุมัติการจองเท่านั้น",
          html`<button class="btn btn-primary" id="u-add">
            ${icon("plus")} เพิ่มผู้ใช้
          </button>`,
        )}
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>ผู้ใช้</th>
                <th>สิทธิ์</th>
                <th>สถานะ</th>
                <th>เข้าสู่ระบบล่าสุด</th>
                <th style="text-align:right">จัดการ</th>
              </tr>
            </thead>
            <tbody class="stagger">
              ${users.map(
                (u) =>
                  html`<tr data-id="${u.id}">
                    <td>
                      <div class="row">
                        <span class="avatar"
                          >${(u.name || u.username).slice(0, 1)}</span
                        >
                        <div>
                          <b>${u.name}</b>${u.id === A.me.id
                            ? html` <span class="badge badge-brand">คุณ</span>`
                            : ""}
                          <div class="t-sub">@${u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      ${u.role === "admin"
                        ? html`<span class="badge badge-brand"
                            >${icon("shield")} ผู้ดูแลระบบ</span
                          >`
                        : html`<span class="badge badge-info"
                            >${icon("user")} เจ้าหน้าที่</span
                          >`}
                    </td>
                    <td>
                      ${u.active
                        ? html`<span class="badge badge-ok"
                            >${icon("check")} ใช้งาน</span
                          >`
                        : html`<span class="badge badge-cancelled"
                            >${icon("ban")} ปิดใช้งาน</span
                          >`}
                      ${u.mustChange
                        ? html`<div class="t-sub">รอเปลี่ยนรหัสผ่าน</div>`
                        : ""}
                    </td>
                    <td class="nowrap">
                      ${u.lastLogin
                        ? html`${timeAgo(u.lastLogin)}
                            <div class="t-sub">
                              ${fmtDateTime(u.lastLogin)}
                            </div>`
                        : html`<span class="faint">ยังไม่เคย</span>`}
                    </td>
                    <td>
                      <div class="row-acts">
                        <button class="btn btn-ghost btn-sm" data-edit>
                          ${icon("edit", "i-sm")} แก้ไข
                        </button>
                        ${u.id !== A.me.id
                          ? html`<button
                              class="btn btn-ghost btn-icon btn-sm"
                              data-del
                              style="color:var(--danger)"
                              aria-label="ลบ"
                            >
                              ${icon("trash", "i-sm")}
                            </button>`
                          : ""}
                      </div>
                    </td>
                  </tr>`,
              )}
            </tbody>
          </table>
        </div>`,
    );
    stagger($("tbody", el));
    $("#u-add", el).onclick = () => userForm(null, render);
    el.onclick = async (e) => {
      const tr = e.target.closest("[data-id]");
      if (!tr) return;
      const u = users.find((x) => x.id === tr.dataset.id);
      if (e.target.closest("[data-edit]")) userForm(u, render);
      else if (e.target.closest("[data-del]")) {
        const ok = await confirmDialog({
          title: `ลบผู้ใช้ ${u.username}?`,
          message: "ผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบได้อีก",
          confirmText: "ลบผู้ใช้",
          danger: true,
          iconName: "trash",
        });
        if (!ok) return;
        try {
          await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
          toast("ลบผู้ใช้แล้ว", "success");
          render();
        } catch (err) {
          toastError(err);
        }
      }
    };
  }
  await render();
}

function userForm(u, onSaved) {
  const editing = !!u;
  const self = editing && u.id === A.me.id;
  const body = document.createElement("form");
  body.className = "stack";
  setHTML(
    body,
    html`<label class="field" data-f="username"
        ><span>ชื่อผู้ใช้ (ภาษาอังกฤษ)</span
        ><input
          class="input"
          name="username"
          value="${u?.username || ""}"
          ${editing ? raw("disabled") : ""}
          autocapitalize="none"
          placeholder="เช่น somchai.k"
      /></label>
      <label class="field" data-f="name"
        ><span>ชื่อ–นามสกุล</span
        ><input class="input" name="name" value="${u?.name || ""}"
      /></label>
      <label class="field"
        ><span>สิทธิ์</span
        ><select class="select" name="role" ${self ? raw("disabled") : ""}>
          <option value="staff" ${u?.role === "staff" ? raw("selected") : ""}>
            เจ้าหน้าที่ — จัดการ/อนุมัติการจอง
          </option>
          <option value="admin" ${u?.role === "admin" ? raw("selected") : ""}>
            ผู้ดูแลระบบ — ทุกเมนู
          </option>
        </select></label
      >
      ${editing && !self
        ? html`<label class="check"
            ><input
              type="checkbox"
              name="active"
              ${u.active ? raw("checked") : ""}
            /><span>เปิดใช้งานบัญชี</span></label
          >`
        : ""}
      <label class="field" data-f="password"
        ><span
          >${editing
            ? "ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
            : "รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัวอักษร)"}</span
        >
        <input
          class="input"
          name="password"
          type="text"
          autocomplete="new-password"
          placeholder="${editing
            ? ""
            : "ผู้ใช้จะถูกให้เปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก"}"
      /></label>`,
  );
  const foot = document.createElement("div");
  foot.className = "row";
  setHTML(
    foot,
    html`<button class="btn btn-ghost" data-x>ยกเลิก</button
      ><button class="btn btn-primary" data-ok>
        ${icon("check")} บันทึก
      </button>`,
  );
  const m = openModal({
    title: editing ? `แก้ไขผู้ใช้ ${u.username}` : "เพิ่มผู้ใช้",
    body,
    footer: foot,
    size: "sm",
  });
  foot.querySelector("[data-x]").onclick = () => m.close();
  foot.querySelector("[data-ok]").onclick = async () => {
    const f = body;
    const payload = { name: f.name.value.trim(), role: f.role.value };
    if (f.password.value) payload.password = f.password.value;
    if (f.active) payload.active = f.active.checked;
    if (self) delete payload.role;
    try {
      if (editing)
        await api(`/api/admin/users/${u.id}`, { method: "PUT", body: payload });
      else
        await api("/api/admin/users", {
          method: "POST",
          body: {
            ...payload,
            username: f.username.value.trim().toLowerCase(),
            password: f.password.value,
          },
        });
      m.close();
      toast(editing ? "บันทึกข้อมูลผู้ใช้แล้ว" : "เพิ่มผู้ใช้แล้ว", "success");
      if (self) A.me.name = payload.name;
      onSaved?.();
    } catch (err) {
      const fields = err.data?.fields || {};
      Object.entries(fields).forEach(([k, v]) => {
        const fe = body.querySelector(`[data-f="${k}"]`);
        if (!fe) return;
        fe.classList.add("invalid");
        fe.insertAdjacentHTML("beforeend", "<span class='field-error'></span>");
        fe.lastElementChild.textContent = v;
      });
      toastError(err);
    }
  };
}

// ------------------------------------------------------------------ LOGS
const ACTION_TH = {
  "booking.create": "สร้างการจอง",
  "booking.block": "ปิดใช้ห้อง",
  "booking.update": "แก้ไขการจอง",
  "booking.cancel": "ยกเลิกการจอง",
  "booking.approve": "อนุมัติการจอง",
  "booking.reject": "ไม่อนุมัติการจอง",
  "booking.status": "เปลี่ยนสถานะ",
  "booking.delete": "ลบการจอง",
  "booking.checkin": "เช็คอิน",
  "booking.end": "คืนห้องก่อนเวลา",
  "booking.release": "คืนห้องอัตโนมัติ",
  "booking.lookup": "ค้นหาการจอง",
  "booking.lookup_fail": "ค้นหาการจองไม่พบ",
  "booking.bulk_approve": "อนุมัติหลายรายการ",
  "booking.bulk_reject": "ไม่อนุมัติหลายรายการ",
  "booking.bulk_cancel": "ยกเลิกหลายรายการ",
  "booking.bulk_delete": "ลบหลายรายการ",
  "booking.bulk_pending": "ตั้งรออนุมัติหลายรายการ",
  "admin.login": "เข้าสู่ระบบ",
  "admin.login_fail": "เข้าสู่ระบบไม่สำเร็จ",
  "admin.logout": "ออกจากระบบ",
  "admin.password": "เปลี่ยนรหัสผ่าน",
  "settings.update": "แก้ไขการตั้งค่า",
  "room.create": "เพิ่มห้อง",
  "room.update": "แก้ไขห้อง",
  "room.archive": "นำห้องออก",
  "room.reorder": "จัดลำดับห้อง",
  "departments.update": "แก้ไขหน่วยงาน",
  "holidays.update": "แก้ไขวันหยุด",
  "user.create": "เพิ่มผู้ใช้",
  "user.update": "แก้ไขผู้ใช้",
  "user.delete": "ลบผู้ใช้",
  "system.start": "เริ่มระบบ",
  "system.backup": "สำรองข้อมูล",
  "system.restore": "กู้คืนข้อมูล",
  "system.error": "ข้อผิดพลาดของระบบ",
  "logs.clear": "ลบบันทึกกิจกรรม",
  "export.csv": "ส่งออก CSV",
};
const LEVEL = {
  info: ["info", "ทั่วไป"],
  warn: ["alert", "คำเตือน"],
  security: ["shield", "ความปลอดภัย"],
  error: ["x-circle", "ข้อผิดพลาด"],
};
const ACTOR_TH = {
  public: "ผู้ใช้",
  admin: "ผู้ดูแล",
  system: "ระบบ",
  kiosk: "จอหน้าห้อง",
};

async function secLogs(el, ctx) {
  const st = {
    q: "",
    action: "",
    level: "",
    from: "",
    to: "",
    page: 1,
    size: 50,
    live: true,
  };
  let data = null;
  let lastTopId = 0;
  setHTML(
    el,
    html`${sectionHead(
        "บันทึกกิจกรรม (Log)",
        "ทุกการจอง แก้ไข อนุมัติ ยกเลิก การเข้าสู่ระบบ และการเปลี่ยนการตั้งค่า ถูกบันทึกพร้อมเวลา ผู้ทำรายการ และ IP",
        html`<div class="row-wrap">
          <button class="btn btn-soft" id="l-csv">
            ${icon("download")} ส่งออก CSV
          </button>
          <button class="btn btn-danger-soft" id="l-clear">
            ${icon("trash")} ล้างบันทึกเก่า
          </button>
        </div>`,
      )}
      <div class="quick lvl-chips" id="l-levels"></div>
      <div class="toolbar card" style="padding:12px">
        <label class="field grow"
          ><span>ค้นหา</span>
          <div class="input-icon">
            ${icon("search")}<input
              class="input"
              id="l-q"
              placeholder="รหัสการจอง ชื่อผู้ใช้ IP รายละเอียด"
            /></div
        ></label>
        <label class="field"
          ><span>ประเภท</span
          ><select class="select" id="l-action">
            <option value="">ทั้งหมด</option>
            <option value="booking.">การจอง</option>
            <option value="admin.">การเข้าสู่ระบบ</option>
            <option value="settings.">การตั้งค่า</option>
            <option value="room.">ห้องประชุม</option>
            <option value="user.">ผู้ใช้งาน</option>
            <option value="system.">ระบบ</option>
          </select></label
        >
        <label class="field"
          ><span>ตั้งแต่</span><input class="input" type="date" id="l-from"
        /></label>
        <label class="field"
          ><span>ถึง</span><input class="input" type="date" id="l-to"
        /></label>
        <label class="check" style="align-self:center"
          ><input type="checkbox" id="l-live" checked /><span
            >อัปเดตอัตโนมัติ</span
          ></label
        >
      </div>
      <div id="l-list"></div>`,
  );
  const params = () => {
    const p = new URLSearchParams();
    for (const k of ["q", "action", "level", "from", "to"])
      if (st[k]) p.set(k, st[k]);
    p.set("page", st.page);
    p.set("size", st.size);
    return p;
  };
  function render(animate) {
    setHTML(
      $("#l-levels", el),
      html`<button class="chip" data-lv="" aria-pressed="${!st.level}">
          ทั้งหมด <b>${data.totalAll}</b>
        </button>
        ${Object.entries(LEVEL).map(
          ([k, [ic, label]]) =>
            html`<button
              class="chip"
              data-lv="${k}"
              aria-pressed="${st.level === k}"
            >
              ${icon(ic, "i-sm")} ${label} <b>${data.levels[k] || 0}</b>
            </button>`,
        )}`,
    );
    const box = $("#l-list", el);
    const draw = () => {
      if (!data.items.length)
        return setHTML(
          box,
          emptyBox("file-text", "ไม่พบบันทึกกิจกรรม", "ลองเปลี่ยนตัวกรอง"),
        );
      setHTML(
        box,
        html`<div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th></th>
                  <th>เวลา</th>
                  <th>การกระทำ</th>
                  <th>ผู้กระทำ</th>
                  <th>รายละเอียด</th>
                  <th>IP / อุปกรณ์</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map(
                  (l) =>
                    html`<tr
                      class="${l.id > lastTopId && lastTopId ? "log-new" : ""}"
                    >
                      <td>
                        <span
                          class="lvl ${l.level}"
                          title="${LEVEL[l.level]?.[1] || l.level}"
                          >${icon(LEVEL[l.level]?.[0] || "info", "i-sm")}</span
                        >
                      </td>
                      <td class="nowrap">
                        <b>${fmtDateTime(l.ts)}</b>
                        <div class="t-sub">${timeAgo(l.ts)}</div>
                      </td>
                      <td class="nowrap">
                        ${ACTION_TH[l.action] || l.action}
                        <div class="t-sub mono">${l.action}</div>
                      </td>
                      <td class="nowrap">
                        ${l.actor}
                        <div class="t-sub">
                          ${ACTOR_TH[l.actorType] || l.actorType}
                        </div>
                      </td>
                      <td><div class="log-detail">${l.detail}</div></td>
                      <td class="nowrap">
                        <span class="mono small">${l.ip || "-"}</span>
                        <div class="t-sub" title="${l.ua}">
                          ${shortUa(l.ua)}
                        </div>
                      </td>
                    </tr>`,
                )}
              </tbody>
            </table>
          </div>
          <div class="pager">
            <span>${data.total.toLocaleString("th-TH")} รายการ</span>
            <div class="row">
              <button
                class="btn btn-sm"
                data-page="${data.page - 1}"
                ${data.page <= 1 ? raw("disabled") : ""}
              >
                ${icon("chevron-left", "i-sm")} ใหม่กว่า
              </button>
              <span>หน้า ${data.page}/${data.pages}</span>
              <button
                class="btn btn-sm"
                data-page="${data.page + 1}"
                ${data.page >= data.pages ? raw("disabled") : ""}
              >
                เก่ากว่า ${icon("chevron-right", "i-sm")}
              </button>
            </div>
          </div>`,
      );
    };
    if (animate) swap(box, draw, "fade");
    else draw();
    if (data.items[0] && st.page === 1)
      lastTopId = Math.max(lastTopId, data.items[0].id);
  }
  async function load(animate = true) {
    try {
      data = await api(`/api/admin/logs?${params()}`);
    } catch (err) {
      return toastError(err);
    }
    if (current !== ctx) return;
    render(animate);
  }
  const reload = () => {
    st.page = 1;
    load();
  };
  $("#l-q", el).addEventListener(
    "input",
    debounce((e) => {
      st.q = e.target.value.trim();
      reload();
    }, 300),
  );
  for (const [id, k] of [
    ["#l-action", "action"],
    ["#l-from", "from"],
    ["#l-to", "to"],
  ]) {
    $(id, el).addEventListener("change", (e) => {
      st[k] = e.target.value;
      reload();
    });
  }
  $("#l-live", el).onchange = (e) => (st.live = e.target.checked);
  el.addEventListener("click", async (e) => {
    const lv = e.target.closest("[data-lv]");
    if (lv) {
      st.level = lv.dataset.lv;
      return reload();
    }
    const pg = e.target.closest("[data-page]");
    if (pg && !pg.disabled) {
      st.page = Number(pg.dataset.page);
      return load();
    }
  });
  $("#l-csv", el).onclick = () => {
    const p = params();
    p.delete("page");
    p.delete("size");
    location.href = `/api/admin/logs.csv?${p}`;
  };
  $("#l-clear", el).onclick = async () => {
    const body = document.createElement("div");
    body.className = "stack";
    const def = addDays(bkkNow().date, -90);
    setHTML(
      body,
      html`<p class="muted">
          ลบบันทึกกิจกรรมที่เก่ากว่าวันที่เลือก (ระบบลบอัตโนมัติเมื่อเกิน
          ${A.settings.logRetentionDays} วันอยู่แล้ว) —
          การลบนี้จะถูกบันทึกไว้เช่นกัน
        </p>
        <label class="field"
          ><span>ลบบันทึกก่อนวันที่</span
          ><input class="input" type="date" value="${def}"
        /></label>`,
    );
    const foot = document.createElement("div");
    foot.className = "row";
    setHTML(
      foot,
      html`<button class="btn btn-ghost" data-x>ยกเลิก</button
        ><button class="btn btn-danger" data-ok>
          ${icon("trash")} ลบบันทึก
        </button>`,
    );
    const m = openModal({
      title: "ล้างบันทึกกิจกรรมเก่า",
      body,
      footer: foot,
      size: "sm",
    });
    foot.querySelector("[data-x]").onclick = () => m.close();
    foot.querySelector("[data-ok]").onclick = async () => {
      try {
        const res = await api(
          `/api/admin/logs?before=${body.querySelector("input").value}`,
          { method: "DELETE" },
        );
        m.close();
        toast(`ลบบันทึกแล้ว ${res.removed} รายการ`, "success");
        reload();
      } catch (err) {
        toastError(err);
      }
    };
  };
  ctx.refresh = () => st.live && st.page === 1 && load(false);
  await load(false);
}

function shortUa(ua = "") {
  if (!ua) return "";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const br = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /curl/.test(ua)
            ? "curl"
            : "";
  return [br, os].filter(Boolean).join(" · ") || ua.slice(0, 24);
}

// ------------------------------------------------------------------ BACKUP
async function secBackup(el, ctx) {
  let sys = null;
  let backups = [];
  try {
    [sys, { backups }] = await Promise.all([
      api("/api/admin/system"),
      api("/api/admin/backups"),
    ]);
  } catch (err) {
    toastError(err);
  }
  if (current !== ctx) return;
  const kb = (n) =>
    n > 1048576
      ? `${(n / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`;
  const up = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return [d ? `${d} วัน` : "", h ? `${h} ชม.` : "", `${m} นาที`]
      .filter(Boolean)
      .join(" ");
  };
  setHTML(
    el,
    html`${sectionHead(
        "สำรองและกู้คืนข้อมูล",
        "ระบบสำรองข้อมูลอัตโนมัติทุกวัน แนะนำให้ดาวน์โหลดไฟล์สำรองเก็บไว้ในเครื่องอื่นเป็นระยะ",
      )}
      <div class="dash-grid stagger" style="margin-top:0">
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("download")} ดาวน์โหลดไฟล์สำรอง</h3>
          </div>
          <p class="muted small">
            ไฟล์ .json ประกอบด้วยการจอง ห้อง การตั้งค่า หน่วยงาน วันหยุด
            และบัญชีผู้ดูแล (รหัสผ่านถูกเข้ารหัส)
          </p>
          <label class="check"
            ><input type="checkbox" id="bk-logs" /><span
              >รวมบันทึกกิจกรรม (Log) ด้วย</span
            ></label
          >
          <button class="btn btn-primary" id="bk-dl">
            ${icon("download")} ดาวน์โหลดไฟล์สำรองตอนนี้
          </button>
        </section>
        <section class="card panel">
          <div class="panel-head">
            <h3>${icon("upload")} กู้คืนจากไฟล์สำรอง</h3>
          </div>
          <div class="notice notice-warning">
            ${icon("alert")}
            <div>
              ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด
              (ระบบจะสำรองข้อมูลปัจจุบันไว้ให้อัตโนมัติก่อนกู้คืน)
            </div>
          </div>
          <label class="drop" id="bk-drop"
            >${icon("upload", "i-lg")}<b>เลือกไฟล์ .json หรือลากไฟล์มาวาง</b
            ><span class="small">ไฟล์ที่ดาวน์โหลดจากระบบนี้เท่านั้น</span>
            <input type="file" accept="application/json,.json" hidden
          /></label>
        </section>
        <section class="card panel span-2">
          <div class="panel-head">
            <h3>${icon("history")} ไฟล์สำรองอัตโนมัติ</h3>
            <span class="spacer"></span
            ><small>เก็บไว้ ${A.settings.backupKeepDays} วัน</small>
          </div>
          ${backups.length
            ? html`<div class="edit-list">
                ${backups.map(
                  (b) =>
                    html`<div class="edit-item">
                      <span class="mono grow">${b.name}</span
                      ><span class="small muted"
                        >${kb(b.size)} · ${fmtDateTime(b.mtime)}</span
                      >
                      <a
                        class="btn btn-ghost btn-sm"
                        href="/api/admin/backups/${encodeURIComponent(b.name)}"
                        >${icon("download", "i-sm")} ดาวน์โหลด</a
                      >
                    </div>`,
                )}
              </div>`
            : html`<div class="faint small">ยังไม่มีไฟล์สำรองอัตโนมัติ</div>`}
        </section>
        ${sys
          ? html`<section class="card panel span-2">
              <div class="panel-head">
                <h3>${icon("server")} ข้อมูลระบบ</h3>
              </div>
              <div class="sys-grid">
                <div class="sys-item">
                  <small>ทำงานต่อเนื่อง</small><b>${up(sys.uptimeSec)}</b>
                </div>
                <div class="sys-item">
                  <small>การจองทั้งหมด</small
                  ><b>${sys.counts.bookings.toLocaleString("th-TH")} รายการ</b>
                </div>
                <div class="sys-item">
                  <small>ขนาดฐานข้อมูล</small><b>${kb(sys.sizes.db)}</b>
                </div>
                <div class="sys-item">
                  <small>บันทึกกิจกรรม</small
                  ><b
                    >${sys.counts.logs.toLocaleString("th-TH")} รายการ
                    (${kb(sys.sizes.logs)})</b
                  >
                </div>
                <div class="sys-item">
                  <small>อุปกรณ์ที่เชื่อมต่อสดอยู่</small
                  ><b>${sys.counts.sse} เครื่อง</b>
                </div>
                <div class="sys-item">
                  <small>หน่วยความจำ</small><b>${sys.memoryMB} MB</b>
                </div>
                <div class="sys-item">
                  <small>Node.js</small><b>${sys.node}</b>
                </div>
                <div class="sys-item">
                  <small>เครื่องแม่ข่าย</small><b>${sys.hostname}</b>
                </div>
                <div class="sys-item" style="grid-column:1/-1">
                  <small>โฟลเดอร์เก็บข้อมูล</small
                  ><b class="mono">${sys.dataDir}</b>
                </div>
              </div>
            </section>`
          : ""}
      </div>`,
  );
  stagger($(".dash-grid", el));
  $("#bk-dl", el).onclick = () => {
    location.href = `/api/admin/backup${$("#bk-logs", el).checked ? "?logs=1" : ""}`;
    toast("กำลังดาวน์โหลดไฟล์สำรอง", "success");
  };
  const drop = $("#bk-drop", el);
  const handle = async (file) => {
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง", "danger");
    }
    const db = data.db || data;
    if (!db || !Array.isArray(db.bookings) || !Array.isArray(db.rooms))
      return toast("ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบจองห้องประชุม", "danger");
    const hasLogs = Array.isArray(data.logs);
    const r = await confirmDialog({
      title: "ยืนยันการกู้คืนข้อมูล?",
      message: `ไฟล์: ${file.name}\nส่งออกเมื่อ: ${data.exportedAt ? fmtDateTime(Date.parse(data.exportedAt)) : "-"}\nการจอง ${db.bookings.length} รายการ · ห้อง ${db.rooms.length} ห้อง${hasLogs ? ` · Log ${data.logs.length} รายการ` : ""}\n\nข้อมูลปัจจุบันจะถูกแทนที่`,
      confirmText: "กู้คืนข้อมูล",
      danger: true,
      choices: hasLogs
        ? [
            { value: "keep", label: "เก็บบันทึกกิจกรรมปัจจุบันไว้" },
            { value: "logs", label: "กู้คืนบันทึกกิจกรรมจากไฟล์ด้วย" },
          ]
        : null,
      iconName: "database",
    });
    if (!r) return;
    try {
      const res = await api("/api/admin/restore", {
        method: "POST",
        body: {
          db,
          logs: hasLogs ? data.logs : undefined,
          restoreLogs: r.choice === "logs",
        },
      });
      toast(`กู้คืนข้อมูลสำเร็จ (การจอง ${res.bookings} รายการ)`, "success");
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toastError(err);
    }
  };
  drop.querySelector("input").onchange = (e) => handle(e.target.files[0]);
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    handle(e.dataTransfer.files[0]);
  });
}

// ------------------------------------------------------------------ CONNECT
async function secConnect(el, ctx) {
  let sys = null;
  try {
    sys = await api("/api/admin/system");
  } catch (err) {
    toastError(err);
  }
  if (current !== ctx) return;
  const urls = sys?.lanUrls?.length ? sys.lanUrls : [location.origin];
  const base = ["localhost", "127.0.0.1"].includes(location.hostname)
    ? urls[0]
    : location.origin;
  const rooms = A.rooms.filter((r) => !r.archived);
  const card = (title, url, sub = "") =>
    html`<div class="card qr-card">
      <div class="qr">${raw(qrSVG(url))}</div>
      <b>${title}</b><span class="mono">${url}</span>${sub
        ? html`<span class="small muted">${sub}</span>`
        : ""}
      <div class="row-wrap" style="justify-content:center">
        <button class="btn btn-ghost btn-sm" data-copy="${url}">
          ${icon("copy", "i-sm")} คัดลอก
        </button>
        <a
          class="btn btn-ghost btn-sm"
          href="${url}"
          target="_blank"
          rel="noopener"
          >${icon("external", "i-sm")} เปิด</a
        >
      </div>
    </div>`;
  setHTML(
    el,
    html`${sectionHead(
        "การเชื่อมต่อและ QR Code",
        "ใช้งานผ่าน Wi-Fi/LAN ภายในสำนักงาน ไม่ต้องติดตั้งแอป — เปิดเบราว์เซอร์แล้วพิมพ์ที่อยู่ หรือสแกน QR",
        html`<button class="btn btn-primary" id="c-poster">
          ${icon("printer")} พิมพ์โปสเตอร์ QR
        </button>`,
      )}
      <section class="card panel" style="margin-bottom:16px">
        <div class="panel-head">
          <h3>${icon("wifi")} ที่อยู่สำหรับเข้าใช้งาน</h3>
        </div>
        <div class="edit-list">
          ${urls.map(
            (u) =>
              html`<div class="edit-item">
                <span class="mono grow">${u}</span
                ><button class="btn btn-ghost btn-sm" data-copy="${u}">
                  ${icon("copy", "i-sm")} คัดลอก
                </button>
              </div>`,
          )}
        </div>
        <ol class="steps-list small">
          <li>
            เครื่องที่รันระบบต้องเปิดไว้ และเชื่อมต่อเครือข่ายเดียวกับผู้ใช้
          </li>
          <li>
            ถ้าเครื่องอื่นเข้าไม่ได้ ให้อนุญาต Node.js ใน Windows Firewall
            (เลือก Private network)
          </li>
          <li>
            แนะนำให้ตั้ง IP ของเครื่องแม่ข่ายเป็นแบบคงที่ (Static IP / DHCP
            reservation) เพื่อให้ QR ใช้ได้ตลอด
          </li>
          <li>บนมือถือ กด “เพิ่มไปยังหน้าจอหลัก” จะได้ไอคอนเหมือนแอป</li>
        </ol>
      </section>
      <div class="qr-grid stagger">
        ${card("หน้าจองห้องประชุม", `${base}/`, "สำหรับเจ้าหน้าที่ทุกคน")}
        ${rooms.map((r) =>
          card(
            `จอหน้า${r.name}`,
            `${base}/display?room=${r.id}`,
            `${r.floor} · เปิดบนแท็บเล็ตหน้าห้อง`,
          ),
        )}
        ${card(
          "จอรวมทุกห้อง (ล็อบบี้)",
          `${base}/display`,
          "แสดงสถานะทุกห้องบนจอเดียว",
        )}
        ${card("หน้าผู้ดูแลระบบ", `${base}/admin`, "เฉพาะผู้มีบัญชี")}
      </div>`,
  );
  stagger($(".qr-grid", el));
  el.onclick = async (e) => {
    const c = e.target.closest("[data-copy]");
    if (c && (await copyText(c.dataset.copy))) toast("คัดลอกแล้ว", "success");
  };
  $("#c-poster", el).onclick = () => {
    const s = A.settings;
    setHTML(
      $("#print-root"),
      html`<div class="poster">
        ${s.logo
          ? html`<img
              src="${s.logo}"
              alt=""
              style="width:30mm;height:30mm;object-fit:contain;margin:0 auto 6mm;display:block"
            />`
          : ""}
        <h1>${s.siteName}</h1>
        <h2>${s.orgName}</h2>
        <div class="qr">${raw(qrSVG(`${base}/`, { ecc: "Q" }))}</div>
        <div class="url">${base}</div>
        <p>
          สแกน QR Code ด้วยกล้องมือถือ (เชื่อมต่อ Wi-Fi ของสำนักงาน)
          เพื่อดูตารางและจองห้องประชุม
        </p>
        <div class="rooms">
          ${rooms.map(
            (r) =>
              html`<span>■ ${r.name} ${r.floor} (${r.capacity} ที่นั่ง)</span>`,
          )}
        </div>
      </div>`,
    );
    setTimeout(() => window.print(), 50);
  };
}

const RENDER = {
  dashboard: secDashboard,
  bookings: secBookings,
  rooms: secRooms,
  data: secData,
  settings: secSettings,
  users: secUsers,
  logs: secLogs,
  backup: secBackup,
  connect: secConnect,
};

boot();
