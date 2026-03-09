@echo off
cd /d D:\Projects\GregLite
gh release create v1.1.1 "D:\Projects\GregLite\app\src-tauri\target\release\bundle\nsis\Gregore Lite_1.1.1_x64-setup.exe" --title "GregLite v1.1.1" --notes-file D:\Projects\GregLite\RELEASE_NOTES_1.1.1.md
