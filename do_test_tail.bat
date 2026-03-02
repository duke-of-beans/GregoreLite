@echo off
cd /d D:\Projects\GregLite\app
pnpm test:run 2>&1 | tail -30
