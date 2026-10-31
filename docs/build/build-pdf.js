#!/usr/bin/env node
"use strict";

// สร้างคู่มือฉบับ PDF (A4) จากไฟล์ Markdown ใน docs/ — ปก สารบัญพร้อมเลขหน้า หน้าคั่นส่วน และคำบรรยายภาพ
// ต้องมี: pandoc, pdftotext (poppler-utils) และ Playwright + Chromium
// ใช้:  node docs/build/build-pdf.js            (สร้างทั้ง 4 ฉบับลง docs/pdf/)
//       node docs/build/build-pdf.js user-guide.th

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const DOCS_DIR = path.resolve(__dirname, "..");
const OUT_DIR = path.join(DOCS_DIR, "pdf");

const LANG = {
  th: {
    org: "สำนักงานเขตบางรัก · กรุงเทพมหานคร",
    sys: "ระบบจองห้องประชุม",
    chips: ["ห้องประชุมเล็ก ชั้น 2", "ห้องประชุมใหญ่ ชั้น 4"],
    ver: "ฉบับที่ 1.0 · ตุลาคม 2569",
    toc: "สารบัญ",
    about: "เกี่ยวกับคู่มือนี้",
    fig: "ภาพที่",
    page: "หน้า",
    part: "ส่วน",
  },
  en: {
    org: "Bang Rak District Office · Bangkok",
    sys: "Meeting Room Booking System",
    chips: ["Small Meeting Room · 2nd floor", "Large Meeting Room · 4th floor"],
    ver: "Version 1.0 · October 2026",
    toc: "Contents",
    about: "About this guide",
    fig: "Figure",
    page: "Page",
    part: "Part",
  },
};

const DOCS = {
  "user-guide.th": {
    shot: "images/u-home.jpg",
    kicker: "คู่มือการใช้งาน",
    title: "สำหรับเจ้าหน้าที่",
    sub: "ดูตารางห้อง · จองห้อง · จัดการการจองของตนเอง",
    footer: "คู่มือเจ้าหน้าที่ · ระบบจองห้องประชุม สำนักงานเขตบางรัก",
  },
  "user-guide.en": {
    shot: "images/u-home.jpg",
    kicker: "User Guide",
    title: "For Staff",
    sub: "View schedules · Book rooms · Manage your bookings",
    footer:
      "Staff User Guide · Meeting Room Booking System, Bang Rak District Office",
  },
  "admin-guide.th": {
    shot: "images/a-dash.jpg",
    kicker: "คู่มือและเอกสารส่งมอบ",
    title: "ผู้ดูแลระบบ<br>และฝ่าย IT",
    sub: "การใช้หน้าผู้ดูแล · การติดตั้ง · HTTPS · ความปลอดภัย · การสำรองข้อมูล",
    footer: "คู่มือผู้ดูแลระบบและฝ่าย IT · ระบบจองห้องประชุม สำนักงานเขตบางรัก",
  },
  "admin-guide.en": {
    shot: "images/a-dash.jpg",
    kicker: "Handover Guide",
    title: "Administrators<br>&amp; IT",
    sub: "Admin pages · Deployment · HTTPS · Security · Backups",
    footer:
      "Administrator & IT Guide · Meeting Room Booking System, Bang Rak District Office",
  },
};

