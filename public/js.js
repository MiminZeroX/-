/* js.js — ระบบจองห้องประชุม สำนักงานเขตบางรัก
 * ไฟล์ JavaScript เดียวที่ใช้ร่วมกันทุกหน้า (โหลดใน <head>)
 * หน้าเลือกโค้ดที่จะทำงานจาก <body data-app="user|admin|display" data-page="...">
 */
(function () {
  "use strict";

  // ================================================================ 1. ตั้งธีมก่อนแสดงผล (กันหน้าจอกะพริบ)
  (function () {
    try {
      var get = function (k) {
        return JSON.parse(localStorage.getItem(k) || "null");
      };
      var cfg = get("br.cfg.appearance") || {};
      var mode = get("br.theme") || cfg.defaultThemeMode || "auto";
      var dark =
        mode === "dark" ||
        (mode === "auto" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      var root = document.documentElement;
      root.setAttribute("data-theme", dark ? "dark" : "light");
      if (cfg.themeColor) root.setAttribute("data-brand", cfg.themeColor);
      var motion = get("br.motion") || cfg.motionLevel || "full";
      // ระบบปฏิบัติการขอลดภาพเคลื่อนไหว → ใช้แบบเรียบง่าย (ถ้าผู้ใช้ไม่ได้เลือกเอง)
      if (
        !get("br.motion") &&
        motion === "full" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        motion = "reduced";
      root.setAttribute("data-motion", motion);
    } catch (e) {
      /* ignore */
    }
  })();

  // ================================================================ 2. ไอคอน SVG
  // ชุดไอคอนเส้น (stroke) ขนาด 24x24 ใช้สีตามตัวอักษร
  const cal =
    '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>';

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    calendar: cal,
    "calendar-plus": `${cal}<path d="M12 12.5v6M9 15.5h6"/>`,
    "calendar-check": `${cal}<path d="m9 15.5 2 2 4-4"/>`,
    "calendar-x": `${cal}<path d="m10 13.5 4 4M14 13.5l-4 4"/>`,
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    building:
      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    door: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.6v16.5a.5.5 0 0 1-.6.5L5 20V5.6a1 1 0 0 1 .8-1l6-1.2a1 1 0 0 1 1.2 1Z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    "chevron-left": '<path d="m15 6-6 6 6 6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-up": '<path d="m6 15 6-6 6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    columns:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    sliders:
      '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    "log-out":
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    "log-in":
      '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    trash:
      '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off":
      '<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    "sun-moon":
      '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity=".18"/>',
    monitor:
      '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    tablet:
      '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
    printer:
      '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3M20 17v.01"/>',
    refresh:
      '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>',
    filter: '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z"/>',
    shield:
      '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    alert:
      '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    "x-circle": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    hourglass:
      '<path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4"/>',
    phone:
      '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    repeat:
      '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M16 7l3 3M19 4l2 2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-3"/>',
    "file-text":
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    database:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M12 20h.01"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    sparkles:
      '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    megaphone:
      '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    maximize:
      '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    external:
      '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
    palette:
      '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9Z"/>',
    toggle:
      '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="3"/>',
    server:
      '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
    history:
      '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    coffee:
      '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8ZM6 2v2M10 2v2M14 2v2"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
  };

  // ================================================================ 3. QR Code (ออฟไลน์)
  // ตัวสร้าง QR Code (โหมด byte) ทำงานแบบออฟไลน์ ไม่พึ่งอินเทอร์เน็ต
  // อ้างอิงขั้นตอนวิธีตามมาตรฐาน ISO/IEC 18004 (โครงสร้างตามแนวทางของ Project Nayuki, MIT License)

  const ECC = { L: [1, 0], M: [0, 1], Q: [3, 2], H: [2, 3] }; // [format bits, table row]

  // prettier-ignore
  const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];
  // prettier-ignore
  const NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  function rawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  const dataCodewords = (ver, e) =>
    Math.floor(rawModules(ver) / 8) -
    ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        r[j] = gfMul(r[j], root);
        if (j + 1 < degree) r[j] ^= r[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return r;
  }

  function rsRemainder(data, divisor) {
    const r = new Array(divisor.length).fill(0);
    for (const b of data) {
      const factor = b ^ r.shift();
      r.push(0);
      divisor.forEach((coef, i) => {
        r[i] ^= gfMul(coef, factor);
      });
    }
    return r;
  }

  function alignPositions(ver, size) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  function qrMatrix(text, eccName = "M") {
    const [fmtBits, e] = ECC[eccName] || ECC.M;
    const bytes = new TextEncoder().encode(String(text));
    let ver = 1;
    for (; ver <= 40; ver++) {
      if (
        4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <=
        dataCodewords(ver, e) * 8
      )
        break;
    }
    if (ver > 40) throw new Error("ข้อความยาวเกินไปสำหรับ QR Code");
    const capBits = dataCodewords(ver, e) * 8;

    // ---- ข้อมูล
    const bits = [];
    const push = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    push(0b0100, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach((b) => push(b, 8));
    push(0, Math.min(4, capBits - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11)
      push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }

    // ---- error correction + interleave
    const numBlocks = NUM_BLOCKS[e][ver];
    const eccLen = ECC_PER_BLOCK[e][ver];
    const raw = Math.floor(rawModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const codewords = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((b, j) => {
        if (i !== shortLen - eccLen || j >= numShort) codewords.push(b[i]);
      });
    }

    // ---- matrix
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => {
      mod[y][x] = dark;
      fn[y][x] = true;
    };
    for (let i = 0; i < size; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            set(x, y, d !== 2 && d !== 4);
          }
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    const al = alignPositions(ver, size);
    for (let i = 0; i < al.length; i++) {
      for (let j = 0; j < al.length; j++) {
        const last = al.length - 1;
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === last) ||
          (i === last && j === 0)
        )
          continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++)
            set(
              al[i] + dx,
              al[j] + dy,
              Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
            );
        }
      }
    }
    const drawFormat = (mask) => {
      const d = (fmtBits << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const fb = ((d << 10) | rem) ^ 0x5412;
      const bit = (i) => ((fb >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6));
      set(8, 8, bit(7));
      set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const vb = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = ((vb >>> i) & 1) === 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        set(a, b, dark);
        set(b, a, dark);
      }
    }
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < codewords.length * 8) {
            mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
            bi++;
          }
        }
      }
    }

    // ---- เลือก mask ที่อ่านง่ายที่สุด
    const applyMask = (m) => {
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    };
    const penalty = () => {
      let score = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let a = 0; a < size; a++) {
          let run = 1;
          let line = "";
          for (let b = 0; b < size; b++) {
            const v = pass === 0 ? mod[a][b] : mod[b][a];
            line += v ? "1" : "0";
            if (b > 0 && line[b] === line[b - 1]) {
              run++;
              if (run === 5) score += 3;
              else if (run > 5) score++;
            } else run = 1;
          }
          const padded = `0000${line}0000`;
          for (
            let i = padded.indexOf("1011101");
            i !== -1;
            i = padded.indexOf("1011101", i + 1)
          ) {
            if (
              padded.slice(i - 4, i) === "0000" ||
              padded.slice(i + 7, i + 11) === "0000"
            )
              score += 40;
          }
        }
      }
      let dark = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (mod[y][x]) dark++;
          if (y < size - 1 && x < size - 1) {
            const c = mod[y][x];
            if (
              c === mod[y][x + 1] &&
              c === mod[y + 1][x] &&
              c === mod[y + 1][x + 1]
            )
              score += 3;
          }
        }
      }
      const total = size * size;
      score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return score;
    };
    let best = 0;
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      const sc = penalty();
      if (sc < bestScore) {
        best = m;
        bestScore = sc;
      }
      applyMask(m);
    }
    applyMask(best);
    drawFormat(best);
    return mod;
  }

  function qrSVG(
    text,
    { ecc = "M", margin = 4, dark = "#000", light = "#fff" } = {},
  ) {
    const m = qrMatrix(text, ecc);
    const size = m.length + margin * 2;
    let d = "";
    m.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (!row[x]) continue;
        let len = 1;
        while (x + len < row.length && row[x + len]) len++;
        d += `M${x + margin} ${y + margin}h${len}v1h-${len}z`;
        x += len - 1;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }

  // ================================================================ 4. ส่วนกลาง
  // โค้ดส่วนกลางที่ใช้ร่วมกันทุกหน้า

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ------------------------------------------------------------ safe HTML templating
  class Raw {
    constructor(s) {
      this.s = s;
    }
    toString() {
      return this.s;
    }
  }
  const raw = (s) => new Raw(String(s));
  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function renderVal(v) {
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(renderVal).join("");
    if (v === null || v === undefined || v === false) return "";
    return esc(v);
  }
  // ทุกค่าที่แทรกจะถูก escape อัตโนมัติ ยกเว้นค่าที่สร้างจาก html`` หรือ raw()
  function html(strings, ...vals) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++)
      out += renderVal(vals[i]) + strings[i + 1];
    return new Raw(out);
  }
  // วาดเนื้อหาใหม่โดยไม่ทำโฟกัสคีย์บอร์ดหาย: ถ้าองค์ประกอบที่โฟกัสอยู่ถูกแทนที่
  // จะโฟกัสตัวใหม่ที่มี id หรือ data-* เดียวกัน (เช่น ช่องเวลา ชิปวันที่ ปุ่มตัวเลือก)
  const FOCUS_KEYS = [
    "m",
    "dur",
    "preset",
    "date",
    "value",
    "room",
    "id",
    "pg",
    "act",
    "equip",
    "step-btn",
  ];
  function focusKey(a) {
    if (a.id) return `#${CSS.escape(a.id)}`;
    for (const k of FOCUS_KEYS) {
      const v = a.getAttribute(`data-${k}`);
      if (v !== null)
        return `${a.tagName.toLowerCase()}[data-${k}="${CSS.escape(v)}"]`;
    }
    return null;
  }
  function setHTML(el, tpl) {
    const a = document.activeElement;
    const key = a && a !== document.body && el.contains(a) ? focusKey(a) : null;
    el.innerHTML = renderVal(tpl);
    if (key) el.querySelector(key)?.focus({ preventScroll: true });
    return el;
  }
  function icon(name, cls = "") {
    return raw(
      `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`,
    );
  }

  // ------------------------------------------------------------ storage (ปลอดภัยเมื่อถูกบล็อก)
  const store = {
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
  class ApiError extends Error {
    constructor(status, data) {
      super((data && data.error) || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      this.status = status;
      this.data = data || {};
    }
  }

  async function api(path, { method = "GET", body, headers = {} } = {}) {
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
        error:
          "เชื่อมต่อระบบไม่ได้ ตรวจสอบว่าเชื่อมต่อ Wi-Fi ของสำนักงานอยู่ แล้วลองอีกครั้ง",
      });
    }
    let data = null;
    if ((res.headers.get("content-type") || "").includes("json"))
      data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  // ------------------------------------------------------------ เวลาไทย
  const TH_MONTHS = [
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
  const TH_MONTHS_SHORT = [
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
  const TH_DAYS = [
    "อาทิตย์",
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
  ];
  const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const TH_DAYS_MIN = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  const TZ = 7 * 60;
  let clockSkew = 0;
  function syncClock(serverMs) {
    if (typeof serverMs === "number") clockSkew = serverMs - Date.now();
  }
  const nowMs = () => Date.now() + clockSkew;
  const pad2 = (n) => String(n).padStart(2, "0");
  function bkkNow() {
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
  function toMin(hhmm) {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }
  const toHHMM = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
  function addDays(date, n) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
  const diffDays = (a, b) =>
    Math.round(
      (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000,
    );
  const toEpoch = (date, hhmm) =>
    Date.parse(`${date}T00:00:00Z`) + (toMin(hhmm) - TZ) * 60000;
  function startOfWeek(date) {
    const wd = weekdayOf(date);
    return addDays(date, wd === 0 ? -6 : 1 - wd); // เริ่มวันจันทร์
  }

  function fmtDate(date, style = "medium") {
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
  function fmtDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m} นาที`;
    return m ? `${h} ชม. ${m} นาที` : `${h} ชั่วโมง`;
  }
  function fmtDateTime(ms) {
    const d = new Date(ms + TZ * 60000);
    const date = d.toISOString().slice(0, 10);
    return `${fmtDate(date)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  function timeAgo(ms) {
    const s = Math.round((nowMs() - ms) / 1000);
    if (s < 45) return "เมื่อสักครู่";
    if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงที่แล้ว`;
    if (s < 86400 * 7) return `${Math.round(s / 86400)} วันที่แล้ว`;
    return fmtDateTime(ms);
  }
  function greeting(minutes) {
    if (minutes < 11 * 60) return "สวัสดีตอนเช้า";
    if (minutes < 13 * 60) return "สวัสดีตอนเที่ยง";
    if (minutes < 16 * 60 + 30) return "สวัสดีตอนบ่าย";
    if (minutes < 19 * 60) return "สวัสดีตอนเย็น";
    return "สวัสดีตอนค่ำ";
  }

  const STATUS = {
    pending: { label: "รออนุมัติ", icon: "hourglass" },
    approved: { label: "อนุมัติแล้ว", icon: "check-circle" },
    rejected: { label: "ไม่อนุมัติ", icon: "x-circle" },
    cancelled: { label: "ยกเลิกแล้ว", icon: "ban" },
  };
  // สถานะตามเวลา: กำลังประชุม / เสร็จสิ้น
  function liveStatus(b) {
    if (b.status !== "approved" && b.status !== "pending") return b.status;
    const now = nowMs();
    if (toEpoch(b.date, b.end) <= now)
      return b.status === "approved" ? "done" : "expired";
    if (toEpoch(b.date, b.start) <= now)
      return b.status === "approved" ? "live" : b.status;
    return b.status;
  }
  function statusBadge(b) {
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
    return html`<span class="badge badge-${st}"
      >${icon(s.icon)}${s.label}</span
    >`;
  }

  // ------------------------------------------------------------ appearance
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  let appearanceSettings = {
    themeColor: "blue",
    defaultThemeMode: "auto",
    motionLevel: "full",
  };
  function applyAppearance(settings = appearanceSettings) {
    appearanceSettings = settings;
    const root = document.documentElement;
    root.dataset.brand = settings.themeColor || "blue";
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
        getComputedStyle(root).getPropertyValue("--bg").trim() || "#f5f5f7";
  }
  mqDark.addEventListener?.("change", () => applyAppearance());
  mqReduce.addEventListener?.("change", () => applyAppearance());
  const motionLevel = () => document.documentElement.dataset.motion || "full";

  // ------------------------------------------------------------ feedback effects
  const fx = { haptic: true, sound: false };
  let audioCtx = null;
  function setFeedback(opts) {
    Object.assign(fx, opts);
  }
  // Android: Vibration API (สั้นกว่า ~15ms มอเตอร์หลายรุ่นหมุนไม่ทัน จึงไม่รู้สึก)
  // iPhone: Safari ไม่มี Vibration API แต่ iOS 18+ สั่นเองเมื่อสลับ <input type="checkbox" switch>
  // จึงสลับสวิตช์ที่ซ่อนไว้แทน (ต้องเรียกระหว่างการแตะ) · iPad ไม่มีมอเตอร์สั่น สั่นไม่ได้ทุกกรณี
  let iosSwitch = null;
  function haptic(ms = 15) {
    if (!fx.haptic || motionLevel() === "off") return;
    try {
      if (navigator.vibrate) {
        navigator.vibrate(ms);
        return;
      }
      if (!matchMedia("(pointer: coarse)").matches) return;
      if (!iosSwitch) {
        iosSwitch = document.createElement("label");
        iosSwitch.setAttribute("aria-hidden", "true");
        iosSwitch.style.cssText =
          "position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
        iosSwitch.innerHTML = '<input type="checkbox" switch tabindex="-1" />';
        // คลิกจำลองนี้ต้องไม่ไปถึงตัวจัดการอื่น (เช่น ปิดเมนูเมื่อคลิกนอกเมนู)
        iosSwitch.addEventListener("click", (e) => e.stopPropagation());
        document.body.appendChild(iosSwitch);
      }
      iosSwitch.click();
    } catch {
      /* ignore */
    }
  }
  function tick(freq = 1700, dur = 0.035, vol = 0.05) {
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
  function chime() {
    [880, 1320].forEach((f, i) =>
      setTimeout(() => tick(f, 0.28, 0.08), i * 140),
    );
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

  function initEffects() {
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        const el = e.target.closest(
          ".btn, .chip, .ripple-host, .seg button, .nav-link, .tab-link",
        );
        if (!el || el.disabled || el.classList.contains("is-disabled")) return;
        if (motionLevel() === "full") spawnRipple(el, e);
        if (fx.sound) tick();
      },
      { passive: true },
    );
    // สั่นตอน click (ไม่ใช่ pointerdown): เบราว์เซอร์มือถือนับว่าเป็นการแตะจริง จึงยอมให้สั่น
    document.addEventListener("click", (e) => {
      const el = e.target.closest(
        ".btn, .chip, .ripple-host, .seg button, .nav-link, .tab-link",
      );
      if (el && !el.disabled && !el.classList.contains("is-disabled")) haptic();
    });
    initTooltips();
  }

  // ------------------------------------------------------------ tooltip
  // ปุ่มไอคอนทุกปุ่ม (.btn-icon[aria-label]) และองค์ประกอบที่มี data-tip จะแสดงคำอธิบาย
  // เมื่อชี้เมาส์ และเมื่อโฟกัสด้วยคีย์บอร์ด (ไม่ใช้ title ของเบราว์เซอร์)
  function initTooltips() {
    const tip = document.createElement("div");
    tip.id = "tooltip";
    tip.className = "tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.appendChild(tip);
    const SEL = "[data-tip], .btn-icon[aria-label]";
    let owner = null;
    const textOf = (el) =>
      el.dataset.tip || el.getAttribute("aria-label") || "";
    function show(el) {
      const text = textOf(el);
      if (!text) return;
      owner = el;
      tip.textContent = text;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const x = Math.max(
        8,
        Math.min(
          innerWidth - tip.offsetWidth - 8,
          r.left + r.width / 2 - tip.offsetWidth / 2,
        ),
      );
      let y = r.top - tip.offsetHeight - 8;
      if (y < 8) y = r.bottom + 8;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      if (el.getAttribute("aria-label") !== text)
        el.setAttribute("aria-describedby", "tooltip");
    }
    function hide() {
      if (owner?.getAttribute("aria-describedby") === "tooltip")
        owner.removeAttribute("aria-describedby");
      owner = null;
      tip.hidden = true;
    }
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const el = e.target.closest(SEL);
      if (el && el !== owner) show(el);
      else if (!el && owner) hide();
    });
    document.addEventListener("focusin", (e) => {
      const el = e.target.closest(SEL);
      if (el && el.matches(":focus-visible")) show(el);
    });
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", (e) => e.key === "Escape" && hide());
    addEventListener("scroll", hide, { passive: true, capture: true });
  }

  // ------------------------------------------------------------ ทรานซิชันระหว่างหน้า HTML
  // เบราว์เซอร์รุ่นใหม่ใช้ View Transitions ข้ามหน้า (ประกาศใน css.css)
  // เบราว์เซอร์ที่ยังไม่รองรับ: เล่นแอนิเมชันออก/เข้าเองเมื่อคลิกลิงก์ภายในระบบ
  const CROSS_DOC_VT = "onpagereveal" in window;
  const skipVTIfOff = (e) => {
    if (e.viewTransition && motionLevel() === "off")
      e.viewTransition.skipTransition();
  };
  addEventListener("pageswap", skipVTIfOff);
  addEventListener("pagereveal", skipVTIfOff);

  function initPageTransitions(selector) {
    const find = () => document.querySelector(selector);
    if (CROSS_DOC_VT || !find()) return;
    if (motionLevel() !== "off") {
      find().classList.add("v-in-up");
      setTimeout(() => find()?.classList.remove("v-in-up"), 700);
    }
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (
        !a ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download"))
        return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/"))
        return;
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      if (motionLevel() === "off") return;
      e.preventDefault();
      find()?.classList.add("v-out-up");
      setTimeout(
        () => location.assign(url.href),
        motionLevel() === "full" ? 140 : 60,
      );
    });
    // กลับมาด้วยปุ่มย้อนกลับ (bfcache) ให้หน้ากลับมาแสดงปกติ
    addEventListener(
      "pageshow",
      (e) => e.persisted && find()?.classList.remove("v-out-up"),
    );
  }

  // ย่อรูปเป็น JPEG ให้ด้านยาวไม่เกิน max px แล้วคืนเป็น data URL
  async function shrinkImage(file, max) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let q = 0.85;
    let url = c.toDataURL("image/jpeg", q);
    while (url.length > 650000 && q > 0.4) url = c.toDataURL("image/jpeg", (q -= 0.15));
    return url;
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    haptic(30);
    setTimeout(() => el.classList.remove("shake"), 500);
  }

  // สลับเนื้อหาพร้อมทรานซิชัน
  async function swap(el, render, dir = "up") {
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

  function stagger(container, selector = ":scope > *") {
    // ไม่เกิน 30ms ต่อรายการ และรวมไม่เกินราว 200ms (ดู .stagger ใน css.css)
    $$(selector, container).forEach((c, i) =>
      c.style.setProperty("--i", Math.min(i, 7)),
    );
  }

  // ส่วนที่อยู่ใต้ขอบจอค่อย ๆ ปรากฏเมื่อเลื่อนมาถึง (ส่วนที่เห็นอยู่แล้วไม่ถูกซ่อน)
  function initReveal(root, selector = ".section") {
    if (motionLevel() === "off" || !("IntersectionObserver" in window)) return;
    const items = [...root.querySelectorAll(selector)].filter(
      (x) => x.getBoundingClientRect().top > innerHeight * 0.92,
    );
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries)
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    items.forEach((x) => {
      x.classList.add("reveal-item");
      io.observe(x);
    });
    root.classList.add("reveal-ready");
  }

  function countUp(el, to, duration = 900) {
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
  function initSeg(seg) {
    let ind = seg.querySelector(".seg-ind");
    if (!ind) {
      ind = document.createElement("span");
      ind.className = "seg-ind";
      seg.prepend(ind);
    }
    const place = () => {
      const sel = seg.querySelector('[aria-pressed="true"]');
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
  function segSelect(seg, value) {
    $$("button", seg).forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.value === String(value))),
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
  // ข้อความแจ้งเตือน: ทั่วไปหายเองและหยุดนับเวลาเมื่อชี้/โฟกัส ส่วนข้อผิดพลาดค้างไว้จนกดปิด
  // โปรแกรมอ่านหน้าจออ่านผ่านพื้นที่ประกาศที่มีอยู่ในหน้าตั้งแต่แรก (#toasts / #sr-alert)
  function toast(message, type = "info", { title = "", duration = 3800 } = {}) {
    const root = rootEl("toasts");
    if (!root.hasAttribute("aria-live")) {
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
    }
    const sticky = type === "danger";
    if (sticky) {
      const sr = rootEl("sr-alert");
      sr.className = "sr-only";
      sr.setAttribute("role", "alert");
      sr.textContent = "";
      setTimeout(
        () => (sr.textContent = `${title ? `${title} ` : ""}${message}`),
        50,
      );
    }
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    if (sticky) el.setAttribute("aria-hidden", "true");
    setHTML(
      el,
      html`<span class="toast-icon">${icon(TOAST_ICON[type] || "info")}</span>
        <div class="toast-body">
          ${title ? html`<b>${title}</b>` : ""}<span>${message}</span>
        </div>
        <button class="toast-x" aria-label="ปิดข้อความ">
          ${icon("x", "i-sm")}
        </button>
        ${sticky
          ? ""
          : html`<i
              class="toast-bar"
              style="animation-duration:${duration}ms"
            ></i>`}`,
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
    if (!sticky) {
      let left = duration;
      let started = Date.now();
      const pause = () => {
        clearTimeout(timer);
        left -= Date.now() - started;
        el.classList.add("paused");
      };
      const resume = () => {
        started = Date.now();
        clearTimeout(timer);
        timer = setTimeout(close, Math.max(1200, left));
        el.classList.remove("paused");
      };
      el.addEventListener("pointerenter", pause);
      el.addEventListener("pointerleave", resume);
      el.addEventListener("focusin", pause);
      el.addEventListener("focusout", resume);
      timer = setTimeout(close, duration);
    }
    if (type === "danger" || type === "warning")
      haptic(type === "danger" ? 40 : 20);
    return close;
  }
  function toastError(err, fallback = "เกิดข้อผิดพลาด") {
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

  // ระหว่างเปิดหน้าต่าง: ส่วนอื่นของหน้ากด/โฟกัสไม่ได้ และโปรแกรมอ่านหน้าจอไม่อ่าน
  const inertSet = new Set();
  function setInert(on) {
    if (on) {
      for (const elx of document.body.children) {
        if (["modal-root", "toasts", "sr-alert"].includes(elx.id) || elx.inert)
          continue;
        if (elx.tagName === "SCRIPT") continue;
        elx.inert = true;
        inertSet.add(elx);
      }
    } else {
      inertSet.forEach((elx) => (elx.inert = false));
      inertSet.clear();
    }
  }

  function openModal({
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
    const titleId = `mt-${Math.random().toString(36).slice(2, 9)}`;
    setHTML(
      wrap,
      html`<div class="modal-backdrop"></div>
        <div
          class="modal modal-${size} ${className}"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          ${title
            ? raw(`aria-labelledby="${titleId}"`)
            : raw('aria-label="หน้าต่าง"')}
        >
          <div class="sheet-handle" aria-hidden="true"></div>
          <header class="modal-head">
            <h3 id="${titleId}">${title}</h3>
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
    setInert(true);

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
        wrap.inert = true;
        if (!modalStack.length) setInert(false);
        setTimeout(
          () => {
            wrap.remove();
            if (!modalStack.length)
              document.body.classList.remove("modal-open");
          },
          motionLevel() === "off" ? 0 : 260,
        );
        // คืนโฟกัสให้ปุ่มที่เปิด หรือหัวข้อหน้าเมื่อปุ่มนั้นหายไปแล้ว
        try {
          const back =
            prevFocus && prevFocus.isConnected && prevFocus !== document.body
              ? prevFocus
              : document.querySelector("main h1, #view h1, h1");
          if (
            back &&
            !back.matches("a, button, input, select, textarea, [tabindex]")
          )
            back.setAttribute("tabindex", "-1");
          back?.focus?.({ preventScroll: true });
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
    // โฟกัสแรก: เมาส์/คีย์บอร์ด → ช่องแรกหรือปุ่มที่ปลอดภัย (ยกเลิก) ; จอสัมผัส → ตัวหน้าต่าง (ไม่ให้แป้นพิมพ์เด้ง)
    setTimeout(() => {
      if (ctrl.closed) return;
      const f = matchMedia("(pointer: fine)").matches
        ? modal.querySelector(
            "[autofocus], .modal-body input:not([type=hidden]):not([disabled]), .modal-body select, .modal-body textarea, [data-act=cancel], [data-x], .modal-foot .btn, .modal-x",
          )
        : null;
      (f || modal).focus({ preventScroll: true });
    }, 60);
    // วนโฟกัสอยู่ในหน้าต่าง (Tab / Shift+Tab)
    wrap.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const items = [
        ...modal.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((x) => !x.closest("[hidden]") && x.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === firstEl || document.activeElement === modal)
      ) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    });

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

  // รายการวันที่จองไม่ได้ (ใช้ในกล่องยืนยันการจองซ้ำ)
  function conflictList(list) {
    return html`<ul class="clist">
      ${list.map(
        (c) =>
          html`<li>
            ${icon("x-circle", "i-sm")}<span
              ><b>${fmtDate(c.date, "wd-year")}</b> ${c.reason}</span
            >
          </li>`,
      )}
    </ul>`;
  }

  function confirmDialog({
    title = "ยืนยันการทำรายการ",
    message = "",
    confirmText = "ยืนยัน",
    cancelText = "กลับ",
    danger = false,
    input = null,
    password = null,
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
          : ""}
        ${password
          ? html`<label class="field"
              ><span>${password.label || "รหัสผ่านของคุณ"}</span
              ><input
                class="input"
                type="password"
                name="cpw"
                autocomplete="current-password"
                required
              /><small class="field-hint"
                >${password.hint || "ยืนยันตัวตนก่อนทำรายการสำคัญ"}</small
              ></label
            >`
          : ""}`,
    );
    const foot = document.createElement("div");
    foot.className = "row";
    foot.style.cssText =
      "width:100%;justify-content:flex-end;gap:10px;flex-wrap:wrap";
    setHTML(
      foot,
      html`<button class="btn btn-ghost" data-act="cancel">
          ${cancelText}
        </button>
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
      const pw = body.querySelector('input[name="cpw"]');
      if (pw && !pw.value) {
        shake(pw);
        pw.focus();
        return;
      }
      m.close({
        value: ta ? ta.value.trim() : "",
        password: pw ? pw.value : "",
        choice: body.querySelector('input[name="cchoice"]:checked')?.value,
      });
    };
    return m.done.then((r) => r || false);
  }

  // ------------------------------------------------------------ confetti
  function confetti({ x, y, count = 140, colors } = {}) {
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
  function liveEvents(handlers) {
    if (!window.EventSource) return () => {};
    let es = null;
    let stopped = false;
    let retry = null;
    const open = () => {
      es = new EventSource("/api/events");
      es.addEventListener("bookings", (e) =>
        handlers.bookings?.(JSON.parse(e.data)),
      );
      es.addEventListener("config", (e) =>
        handlers.config?.(JSON.parse(e.data)),
      );
      es.addEventListener("hello", (e) => handlers.hello?.(JSON.parse(e.data)));
      // ระบบปิดสตรีมตามรอบ (แจ้ง "bye" ก่อน) แล้วเบราว์เซอร์ต่อใหม่เอง — ไม่ต้องแสดงว่าออฟไลน์
      let planned = false;
      es.addEventListener("bye", () => {
        planned = true;
      });
      es.onopen = () => {
        planned = false;
        handlers.status?.(true);
      };
      es.onerror = () => {
        if (planned) planned = false;
        else handlers.status?.(false);
        // ถูกปฏิเสธ (เช่น เปิดหลายหน้าต่างเกินไป) เบราว์เซอร์จะไม่ต่อใหม่เอง: ลองใหม่ภายหลัง
        if (es.readyState === EventSource.CLOSED && !stopped) {
          clearTimeout(retry);
          retry = setTimeout(open, 20000);
        }
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      es.close();
    };
  }

  // ------------------------------------------------------------ files
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadICS(b, room, orgName) {
    const dt = (date, time) =>
      `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
    const e = (s) =>
      String(s || "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n|\r|\n/g, "\\n");
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

  // รหัสผ่านชั่วคราวแบบสุ่ม อ่านง่าย ไม่มีตัวที่สับสน (0/O, 1/l)
  function tempPassword() {
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const buf = new Uint32Array(12);
    crypto.getRandomValues(buf);
    const ch = [...buf].map((n) => abc[n % abc.length]).join("");
    return `${ch.slice(0, 4)}-${ch.slice(4, 8)}-${ch.slice(8)}`;
  }

  async function copyText(text) {
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

  function debounce(fn, ms = 250) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  // ตัวอักษรย่อสำหรับโลโก้
  function initials(name) {
    const clean = String(name || "")
      .replace(/^สำนักงาน/, "")
      .replace(/^เขต/, "")
      .trim();
    return clean.slice(0, 2) || "บร";
  }

  // ================================================================ 5. หน้าผู้ใช้ (index / calendar / book / my)
  function startUser() {
    // หน้าผู้ใช้งาน: หน้าแรก / ปฏิทิน / จองห้อง / การจองของฉัน

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
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(
        location.hostname,
      );
      return local && S.serverUrls.length ? S.serverUrls[0] : location.origin;
    }

    const EMBLEM = raw('<span class="seal" aria-hidden="true"></span>');

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
        // เก็บโทเคนไว้เฉพาะที่ยังมีการจองที่ยังไม่จบ หรือเพิ่งจบไม่เกิน 14 วัน
        const keepFrom = addDays(bkkNow().date, -14);
        for (const it of res.items) {
          if (it.bookings.some((b) => b.date >= keepFrom)) alive.add(it.token);
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
    // เก็บการตั้งค่าล่าสุดไว้ เพื่อวาดหน้าได้ทันทีเมื่อเปลี่ยนหน้า แล้วค่อยอัปเดตจากเซิร์ฟเวอร์
    const CFG_CACHE = "br.cfg.cache";
    async function loadConfig() {
      const cfg = await api("/api/config");
      syncClock(cfg.now.ms);
      // eslint-disable-next-line no-unused-vars
      const { now, ...rest } = cfg;
      // เวลาเครื่องต่างจากเซิร์ฟเวอร์เกิน 1 นาที (เช่น แท็บเล็ตตั้งเวลาผิด) ให้วาดหน้าใหม่ด้วยเวลาที่ถูกต้อง
      const skew = cfg.now.ms - Date.now();
      const skewMoved =
        Math.abs(skew - (store.get("br.clock.skew") ?? 0)) > 60000;
      store.set("br.clock.skew", skew);
      const changed =
        skewMoved ||
        JSON.stringify(rest) !== JSON.stringify(store.get(CFG_CACHE));
      store.set(CFG_CACHE, rest);
      applyConfig(cfg);
      return changed;
    }

    function applyConfig(cfg) {
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
      const pageTitle = {
        calendar: "ปฏิทินห้องประชุม",
        book: "จองห้องประชุม",
        my: "การจองของฉัน",
        feedback: "ร้องเรียน · แจ้งปัญหา · ข้อเสนอแนะ",
      }[pageName()];
      document.title = `${pageTitle ? `${pageTitle} · ` : ""}${s.siteName} · ${s.orgName}`;
      setHTML(
        $("#brand-mark"),
        s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM,
      );
      renderBanner();
      setHTML(
        $("#site-foot"),
        html`<span>${s.contactText}</span
          ><a href="feedback.html"
            >${icon("mail", "i-sm")} ร้องเรียน · แจ้งปัญหา · เสนอแนะ</a
          ><span class="spacer"></span
          ><a href="display.html">${icon("tablet", "i-sm")} จอแสดงผลหน้าห้อง</a
          ><a href="admin.html"
            >${icon("shield", "i-sm")} สำหรับผู้ดูแลระบบ</a
          >`,
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

    // ------------------------------------------------------------------ หน้า (เลือกจาก <body data-page>)
    const PAGES = {
      home: viewHome,
      calendar: viewCalendar,
      book: viewBook,
      my: viewMy,
      feedback: viewFeedback,
    };
    const pageName = () =>
      document.body.dataset.page in PAGES ? document.body.dataset.page : "home";
    // วาดเนื้อหาของหน้าปัจจุบัน — เรียกซ้ำได้เมื่อผู้ดูแลเปลี่ยนการตั้งค่า
    function renderPage(animate = false) {
      const key = pageName();
      updateNav(key);
      try {
        current.cleanup?.();
      } catch {
        /* ignore */
      }
      const ctx = { name: key };
      current = ctx;
      const draw = () => {
        // container ใหม่ทุกครั้ง เพื่อไม่ให้ event listener เก่าค้างอยู่
        const page = document.createElement("div");
        viewEl.replaceChildren(page);
        PAGES[key](page, new URLSearchParams(location.search), ctx);
      };
      if (animate) swap(viewEl, draw, "fade");
      else draw();
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
          list.find((x) => x.id === it.dataset.id) ||
          my.byId.get(it.dataset.id)?.b;
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
            class="day-seg ${b.status === "pending"
              ? "pending"
              : ""} ${b.kind === "block" ? "block" : ""}"
            style="left:${((a - o) / span) * 100}%;width:${((z - a) / span) *
            100}%;animation-delay:${i * 60}ms"
            data-tip="${b.start}–${b.end} ${titleOf(b)}"
          ></i>`;
        });
      const nowPct = ((now.minutes - o) / span) * 100;
      const ticks = [];
      for (let m = Math.ceil(o / 120) * 120; m <= c; m += 120)
        ticks.push(pad2(Math.floor(m / 60)));
      let nowBlock;
      if (!r.active) {
        nowBlock = html`<span class="label">สถานะ</span
          ><b>ปิดให้บริการชั่วคราว</b
          ><span class="sub"
            >${r.closedMessage || "กรุณาติดต่อผู้ดูแลห้องประชุม"}</span
          >`;
      } else if (st.cur) {
        const a = toMin(st.cur.start);
        const z = toMin(st.cur.end);
        const pct = Math.min(
          100,
          Math.max(0, ((now.minutes - a) / (z - a)) * 100),
        );
        nowBlock = html`<span class="label"
            >${st.cur.kind === "block" ? "ปิดใช้ห้อง" : "กำลังประชุม"} ·
            เหลืออีก ${fmtDuration(z - now.minutes)}</span
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
          ><b
            >${dayClosed(now.date)
              ? "วันหยุด"
              : "ว่างตลอดช่วงที่เหลือของวัน"}</b
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
        ${r.photo
          ? html`<img
              class="room-photo"
              src="${r.photo}"
              alt="ภาพ${r.name}"
              loading="lazy"
            />`
          : ""}
        <header class="room-head">
          <div class="room-icon">${icon("door")}</div>
          <p class="room-floor">${r.floor}</p>
          <h3>${r.name}</h3>
          <p class="room-meta">
            รองรับ ${r.capacity} คน ·
            ${r.needsApproval ? "รอผู้ดูแลอนุมัติ" : "ยืนยันทันที"}
          </p>
          <span class="status-pill ${st.cls}"
            ><i class="dot"></i>${st.label}</span
          >
        </header>
        ${r.description ? html`<p class="room-desc">${r.description}</p>` : ""}
        <div class="room-now">${nowBlock}</div>
        <div class="day-bar">
          <div
            class="day-track"
            role="img"
            aria-label="ช่วงเวลาที่มีการจองวันนี้ ${list
              .filter((b) => b.roomId === r.id)
              .map((b) => `${b.start}–${b.end}`)
              .join(", ") || "ไม่มี"}"
          >
            ${segs}${nowPct >= 0 && nowPct <= 100
              ? html`<i class="day-now" style="left:${nowPct}%"></i>`
              : ""}
          </div>
          <div class="day-ticks" aria-hidden="true">
            ${ticks.map((t) => html`<span>${t}</span>`)}
          </div>
        </div>
        ${r.equipment.length
          ? html`<ul class="room-equip" aria-label="อุปกรณ์ในห้อง">
              ${r.equipment.map((e) => html`<li>${e}</li>`)}
            </ul>`
          : ""}
        <div class="room-actions">
          ${r.active
            ? html`<a
                class="btn btn-primary"
                href="book.html?room=${encodeURIComponent(r.id)}"
                >จองห้องนี้</a
              >`
            : ""}
          <a
            class="link-more"
            href="calendar.html?v=day&room=${encodeURIComponent(r.id)}"
            >ดูตาราง ${icon("chevron-right")}</a
          >
        </div>
      </article>`;
    }

    function viewHome(el, q, ctx) {
      const s = S.settings;
      const now = bkkNow();
      setHTML(
        el,
            // <span class="hero-seal" aria-hidden="true">${s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM}</span>
            // <p class="eyebrow">${s.orgName}</p>
        html`<section class="hero">

            <h1>
              จองห้องประชุม<span class="grad-text">ง่ายในไม่กี่แตะ</span>
            </h1>
            <p class="hero-sub">
              ดูห้องว่างแบบเรียลไทม์ แล้วจองได้ทันที จากคอมพิวเตอร์ แท็บเล็ต
              หรือมือถือ
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary btn-lg" href="book.html"
                >จองห้องประชุม</a
              >
              <a class="link-more" href="calendar.html"
                >ดูตารางห้อง ${icon("chevron-right")}</a
              >
            </div>
            <dl class="hero-stats">
              <div>
                <dt>
                  <span id="h-greet">${greeting(now.minutes)}</span> ·
                  <span id="h-date">${fmtDate(now.date, "long")}</span>
                </dt>
                <dd class="clock-digits" id="h-clock"></dd>
              </div>
              <div>
                <dt>การประชุมวันนี้</dt>
                <dd id="h-today">–</dd>
              </div>
              <div>
                <dt>ห้องว่างขณะนี้</dt>
                <dd id="h-free">–</dd>
              </div>
            </dl>
          </section>
          <section class="section">
            <div class="section-head">
              <h2>สถานะห้องประชุม</h2>
              <span class="live-dot ${S.online ? "" : "off"}"
                >${S.online
                  ? "อัปเดตอัตโนมัติ"
                  : "ออฟไลน์ · กำลังเชื่อมต่อใหม่"}</span
              >
            </div>
            <div
              class="room-grid ${S.rooms.length > 2 ? "many" : ""}"
              id="h-rooms"
            >
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
                <a class="link-more" href="calendar.html"
                  >ดูปฏิทิน ${icon("chevron-right")}</a
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
                <a class="link-more" href="my.html"
                  >ดูทั้งหมด ${icon("chevron-right")}</a
                >
              </div>
              <div class="agenda" id="h-my"></div>
            </div>
          </section>`,
      );
      let todays = [];
      let first = true;
      initReveal(el);

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
                "ทุกห้องว่างทั้งวัน เริ่มจองได้ทันที",
                html`<a class="btn btn-primary btn-sm" href="book.html"
                  >จองห้องประชุม</a
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
                "ยังไม่มีการจองบนอุปกรณ์นี้",
                "การจองที่ทำจากอุปกรณ์นี้จะแสดงที่นี่ ถ้าจองจากอุปกรณ์อื่น ใช้รหัสการจองกับเบอร์โทรเรียกดูได้",
                html`<a class="btn btn-soft btn-sm" href="my.html"
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
        view: ["day", "week", "month"].includes(q.get("v"))
          ? q.get("v")
          : "day",
        room: S.rooms.some((r) => r.id === q.get("room"))
          ? q.get("room")
          : "all",
      };
      setHTML(
        el,
        html`<h1 class="sr-only">ปฏิทินห้องประชุม</h1>
          <div class="cal-toolbar">
            <div class="cal-nav">
              <button
                class="btn btn-icon"
                data-act="prev"
                aria-label="ก่อนหน้า"
              >
                ${icon("chevron-left")}
              </button>
              <button class="btn" data-act="today">วันนี้</button>
              <button class="btn btn-icon" data-act="next" aria-label="ถัดไป">
                ${icon("chevron-right")}
              </button>
            </div>
            <label class="cal-title"
              ><span id="c-title" aria-live="polite"></span>${icon(
                "chevron-down",
                "i-sm",
              )}<input type="date" id="c-pick" aria-label="เลือกวันที่"
            /></label>
            <div class="seg" role="group" aria-label="มุมมองปฏิทิน" id="c-seg">
              <button data-value="day">รายวัน</button>
              <button data-value="week">รายสัปดาห์</button>
              <button data-value="month">รายเดือน</button>
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
        const unit = { day: "วัน", week: "สัปดาห์", month: "เดือน" }[st.view];
        $('[data-act="prev"]', el).setAttribute(
          "aria-label",
          `${unit}ก่อนหน้า`,
        );
        $('[data-act="next"]', el).setAttribute("aria-label", `${unit}ถัดไป`);
        $("#c-pick", el).value = st.date;
        history.replaceState(
          null,
          "",
          `calendar.html?v=${st.view}&d=${st.date}${st.room !== "all" ? `&room=${encodeURIComponent(st.room)}` : ""}`,
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
          data-tip="${b.start}–${b.end} ${titleOf(b)}${b.department
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
          <span class="now-tag" style="top:${top}px"
            >${toHHMM(n.minutes)}</span
          >`;
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
        const extra = list.filter(
          (b) => toMin(b.end) <= o || toMin(b.start) >= c,
        );
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
                return html`<div
                    class="agenda-day ${d === today ? "today" : ""}"
                  >
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
                      class="tg-day ${d === today
                        ? "today"
                        : ""} ${S.holidays.get(d) ? "hol" : ""}"
                      data-goto="${d}"
                      data-tip="${S.holidays.get(d) || ""}"
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
                          class="tg-col ${closed || !r.active
                            ? "off"
                            : ""} ${d === today ? "today" : ""}"
                          data-room="${r.id}"
                          data-date="${d}"
                          data-tip="${r.name}"
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
                          class="mpill ${b.status === "pending"
                            ? "pending"
                            : ""}"
                          style="--room:${col(roomOf(b.roomId))}"
                          >${b.start} ${titleOf(b)}</span
                        >`,
                    )}
                  ${items.length > 3
                    ? html`<span class="mmore"
                        >+${items.length - 3} รายการ</span
                      >`
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
          // เปิดวันจากปฏิทินรายเดือน: ย้ายโฟกัสไปที่หัวข้อวันที่ (ประกาศวันใหม่ให้ผู้ใช้คีย์บอร์ดทราบ)
          return render("fade").then(() => {
            const t = $("#c-title", el);
            t.setAttribute("tabindex", "-1");
            t.focus({ preventScroll: true });
          });
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
          return toast(
            `${room?.name || "ห้องนี้"}ปิดให้บริการชั่วคราว`,
            "warning",
          );
        const closed = dayClosed(date);
        if (closed) return toast(closed, "warning");
        if (
          toEpoch(date, toHHMM(m)) + S.settings.slotMinutes * 60000 <=
          nowMs()
        )
          return toast("ช่วงเวลานี้ผ่านไปแล้ว เลือกเวลาถัดไปแทน", "warning");
        haptic();
        location.href = `book.html?room=${encodeURIComponent(room.id)}&date=${date}&start=${toHHMM(m)}`;
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
          if (scroller && scroller.scrollWidth > scroller.clientWidth + 4)
            return;
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
        // ตารางเวลาเลื่อนในกรอบของตัวเอง (หัวคอลัมน์ห้องจึงติดด้านบนเสมอ)
        const line = $(".now-line", body);
        const pane = $(".tgrid-scroll", body);
        if (line && pane && st.view !== "month") {
          const off =
            line.getBoundingClientRect().top - pane.getBoundingClientRect().top;
          if (off > pane.clientHeight * 0.7)
            pane.scrollTo({
              top: pane.scrollTop + off - pane.clientHeight / 3,
              behavior: motionLevel() === "full" ? "smooth" : "auto",
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
            ${statusBadge(b)}
            ${b.code ? html`<span class="code">${b.code}</span>` : ""}
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
              href="calendar.html?v=day&d=${b.date}&room=${encodeURIComponent(
                r.id,
              )}"
              >${icon("calendar")} ดูตารางห้องนี้</a
            >
            <a
              class="btn btn-primary"
              href="book.html?room=${encodeURIComponent(r.id)}&date=${b.date}"
              >${icon("calendar-plus")} จองห้องนี้วันเดียวกัน</a
            >`,
        );
        foot.addEventListener(
          "click",
          (e) => e.target.closest("a") && m.close(),
        );
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
      acts.push({
        key: "print",
        label: "พิมพ์",
        ic: "printer",
        cls: "btn-ghost",
      });
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
            location.href = `book.html?edit=${b.id}`;
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
              cancelText: "ใช้ห้องต่อ",
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
        confirmText: "ยกเลิกการจอง",
        cancelText: "เก็บการจองไว้",
        danger: true,
        input: {
          label: "เหตุผล (ไม่บังคับ)",
          placeholder: "เช่น เลื่อนการประชุม",
        },
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
      const url = `${baseUrl()}/my.html?code=${encodeURIComponent(b.code)}`;
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
            <img src="${s.logo || "brand/seal.svg"}" alt="" />
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
              พิมพ์เมื่อ ${fmtDate(n.date, "full")} เวลา ${toHHMM(n.minutes)}
              น.<br />${s.contactText}
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
        remember: !!profile.organizer,
        shared: false,
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
              html`<a class="btn btn-soft" href="calendar.html"
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
            <aside
              class="card sum-card"
              id="b-sum"
              aria-label="สรุปการจอง"
            ></aside>
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
                (b) =>
                  m < toMin(b.end) + buf && toMin(b.start) < m + step + buf,
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
              data-tip="${tip}"
              aria-pressed="${inR ? "true" : "false"}"
              aria-label="${toHHMM(sl.m)}–${toHHMM(sl.m + step)} น. · ${sl.busy
                ? "ไม่ว่าง"
                : sl.past
                  ? "ผ่านไปแล้ว"
                  : "ว่าง"}"
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
            html`${icon("check-circle")} เลือกแล้ว
              <b>${f.start}–${f.end} น.</b> · แตะช่องอื่นเพื่อเริ่มเลือกใหม่`,
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
                ${icon("clock", "i-sm")} ${p.label}
                ${toHHMM(p.a)}–${toHHMM(p.z)}
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
                      >ต้องจองอย่างน้อย
                      ${fmtDuration(s.minDurationMinutes)}</span
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
          aria-pressed="${d === f.date ? "true" : "false"}"
          aria-label="${fmtDate(d, "long")}${closed ? ` · ${closed}` : ""}"
          data-tip="${closed || fmtDate(d, "long")}"
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
                      ที่นั่ง${r.active
                        ? ""
                        : " · ปิดชั่วคราว"}${r.needsApproval
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
            <div class="slot-hint" id="b-hint" role="status"></div>
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
              <div
                class="row"
                style="flex-wrap:wrap;align-items:center;gap:12px"
              >
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
                  <button
                    type="button"
                    data-step-btn="1"
                    aria-label="เพิ่มจำนวน"
                  >
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
                          <span class="chip-check"
                            >${icon("check", "i-sm")}</span
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
                          <span class="chip-check"
                            >${icon("check", "i-sm")}</span
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
              >${f.note}</textarea
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
                          aria-pressed="${f.repeat === "none"}"
                        >
                          ไม่ซ้ำ
                        </button>
                        <button
                          type="button"
                          data-value="weekly"
                          aria-pressed="${f.repeat === "weekly"}"
                        >
                          ทุกสัปดาห์
                        </button>
                        <button
                          type="button"
                          data-value="daily"
                          aria-pressed="${f.repeat === "daily"}"
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
                ${f.shared ? raw("disabled") : ""}
              /><span
                >จดจำชื่อ หน่วยงาน และเบอร์โทรไว้ในอุปกรณ์นี้
                สำหรับการจองครั้งถัดไป</span
              ></label
            >
            ${f.editing
              ? ""
              : html`<label class="check full"
                  ><input
                    type="checkbox"
                    name="shared"
                    ${f.shared ? raw("checked") : ""}
                  /><span
                    >นี่เป็นอุปกรณ์ส่วนกลาง — ไม่ต้องเก็บการจองไว้ในอุปกรณ์นี้
                    <small class="field-hint"
                      >จดรหัสการจองไว้
                      แล้วใช้รหัสกับเบอร์โทรเรียกดูจากอุปกรณ์ของคุณภายหลัง</small
                    ></span
                  ></label
                >`}
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
          val
            ? html`<b>${val}</b>`
            : html`<span class="empty-val">${empty}</span>`;
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
                  ${v(
                    f.date ? fmtDate(f.date, "long") : "",
                    "ยังไม่ได้เลือกวัน",
                  )}
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
            >${f.start && f.end
              ? `${f.start}–${f.end} น.`
              : "ยังไม่ได้เลือกเวลา"}`,
        );
      }

      // ---------- step navigation
      function renderStep(dir = "up", focusHead = false) {
        $$(".step", el).forEach((b) => {
          const n = Number(b.dataset.step);
          b.classList.toggle("active", n === f.step);
          b.classList.toggle("done", n < f.step);
          if (n === f.step) b.setAttribute("aria-current", "step");
          else b.removeAttribute("aria-current");
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
            // เปลี่ยนขั้นตอนแล้ว ย้ายโฟกัสไปที่หัวข้อแรกของขั้นตอนใหม่
            if (focusHead) {
              const h = pane.querySelector("h3");
              if (h) {
                h.setAttribute("tabindex", "-1");
                h.focus({ preventScroll: true });
              }
            }
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
        renderStep(dir, true);
      }

      function clearErrors() {
        $$(".field.invalid", pane).forEach((x) =>
          x.classList.remove("invalid"),
        );
        $$(".field-error", pane).forEach((x) => x.remove());
        $$("[aria-invalid]", pane).forEach((x) => {
          x.removeAttribute("aria-invalid");
          x.removeAttribute("aria-describedby");
        });
      }
      // ข้อความผิดพลาดผูกกับช่องกรอก (aria-invalid + aria-describedby) ให้โปรแกรมอ่านหน้าจออ่านได้
      function fieldError(name, msg) {
        const fieldEl = pane.querySelector(`[data-f="${name}"]`);
        if (!fieldEl) return null;
        fieldEl.classList.add("invalid");
        const errId = `err-${name}`;
        fieldEl.insertAdjacentHTML(
          "beforeend",
          `<span class="field-error" id="${errId}"></span>`,
        );
        setHTML(
          fieldEl.lastElementChild,
          html`${icon("alert", "i-sm")} ${msg}`,
        );
        const ctl = fieldEl.querySelector("input, select, textarea");
        if (ctl) {
          ctl.setAttribute("aria-invalid", "true");
          ctl.setAttribute("aria-describedby", errId);
        }
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
            return failToast(
              "ช่วงเวลาที่เลือกไม่ว่าง กรุณาเลือกใหม่",
              "#b-slots",
            );
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
        const target = pane.querySelector(sel);
        shake(target);
        // ข้อความค้างไว้ใต้ตารางเวลา (โปรแกรมอ่านหน้าจออ่านให้ทันที) ไม่หายไปพร้อม toast
        const hint = $("#b-hint", el);
        if (hint) setHTML(hint, html`${icon("alert")} ${msg}`);
        target
          ?.querySelector("button:not([aria-disabled=true]), input")
          ?.focus();
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
        setHTML(
          box,
          html`<div class="faint small">กำลังตรวจสอบห้องว่าง...</div>`,
        );
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
          html`<div
              class="small ${bad ? "" : "muted"}"
              style="margin-bottom:6px"
            >
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
                    data-tip="${x.reason || "ว่าง"}"
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
              return toast(
                "ห้องนี้ปิดให้บริการชั่วคราว เลือกห้องอื่นได้",
                "warning",
              );
            if (sl.past) {
              shake(btn);
              return toast(
                "ช่วงเวลานี้ผ่านไปแล้ว เลือกเวลาถัดไปแทน",
                "warning",
              );
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
            else if (t.name === "shared") {
              // เครื่องส่วนกลาง: ไม่จำข้อมูลผู้จองด้วย
              f.shared = t.checked;
              const rem = pane.querySelector('[name="remember"]');
              rem.disabled = f.shared;
              if (f.shared) rem.checked = f.remember = false;
            } else if (t.name === "repeatCount") {
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
              t.removeAttribute("aria-invalid");
              t.removeAttribute("aria-describedby");
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
              const set =
                eq.dataset.equip !== undefined ? f.equipment : f.services;
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
        const dept =
          f.department === "__other" ? f.deptOther.trim() : f.department;
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
        if (f.remember && !f.shared)
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
            location.href = "my.html";
            return;
          }
          if (f.repeat !== "none")
            body.repeat = { type: f.repeat, count: f.repeatCount };
          if (skipConflicts) body.skipConflicts = true;
          const res = await api("/api/bookings", { method: "POST", body });
          if (!f.shared) {
            my.add(res.token);
            my.load().catch(() => {});
          }
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
                message: html`${conflictList(bad)}
                  <p>ต้องการจองเฉพาะวันที่ว่าง (${okN} ครั้ง) หรือไม่?</p>`,
                confirmText: `จอง ${okN} ครั้งที่ว่าง`,
                cancelText: "เลือกเวลาใหม่",
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
                k === "department" && f.department === "__other"
                  ? "deptOther"
                  : k,
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
                  <path
                    d="${pending ? "M50 27v25l15 9" : "M30 52l13 13 27-29"}"
                  />
                </svg>
                <h2>${pending ? "ส่งคำขอจองแล้ว" : "จองห้องเรียบร้อย"}</h2>
                <p>
                  ${pending
                    ? "รอผู้ดูแลห้องประชุมอนุมัติ หน้า “การจองของฉัน” จะอัปเดตสถานะให้อัตโนมัติ"
                    : "ห้องนี้เป็นของคุณตามเวลาที่จองแล้ว เก็บรหัสการจองไว้ใช้เรียกดูหรือยกเลิกจากอุปกรณ์อื่น"}
                </p>
                ${f.shared
                  ? html`<div class="notice notice-info">
                      ${icon("info")}
                      <div>
                        อุปกรณ์นี้จะไม่จำการจองนี้
                        จดรหัสด้านล่างไว้หรือพิมพ์ใบยืนยัน
                        แล้วใช้รหัสกับเบอร์โทรเรียกดูจากอุปกรณ์ของคุณ
                      </div>
                    </div>`
                  : ""}
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
                          .map(
                            (x) => `${fmtDate(x.date, "short")} (${x.reason})`,
                          )
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
                  ${f.shared
                    ? ""
                    : html`<a class="btn btn-ghost" href="my.html"
                        >${icon("calendar-check")} ดูการจองของฉัน</a
                      >`}
                  <button class="btn btn-primary" data-act="again">
                    ${icon("plus")} จองห้องอีกครั้ง
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
              } else if (act === "ics")
                downloadICS(b, roomOf(b.roomId), s.orgName);
              else if (act === "print") printSlip(b);
              else if (act === "again") location.href = "book.html";
              else if (item)
                openDetail(list.find((x) => x.id === item.dataset.id));
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
                  html`<a class="btn btn-soft" href="my.html"
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

    // ------------------------------------------------------------------ ร้องเรียน / แจ้งปัญหา / ข้อเสนอแนะ
    function viewFeedback(el, q) {
      const type = ["complaint", "bug", "idea"].includes(q.get("type"))
        ? q.get("type")
        : "bug";
      const opt = (v, label) =>
        html`<option value="${v}" ${v === type ? "selected" : ""}>
          ${label}
        </option>`;
      setHTML(
        el,
        html`<div class="page-head">
            <div>
              <h1>ร้องเรียน · แจ้งปัญหา · ข้อเสนอแนะ</h1>
              <p>
                ส่งเรื่องถึงผู้ดูแลห้องประชุม ${S.settings.orgName}
                ไม่ต้องใส่ชื่อก็ได้ ถ้าต้องการให้ติดต่อกลับ
                กรุณาใส่เบอร์โทรหรืออีเมล
              </p>
            </div>
          </div>
          <form class="card form-grid" id="f-form" style="padding:20px">
            <label class="field full"
              ><span>ประเภทเรื่อง <i class="req">*</i></span
              ><select class="select" name="type">
                ${opt("bug", "แจ้งปัญหาการใช้งาน / ระบบผิดพลาด")}
                ${opt("complaint", "ร้องเรียน")}
                ${opt("idea", "ข้อเสนอแนะ / สิ่งที่อยากให้เพิ่ม")}
              </select></label
            >
            <label class="field full"
              ><span>รายละเอียด <i class="req">*</i></span
              ><textarea
                class="textarea"
                name="message"
                rows="6"
                minlength="5"
                maxlength="2000"
                required
                placeholder="เล่าสิ่งที่เกิดขึ้น หน้าไหน ห้องไหน วันเวลาใด หรือสิ่งที่อยากให้ปรับปรุง"
              ></textarea></label
            >
            <label class="field"
              ><span>ชื่อ (ไม่บังคับ)</span
              ><input class="input" name="name" maxlength="100" autocomplete="name"
            /></label>
            <label class="field"
              ><span>เบอร์โทรหรืออีเมลสำหรับติดต่อกลับ (ไม่บังคับ)</span
              ><input class="input" name="contact" maxlength="100"
            /></label>
            <div class="full">
              <button class="btn btn-primary" type="submit">
                ${icon("mail")} ส่งเรื่อง
              </button>
            </div>
          </form>`,
      );
      $("#f-form", el).onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector("button");
        btn.classList.add("is-loading");
        const f = form.elements;
        try {
          await api("/api/feedback", {
            method: "POST",
            body: {
              type: f.type.value,
              message: f.message.value,
              name: f.name.value,
              contact: f.contact.value,
            },
          });
          setHTML(
            el,
            html`<div class="card success">
              <div class="empty-art">${icon("check-circle")}</div>
              <h2>ส่งเรื่องเรียบร้อยแล้ว</h2>
              <p>ขอบคุณที่แจ้งเรื่องนี้ ผู้ดูแลห้องประชุมจะตรวจสอบโดยเร็ว</p>
              <div class="row-wrap">
                <a class="btn btn-soft" href="feedback.html">ส่งเรื่องอื่นอีก</a>
                <a class="btn btn-ghost" href="index.html">กลับหน้าแรก</a>
              </div>
            </div>`,
          );
        } catch (err) {
          toastError(err);
          shake(form);
        } finally {
          btn.classList.remove("is-loading");
        }
      };
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
              <button data-value="upcoming" aria-pressed="true">
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
                >${icon("door", "i-sm")}
                ${r ? `${r.name} ${r.floor}` : "-"}</span
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
                html`<a class="btn btn-primary" href="book.html"
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
                  ? html`<a class="btn btn-soft" href="book.html"
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
                  const same = my.items.filter(
                    (x) => x.token === it.token,
                  ).length;
                  const ok = await confirmDialog({
                    title: "ลบออกจากอุปกรณ์นี้?",
                    message: `${same > 1 ? `รายการในชุดเดียวกัน ${same} รายการจะถูกลบออกจากรายการในอุปกรณ์นี้` : "รายการจะถูกลบออกจากอุปกรณ์นี้เท่านั้น"} (การจองในระบบไม่ถูกยกเลิก — ค้นหากลับมาได้ด้วยรหัสการจองและเบอร์โทร)`,
                    confirmText: "ลบจากอุปกรณ์",
                    cancelText: "เก็บไว้",
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
            body: {
              code: form.code.value.trim(),
              phone: form.phone.value.trim(),
            },
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
              <button
                class="pref-opt ${motion === "off" ? "on" : ""}"
                data-v="off"
              >
                ${icon("ban")}ปิด
              </button>
            </div>
            <span class="field-hint"
              >${motion
                ? html`<button type="button" class="link-btn" data-reset>
                    ใช้ค่าเริ่มต้นของระบบ
                  </button>`
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
      // วาดจากการตั้งค่าที่จำไว้ก่อน (เปลี่ยนหน้าได้ลื่น) แล้วค่อยตรวจกับเซิร์ฟเวอร์
      const cached = store.get(CFG_CACHE);
      let rendered = false;
      if (cached?.settings) {
        const skew = store.get("br.clock.skew");
        if (typeof skew === "number") syncClock(Date.now() + skew);
        applyConfig(cached);
        renderPage();
        rendered = true;
      }
      let changed = false;
      try {
        changed = await loadConfig();
      } catch (err) {
        if (rendered) {
          toastError(err);
        } else {
          setHTML(
            viewEl,
            html`<div class="empty card" style="margin-top:40px">
              <div class="empty-art">${icon("wifi")}</div>
              <b>เชื่อมต่อระบบไม่ได้</b>
              <p class="small">${err.message}</p>
              <button class="btn btn-primary">ลองใหม่</button>
            </div>`,
          );
          viewEl.querySelector(".btn").onclick = () => location.reload();
          return;
        }
      }
      if (!rendered) renderPage();
      else if (changed) {
        // ไม่รีเซ็ตฟอร์มระหว่างกำลังจอง
        if (current.name === "book") current.refresh?.();
        else renderPage();
      }
      initPageTransitions("#view");
      $("#btn-prefs").onclick = openPrefs;
      $("#tab-prefs").onclick = openPrefs;
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
      my.load().catch(() => {});

      let lastTick = 0;
      setInterval(() => {
        const n = bkkNow();
        const topClock = $("#top-clock");
        if (topClock)
          topClock.textContent = `${pad2(Math.floor(n.minutes / 60))}:${pad2(n.minutes % 60)} น.`;
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
          else renderPage(true);
        }, 300),
        status: (ok) => {
          const was = S.online;
          S.online = ok;
          $$(".live-dot").forEach((d) => {
            d.classList.toggle("off", !ok);
            d.textContent = ok
              ? "อัปเดตอัตโนมัติ"
              : "ออฟไลน์ · กำลังเชื่อมต่อใหม่";
          });
          if (ok && !was) onBookings();
        },
      });
      document.addEventListener(
        "visibilitychange",
        () => document.visibilityState === "visible" && onBookings(),
      );
    }

    boot();
  }

  // ================================================================ 6. หน้าผู้ดูแลระบบ (admin*.html)
  function startAdmin() {
    // หน้าผู้ดูแลระบบ

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

    const EMBLEM = raw('<span class="seal" aria-hidden="true"></span>');
    // ชุดสีห้องที่ผ่านการตรวจสอบสำหรับผู้มีภาวะตาบอดสี (ทั้งธีมสว่างและมืด)
    const ROOM_SWATCHES = ["#0284c7", "#7c3aed", "#ea580c", "#0d9488"];
    const BRANDS = [
      ["blue", "#0071e3", "น้ำเงิน (ค่าเริ่มต้น)"],
      ["green", "#0b7a4b", "เขียว กทม."],
      ["teal", "#0f766e", "เขียวน้ำทะเล"],
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
    // แต่ละเมนูเป็นไฟล์ HTML แยก: admin.html (แดชบอร์ด), admin-bookings.html, ...
    const pageFile = (id) =>
      id === "dashboard" ? "admin.html" : `admin-${id}.html`;

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
        id: "kpi",
        label: "รายงานตัวชี้วัด (KPI)",
        icon: "chart",
        role: "staff",
        group: "ภาพรวม",
      },
      {
        id: "feedback",
        label: "ร้องเรียนและข้อเสนอแนะ",
        icon: "mail",
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

    // จำโครงหน้า (ชื่อผู้ใช้/การตั้งค่า) ไว้ในแท็บนี้ เพื่อแสดงเมนูได้ทันทีเมื่อเปลี่ยนหน้า
    // สิทธิ์จริงยังตรวจกับเซิร์ฟเวอร์ทุกครั้ง
    const SHELL_KEY = "br.adm.shell";
    const shellCache = {
      get() {
        try {
          return JSON.parse(sessionStorage.getItem(SHELL_KEY) || "null");
        } catch {
          return null;
        }
      },
      set(v) {
        try {
          sessionStorage.setItem(SHELL_KEY, JSON.stringify(v));
        } catch {
          /* ignore */
        }
      },
      clear() {
        try {
          sessionStorage.removeItem(SHELL_KEY);
        } catch {
          /* ignore */
        }
      },
    };

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
      // หน้าที่ยังไม่บันทึก (หน้าตั้งค่า): ถามก่อนออก — ทำงานก่อนทรานซิชันเปลี่ยนหน้า (capture)
      document.addEventListener(
        "click",
        async (e) => {
          const a = e.target.closest("a[href]");
          if (!a || a.target === "_blank" || !current.dirty?.()) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          const ok = await confirmDialog({
            title: "ยังไม่ได้บันทึกการเปลี่ยนแปลง",
            message: "หากออกจากหน้านี้ การตั้งค่าที่แก้ไขไว้จะหายไป",
            confirmText: "ออกโดยไม่บันทึก",
            cancelText: "อยู่ต่อ",
            danger: true,
          });
          if (!ok) return;
          current.dirty = () => false;
          location.href = a.href;
        },
        true,
      );
      window.addEventListener("beforeunload", (e) => {
        if (current.dirty?.()) {
          e.preventDefault();
          e.returnValue = "";
        }
      });
      const cached = shellCache.get();
      if (cached?.me) {
        A.me = cached.me;
        A.settings = cached.settings || {};
        A.rooms = cached.rooms || [];
        A.pending = cached.pending || 0;
        applyAppearance(A.settings);
        renderShell();
        setHTML(
          $("#sec"),
          html`<div
            class="skel"
            style="height:150px;border-radius:20px"
          ></div>`,
        );
      }
      try {
        await loadPublic();
      } catch (err) {
        setHTML(
          root,
          authLayout(
            html`<div>
              ${authBrand()}
              <div class="auth-head">
                <h1>เชื่อมต่อระบบไม่ได้</h1>
                <p>${err.message}</p>
              </div>
              <button
                class="btn btn-primary btn-lg btn-block auth-submit"
                type="button"
                id="auth-retry"
              >
                ลองใหม่
              </button>
            </div>`,
          ),
        );
        $("#auth-retry").onclick = () => location.reload();
        initAuthFx();
        return;
      }
      try {
        const me = await api("/api/admin/me");
        A.me = me.admin;
        A.pending = me.pendingCount;
        await enter();
      } catch (err) {
        if (err.status === 401) {
          shellCache.clear();
          showLogin();
        } else toastError(err);
      }
    }

    // ช่วงเวลาของวัน (เวลาไทย) ใช้กำหนดสีท้องฟ้าและคำทักทายหน้าเข้าสู่ระบบ
    function dayPart(min) {
      if (min >= 5 * 60 && min < 8 * 60) return "dawn";
      if (min >= 8 * 60 && min < 16 * 60 + 30) return "day";
      if (min >= 16 * 60 + 30 && min < 19 * 60) return "dusk";
      return "night";
    }
    // โครงหน้าเข้าสู่ระบบ: การ์ดกระจกใบเดียวกลางจอ บนท้องฟ้าและทะเลเมฆที่เคลื่อนไหว
    function authLayout(inner) {
      const n = bkkNow();
      return html`<main class="auth t-${dayPart(n.minutes)}">
        <div class="auth-sky" aria-hidden="true">
          <div class="cloud-pan"><div class="cloud-strip"></div></div>
          <div class="cloud-tint"></div>
          <span class="stars"></span>
        </div>
        <div class="auth-clock" aria-hidden="true">
          <b id="auth-time"></b><span id="auth-date"></span>
        </div>
        <div class="auth-card">${inner}</div>
      </main>`;
    }

    // ลูกเล่นหน้าเข้าสู่ระบบ: นาฬิกา, ตราเอียงตามเมาส์, เตือน Caps Lock / แป้นพิมพ์ภาษาไทย
    let authTimer = null;
    function initAuthFx() {
      const auth = $(".auth");
      if (!auth) return;
      clearInterval(authTimer);
      const tick = () => {
        const tEl = $("#auth-time");
        if (!tEl) return clearInterval(authTimer);
        const n = bkkNow();
        tEl.textContent = `${pad2(Math.floor(n.minutes / 60))}:${pad2(n.minutes % 60)}`;
        $("#auth-date").textContent = fmtDate(n.date, "wd");
        auth.className = `auth t-${dayPart(n.minutes)}`;
      };
      tick();
      authTimer = setInterval(tick, 15000);
      // ท้องฟ้าเลื่อนตามเมาส์เล็กน้อย (parallax) เฉพาะเมาส์ และโหมดเอฟเฟกต์เต็ม
      if (matchMedia("(pointer: fine)").matches && motionLevel() === "full") {
        let raf = 0;
        auth.addEventListener("pointermove", (e) => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            auth.style.setProperty(
              "--px",
              (e.clientX / innerWidth - 0.5).toFixed(3),
            );
            auth.style.setProperty(
              "--py",
              (e.clientY / innerHeight - 0.5).toFixed(3),
            );
          });
        });
      }
      // คำเตือนการพิมพ์: Caps Lock เปิด หรือพิมพ์ภาษาไทยในช่องชื่อผู้ใช้/รหัสผ่าน
      $$("input[type=password], input[name=username]", auth).forEach((inp) => {
        const field = inp.closest(".field");
        if (!field || field.querySelector(".key-warn")) return;
        const warn = document.createElement("small");
        warn.className = "key-warn";
        warn.setAttribute("aria-live", "polite");
        field.append(warn);
        const check = (e) => {
          const caps = e.getModifierState?.("CapsLock");
          const thai = /[\u0E00-\u0E7F]/.test(inp.value);
          const msg = thai
            ? "แป้นพิมพ์เป็นภาษาไทยอยู่ กดปุ่ม ~ หรือ Alt+Shift เพื่อเปลี่ยนเป็นภาษาอังกฤษ"
            : caps
              ? "Caps Lock เปิดอยู่"
              : "";
          if (warn.textContent !== msg) {
            warn.textContent = msg;
            warn.classList.toggle("show", !!msg);
          }
        };
        ["keydown", "keyup", "input"].forEach((ev) =>
          inp.addEventListener(ev, check),
        );
        inp.addEventListener("blur", () => {
          warn.textContent = "";
          warn.classList.remove("show");
        });
      });
    }

    // เข้าสู่ระบบสำเร็จ: ปุ่มกลายเป็นเครื่องหมายถูก แล้วการ์ดค่อย ๆ ลอยหายไป
    function authSuccess(btn) {
      return new Promise((resolve) => {
        if (motionLevel() === "off") return resolve();
        btn.classList.remove("is-loading");
        btn.classList.add("is-done");
        setHTML(btn, html`${icon("check")} สำเร็จ`);
        setTimeout(() => $(".auth-card")?.classList.add("leaving"), 550);
        setTimeout(resolve, motionLevel() === "full" ? 980 : 450);
      });
    }

    function authBrand() {
      const s = A.settings;
      return html`<div class="auth-brand">
        <span class="auth-seal"
          >${s.logo ? html`<img src="${s.logo}" alt="" />` : EMBLEM}</span
        >
        <span>${s.orgName} · ${s.siteName}</span>
      </div>`;
    }

    function showLogin() {
      const s = A.settings;
      document.title = `เข้าสู่ระบบผู้ดูแล · ${s.siteName}`;
      setHTML(
        root,
        authLayout(
          html`<form id="login" autocomplete="on" novalidate>
            ${authBrand()}
            <div class="auth-head">
              <p class="auth-greet">${greeting(bkkNow().minutes)}</p>
              <h1>ยินดีต้อนรับกลับ</h1>
              <p>เข้าสู่ระบบผู้ดูแล เพื่ออนุมัติและจัดการการจองห้องประชุม</p>
            </div>
            <label class="field"
              ><span>ชื่อผู้ใช้</span
              ><input
                class="input"
                name="username"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                placeholder="เช่น admin"
                required
            /></label>
            <label class="field"
              ><span>รหัสผ่าน</span>
              <div class="pw-wrap">
                <input
                  class="input"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="รหัสผ่านของคุณ"
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
            <div class="auth-row">
              <span class="faint small"
                >${icon("shield", "i-sm")} ทุกการเข้าสู่ระบบถูกบันทึกไว้</span
              >
              <button type="button" class="link-btn small" id="forgot">
                ลืมรหัสผ่าน?
              </button>
            </div>
            <div id="forgot-tip" hidden>
              <div class="notice">
                ${icon("info")}
                <div>
                  ขอให้ผู้ดูแลระบบอีกคนตั้งรหัสผ่านชั่วคราวให้ที่เมนู
                  “ผู้ใช้งานระบบ” หากไม่มีผู้ดูแลคนอื่น ให้ปิดระบบ แล้วรัน
                  <code>node scripts/reset-admin.js</code> บนเครื่องแม่ข่าย
                </div>
              </div>
            </div>
            <div id="login-err" aria-live="assertive"></div>
            <button
              class="btn btn-primary btn-lg btn-block auth-submit"
              type="submit"
            >
              เข้าสู่ระบบ
            </button>
            <p class="auth-foot">
              <a href="/">${icon("arrow-left", "i-sm")} กลับหน้าจองห้อง</a>
            </p>
          </form>`,
        ),
      );
      const form = $("#login");
      initAuthFx();
      form.username.focus();
      $("#forgot").onclick = () => {
        const tip = $("#forgot-tip");
        tip.hidden = !tip.hidden;
      };
      $(".pw-eye", form).onclick = (e) => {
        const inp = form.password;
        const show = inp.type === "password";
        inp.type = show ? "text" : "password";
        e.currentTarget.setAttribute(
          "aria-label",
          show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน",
        );
        setHTML(e.currentTarget, icon(show ? "eye-off" : "eye"));
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        if (!form.username.value.trim() || !form.password.value) {
          setHTML(
            $("#login-err"),
            html`<div class="notice notice-danger">
              ${icon("alert")}
              <div>กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ</div>
            </div>`,
          );
          shake(form);
          (form.username.value.trim() ? form.password : form.username).focus();
          return;
        }
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
          await authSuccess(btn);
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
      if (A.me.mustChange) return showFirstPassword();
      try {
        await loadRooms();
        if (isAdmin()) A.settings = (await api("/api/admin/settings")).settings;
      } catch (err) {
        toastError(err);
      }
      renderShell();
      await renderSection();
      initPageTransitions(".adm-content");
      startLive();
      shellCache.set({
        me: A.me,
        settings: A.settings,
        rooms: A.rooms,
        pending: A.pending,
      });
    }

    // ------------------------------------------------------------------ shell
    function renderShell() {
      const s = A.settings;
      document.title = `ผู้ดูแลระบบ · ${s.siteName}`;
      const visible = SECTIONS.filter((x) => x.role === "staff" || isAdmin());
      const groups = [...new Set(visible.map((x) => x.group))];
      setHTML(
        root,
        html`<a class="skip-link" href="#sec">ข้ามไปยังเนื้อหา</a>
          <div class="adm">
            <aside class="side" id="side" aria-label="เมนูผู้ดูแล">
              <div class="side-brand">
                <span class="brand-mark"
                  >${s.logo
                    ? html`<img src="${s.logo}" alt="" />`
                    : EMBLEM}</span
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
                              href="${pageFile(x.id)}"
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
                  aria-controls="side"
                  aria-expanded="false"
                >
                  ${icon("menu")}
                </button>
                <h1 id="sec-title"></h1>
                <span class="live-dot" id="live-dot"
                  ><span class="live-text">อัปเดตสด</span></span
                >
                <a
                  class="btn btn-soft btn-sm top-site"
                  href="/"
                  target="_blank"
                  rel="noopener"
                  aria-label="เปิดหน้าจองห้อง (แท็บใหม่)"
                  >${icon("external", "i-sm")} <span>หน้าจองห้อง</span></a
                >
              </header>
              <main class="adm-content" id="sec" tabindex="-1"></main>
            </div>
          </div>`,
      );
      const side = $("#side");
      const menuBtn = $("#btn-menu");
      // เมนูแบบลิ้นชัก (จอเล็ก): เปิดแล้วโฟกัสเมนูปัจจุบัน ปิดด้วย Esc/แตะพื้นหลัง แล้วคืนโฟกัส
      const setMenu = (open, restore = true) => {
        side.classList.toggle("open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
        if (open)
          (
            side.querySelector(".side-link.active") ||
            side.querySelector("a,button")
          )?.focus();
        else if (restore && side.contains(document.activeElement))
          menuBtn.focus();
      };
      menuBtn.onclick = () => setMenu(true);
      $("#scrim").onclick = () => setMenu(false);
      side.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && side.classList.contains("open")) {
          e.stopPropagation();
          setMenu(false);
        }
      });
      side.addEventListener(
        "click",
        (e) => e.target.closest(".side-link") && setMenu(false, false),
      );
      $("#btn-pass").onclick = () => changePassword(false);
      $("#btn-logout").onclick = async () => {
        const ok = await confirmDialog({
          title: "ออกจากระบบ?",
          message: "เมื่อกลับมาใช้เมนูผู้ดูแลอีกครั้ง ต้องเข้าสู่ระบบใหม่",
          confirmText: "ออกจากระบบ",
          cancelText: "อยู่ในระบบต่อ",
          iconName: "log-out",
        });
        if (!ok) return;
        try {
          await api("/api/admin/logout", { method: "POST" });
        } catch {
          /* ignore */
        }
        shellCache.clear();
        location.href = "admin.html";
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
      const base = `${A.secLabel ? `${A.secLabel} · ` : ""}ผู้ดูแลระบบ · ${A.settings.siteName}`;
      document.title = n ? `(${n}) ${base}` : base;
    }

    async function refreshPending() {
      try {
        const me = await api("/api/admin/me");
        updatePending(me.pendingCount);
      } catch (err) {
        if (err.status === 401) {
          shellCache.clear();
          location.reload();
        }
      }
    }

    // เมนูปัจจุบันมาจาก <body data-page> ของไฟล์ HTML (admin.html, admin-bookings.html, ...)
    async function renderSection() {
      const id = document.body.dataset.page || "dashboard";
      const sec = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
      $$(".side-link").forEach((a) => {
        const on = a.dataset.sec === sec.id;
        a.classList.toggle("active", on);
        if (on) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      $("#sec-title").textContent = sec.label;
      A.secLabel = sec.label;
      updatePending();
      try {
        current.cleanup?.();
      } catch {
        /* ignore */
      }
      const el = $("#sec");
      const ctx = { id: sec.id, el };
      current = ctx;
      // container ใหม่ทุกครั้ง เพื่อไม่ให้ event listener เก่าค้างอยู่
      const view = document.createElement("div");
      el.replaceChildren(view);
      ctx.el = view;
      if (sec.role === "admin" && !isAdmin()) {
        setHTML(
          view,
          emptyBox(
            "lock",
            "เมนูนี้สำหรับผู้ดูแลระบบเท่านั้น",
            "บัญชีเจ้าหน้าที่จัดการได้เฉพาะแดชบอร์ดและรายการจอง",
            html`<a class="btn btn-soft" href="admin-bookings.html"
              >${icon("calendar")} ไปที่รายการจอง</a
            >`,
          ),
        );
        return;
      }
      await RENDER[sec.id](view, ctx);
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
          const dot = $("#live-dot");
          if (dot) {
            dot.classList.toggle("off", !ok);
            dot.querySelector(".live-text").textContent = ok
              ? "อัปเดตสด"
              : "ออฟไลน์ · กำลังเชื่อมต่อใหม่";
          }
        },
      });
    }

    // ------------------------------------------------------------------ shared UI
    function sectionHead(title, desc, actions = "") {
      return html`<div class="sec-head">
        <h2>${title}</h2>
        <span class="spacer"></span>${actions}${desc
          ? html`<p>${desc}</p>`
          : ""}
      </div>`;
    }

    function emptyBox(ic, title, text = "", action = "") {
      return html`<div class="empty card">
        <div class="empty-art">${icon(ic)}</div>
        <b>${title}</b>${text
          ? html`<p class="small">${text}</p>`
          : ""}${action}
      </div>`;
    }

    function row(ic, label, value) {
      if (value === "" || value === null || value === undefined) return "";
      return html`<div class="detail-row">
        ${icon(ic)}<span>${label}</span><b>${value}</b>
      </div>`;
    }

    // ฟิลด์ตั้งรหัสผ่านใหม่ (ใช้ทั้งหน้าตั้งรหัสครั้งแรกและหน้าต่างเปลี่ยนรหัสผ่าน)
    const PW_HINT =
      "อย่างน้อย 12 ตัวอักษร วลีที่จำง่ายปลอดภัยกว่าคำสั้นที่ซับซ้อน";
    function passwordFields() {
      return html`<label class="field" data-f="current"
          ><span>รหัสผ่านปัจจุบัน</span
          ><input
            class="input"
            type="password"
            name="current"
            autocomplete="current-password"
            required
        /></label>
        <label class="field" data-f="next"
          ><span>รหัสผ่านใหม่</span
          ><input
            class="input"
            type="password"
            name="next"
            autocomplete="new-password"
            minlength="12"
            aria-describedby="pw-hint"
            required
          /><small class="field-hint" id="pw-hint">${PW_HINT}</small></label
        >
        <label class="field" data-f="confirm"
          ><span>ยืนยันรหัสผ่านใหม่</span
          ><input
            class="input"
            type="password"
            name="confirm"
            autocomplete="new-password"
            required
        /></label>`;
    }

    // ตรวจและส่งรหัสผ่านใหม่ คืนค่า true เมื่อสำเร็จ
    async function submitPassword(form, btn) {
      $$(".field-error", form).forEach((x) => x.remove());
      $$(".invalid", form).forEach((x) => x.classList.remove("invalid"));
      $$("[aria-invalid]", form).forEach((x) =>
        x.removeAttribute("aria-invalid"),
      );
      const err = (k, msg) => {
        const fe = form.querySelector(`[data-f="${k}"]`);
        fe.classList.add("invalid");
        const inp = fe.querySelector("input");
        const note = document.createElement("span");
        note.className = "field-error";
        note.id = `pw-err-${k}`;
        note.textContent = msg;
        fe.append(note);
        inp.setAttribute("aria-invalid", "true");
        inp.setAttribute(
          "aria-describedby",
          k === "next" ? `pw-hint ${note.id}` : note.id,
        );
        shake(fe);
        inp.focus();
      };
      if (!form.current.value) {
        err("current", "กรอกรหัสผ่านที่ใช้อยู่ตอนนี้");
        return false;
      }
      if (form.next.value.length < 12) {
        err("next", "ต้องมีอย่างน้อย 12 ตัวอักษร");
        return false;
      }
      if (form.next.value !== form.confirm.value) {
        err("confirm", "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
        return false;
      }
      btn.classList.add("is-loading");
      try {
        await api("/api/admin/password", {
          method: "POST",
          body: { current: form.current.value, next: form.next.value },
        });
        A.me.mustChange = false;
        return true;
      } catch (e) {
        btn.classList.remove("is-loading");
        const fields = e.data?.fields || {};
        if (Object.keys(fields).length)
          Object.entries(fields).forEach(([k, v]) => err(k, v));
        else toastError(e);
        return false;
      }
    }

    // บัญชีใหม่หรือบัญชีที่ถูกรีเซ็ต: ต้องตั้งรหัสผ่านของตนเองก่อน (เซิร์ฟเวอร์บังคับด้วย)
    function showFirstPassword() {
      const s = A.settings;
      shellCache.clear();
      document.title = `ตั้งรหัสผ่านใหม่ · ${s.siteName}`;
      setHTML(
        root,
        authLayout(
          html`<form id="first-pw" novalidate>
            ${authBrand()}
            <div class="auth-head">
              <h1>ตั้งรหัสผ่านของคุณ</h1>
              <p>
                สวัสดี ${A.me.name} · ตั้งรหัสผ่านใหม่แทนรหัสชั่วคราว
                แล้วเริ่มใช้งานได้ทันที
              </p>
            </div>
            ${passwordFields()}
            <button
              class="btn btn-primary btn-lg btn-block auth-submit"
              type="submit"
            >
              บันทึกและเริ่มใช้งาน
            </button>
            <div class="auth-row">
              <button type="button" class="link-btn small" id="pw-out">
                ออกจากระบบ
              </button>
              <span class="faint small"
                >${icon("shield", "i-sm")} รหัสใหม่ใช้แทนรหัสชั่วคราวทันที</span
              >
            </div>
          </form>`,
        ),
      );
      const form = $("#first-pw");
      initAuthFx();
      form.current.focus();
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        if (await submitPassword(form, btn)) {
          await authSuccess(btn);
          toast("ตั้งรหัสผ่านแล้ว เริ่มใช้งานได้เลย", "success");
          await enter();
        }
      };
      $("#pw-out").onclick = async () => {
        await api("/api/admin/logout", { method: "POST" }).catch(() => {});
        showLogin();
      };
    }

    function changePassword() {
      const body = document.createElement("form");
      body.className = "stack";
      body.noValidate = true;
      setHTML(
        body,
        html`${passwordFields()}<button type="submit" hidden></button>`,
      );
      const foot = document.createElement("div");
      foot.className = "row";
      setHTML(
        foot,
        html`<button class="btn btn-ghost" data-x>กลับ</button
          ><button class="btn btn-primary" data-ok>
            ${icon("check")} บันทึกรหัสผ่านใหม่
          </button>`,
      );
      const m = openModal({
        title: "เปลี่ยนรหัสผ่าน",
        body,
        footer: foot,
        size: "sm",
      });
      foot.querySelector("[data-x]").addEventListener("click", () => m.close());
      const submit = async () => {
        if (await submitPassword(body, foot.querySelector("[data-ok]"))) {
          m.close();
          toast(
            "เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบจะถูกออกจากระบบ",
            "success",
          );
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
        acts.push({
          k: "approved",
          label: "อนุมัติ",
          ic: "check",
          cls: "btn-ok",
        });
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
            ${statusBadge(b)}<span class="code">${b.code}</span>${b.kind ===
            "block"
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
                        ${h.text}<small
                          >${fmtDateTime(h.ts)} · ${h.actor}</small
                        >
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
            cancelText: "เก็บไว้",
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
              aria-pressed="${b.kind !== "block"}"
            >
              ${icon("users", "i-sm")} การประชุม
            </button>
            <button
              type="button"
              data-value="block"
              aria-pressed="${b.kind === "block"}"
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
              ><input
                class="input"
                name="title"
                maxlength="200"
                value="${b.title}"
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
                ${A.departments.map(
                  (d) => html`<option value="${d}"></option>`,
                )}
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
              ><textarea class="textarea" name="note" rows="2" maxlength="1000">${b.note}</textarea
              >
            </label>
            <label class="field full" data-f="adminNote"
              ><span>บันทึกภายใน (เฉพาะผู้ดูแล)</span
              ><textarea
                class="textarea"
                name="adminNote"
                rows="2"
                maxlength="500"
              >${b.adminNote || ""}</textarea
              >
            </label>
            ${!editing && s.enableRecurring
              ? html`<div class="field full">
                  <span>จองซ้ำ</span>
                  <div class="row-wrap">
                    <select
                      class="select"
                      name="repeat"
                      style="max-width:220px"
                    >
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
              message: html`${conflictList(d.conflicts)}
                <p>จองเฉพาะวันที่ว่าง?</p>`,
              confirmText: "จองเฉพาะวันที่ว่าง",
              cancelText: "เลือกวันใหม่",
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
          ? st.perRoom.reduce((s2, r) => s2 + r.utilization, 0) /
            st.perRoom.length
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
              href="admin-bookings.html?status=pending"
              style="text-decoration:none;color:inherit"
              ><span class="k-ic">${icon("hourglass")}</span>
              <div class="k-val" data-v="${st.pendingCount}">0</div>
              <div class="k-label">รออนุมัติ</div>
              <div class="k-sub">
                ${st.pendingCount
                  ? html`คลิกเพื่อจัดการ ${icon("arrow-right", "i-sm")}`
                  : "ไม่มีรายการค้าง"}
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
                <span data-v="${Math.round(util * 100)}">0</span
                ><small>%</small>
              </div>
              <div class="k-label">อัตราการใช้ห้องเฉลี่ย</div>
              <div class="k-sub">
                คิดจาก ${st.range.workDays} วันทำการ ช่วง
                ${st.hours.open}–${st.hours.close} น.
              </div>
            </div>`,
        );
        $$("[data-v]", box).forEach((x) =>
          first
            ? countUp(x, Number(x.dataset.v))
            : (x.textContent = x.dataset.v),
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
        const hours = Array.from(
          { length: Math.max(1, c - o) },
          (_, i) => o + i,
        );
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
                ><a
                  class="btn btn-ghost btn-sm"
                  href="admin-bookings.html?status=pending"
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
                              data-tip="อนุมัติ"
                            >
                              ${icon("check")}
                            </button>
                            <button
                              class="btn btn-danger-soft btn-icon btn-sm"
                              data-st="rejected"
                              aria-label="ไม่อนุมัติ"
                              data-tip="ไม่อนุมัติ"
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
                ><small>ชั่วโมงที่จองเทียบกับชั่วโมงทำการ</small>
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
                        <i
                          style="width:${Math.max(0.5, r.utilization * 100)}%"
                        ></i>
                      </div>
                    </div>`,
                )}
              </div>
            </section>
            <section class="card panel">
              <div class="panel-head">
                <h3>${icon("check-circle")} สถานะการจองในเดือน</h3>
                <span class="spacer"></span
                ><small>ทั้งหมด ${total} รายการ</small>
              </div>
              ${total
                ? html`<div class="stackbar">
                    ${statusDefs.map(([k, c2], i) =>
                      sc[k]
                        ? html`<i
                            style="width:${(sc[k] / total) *
                            100}%;background:${raw(c2)};animation-delay:${i *
                            80}ms"
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
                            style="--v:${v / hmax};--i:${di * hours.length +
                            hi}"
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
                            <b>${d.name}</b
                            ><span class="v">${d.count} ครั้ง</span>
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
      const q0 = new URLSearchParams(location.search);
      const today = bkkNow().date;
      // มีคำขอรออนุมัติ: เปิดมาที่รายการรออนุมัติก่อน (งานที่ต้องทำ)
      const startStatus =
        q0.get("status") || (A.pending > 0 ? "pending" : "upcoming");
      const st = {
        q: "",
        room: "",
        status: startStatus,
        from: "",
        to: "",
        sort: "date_asc",
        page: 1,
        size: 25,
        sel: new Set(),
        preset: startStatus === "pending" ? "pending" : "upcoming",
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
        [
          "all",
          "ทั้งหมด",
          { status: "all", from: "", to: "", sort: "date_desc" },
        ],
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
                <option value="date_asc">วันที่ใช้ (เก่าไปใหม่)</option>
                <option value="date_desc">วันที่ใช้ (ใหม่ไปเก่า)</option>
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
        if (q)
          q.textContent = data.pendingCount ? `(${data.pendingCount})` : "";
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
                          <button type="button" class="t-title t-open">
                            ${titleOf(b)}
                          </button>
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
                                    data-tip="${a.label}"
                                    aria-label="${a.label} ${b.code} ${titleOf(
                                      b,
                                    )}"
                                  >
                                    ${icon(a.ic, "i-sm")}
                                  </button>`,
                              )}
                            <button
                              class="btn btn-ghost btn-icon btn-sm"
                              data-edit
                              data-tip="แก้ไข"
                              aria-label="แก้ไข ${b.code} ${titleOf(b)}"
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
                        aria-label="เลือก ${b.code} ${titleOf(b)}"
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
                          html`<button
                            class="btn btn-sm ${a.cls}"
                            data-st="${a.k}"
                          >
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
                    data-pg="${data.page - 1}"
                    ${data.page <= 1 ? raw("disabled") : ""}
                  >
                    ${icon("chevron-left", "i-sm")} ก่อนหน้า
                  </button>
                  <span>หน้า ${data.page}/${data.pages}</span>
                  <button
                    class="btn btn-sm"
                    data-pg="${data.page + 1}"
                    ${data.page >= data.pages ? raw("disabled") : ""}
                  >
                    ถัดไป ${icon("chevron-right", "i-sm")}
                  </button>
                </div>
              </div>`,
          );
          $$("tbody tr, .bk-card", box).forEach((x, i) => {
            x.style.animation = `rise .45s var(--ease-out) both ${Math.min(i, 8) * 25}ms`;
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
        const pg = e.target.closest("button[data-pg]");
        if (pg && !pg.disabled) {
          st.page = Number(pg.dataset.pg);
          load();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (e.target.closest("[data-selall]")) {
          const on = e.target.checked;
          data.items.forEach((b) =>
            on ? st.sel.add(b.id) : st.sel.delete(b.id),
          );
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
                          <p>
                            รองรับ ${r.capacity} คน · ${approvalTh[r.approval]}
                          </p>
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
                                html`<span class="chip chip-static"
                                  >${e}</span
                                >`,
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
                          data-tip="เลื่อนขึ้น"
                        >
                          ${icon("chevron-up")}
                        </button>
                        <button
                          class="btn btn-ghost btn-icon btn-sm"
                          data-move="1"
                          ${i === rooms.length - 1 ? raw("disabled") : ""}
                          aria-label="เลื่อนลง"
                          data-tip="เลื่อนลง"
                        >
                          ${icon("chevron-down")}
                        </button>
                        <a
                          class="btn btn-ghost btn-sm"
                          href="display.html?room=${encodeURIComponent(r.id)}"
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
            await api("/api/admin/rooms/order", {
              method: "PUT",
              body: { ids },
            });
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
            cancelText: "เก็บห้องไว้",
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
                cancelText: "ไม่นำออก",
                danger: true,
              });
              if (!ok2) return;
              try {
                await api(`/api/admin/rooms/${r.id}?force=1`, {
                  method: "DELETE",
                });
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
            cancelText: "เปิดให้บริการต่อ",
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
      const used = new Set(
        A.rooms.filter((x) => !x.archived).map((x) => x.color),
      );
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
              <option
                value="yes"
                ${d.approval === "yes" ? raw("selected") : ""}
              >
                ต้องอนุมัติเสมอ
              </option>
              <option value="no" ${d.approval === "no" ? raw("selected") : ""}>
                ยืนยันทันทีเสมอ
              </option>
            </select></label
          >
          <label class="field full"
            ><span>คำอธิบาย</span
            ><textarea
              class="textarea"
              name="description"
              rows="2"
              maxlength="300"
            >${d.description}</textarea
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
              <label class="swatch-custom" data-tip="เลือกสีเอง"
                >${icon("palette", "i-sm")}<input
                  type="color"
                  value="${d.color}"
              /></label>
            </div>
          </div>
          <div class="field full" data-f="photo">
            <span
              >รูปห้อง
              <small class="faint">(แสดงบนการ์ดห้องหน้าแรก)</small></span
            >
            <div class="room-photo-edit" id="rf-photo"></div>
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
      // รูปห้อง: ย่อเป็น JPEG ด้านยาวไม่เกิน 1280px ก่อนส่ง (เก็บในฐานข้อมูลเดียวกับการจอง)
      let photo = d.photo || "";
      let photoChanged = false;
      const photoBox = $("#rf-photo", body);
      const drawPhoto = () =>
        setHTML(
          photoBox,
          html`${photo
              ? html`<img class="room-photo" src="${photo}" alt="" />`
              : html`<div class="room-photo empty-photo">${icon("image")}</div>`}
            <div class="row-wrap">
              <label class="btn btn-soft btn-sm"
                >${icon("upload")} ${photo ? "เปลี่ยนรูป" : "เลือกรูป"}<input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
              /></label>
              ${photo
                ? html`<button
                    type="button"
                    class="btn btn-danger-soft btn-sm"
                    data-photo-rm
                  >
                    ${icon("trash")} ลบรูป
                  </button>`
                : ""}
            </div>`,
        );
      drawPhoto();
      photoBox.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          photo = await shrinkImage(file, 1280);
          photoChanged = true;
          drawPhoto();
        } catch {
          toast("เปิดไฟล์รูปนี้ไม่ได้ กรุณาใช้ไฟล์ JPG หรือ PNG", "warning");
        }
      };
      photoBox.onclick = (e) => {
        if (!e.target.closest("[data-photo-rm]")) return;
        photo = "";
        photoChanged = true;
        drawPhoto();
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
        if (photoChanged) payload.photo = photo;
        try {
          if (editing)
            await api(`/api/admin/rooms/${r.id}`, {
              method: "PUT",
              body: payload,
            });
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
                  และวันหยุดชดเชย/วันหยุดพิเศษ เปลี่ยนทุกปี
                  กรุณาเพิ่มเองตามประกาศ
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
          {
            k: "allowHolidays",
            label: "เปิดให้จองวันหยุดราชการ",
            type: "switch",
          },
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
          {
            k: "allowUserEdit",
            label: "ผู้จองแก้ไขการจองเองได้",
            type: "switch",
          },
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
          {
            k: "serviceOptions",
            label: "บริการเสริม",
            type: "tags",
            wide: true,
          },
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
            hint: "Android ทุกรุ่นที่เปิดการสั่นไว้ และ iPhone ที่ใช้ iOS 18 ขึ้นไป (iPad ไม่มีมอเตอร์สั่น)",
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
          {
            k: "displayEnabled",
            label: "เปิดใช้จอแสดงผลหน้าห้อง",
            type: "switch",
          },
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
            >${v}</textarea
            >`;
          case "number":
            return html`<input
                class="input num"
                type="number"
                data-k="${fd.k}"
                value="${v}"
                min="${fd.min}"
                max="${fd.max}"
              />${fd.suffix
                ? html`<span class="suffix">${fd.suffix}</span>`
                : ""}`;
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
                    aria-pressed="${val === v}"
                  >
                    ${label}
                  </button>`,
              )}
            </div>`;
          case "brand":
            return html`<div
              class="swatches brand-swatches"
              data-brand-k="${fd.k}"
            >
              ${BRANDS.map(
                ([key, hex, label]) =>
                  html`<button
                    type="button"
                    class="swatch ${v === key ? "on" : ""}"
                    style="--sw:${hex}"
                    data-v="${key}"
                    data-tip="${label}"
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
                        data-tip="ลบ ${t}"
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
                  class="sr-only"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
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
            <b id="lbl-${fd.k}">${fd.label}</b>${fd.hint
              ? html`<small id="hint-${fd.k}">${fd.hint}</small>`
              : ""}
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
            <b
              >${icon("edit", "i-sm")} <span id="s-count" role="status"></span
            ></b>
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
      // ทุกช่องตั้งค่ามีชื่อ (จากหัวข้อของแถว) และคำอธิบาย ให้โปรแกรมอ่านหน้าจออ่านได้
      function labelRows(scope) {
        $$("[data-row]", scope).forEach((row) => {
          const k = row.dataset.row;
          const hint = row.querySelector(`#hint-${CSS.escape(k)}`);
          row
            .querySelectorAll(
              ".ctl input, .ctl select, .ctl textarea, .ctl .seg",
            )
            .forEach((c) => {
              if (c.type === "file") return;
              if (!c.hasAttribute("aria-label"))
                c.setAttribute("aria-labelledby", `lbl-${k}`);
              if (hint) c.setAttribute("aria-describedby", `hint-${k}`);
              if (c.type === "checkbox" && c.closest(".switch"))
                c.setAttribute("role", "switch");
              if (c.classList.contains("seg")) c.setAttribute("role", "group");
            });
        });
      }
      labelRows(el);

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
        labelRows(el.querySelector(`[data-row="${k}"]`).parentElement);
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
            typeof orig[k] === "number"
              ? Number(e.target.value)
              : e.target.value;
        else draft[k] = e.target.value;
        refreshRow(k);
      });
      el.addEventListener("change", (e) => {
        const logo = e.target.closest("[data-logo]");
        if (logo && e.target.files?.[0]) {
          const file = e.target.files[0];
          if (file.size > 290 * 1024) {
            toast(
              "ไฟล์โลโก้ใหญ่เกิน 300KB ลดขนาดภาพ หรือใช้ไฟล์ SVG/PNG ที่เล็กลง",
              "warning",
            );
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
        renderSection();
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
                                ? html` <span class="badge badge-brand"
                                    >คุณ</span
                                  >`
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
              message:
                "ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้อีก และกู้คืนบัญชีไม่ได้ (ถ้าต้องการพักไว้ ให้ปิดการใช้งานแทน)",
              confirmText: "ลบผู้ใช้",
              cancelText: "เก็บผู้ใช้ไว้",
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
              <option
                value="staff"
                ${u?.role === "staff" ? raw("selected") : ""}
              >
                เจ้าหน้าที่ — จัดการ/อนุมัติการจอง
              </option>
              <option
                value="admin"
                ${u?.role === "admin" ? raw("selected") : ""}
              >
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
          ${self
            ? html`<p class="field-hint">
                เปลี่ยนรหัสผ่านของคุณเองได้ที่ปุ่ม “เปลี่ยนรหัสผ่าน”
                ด้านล่างเมนู
              </p>`
            : html`<div class="field" data-f="password">
                <label for="u-pw"
                  >${editing
                    ? "รหัสผ่านชั่วคราวใหม่"
                    : "รหัสผ่านชั่วคราว"}</label
                >
                <div class="row nowrap">
                  <input
                    class="input"
                    id="u-pw"
                    name="password"
                    type="text"
                    autocomplete="off"
                    spellcheck="false"
                    aria-describedby="u-pw-hint"
                  />
                  <button type="button" class="btn btn-ghost" data-genpw>
                    ${icon("refresh", "i-sm")} สุ่มรหัส
                  </button>
                </div>
                <small class="field-hint" id="u-pw-hint"
                  >${editing
                    ? "เว้นว่างถ้าไม่เปลี่ยน · ผู้ใช้ต้องตั้งรหัสของตนเองเมื่อเข้าสู่ระบบครั้งถัดไป"
                    : "อย่างน้อย 12 ตัวอักษร · แจ้งผู้ใช้ทางช่องทางส่วนตัว ระบบจะให้ตั้งรหัสใหม่เมื่อเข้าสู่ระบบครั้งแรก"}</small
                >
              </div>`}
          ${self
            ? ""
            : html`<label class="field" data-f="confirmPassword"
                ><span>รหัสผ่านของคุณ</span
                ><input
                  class="input"
                  name="confirmPassword"
                  type="password"
                  autocomplete="current-password"
                  aria-describedby="u-cpw-hint"
                /><small class="field-hint" id="u-cpw-hint"
                  >${editing
                    ? "ต้องใส่เมื่อเปลี่ยนสิทธิ์หรือตั้งรหัสผ่านชั่วคราวใหม่"
                    : "ยืนยันตัวตนก่อนเพิ่มผู้ใช้"}</small
                ></label
              >`}`,
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
      const gen = body.querySelector("[data-genpw]");
      if (gen)
        gen.onclick = () => {
          body.password.value = tempPassword();
          body.password.select();
        };
      foot.querySelector("[data-ok]").onclick = async () => {
        const f = body;
        $$(".field-error", f).forEach((x) => x.remove());
        $$(".invalid", f).forEach((x) => x.classList.remove("invalid"));
        const payload = { name: f.name.value.trim(), role: f.role.value };
        if (f.password?.value) payload.password = f.password.value;
        if (f.confirmPassword?.value)
          payload.confirmPassword = f.confirmPassword.value;
        if (f.active) payload.active = f.active.checked;
        if (self) delete payload.role;
        try {
          if (editing)
            await api(`/api/admin/users/${u.id}`, {
              method: "PUT",
              body: payload,
            });
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
          toast(
            editing ? "บันทึกข้อมูลผู้ใช้แล้ว" : "เพิ่มผู้ใช้แล้ว",
            "success",
          );
          if (self) A.me.name = payload.name;
          onSaved?.();
        } catch (err) {
          const fields = err.data?.fields || {};
          Object.entries(fields).forEach(([k, v]) => {
            const fe = body.querySelector(`[data-f="${k}"]`);
            if (!fe) return;
            fe.classList.add("invalid");
            fe.insertAdjacentHTML(
              "beforeend",
              "<span class='field-error'></span>",
            );
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
      "system.purge": "ล้างข้อมูลการจอง",
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
                          class="${l.id > lastTopId && lastTopId
                            ? "log-new"
                            : ""}"
                        >
                          <td>
                            <span
                              class="lvl ${l.level}"
                              data-tip="${LEVEL[l.level]?.[1] || l.level}"
                              >${icon(
                                LEVEL[l.level]?.[0] || "info",
                                "i-sm",
                              )}</span
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
                            <div class="t-sub" data-tip="${l.ua}">
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
                    data-pg="${data.page - 1}"
                    ${data.page <= 1 ? raw("disabled") : ""}
                  >
                    ${icon("chevron-left", "i-sm")} ใหม่กว่า
                  </button>
                  <span>หน้า ${data.page}/${data.pages}</span>
                  <button
                    class="btn btn-sm"
                    data-pg="${data.page + 1}"
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
        const pg = e.target.closest("button[data-pg]");
        if (pg && !pg.disabled) {
          st.page = Number(pg.dataset.pg);
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
              ลบบันทึกที่เก่ากว่าวันที่เลือก ระบบเก็บบันทึก 30 วันล่าสุดไว้เสมอ
              และลบอัตโนมัติเมื่อเกิน ${A.settings.logRetentionDays} วันอยู่แล้ว
              การลบครั้งนี้จะถูกบันทึกไว้ด้วย
            </p>
            <label class="field"
              ><span>ลบบันทึกก่อนวันที่</span
              ><input
                class="input"
                type="date"
                value="${def}"
                max="${addDays(bkkNow().date, -30)}"
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
                และรายชื่อผู้ดูแล (ไม่รวมรหัสผ่าน)
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
                <input
                  type="file"
                  class="sr-only"
                  accept="application/json,.json"
              /></label>
            </section>
            <section class="card panel span-2">
              <div class="panel-head">
                <h3>${icon("trash")} ล้างข้อมูลการจอง</h3>
              </div>
              <p class="muted small">
                ลบการจองเก่าที่ไม่ต้องเก็บแล้ว (ลดข้อมูลส่วนบุคคลตาม PDPA)
                หรือลบการจองทดสอบทั้งหมดก่อนเปิดใช้จริง — ห้อง การตั้งค่า ผู้ใช้
                และบันทึกกิจกรรมไม่ถูกลบ
                ระบบสำรองข้อมูลเดิมไว้ในรายการไฟล์สำรองอัตโนมัติก่อนลบทุกครั้ง
              </p>
              <div class="row">
                <button class="btn btn-ghost" id="bk-purge-old">
                  ${icon("history")} ลบการจองเก่า
                </button>
                <button class="btn btn-danger" id="bk-purge-all">
                  ${icon("trash")} ล้างการจองทั้งหมด
                </button>
              </div>
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
                            href="/api/admin/backups/${encodeURIComponent(
                              b.name,
                            )}"
                            >${icon("download", "i-sm")} ดาวน์โหลด</a
                          >
                        </div>`,
                    )}
                  </div>`
                : html`<div class="faint small">
                    ยังไม่มีไฟล์สำรองอัตโนมัติ
                  </div>`}
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
                      ><b
                        >${sys.counts.bookings.toLocaleString("th-TH")}
                        รายการ</b
                      >
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
          return toast(
            "อ่านไฟล์นี้ไม่ได้ เลือกไฟล์ .json ที่ดาวน์โหลดจากเมนูสำรองข้อมูล",
            "danger",
          );
        }
        const db = data.db || data;
        if (!db || !Array.isArray(db.bookings) || !Array.isArray(db.rooms))
          return toast(
            "ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบจองห้องประชุม เลือกไฟล์ .json ที่ดาวน์โหลดจากเมนูสำรองข้อมูล",
            "danger",
          );
        const hasLogs = Array.isArray(data.logs);
        const r = await confirmDialog({
          title: "ยืนยันการกู้คืนข้อมูล?",
          message: `ไฟล์: ${file.name}\nส่งออกเมื่อ: ${data.exportedAt ? fmtDateTime(Date.parse(data.exportedAt)) : "-"}\nการจอง ${db.bookings.length} รายการ · ห้อง ${db.rooms.length} ห้อง${hasLogs ? ` · บันทึกกิจกรรม ${data.logs.length} รายการ` : ""}\n\nการจอง ห้อง และการตั้งค่าปัจจุบันจะถูกแทนที่ด้วยข้อมูลในไฟล์ (บัญชีผู้ใช้คงเดิม) ระบบสำรองข้อมูลปัจจุบันไว้ให้ก่อนอัตโนมัติ`,
          confirmText: "กู้คืนข้อมูล",
          cancelText: "ไม่กู้คืน",
          danger: true,
          password: { hint: "ใส่รหัสผ่านของคุณเพื่อยืนยันการกู้คืน" },
          choices: hasLogs
            ? [
                { value: "keep", label: "ไม่นำเข้าบันทึกกิจกรรมจากไฟล์" },
                {
                  value: "logs",
                  label: "นำเข้าบันทึกกิจกรรมจากไฟล์ด้วย",
                  hint: "เพิ่มต่อจากบันทึกปัจจุบัน ไม่ลบของเดิม",
                },
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
              confirmPassword: r.password,
            },
          });
          const skipped = res.skipped.bookings + res.skipped.rooms;
          toast(
            `กู้คืนข้อมูลแล้ว: การจอง ${res.bookings} รายการ ห้อง ${res.rooms} ห้อง` +
              (skipped ? ` (ข้ามข้อมูลที่ไม่ถูกต้อง ${skipped} รายการ)` : ""),
            "success",
          );
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
      $("#bk-purge-old", el).onclick = () =>
        purgeDialog("before", sys?.counts?.bookings);
      $("#bk-purge-all", el).onclick = () =>
        purgeDialog("all", sys?.counts?.bookings);
    }

    // ล้างข้อมูลการจอง: ยืนยันรหัสผ่านทุกครั้ง และ "ทั้งหมด" ต้องพิมพ์คำยืนยัน
    function purgeDialog(scope, total) {
      const all = scope === "all";
      const today = bkkNow().date;
      const body = document.createElement("div");
      body.className = "stack";
      setHTML(
        body,
        html`<div class="notice notice-warning">
            ${icon("alert")}
            <div>
              ${all
                ? "การจองทุกรายการจะถูกลบ รวมถึงการจองที่ยังไม่ถึงวัน ใช้เมื่อต้องการล้างข้อมูลทดสอบก่อนเปิดใช้จริง"
                : "การจองที่วันประชุมอยู่ก่อนวันที่เลือกจะถูกลบ การจองตั้งแต่วันที่เลือกเป็นต้นไปยังอยู่ครบ"}
              — ระบบสำรองข้อมูลเดิมไว้ให้ก่อน กู้คืนได้จากไฟล์สำรองอัตโนมัติชื่อ
              <span class="mono">prepurge-…</span>
            </div>
          </div>
          ${all
            ? html`<label class="field"
                ><span>พิมพ์คำว่า <b>ลบทั้งหมด</b> เพื่อยืนยัน</span
                ><input class="input" name="ctext" autocomplete="off" required
              /></label>`
            : html`<label class="field"
                ><span>ลบการจองที่ประชุมก่อนวันที่</span
                ><input
                  class="input"
                  type="date"
                  name="before"
                  value="${addDays(today, -365)}"
                  max="${today}"
                  required
              /></label>`}
          <label class="field"
            ><span>รหัสผ่านของคุณ</span
            ><input
              class="input"
              type="password"
              name="cpw"
              autocomplete="current-password"
              required
            /><small class="field-hint"
              >ยืนยันตัวตนก่อนลบข้อมูล${total != null
                ? ` · ตอนนี้มีการจอง ${total.toLocaleString("th-TH")} รายการ`
                : ""}</small
            ></label
          >`,
      );
      const foot = document.createElement("div");
      foot.className = "row";
      setHTML(
        foot,
        html`<button class="btn btn-ghost" data-x>ไม่ลบ</button
          ><button class="btn btn-danger" data-ok>
            ${icon("trash")} ${all ? "ล้างการจองทั้งหมด" : "ลบการจองเก่า"}
          </button>`,
      );
      const m = openModal({
        title: all ? "ล้างการจองทั้งหมด?" : "ลบการจองเก่า",
        body,
        footer: foot,
        size: "sm",
      });
      const val = (n) => body.querySelector(`[name="${n}"]`)?.value || "";
      foot.querySelector("[data-x]").onclick = () => m.close();
      const ok = foot.querySelector("[data-ok]");
      ok.onclick = async () => {
        if (!val("cpw")) return body.querySelector('[name="cpw"]').focus();
        ok.disabled = true;
        try {
          const res = await api("/api/admin/purge", {
            method: "POST",
            body: all
              ? {
                  scope,
                  confirmText: val("ctext"),
                  confirmPassword: val("cpw"),
                }
              : { scope, before: val("before"), confirmPassword: val("cpw") },
          });
          m.close();
          toast(
            res.removed
              ? `ลบการจองแล้ว ${res.removed.toLocaleString("th-TH")} รายการ`
              : "ไม่มีการจองที่ตรงเงื่อนไข จึงไม่ได้ลบอะไร",
            "success",
          );
          if (res.removed) setTimeout(() => location.reload(), 900);
        } catch (err) {
          ok.disabled = false;
          toastError(err);
        }
      };
    }

    // ------------------------------------------------------------------ CONNECT
    async function secConnect(el, ctx) {
      let sys = null;
      let kioskKey = "";
      try {
        [sys, { key: kioskKey }] = await Promise.all([
          api("/api/admin/system"),
          api("/api/admin/kiosk-key"),
        ]);
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
            sys?.cloud
              ? "ระบบออนไลน์ผ่าน HTTPS เปิดได้จากทุกที่ ไม่ต้องติดตั้งแอป — เปิดเบราว์เซอร์แล้วพิมพ์ที่อยู่ หรือสแกน QR"
              : "ใช้งานผ่าน Wi-Fi/LAN ภายในสำนักงาน ไม่ต้องติดตั้งแอป — เปิดเบราว์เซอร์แล้วพิมพ์ที่อยู่ หรือสแกน QR",
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
            ${sys?.yourIp
              ? html`<p class="small muted">
                  IP ของคุณที่ระบบเห็น:
                  <span class="mono">${sys.yourIp}</span>
                  ${sys.officeNetwork
                    ? "· อยู่ในเครือข่ายสำนักงาน"
                    : sys.cloud
                      ? "· หากเป็นเครื่องในสำนักงาน ให้เพิ่ม IP นี้ใน OFFICE_IPS เพื่อไม่ให้ทั้งสำนักงานถูกจำกัดการใช้งานพร้อมกัน"
                      : ""}
                </p>`
              : ""}
            ${sys?.cloud
              ? html`<ol class="steps-list small">
                  <li>เจ้าหน้าที่เปิดได้ทั้งในสำนักงานและนอกสำนักงาน</li>
                  <li>
                    ข้อมูลอยู่บนเครื่องคลาวด์ —
                    ดาวน์โหลดไฟล์สำรองเก็บไว้เป็นระยะ (เมนูสำรอง/กู้คืนข้อมูล)
                  </li>
                  <li>
                    บนมือถือ กด “เพิ่มไปยังหน้าจอหลัก” จะได้ไอคอนเหมือนแอป
                  </li>
                </ol>`
              : html`<ol class="steps-list small">
                  <li>
                    เครื่องที่รันระบบต้องเปิดไว้
                    และเชื่อมต่อเครือข่ายเดียวกับผู้ใช้
                  </li>
                  <li>
                    ถ้าเครื่องอื่นเข้าไม่ได้ ให้อนุญาต Node.js ใน Windows
                    Firewall (เลือก Private network)
                  </li>
                  <li>
                    แนะนำให้ตั้ง IP ของเครื่องแม่ข่ายเป็นแบบคงที่ (Static IP /
                    DHCP reservation) เพื่อให้ QR ใช้ได้ตลอด
                  </li>
                  <li>
                    บนมือถือ กด “เพิ่มไปยังหน้าจอหลัก” จะได้ไอคอนเหมือนแอป
                  </li>
                </ol>`}
          </section>
          <section class="card panel" style="margin-bottom:16px">
            <div class="panel-head">
              <h3>${icon("key")} รหัสจอหน้าห้อง</h3>
              <span class="spacer"></span>
              <button class="btn btn-ghost btn-sm" id="c-rekey">
                ${icon("refresh", "i-sm")} สร้างรหัสใหม่
              </button>
            </div>
            <p class="small muted">
              ลิงก์จอหน้าห้องด้านล่างมีรหัสจอฝังอยู่
              ปุ่มเช็คอินบนจอจะใช้ได้เฉพาะแท็บเล็ตที่เปิดจากลิงก์นี้
              หากแท็บเล็ตสูญหายหรือสงสัยว่ารหัสรั่วไหล ให้สร้างรหัสใหม่
              แล้วเปิดลิงก์ใหม่บนจอทุกเครื่อง
            </p>
          </section>
          <div class="qr-grid stagger">
            ${card("หน้าจองห้องประชุม", `${base}/`, "สำหรับเจ้าหน้าที่ทุกคน")}
            ${rooms.map((r) =>
              card(
                `จอหน้า${r.name}`,
                `${base}/display.html?room=${encodeURIComponent(r.id)}&key=${kioskKey}`,
                `${r.floor} · เปิดบนแท็บเล็ตหน้าห้อง (ลิงก์นี้มีรหัสจอ ใช้เช็คอินได้)`,
              ),
            )}
            ${card(
              "จอรวมทุกห้อง (ล็อบบี้)",
              `${base}/display.html?key=${kioskKey}`,
              "แสดงสถานะทุกห้องบนจอเดียว",
            )}
            ${card("หน้าผู้ดูแลระบบ", `${base}/admin.html`, "เฉพาะผู้มีบัญชี")}
          </div>`,
      );
      stagger($(".qr-grid", el));
      el.onclick = async (e) => {
        const c = e.target.closest("[data-copy]");
        if (c && (await copyText(c.dataset.copy)))
          toast("คัดลอกแล้ว", "success");
      };
      $("#c-rekey", el).onclick = async () => {
        const r = await confirmDialog({
          title: "สร้างรหัสจอหน้าห้องใหม่?",
          message:
            "จอหน้าห้องทุกเครื่องจะเช็คอินไม่ได้ จนกว่าจะเปิดลิงก์ใหม่จากหน้านี้",
          confirmText: "สร้างรหัสใหม่",
          cancelText: "ใช้รหัสเดิม",
          danger: true,
          iconName: "key",
          password: {},
        });
        if (!r) return;
        try {
          await api("/api/admin/kiosk-key", {
            method: "POST",
            body: { confirmPassword: r.password },
          });
          toast(
            "สร้างรหัสจอใหม่แล้ว เปิดลิงก์ใหม่บนจอหน้าห้องทุกเครื่อง",
            "success",
          );
          secConnect(el, ctx);
        } catch (err) {
          toastError(err);
        }
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
              : html`<img
                  src="brand/logo-bangrak.svg"
                  alt="สำนักงานเขตบางรัก"
                  style="width:120mm;height:auto;margin:0 auto 8mm;display:block"
                />`}
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
                  html`<span
                    ><svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      aria-hidden="true"
                    >
                      <rect width="14" height="14" rx="3" fill="${col(r)}" />
                    </svg>
                    ${r.name} ${r.floor} (${r.capacity} ที่นั่ง)</span
                  >`,
              )}
            </div>
          </div>`,
        );
        setTimeout(() => window.print(), 50);
      };
    }

    // ------------------------------------------------------------------ รายงานตัวชี้วัด (KPI)
    // ช่วงรายงานจากวันที่อ้างอิง: รายวัน / สัปดาห์ (จันทร์–อาทิตย์) / เดือน / ปี หรือกำหนดเอง
    function kpiRange(mode, date, from, to) {
      if (mode === "day") return [date, date];
      if (mode === "week") {
        const mon = addDays(date, -((weekdayOf(date) + 6) % 7));
        return [mon, addDays(mon, 6)];
      }
      if (mode === "month") {
        const first = `${date.slice(0, 8)}01`;
        return [first, addDays(`${addDays(first, 32).slice(0, 8)}01`, -1)];
      }
      if (mode === "year") return [`${date.slice(0, 4)}-01-01`, `${date.slice(0, 4)}-12-31`];
      return [from, to];
    }
    function kpiShift(mode, date, n) {
      if (mode === "day") return addDays(date, n);
      if (mode === "week") return addDays(date, 7 * n);
      const [y, m] = date.split("-").map(Number);
      if (mode === "year") return `${y + n}-${String(m).padStart(2, "0")}-01`;
      const t = y * 12 + (m - 1) + n;
      return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
    }
    function kpiTitle(mode, from, to) {
      if (mode === "day") return `รายวัน ${fmtDate(from, "long")}`;
      if (mode === "month") return `รายเดือน ${fmtDate(from, "month")}`;
      if (mode === "year") return `รายปี พ.ศ. ${Number(from.slice(0, 4)) + 543}`;
      return `${mode === "week" ? "รายสัปดาห์ " : ""}${fmtDate(from, "full")} – ${fmtDate(to, "full")}`;
    }
    const kpiVal = (k) => (k.value === null ? "–" : `${k.value.toLocaleString("th-TH")}`);
    const kpiGoal = (k) => `${k.better === "high" ? "≥" : "≤"} ${k.target} ${k.unit}`;
    const kpiState = (k) =>
      k.pass === null ? ["info", "ไม่มีข้อมูล"] : k.pass ? ["ok", "ผ่านเป้าหมาย"] : ["warn", "ต่ำกว่าเป้าหมาย"];

    async function secKpi(el) {
      const st = { mode: "month", date: bkkNow().date, from: bkkNow().date, to: bkkNow().date };
      let data = null;
      setHTML(
        el,
        html`${sectionHead(
            "รายงานตัวชี้วัด (KPI)",
            "สรุปผลการใช้งานระบบจองห้องประชุมเทียบกับเป้าหมาย สำหรับรายงานผู้บริหาร",
            html`<button class="btn btn-soft" id="k-print">
              ${icon("printer")} พิมพ์ / บันทึก PDF
            </button>`,
          )}
          <div class="toolbar card" style="padding:12px">
            <div class="seg" id="k-mode">
              <button data-value="day">รายวัน</button>
              <button data-value="week">รายสัปดาห์</button>
              <button data-value="month" aria-pressed="true">รายเดือน</button>
              <button data-value="year">รายปี</button>
              <button data-value="custom">กำหนดเอง</button>
            </div>
            <div class="row-wrap date-nav" id="k-nav">
              <button class="btn btn-ghost btn-icon" data-shift="-1" aria-label="ช่วงก่อนหน้า">
                ${icon("chevron-left")}
              </button>
              <input class="input" type="date" id="k-date" aria-label="วันที่อ้างอิง" />
              <button class="btn btn-ghost btn-icon" data-shift="1" aria-label="ช่วงถัดไป">
                ${icon("chevron-right")}
              </button>
            </div>
            <div class="row-wrap" id="k-custom" hidden>
              <label class="field"><span>ตั้งแต่</span><input class="input" type="date" id="k-from" /></label>
              <label class="field"><span>ถึง</span><input class="input" type="date" id="k-to" /></label>
            </div>
          </div>
          <div id="k-body"></div>`,
      );
      const seg = $("#k-mode", el);
      initSeg(seg);
      const body = $("#k-body", el);

      function render() {
        const d = data;
        const u = d.usage;
        setHTML(
          body,
          html`<h3 style="margin:18px 0 12px">${kpiTitle(st.mode, d.from, d.to)}</h3>
            <div class="kpis">
              ${d.kpis.map((k) => {
                const [cls, label] = kpiState(k);
                return html`<div class="kpi ${cls}">
                  <div class="k-ic">${icon(cls === "ok" ? "check-circle" : cls === "warn" ? "alert" : "info")}</div>
                  <div class="k-val">${kpiVal(k)}<small>${k.value === null ? "" : k.unit}</small></div>
                  <div class="k-label">${k.label}</div>
                  <div class="k-sub">เป้าหมาย ${kpiGoal(k)} · <b>${label}</b></div>
                  <div class="k-sub">${k.note}</div>
                </div>`;
              })}
            </div>
            <div class="kpis" style="margin-top:14px">
              ${[
                ["calendar-check", "การจองที่ใช้งานจริง", u.bookings, "รายการ"],
                ["clock", "ชั่วโมงการประชุมรวม", u.hours, "ชม."],
                ["users", "ผู้เข้าร่วมประชุมรวม", u.attendees, "คน"],
                ["building", "หน่วยงานที่ใช้บริการ", u.departments, "หน่วยงาน"],
              ].map(
                ([ic, label, v, unit]) => html`<div class="kpi info">
                  <div class="k-ic">${icon(ic)}</div>
                  <div class="k-val">${v.toLocaleString("th-TH")}<small>${unit}</small></div>
                  <div class="k-label">${label}</div>
                </div>`,
              )}
            </div>
            <div class="split" style="margin-top:14px">
              <section class="card panel">
                <div class="panel-head"><h3>${icon("door")} การใช้งานแยกตามห้อง</h3></div>
                <div class="table-wrap">
                  <table class="table">
                    <thead><tr><th>ห้อง</th><th>การจอง</th><th>ชั่วโมง</th><th>อัตราการใช้</th></tr></thead>
                    <tbody>
                      ${u.perRoom.map(
                        (r) => html`<tr>
                          <td>${r.name}</td><td>${r.count}</td><td>${r.hours}</td>
                          <td>${r.utilization === null ? "–" : `${r.utilization}%`}</td>
                        </tr>`,
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <section class="card panel">
                <div class="panel-head"><h3>${icon("shield")} เรื่องร้องเรียนและความปลอดภัย</h3></div>
                <div class="table-wrap">
                  <table class="table">
                    <tbody>
                      ${Object.entries(d.feedback.byType).map(
                        ([k, v]) => html`<tr><td>${k}</td><td>${v} เรื่อง</td></tr>`,
                      )}
                      <tr><td>เข้าสู่ระบบผู้ดูแลสำเร็จ</td><td>${d.security.logins} ครั้ง</td></tr>
                      <tr><td>เข้าสู่ระบบไม่สำเร็จ</td><td>${d.security.loginFails} ครั้ง</td></tr>
                      <tr><td>เหตุการณ์ด้านความปลอดภัย</td><td>${d.security.events} ครั้ง</td></tr>
                      <tr><td>ดาวน์โหลดไฟล์สำรองข้อมูลด้วยตนเอง</td><td>${d.security.manualBackups} ครั้ง</td></tr>
                      <tr><td>ยกเลิก/ไม่อนุมัติ · คืนห้องอัตโนมัติ</td><td>${u.cancelled} · ${u.released} รายการ</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>`,
        );
      }

      async function load() {
        const [from, to] = kpiRange(st.mode, st.date, st.from, st.to);
        $("#k-date", el).value = st.date;
        $("#k-from", el).value = st.from = from;
        $("#k-to", el).value = st.to = to;
        try {
          data = await api(`/api/admin/kpi?from=${from}&to=${to}`);
          render();
        } catch (err) {
          toastError(err);
        }
      }

      seg.onclick = (e) => {
        const b = e.target.closest("button[data-value]");
        if (!b) return;
        st.mode = b.dataset.value;
        segSelect(seg, st.mode);
        $("#k-nav", el).hidden = st.mode === "custom";
        $("#k-custom", el).hidden = st.mode !== "custom";
        load();
      };
      $("#k-nav", el).onclick = (e) => {
        const b = e.target.closest("[data-shift]");
        if (!b) return;
        st.date = kpiShift(st.mode, st.date, Number(b.dataset.shift));
        load();
      };
      $("#k-date", el).onchange = (e) => {
        if (!e.target.value) return;
        st.date = e.target.value;
        load();
      };
      $("#k-custom", el).onchange = () => {
        const f = $("#k-from", el).value;
        const t = $("#k-to", el).value;
        if (!f || !t) return;
        st.from = f;
        st.to = t < f ? f : t;
        load();
      };
      $("#k-print", el).onclick = () => {
        if (!data) return;
        const s = A.settings;
        const d = data;
        const n = bkkNow();
        setHTML(
          $("#print-root"),
          html`<div class="slip">
            <div class="slip-head">
              <img src="${s.logo || "brand/seal.svg"}" alt="" />
              <div><h1>${s.orgName}</h1><p>${s.siteName}</p></div>
            </div>
            <h2 class="slip-title">รายงานตัวชี้วัดการใช้งานระบบ (KPI)</h2>
            <div class="slip-code">${kpiTitle(st.mode, d.from, d.to)}</div>
            <table class="slip-schedule">
              <thead><tr><th>ตัวชี้วัด</th><th>ผล</th><th>เป้าหมาย</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead>
              <tbody>
                ${d.kpis.map(
                  (k) => html`<tr>
                    <td>${k.label}</td>
                    <td>${kpiVal(k)} ${k.value === null ? "" : k.unit}</td>
                    <td>${kpiGoal(k)}</td>
                    <td>${kpiState(k)[1]}</td>
                    <td>${k.note}</td>
                  </tr>`,
                )}
              </tbody>
            </table>
            <table class="slip-schedule" style="margin-top:6mm">
              <thead><tr><th>ห้อง</th><th>การจอง</th><th>ชั่วโมง</th><th>อัตราการใช้</th></tr></thead>
              <tbody>
                ${d.usage.perRoom.map(
                  (r) => html`<tr><td>${r.name}</td><td>${r.count}</td><td>${r.hours}</td>
                    <td>${r.utilization === null ? "–" : `${r.utilization}%`}</td></tr>`,
                )}
                <tr><td><b>รวม</b></td><td><b>${d.usage.bookings}</b></td><td><b>${d.usage.hours}</b></td><td></td></tr>
              </tbody>
            </table>
            <p style="margin-top:4mm">
              ผู้เข้าร่วมประชุมรวม ${d.usage.attendees.toLocaleString("th-TH")} คน ·
              หน่วยงานที่ใช้บริการ ${d.usage.departments} หน่วยงาน ·
              เรื่องร้องเรียน/แจ้งปัญหา ${d.feedback.total} เรื่อง (ดำเนินการแล้ว ${d.feedback.done}) ·
              เข้าสู่ระบบไม่สำเร็จ ${d.security.loginFails} ครั้ง
            </p>
            <div class="slip-foot">
              <div>
                จัดทำเมื่อ ${fmtDate(n.date, "full")} เวลา ${toHHMM(n.minutes)} น.
                <div class="slip-sign">
                  ลงชื่อ ..................................................... ผู้รายงาน<br />
                  (.....................................................)
                </div>
              </div>
            </div>
          </div>`,
        );
        setTimeout(() => window.print(), 50);
      };
      await load();
    }

    async function secFeedback(el, ctx) {
      let filter = "new";
      let data = { items: [], types: {} };
      setHTML(
        el,
        html`${sectionHead(
            "ร้องเรียน · แจ้งปัญหา · ข้อเสนอแนะ",
            "เรื่องที่ผู้ใช้ส่งมาจากหน้า “ร้องเรียน · แจ้งปัญหา · เสนอแนะ” ท้ายทุกหน้า",
          )}
          <div class="seg" id="fb-seg">
            <button data-value="new" aria-pressed="true">ยังไม่ดำเนินการ</button>
            <button data-value="done">ดำเนินการแล้ว</button>
            <button data-value="all">ทั้งหมด</button>
          </div>
          <div class="my-list" id="fb-list"></div>`,
      );
      const seg = $("#fb-seg", el);
      initSeg(seg);
      const listEl = $("#fb-list", el);
      const badge = { complaint: "badge-danger", bug: "badge-warn", idea: "badge-info" };

      function render() {
        const items = data.items.filter(
          (f) => filter === "all" || f.status === filter,
        );
        setHTML(
          listEl,
          items.length
            ? items.map(
                (f) => html`<article class="card" style="padding:16px 18px">
                  <div class="row-wrap">
                    <span class="badge ${badge[f.type] || ""}"
                      >${data.types[f.type] || f.type}</span
                    >
                    ${f.status === "done"
                      ? html`<span class="badge badge-ok"
                          >${icon("check")} ดำเนินการแล้ว</span
                        >`
                      : ""}
                    <span class="small muted">${fmtDateTime(f.ts)}</span>
                    <span class="spacer"></span>
                    <button class="btn btn-soft btn-sm" data-id="${f.id}">
                      ${f.status === "done"
                        ? html`${icon("refresh")} เปิดเรื่องใหม่`
                        : html`${icon("check")} ทำเครื่องหมายว่าดำเนินการแล้ว`}
                    </button>
                    ${isAdmin()
                      ? html`<button
                          class="btn btn-ghost btn-sm"
                          data-del="${f.id}"
                          data-tip="ลบเรื่องนี้ถาวร"
                          aria-label="ลบเรื่องนี้ถาวร"
                        >
                          ${icon("trash", "i-sm")}
                        </button>`
                      : ""}
                  </div>
                  <p style="white-space:pre-wrap;margin:10px 0 6px">${f.message}</p>
                  ${f.name || f.contact
                    ? html`<div class="small muted">
                        ${icon("user", "i-sm")} ${f.name || "-"}
                        ${f.contact ? html` · ${f.contact}` : ""}
                      </div>`
                    : ""}
                </article>`,
              )
            : emptyBox("mail", "ยังไม่มีเรื่องในหมวดนี้"),
        );
      }

      async function load() {
        try {
          data = await api("/api/admin/feedback");
          render();
        } catch (err) {
          toastError(err);
        }
      }

      seg.onclick = (e) => {
        const b = e.target.closest("button[data-value]");
        if (!b) return;
        filter = b.dataset.value;
        segSelect(seg, filter);
        render();
      };
      listEl.onclick = async (e) => {
        const del = e.target.closest("button[data-del]");
        if (del) {
          const ok = await confirmDialog({
            title: "ลบเรื่องนี้ถาวร?",
            cancelText: "เก็บไว้",
            message:
              "ข้อความ ชื่อ และช่องทางติดต่อของผู้แจ้งจะถูกลบและกู้คืนไม่ได้ (ไฟล์สำรองที่ทำไว้ก่อนหน้ายังมีเรื่องนี้อยู่)",
            confirmText: "ลบถาวร",
            danger: true,
            iconName: "trash",
          });
          if (!ok) return;
          try {
            await api(`/api/admin/feedback/${encodeURIComponent(del.dataset.del)}`, {
              method: "DELETE",
            });
            data.items = data.items.filter((x) => x.id !== del.dataset.del);
            toast("ลบเรื่องแล้ว", "success");
            render();
          } catch (err) {
            toastError(err);
          }
          return;
        }
        const b = e.target.closest("button[data-id]");
        if (!b) return;
        const f = data.items.find((x) => x.id === b.dataset.id);
        b.classList.add("is-loading");
        try {
          const res = await api(`/api/admin/feedback/${encodeURIComponent(f.id)}`, {
            method: "PATCH",
            body: { status: f.status === "done" ? "new" : "done" },
          });
          Object.assign(f, res.item);
          render();
        } catch (err) {
          toastError(err);
          b.classList.remove("is-loading");
        }
      };
      ctx.refresh = load;
      await load();
    }

    const RENDER = {
      dashboard: secDashboard,
      feedback: secFeedback,
      kpi: secKpi,
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
  }

  // ================================================================ 7. จอแสดงผลหน้าห้อง (display.html)
  function startDisplay() {
    // จอแสดงผลหน้าห้อง: display.html?room=<id>  หรือ display.html (ทุกห้อง)

    const S = {
      settings: {},
      rooms: [],
      holidays: new Map(),
      serverUrls: [],
      online: true,
    };
    const rootEl = $("#ds");
    const roomId = new URLSearchParams(location.search).get("room");
    // รหัสจอหน้าห้อง: ได้จากลิงก์ที่ผู้ดูแลสร้าง (…&key=) เก็บไว้ในเครื่องแล้วลบออกจากแถบที่อยู่
    const KIOSK_KEY = "br.kiosk.key";
    {
      const p = new URLSearchParams(location.search);
      const k = p.get("key");
      if (k && /^[A-Za-z0-9_-]{32,}$/.test(k)) {
        store.set(KIOSK_KEY, k);
        p.delete("key");
        const qs = p.toString();
        history.replaceState(
          null,
          "",
          `${location.pathname}${qs ? `?${qs}` : ""}`,
        );
      }
    }
    const kioskKey = () => store.get(KIOSK_KEY, "");
    let list = [];
    let loadedDate = "";
    let first = true;

    const EMBLEM = raw('<span class="seal" aria-hidden="true"></span>');
    const col = (r) =>
      r && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#0284c7";
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
      if (b.kind === "block")
        return `ปิดใช้ห้อง${b.title ? `: ${b.title}` : ""}`;
      return S.settings.displayShowTitle && b.title ? b.title : "การประชุม";
    };

    function dayOff(date) {
      const s = S.settings;
      const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
      const h = S.holidays.get(date);
      if (h && !s.allowHolidays) return h;
      if (!s.allowWeekends && (wd === 0 || wd === 6))
        return "วันหยุดสุดสัปดาห์";
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
      if (off)
        return { key: "off", label: "วันหยุด", sub: off, items, cur, next };
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
            data-tip="เต็มจอ"
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
        const pct = Math.min(
          100,
          Math.max(0, ((n.minutes - a) / (z - a)) * 100),
        );
        return html`<div class="ds-now">
          <span class="lbl"
            >${st.cur.kind === "block" ? "ปิดใช้ห้อง" : "กำลังประชุม"}${st.cur
              .checkedIn
              ? " · เช็คอินแล้ว"
              : ""}</span
          >
          <h2>${titleOf(st.cur)}</h2>
          <div class="meta">
            <span>${icon("clock")} ${st.cur.start}–${st.cur.end} น.</span>${st
              .cur.department
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
      const bookUrl = `${baseUrl()}/book.html?room=${encodeURIComponent(r.id)}`;
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
                ${ci && kioskKey()
                  ? html`<button
                      class="btn btn-checkin"
                      data-checkin="${ci.id}"
                    >
                      ${icon("check-circle")} เช็คอินเข้าใช้ห้อง
                    </button>`
                  : ci
                    ? html`<p class="ds-hint">
                        ${icon("info", "i-sm")} ผู้จองเช็คอินได้จากหน้า
                        “การจองของฉัน” บนมือถือ
                      </p>`
                    : ""}
                ${r.active
                  ? html`<button class="btn btn-ghosty" data-book>
                      ${icon("calendar-plus")} จองห้องนี้
                    </button>`
                  : ""}
                <a class="btn btn-ghosty" href="display.html"
                  >${icon("grid")} ทุกห้อง</a
                >
                ${r.active
                  ? html`<div class="ds-qr">
                      <small
                        >สแกนเพื่อจองห้องนี้<br />ด้วยมือถือ (Wi-Fi
                        สำนักงาน)</small
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
        const body = html`<div
          class="stack center"
          style="justify-items:center"
        >
          <div
            style="width:260px;height:260px;padding:10px;background:#fff;border-radius:18px"
          >
            ${raw(qrSVG(bookUrl))}
          </div>
          <p class="muted">
            สแกนด้วยกล้องมือถือที่เชื่อม Wi-Fi สำนักงาน เพื่อจอง${r.name}
            บนอุปกรณ์ของคุณเอง
          </p>
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
                href="display.html?room=${encodeURIComponent(r.id)}"
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
            ><span
              >เปิดได้ที่หน้าผู้ดูแลระบบ เมนู “ตั้งค่าและฟังก์ชัน”
              หัวข้อจอแสดงผลหน้าห้อง</span
            >
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
              headers: { "X-Kiosk-Key": kioskKey() },
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
      if (t)
        t.textContent = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
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
      const lvl = cfg.settings.motionLevel || "full";
      document.documentElement.dataset.motion =
        lvl === "full" && matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "reduced"
          : lvl;
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
      initPageTransitions("#ds");
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
  }

  // ================================================================ เริ่มทำงาน
  function start() {
    const run = { user: startUser, admin: startAdmin, display: startDisplay }[
      document.body.dataset.app
    ];
    if (run) run();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
