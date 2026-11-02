@echo off
chcp 65001 >nul
title โปรแกรมตรวจสอบระบบจองห้องประชุม
cd /d "%~dp0"
rem ดับเบิลคลิกไฟล์นี้เพื่อตรวจระบบ (ต้องมี Node.js 18 ขึ้นไป)
rem ใส่ตัวเลือกเพิ่มได้ เช่น  check-windows.bat --url=https://... --deep

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

node check.js %*
echo.
pause
