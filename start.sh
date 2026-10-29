#!/bin/sh
# เริ่มระบบจองห้องประชุม (macOS / Linux)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "ไม่พบ Node.js — กรุณาติดตั้งรุ่น LTS จาก https://nodejs.org"
  exit 1
fi
exec node server.js "$@"
