#!/bin/sh
# เริ่มระบบจองห้องประชุม (macOS / Linux) — หากระบบหยุดเพราะข้อผิดพลาด จะเริ่มใหม่อัตโนมัติ
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "ไม่พบ Node.js — กรุณาติดตั้งรุ่น LTS จาก https://nodejs.org"
  exit 1
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
