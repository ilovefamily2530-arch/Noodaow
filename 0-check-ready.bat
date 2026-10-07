@echo off
chcp 65001 >nul
echo ===== ตรวจความพร้อมของเครื่อง =====
echo.
echo [Node.js]
node -v || echo   ยังไม่ได้ติดตั้ง Node.js - ดาวน์โหลดรุ่น LTS ที่ nodejs.org
echo [npm]
call npm -v || echo   ยังใช้ npm ไม่ได้
echo [Git]
git --version || echo   ยังไม่ได้ติดตั้ง Git - ดาวน์โหลดที่ git-scm.com
echo [VS Code]
call code --version || echo   ยังเรียก VS Code ไม่ได้ - ดาวน์โหลดที่ code.visualstudio.com
echo.
echo ถ้าทุกบรรทัดขึ้นเลขรุ่น แสดงว่าพร้อมแล้ว ถ่ายภาพหน้าจอนี้ส่งวิทยากร
pause
