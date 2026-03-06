@echo off
cd /d D:\Projects\GregLite\app
pnpm test:run 2>&1 > _test_output.txt
echo EXIT_CODE=%ERRORLEVEL%
type _test_output.txt | findstr /c:"passed" /c:"failed" /c:"Test Files"
