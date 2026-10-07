@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== ติดตั้งแพ็กเกจ (ครั้งแรกใช้เวลา 1-3 นาที) =====
call npm install
if errorlevel 1 (
  echo ติดตั้งไม่สำเร็จ คัดลอกข้อความด้านบนไปถามผู้ช่วยปัญญาประดิษฐ์หรือวิทยากร
  pause
  exit /b 1
)
echo.
echo ===== รันระบบในเครื่อง =====
echo เปิดเบราว์เซอร์ไปที่ http://localhost:3000
echo หยุดระบบ: กด Ctrl + C แล้วตอบ Y
call npm run dev
pause
