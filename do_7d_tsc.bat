@echo off
cd /d D:\Projects\GregLite\app
call npx tsc --noEmit 2>&1
echo TSC_EXIT:%ERRORLEVEL%
