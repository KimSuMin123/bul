@echo off
@chcp 65001 > nul
title 원각 불교 아카데미 - 동영상 원클릭 고화질 압축기
echo.
echo ========================================================
echo   원각 불교 아카데미 동영상 원클릭 고화질 자동 압축기
echo   (1080p FHD 화질 보존 / 48MB 클라우드 스토리지 최적화)
echo ========================================================
echo.

cd /d "%~dp0"

if "%~1"=="" (
    python compress_tool.py
) else (
    python compress_tool.py %*
)

echo.
echo 작업이 완료되었습니다. 창을 닫으려면 아무 키나 누르세요.
pause > nul
