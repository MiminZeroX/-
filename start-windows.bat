@echo off
chcp 65001 >nul
title ระบบจองห้องประชุม - สำนักงานเขตบางรัก
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   ไม่พบ Node.js ในเครื่องนี้
  echo   กรุณาดาวน์โหลดและติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org
  echo   ติดตั้งเสร็จแล้ว ให้ดับเบิลคลิกไฟล์นี้อีกครั้ง
  echo.
  start "" https://nodejs.org/
  pause
  exit /b 1
)

:loop
node server.js %*
echo.
echo   ระบบหยุดทำงาน - จะเริ่มใหม่อัตโนมัติใน 5 วินาที (ปิดหน้าต่างนี้เพื่อหยุดถาวร)
timeout /t 5 >nul
goto loop
