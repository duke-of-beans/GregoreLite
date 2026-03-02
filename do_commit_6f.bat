@echo off
cd /d D:\Projects\GregLite
git add app\lib\ghost\ipc.ts app\lib\ghost\status.ts app\lib\ghost\lifecycle.ts app\lib\ghost\index.ts app\lib\stores\ghost-store.ts app\lib\stores\index.ts app\lib\aegis\index.ts app\lib\ghost\email\poller.ts app\lib\ghost\ingest\index.ts app\lib\ghost\__tests__\lifecycle.test.ts STATUS.md SPRINT_6F_COMPLETE.md
git commit -F .git\COMMIT_MSG_TEMP
git push