// แปลงเนื้อหา (ทำงานในหน้าเว็บ): ปก สารบัญ หน้าคั่นส่วน หัวข้อ ภาพ ตาราง
function transform({ doc, L, pages, markers }) {
  const src = document.getElementById("src");
  const nodes = [...src.children];
  const isToc = (n) =>
    n.tagName === "H2" && /^(สารบัญ|Contents)$/.test(n.textContent.trim());
  const tocIdx = nodes.findIndex(isToc);
  const intro = nodes
    .slice(1, tocIdx)
    .filter(
      (n, i) =>
        !(i === 0 && n.tagName === "P") &&
        n.tagName !== "HR" &&
        !n.querySelector('a[href$=".md"]'),
    );
  let start = nodes.findIndex(
    (n, i) => i > tocIdx && (n.tagName === "H1" || n.tagName === "H2"),
  );
  const content = document.createElement("div");
  content.className = "content";
  nodes.slice(start).forEach((n) => content.appendChild(n));

  // ลิงก์ไปไฟล์อื่น ใช้ไม่ได้ใน PDF: เหลือเป็นข้อความ
  content.querySelectorAll("a").forEach((a) => {
    const h = a.getAttribute("href") || "";
    if (!h.startsWith("#") && !/^https?:/.test(h))
      a.replaceWith(...a.childNodes);
  });
  content.querySelectorAll("hr").forEach((hr) => hr.remove());

  // หัวข้อระดับ 2: เลขหัวข้อเป็นป้าย
  const entries = [];
  content.querySelectorAll("h2").forEach((h) => {
    const m = /^(\d+)\.\s*(.*)$/.exec(
      h.textContent.replace(/\s+/g, " ").trim(),
    );
    if (!m) return;
    h.innerHTML = `<span class="n">${m[1]}</span><span class="t"></span>`;
    h.querySelector(".t").textContent = m[2];
    entries.push({ el: h, n: m[1], t: m[2], part: false });
  });

  // หัวข้อระดับ 1 = ส่วนของเอกสาร: ทำเป็นหน้าคั่น
  [...content.querySelectorAll("h1")].forEach((h) => {
    const [lbl, ...rest] = h.textContent
      .replace(/\s+/g, " ")
      .trim()
      .split(" — ");
    const title = rest.join(" — ") || lbl;
    const letter = lbl.trim().split(/\s+/).pop();
    const sections = [];
    for (
      let n = h.nextElementSibling;
      n && n.tagName !== "H1";
      n = n.nextElementSibling
    )
      if (n.tagName === "H2" && n.querySelector(".n"))
        sections.push([
          n.querySelector(".n").textContent,
          n.querySelector(".t").textContent,
        ]);
    const div = document.createElement("section");
    div.className = "part-page";
    div.innerHTML = `<img class="seal-w" src="../public/brand/seal.svg" alt=""><div class="big"></div><div class="lbl"></div><h1></h1><ol></ol>`;
    div.querySelector(".big").textContent = letter;
    div.querySelector(".lbl").textContent = lbl.trim();
    const h1 = div.querySelector("h1");
    h1.id = h.id;
    h1.textContent = title;
    sections.forEach(([n, t]) => {
      const li = document.createElement("li");
      li.innerHTML = `<b></b><span></span>`;
      li.firstChild.textContent = n;
      li.lastChild.textContent = t;
      div.querySelector("ol").appendChild(li);
    });
    h.replaceWith(div);
    entries.push({ el: h1, n: letter, t: title, part: true });
  });
  entries.sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );

  // ภาพ: ย่อหน้าที่มีแต่รูป -> figure พร้อมคำบรรยาย
  let figNo = 0;
  content.querySelectorAll("p").forEach((p) => {
    const imgs = [...p.querySelectorAll("img")];
    if (!imgs.length || p.textContent.trim()) return;
    const fig = document.createElement("figure");
    if (imgs.length > 1) fig.className = "pair";
    imgs.forEach((img) => {
      img.removeAttribute("width");
      const fr = document.createElement("span");
      fr.className = "frame";
      fr.appendChild(img);
      fig.appendChild(fr);
    });
    const cap = document.createElement("figcaption");
    const first = ++figNo;
    if (imgs.length > 1) figNo += imgs.length - 1;
    cap.innerHTML = `<b>${L.fig} ${first === figNo ? first : `${first}–${figNo}`}</b><span></span>`;
    cap.lastChild.textContent = imgs.map((i) => i.alt).join(" · ");
    fig.appendChild(cap);
    p.replaceWith(fig);
  });

  // ตารางลงชื่อ (ช่องว่างทั้งหมด)
  content.querySelectorAll("table").forEach((t) => {
    const cells = [...t.querySelectorAll("tbody td")];
    if (cells.length && cells.every((c) => !c.textContent.trim()))
      t.classList.add("sign");
  });

  // หมายเหตุท้ายเอกสาร
  const last = content.lastElementChild;
  if (last && last.tagName === "P" && last.querySelector("em")) {
    last.className = "endnote";
  }

  // ปก
  const cover = document.createElement("section");
  cover.className = "cover";
  cover.innerHTML = `
    <div class="org-top"></div><div class="ver"></div>
    <div class="seal"><img src="../public/brand/seal.svg" alt=""></div>
    <div class="titles">
      <div class="org"></div>
      <div class="kicker"></div>
      <h1 class="ct">${doc.title}</h1>
      <div class="sys"></div>
      <div class="sub"></div>
      <div class="chips">${L.chips.map((c) => `<span>${c}</span>`).join("")}</div>
    </div>
    <div class="shot"><img src="${doc.shot}" alt=""></div>
    <div class="band"></div>`;
  cover.querySelector(".org-top").textContent = L.sys;
  cover.querySelector(".ver").textContent = L.ver;
  cover.querySelector(".org").textContent = L.org;
  cover.querySelector(".kicker").textContent = doc.kicker;
  cover.querySelector(".sys").textContent = L.sys;
  cover.querySelector(".sub").textContent = doc.sub;

  // สารบัญ
  const toc = document.createElement("section");
  toc.className = "toc-page";
  toc.innerHTML = `<h2 class="toc-h"></h2><div class="about"><h3></h3></div><ol class="toc"></ol>`;
  toc.querySelector(".toc-h").textContent = L.toc;
  toc.querySelector(".about h3").textContent = L.about;
  intro.forEach((n) => toc.querySelector(".about").appendChild(n));
  entries.forEach((e, i) => {
    const li = document.createElement("li");
    if (e.part) li.className = "part";
    li.innerHTML = `<a href="#${e.el.id}"><span class="n"></span><span class="t"></span><span class="p"></span></a>`;
    li.querySelector(".n").textContent = e.n;
    li.querySelector(".t").textContent = e.t;
    li.querySelector(".p").textContent = pages[i] || "";
    toc.querySelector(".toc").appendChild(li);
    if (markers) {
      const m = document.createElement("span");
      m.className = "mark";
      m.textContent = `ZQ${i}QZ`;
      e.el.appendChild(m);
    }
  });

  src.replaceWith(cover, toc, content);
  return entries.length;
}

