#!/bin/sh
# เริ่มระบบจองห้องประชุม (macOS / Linux) — หากระบบหยุดเพราะข้อผิดพลาด จะเริ่มใหม่อัตโนมัติ
# เปิดแบบ HTTPS:  ./start.sh --https   (สร้างใบรับรองด้วย mkcert ให้อัตโนมัติ)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "ไม่พบ Node.js — กรุณาติดตั้งรุ่น LTS จาก https://nodejs.org"
  exit 1
fi

https=0
for a do
  shift
  if [ "$a" = "--https" ]; then https=1; else set -- "$@" "$a"; fi
done
if [ "$https" = 1 ]; then
  certdir=$(node scripts/https-cert.js "$@") || exit 1
  case " $* " in
    *" --port="*) ;;
    *)
      # macOS และผู้ใช้ root เปิดพอร์ต 443 ได้ (ไม่ต้องพิมพ์เลขพอร์ตในที่อยู่เว็บ)
      if [ -z "$PORT" ]; then
        if [ "$(uname)" = Darwin ] || [ "$(id -u)" = 0 ]; then
          set -- "$@" --port=443
        else
          set -- "$@" --port=3443
        fi
      fi
      ;;
  esac
  set -- "$@" "--tls-cert=$certdir/cert.pem" "--tls-key=$certdir/key.pem"
fi

trap 'exit 0' INT TERM
while true; do
  node server.js "$@"
  code=$?
  # ปิดด้วย Ctrl+C หรือคำสั่งหยุด (รหัส 0/130/143) ไม่ต้องเริ่มใหม่
  [ "$code" -eq 0 ] || [ "$code" -eq 130 ] || [ "$code" -eq 143 ] && exit 0
  echo "ระบบหยุดทำงาน (รหัส $code) — จะเริ่มใหม่ใน 5 วินาที"
  sleep 5
done
