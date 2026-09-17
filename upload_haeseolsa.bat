@echo off
node "%~dp0scripts\upload_videos_to_supabase.mjs" "불교해설사"
if "%1"=="" pause
