@echo off
cd /d D:\zhuomian\pro\qn-ai-chat
call npm run build
start "" "node_modules\electron\dist\electron.exe" .
