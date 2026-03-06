@echo off
cd /d D:\Projects\GregLite\app
rmdir /s /q .next 2>nul
start /b pnpm dev > _dev.log 2>&1
