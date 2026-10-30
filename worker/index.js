// ลิงก์ถาวร (workers.dev) ที่ส่งต่อไปยังที่อยู่ Quick Tunnel ล่าสุดของเครื่องที่รันระบบ
// ที่อยู่ tunnel เปลี่ยนทุกครั้งที่เปิดใหม่ scripts/start-public.sh จึงแจ้งที่อยู่ใหม่มาที่ POST /__tunnel
// โดยต้องมีรหัส UPDATE_TOKEN (ตั้งเป็น Secret ของ Worker นี้) ไม่เช่นนั้นใครก็เปลี่ยนปลายทางได้
import { DurableObject } from "cloudflare:workers";

// รับเฉพาะ Quick Tunnel ของ Cloudflare กันการพาผู้ใช้ไปเว็บอื่นแม้รหัสจะหลุด
const TUNNEL_RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;

export class TunnelTarget extends DurableObject {
  async get() {
    return (await this.ctx.storage.get("url")) || "";
  }
  async set(url) {
    await this.ctx.storage.put("url", url);
  }
}

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all(
    [a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))),
  );
  return crypto.subtle.timingSafeEqual(x, y);
}

const OFFLINE_HTML = `<!doctype html><html lang="th"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ระบบจองห้องประชุม · ปิดชั่วคราว</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center">
<h1>ระบบจองห้องประชุมปิดอยู่ชั่วคราว</h1>
<p>เครื่องที่ให้บริการยังไม่ได้เปิด กรุณาลองใหม่อีกครั้งภายหลัง หรือติดต่อผู้ดูแลระบบ</p>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = env.TUNNEL.get(env.TUNNEL.idFromName("main"));

    if (url.pathname === "/__tunnel") {
      if (request.method !== "POST")
        return new Response("Method Not Allowed", { status: 405 });
      const auth = request.headers.get("authorization") || "";
      if (
        !env.UPDATE_TOKEN ||
        !(await sameSecret(auth, `Bearer ${env.UPDATE_TOKEN}`))
      )
        return new Response("Unauthorized", { status: 401 });
      const next = (await request.text()).trim();
      if (!TUNNEL_RE.test(next))
        return new Response("Bad Request", { status: 400 });
      await target.set(next);
      return new Response("ok");
    }

    const dest = await target.get();
    if (!dest)
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      });
    return new Response(null, {
      status: 302,
      headers: {
        Location: dest + url.pathname + url.search,
        "Cache-Control": "no-store",
      },
    });
  },
};
