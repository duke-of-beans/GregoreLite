@echo off
cd /d D:\Projects\GregLite\app
if exist .next rmdir /s /q .next
pnpm dev