async function render(page, name, html, opts) {
  await page.goto(html, { waitUntil: "load" });
  const count = await page.evaluate(transform, opts);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) =>
        i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)),
      ),
    );
  });
  return {
    count,
    pdf: await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    }),
  };
}

async function build(browser, name) {
  const doc = DOCS[name];
  const L = LANG[name.split(".").pop()];
  const fragment = execFileSync(
    "pandoc",
    [
      "-f",
      "gfm+gfm_auto_identifiers",
      "-t",
      "html5",
      path.join(DOCS_DIR, `${name}.md`),
    ],
    { encoding: "utf8" },
  );
  const htmlFile = path.join(__dirname, `.${name}.html`);
  fs.writeFileSync(
    htmlFile,
    `<!doctype html><html lang="${name.split(".").pop()}"><head><meta charset="utf-8">
<base href="file://${DOCS_DIR}/"><link rel="stylesheet" href="build/manual.css">
<style>@page{@bottom-left{content:${JSON.stringify(doc.footer)}}@bottom-right{content:${JSON.stringify(`${L.page} `)} counter(page) " / " counter(pages)}@top-right{content:${JSON.stringify(L.sys + " · " + L.org)}}}</style></head>
<body><div id="src">${fragment}</div></body></html>`,
  );
  const html = `file://${htmlFile}`;
  const page = await browser.newPage();
  // รอบแรก: หาเลขหน้าของแต่ละหัวข้อจากตัวระบุที่ซ่อนไว้
  const first = await render(page, name, html, {
    doc,
    L,
    pages: [],
    markers: true,
  });
  const tmp = path.join(os.tmpdir(), `manual-${process.pid}.pdf`);
  fs.writeFileSync(tmp, first.pdf);
  const text = execFileSync("pdftotext", ["-layout", tmp, "-"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  fs.unlinkSync(tmp);
  const pageTexts = text.split("\f");
  const pages = [];
  for (let i = 0; i < first.count; i++) {
    const at = pageTexts.findIndex((t) => t.includes(`ZQ${i}QZ`));
    pages.push(at >= 0 ? String(at + 1) : "");
  }
  // รอบสอง: ฉบับจริงพร้อมเลขหน้าในสารบัญ
  const final = await render(page, name, html, {
    doc,
    L,
    pages,
    markers: false,
  });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.pdf`), final.pdf);
  await page.close();
  fs.unlinkSync(htmlFile);
  const missing = pages.filter((p) => !p).length;
  console.log(
    `${name}.pdf  (${pageTexts.length - 1} หน้า${missing ? `, ไม่พบเลขหน้า ${missing} หัวข้อ` : ""})`,
  );
}

(async () => {
  const names = process.argv.slice(2).length
    ? process.argv.slice(2)
    : Object.keys(DOCS);
  const browser = await chromium.launch();
  try {
    for (const n of names) await build(browser, n);
  } finally {
    await browser.close();
  }
})();
