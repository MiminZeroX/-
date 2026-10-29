@echo off
chcp 65001 >nul
rem สร้าง shortcut ในโฟลเดอร์ Startup ให้ระบบเริ่มทำงานเองเมื่อเปิดเครื่อง (ย่อหน้าต่างไว้)
set "BR_TARGET=%~dp0start-windows.bat"
set "BR_DIR=%~dp0"
set "BR_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BangRak-Room-Booking.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:BR_LNK); $s.TargetPath=$env:BR_TARGET; $s.WorkingDirectory=$env:BR_DIR; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (
  echo   สร้าง shortcut ไม่สำเร็จ
) else (
  echo   ตั้งค่าเรียบร้อย - ระบบจะเริ่มทำงานเองทุกครั้งที่เปิดเครื่องและเข้าสู่ระบบ Windows
  echo   ยกเลิกได้โดยลบไฟล์ BangRak-Room-Booking.lnk ในโฟลเดอร์ shell:startup
)
pause
