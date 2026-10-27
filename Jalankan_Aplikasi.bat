@echo off
cd /d "%~dp0"
title Fiqh Ibn Hazm Server (Port 4560)
echo ================================================================
echo   Mausu'ah Ikhtiyarat Ibn Hazm al-Fiqhiyyah - Al-Muhalla
echo   Memulai Server Lokal (Node.js)...
echo   Browser akan terbuka secara otomatis setelah server aktif.
echo   (JANGAN TUTUP JENDELA INI SELAMA MENGGUNAKAN APLIKASI)
echo ================================================================
echo.
node scripts\local-server.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal menjalankan Node.js.
    echo Pastikan Node.js terpasang di komputer Anda.
    pause
)
pause
