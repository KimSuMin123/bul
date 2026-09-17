@echo off
chcp 65001 > nul
echo ================================================================
echo   세화붓다아카데미 - Supabase 동영상 원클릭 자동 업로드 도구
echo ================================================================
echo.
echo 압축된 30개 동영상을 Supabase Cloud Storage에 업로드합니다...
echo.

node "%~dp0scripts\upload_videos_to_supabase.mjs"

echo.
echo 엔터 키를 누르면 창이 닫힙니다...
pause > nul
