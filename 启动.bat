@echo off
title Colin Accounting

cd /d "%~dp0"

echo Starting Colin Accounting...
echo   CWD: %cd%
echo.

call npm run dev
pause
