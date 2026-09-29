@echo off
chcp 65001 > nul
setlocal EnableExtensions DisableDelayedExpansion
title 세화붓다아카데미 강의 영상 변환 도구
cd /d "%~dp0"
set "FF=%~dp0ffmpeg.exe"
set "OUT=%~dp0업로드용"
rem 45MB = 47185920 bytes (Supabase 무료 한도 50MB 안쪽)
set "LIMIT=47185920"
set /a DONE=0
set /a SKIP=0
set /a FAIL=0

echo ================================================================
echo   세화붓다아카데미 강의 영상 변환 도구
echo   모든 기기에서 재생되는 mp4로 변환합니다.
echo   1080p (H.264 Level 4.0) - 45MB를 넘거나 원본이 720p 이하면 720p (Level 4.0)
echo ================================================================
echo.

if exist "%FF%" goto :ready
echo [오류] ffmpeg.exe가 이 파일과 같은 폴더에 없습니다.
echo        내려받은 zip 파일의 압축을 먼저 풀고, 풀린 폴더에서 실행해 주세요.
goto :finish

:ready
if not exist "%OUT%" mkdir "%OUT%"
if "%~1"=="" goto :folder

:args
if "%~1"=="" goto :summary
call :convert "%~f1"
shift
goto :args

:folder
echo 이 폴더의 영상 파일을 모두 변환합니다.
echo (특정 파일만 변환하려면 영상 파일을 이 .bat 아이콘 위로 끌어다 놓으세요)
for %%F in (*.avi *.mp4 *.mov *.mkv *.wmv *.m4v *.flv *.mpg *.mpeg *.ts *.webm) do call :convert "%%~fF"
goto :summary

:convert
set "DST=%OUT%\%~n1.mp4"
echo.
echo ----------------------------------------------------------------
echo ▶ "%~nx1"  (원본 %~z1 bytes)
if not exist "%DST%" goto :encode_all
echo   이미 변환된 파일이 있어 건너뜁니다: "업로드용\%~n1.mp4"
set /a SKIP+=1
goto :eof

:encode_all
rem 원본 세로 해상도를 읽는다. 720p 이하 원본은 1080p로 키우지 않는다(화질 이득 없이 시간·용량만 늘어남).
set "SRCFILE=%~f1"
set "SRC_H=0"
for /f %%H in ('powershell -NoProfile -Command "$o = (& $env:FF -hide_banner -i $env:SRCFILE 2>&1 | Out-String); if ($o -match 'Video:.*?(\d{3,5})x(\d{3,5})') { $matches[2] } else { 0 }"') do set "SRC_H=%%H"
if %SRC_H% GTR 720 goto :try1080
if %SRC_H%==0 goto :try1080
echo   원본이 %SRC_H%p라서 720p로 변환합니다... (아래 time= 이 원본 길이까지 올라가면 끝납니다)
goto :try720

:try1080
echo   1080p 변환 중... (아래 time= 이 원본 길이까지 올라가면 끝납니다)
call :encode "%~f1" "%DST%" 1080 28 || goto :failed
call :size_ok "%DST%"
if errorlevel 2 goto :failed
if not errorlevel 1 goto :ok
echo   45MB를 넘어 720p로 다시 변환합니다...

:try720
call :encode "%~f1" "%DST%" 720 28 || goto :failed
call :size_ok "%DST%"
if errorlevel 2 goto :failed
if not errorlevel 1 goto :ok
echo   아직 45MB를 넘어 720p 압축을 조금 더 높여 다시 변환합니다...
call :encode "%~f1" "%DST%" 720 31 || goto :failed
call :size_ok "%DST%"
if errorlevel 2 goto :failed
if not errorlevel 1 goto :ok
echo   [주의] 가장 작은 설정으로도 45MB를 넘습니다. 영상을 두 개로 나눠 주세요.
del "%DST%" > nul 2>&1
set /a FAIL+=1
goto :eof

:ok
for %%A in ("%DST%") do set /a MB=%%~zA / 1048576
set "SZ=약 %MB%MB"
if %MB%==0 set "SZ=1MB 미만"
echo   완료: "업로드용\%~n1.mp4"  (%SZ%)
set /a DONE+=1
goto :eof

:failed
echo   [실패] 변환하지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.
del "%DST%.part" > nul 2>&1
set /a FAIL+=1
goto :eof

:encode
set "W=1920"
if "%~3"=="720" set "W=1280"
"%FF%" -hide_banner -loglevel error -stats -y -i "%~1" -vf "scale=%W%:%~3:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos:out_range=tv:out_color_matrix=bt709,pad=%W%:%~3:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p" -c:v libx264 -profile:v high -level:v 4.0 -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -crf %~4 -preset veryfast -g 150 -c:a aac -b:a 64k -ac 2 -ar 44100 -movflags +faststart -f mp4 "%~2.part"
rem 비정상 종료(음수 코드 포함)는 모두 실패로 본다
if not "%errorlevel%"=="0" exit /b 1
move /y "%~2.part" "%~2" > nul
exit /b 0

:size_ok
if %~z1 GTR %LIMIT% exit /b 1
rem 1KB 미만(빈 파일)은 비정상 결과로 본다
if %~z1 LSS 1024 exit /b 2
exit /b 0

:summary
echo.
echo ================================================================
echo   끝났습니다. 완료 %DONE%개 / 건너뜀 %SKIP%개 / 실패 %FAIL%개
echo   변환된 파일은 '업로드용' 폴더에 있습니다.
echo   관리자 화면에서 이 폴더의 mp4 파일을 올려 주세요.
echo ================================================================
if not defined SBA_NO_OPEN if exist "%OUT%" start "" explorer "%OUT%"

:finish
echo.
echo 아무 키나 누르면 창이 닫힙니다.
pause > nul
