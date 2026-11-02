#!/bin/bash
# ดับเบิลคลิกไฟล์นี้เพื่อตรวจระบบจองห้องประชุม (macOS · ต้องมี Node.js 18 ขึ้นไป)
# ครั้งแรกถ้า macOS ไม่ยอมเปิด: คลิกขวาที่ไฟล์ › Open › Open
# ใส่ตัวเลือกเพิ่มได้ใน Terminal เช่น  ./check-mac.command --url=https://... --deep
cd "$(dirname "$0")" || exit 1
# หน้าต่างที่เปิดด้วยการดับเบิลคลิกอาจไม่มี PATH ของ Homebrew/ตัวติดตั้ง Node
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  ไม่พบ Node.js ในเครื่องนี้"
  echo "  กรุณาดาวน์โหลดและติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org"
  echo "  ติดตั้งเสร็จแล้ว ให้ดับเบิลคลิกไฟล์นี้อีกครั้ง"
  echo
  open "https://nodejs.org/"
  read -r -n 1 -s -p "  กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง"
  exit 1
fi

node check.js "$@"
echo
read -r -n 1 -s -p "  กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง"
echo
