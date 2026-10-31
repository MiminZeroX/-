// ตัวแปลงคำขอ/คำตอบของ Workers (Request/Response) ให้เป็นแบบ Node (req/res)
// เพื่อใช้ตัวจัดการคำขอเดิมของระบบ (createApp().handle) ได้โดยไม่ต้องแก้
// รองรับเท่าที่ระบบใช้: อ่าน body ทีละท่อน (หยุดได้เมื่อเกินขนาด), writeHead/write/end และสตรีมสด (SSE)

import { Buffer } from "node:buffer";

const encoder = new TextEncoder();
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
]);

const toBytes = (chunk) =>
  typeof chunk === "string" ? encoder.encode(chunk) : new Uint8Array(chunk);

function toHeaders(obj) {
  const h = new Headers();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || HOP_BY_HOP.has(k.toLowerCase())) continue;
    if (Array.isArray(v)) v.forEach((x) => h.append(k, String(x)));
    else h.set(k, String(v));
  }
  return h;
}

export function serveNode(handle, request, clientIp) {
  return new Promise((resolve) => {
    const url = new URL(request.url);
    const listeners = {};
    const emit = (ev, ...args) =>
      (listeners[ev] || []).slice().forEach((fn) => fn(...args));
    let reader = null;
    let stopped = false;
    let pumping = false;

    const stopBody = () => {
      stopped = true;
      if (reader) reader.cancel().catch(() => {});
      else if (request.body) request.body.cancel().catch(() => {});
    };

    async function pump() {
      if (!request.body) {
        emit("end");
        return;
      }
      reader = request.body.getReader();
      try {
        for (;;) {
          if (stopped) return;
          const { done, value } = await reader.read();
          if (done) break;
          if (!stopped) emit("data", Buffer.from(value));
        }
        if (!stopped) emit("end");
      } catch (err) {
        if (!stopped) emit("error", err);
      }
    }

    const headers = {};
    request.headers.forEach((v, k) => {
      headers[k] = v;
    });
    // คำขอที่มีข้อมูลแต่ไม่บอกความยาว: ให้ตัวตรวจชนิดข้อมูลของระบบรู้ว่ามี body
    if (
      request.body &&
      !headers["content-length"] &&
      !headers["transfer-encoding"]
    )
      headers["transfer-encoding"] = "chunked";

    const req = {
      method: request.method,
      url: url.pathname + url.search,
      headers,
      socket: { remoteAddress: clientIp },
      on(ev, fn) {
        (listeners[ev] ||= []).push(fn);
        if ((ev === "data" || ev === "end") && !pumping) {
          pumping = true;
          queueMicrotask(pump);
        }
        return req;
      },
      // หยุดรับข้อมูลที่เหลือ (ข้อมูลเกินขนาด) / ทิ้งข้อมูลที่ไม่ใช้
      pause: stopBody,
      resume: stopBody,
    };

    // ผู้ใช้ปิดหน้า/ตัดการเชื่อมต่อ (Cloudflare แจ้งผ่าน request.signal)
    request.signal?.addEventListener("abort", () => {
      if (ctrl && !ended) {
        ended = true;
        try {
          ctrl.close();
        } catch {
          /* ปิดไปแล้ว */
        }
        emit("close");
      }
    });

    let status = 200;
    const outHeaders = {};
    let ctrl = null;
    let settled = false;
    let ended = false;

    const finish = (response) => {
      if (settled) return;
      settled = true;
      resolve(response);
    };

    // เริ่มส่งแบบสตรีม (ใช้กับการอัปเดตสด) — ผู้ใช้ปิดหน้า = สตรีมถูกยกเลิก = แจ้ง "close"
    function startStream() {
      const stream = new ReadableStream({
        start(c) {
          ctrl = c;
        },
        cancel() {
          ended = true;
          emit("close");
        },
      });
      finish(new Response(stream, { status, headers: toHeaders(outHeaders) }));
    }

    const res = {
      headersSent: false,
      writeHead(code, h = {}) {
        status = code;
        Object.assign(outHeaders, h);
        res.headersSent = true;
        return res;
      },
      setHeader(k, v) {
        outHeaders[k] = v;
      },
      write(chunk) {
        if (ended) throw new Error("stream closed");
        if (!ctrl) startStream();
        ctrl.enqueue(toBytes(chunk));
        return true;
      },
      end(chunk) {
        if (ended) return res;
        ended = true;
        res.headersSent = true;
        if (ctrl) {
          if (chunk != null) ctrl.enqueue(toBytes(chunk));
          try {
            ctrl.close();
          } catch {
            /* ปิดไปแล้ว */
          }
          emit("close");
          return res;
        }
        const noBody =
          request.method === "HEAD" || status === 204 || status === 304;
        finish(
          new Response(noBody || chunk == null ? null : toBytes(chunk), {
            status,
            headers: toHeaders(outHeaders),
          }),
        );
        emit("close");
        return res;
      },
      on() {
        return res;
      },
    };

    Promise.resolve()
      .then(() => handle(req, res))
      .catch((err) => {
        console.error("[error]", err);
        if (!res.headersSent)
          res
            .writeHead(500, {
              "Content-Type": "application/json; charset=utf-8",
            })
            .end(JSON.stringify({ error: "เกิดข้อผิดพลาดภายในระบบ" }));
      })
      .finally(() => {
        // ตัวจัดการจบโดยไม่ได้ส่งคำตอบ (ไม่ควรเกิด) — ตอบ 500 แทนการค้าง
        if (!settled && !ctrl)
          finish(new Response("Internal Server Error", { status: 500 }));
      });
  });
}
