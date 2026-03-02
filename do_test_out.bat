@echo off
cd /d D:\Projects\GregLite\app
pnpm test:run > D:\Projects\GregLite\test_output.txt 2>&1
echo TESTS_EXIT:%ERRORLEVEL%
