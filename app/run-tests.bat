@echo off
cd /d D:\Projects\GregLite\app
set NODE_PATH=D:\Projects\GregLite\app\node_modules\.pnpm\vitest@4.0.17_@opentelemetr_6311d9b92db8bd24cb6d85320592a23a\node_modules\vitest\node_modules;D:\Projects\GregLite\app\node_modules\.pnpm\vitest@4.0.17_@opentelemetr_6311d9b92db8bd24cb6d85320592a23a\node_modules;D:\Projects\GregLite\app\node_modules\.pnpm\node_modules
set VITEST_MJS=D:\Projects\GregLite\app\node_modules\.pnpm\vitest@4.0.17_@opentelemetr_6311d9b92db8bd24cb6d85320592a23a\node_modules\vitest\vitest.mjs
"D:\Program Files\nodejs\node.exe" "%VITEST_MJS%" run --reporter=verbose
