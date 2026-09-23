param([string]$TaskName = 'LMS-Daily-SELECT-Backup', [ValidatePattern('^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')][string]$At = '03:00', [ValidateRange(1,3650)][int]$RetentionDays = 7, [string]$BackupDir = '', [string]$VaultName = '', [switch]$Install)
$ErrorActionPreference = 'Stop'
$tz = Get-TimeZone
if ($tz.BaseUtcOffset.TotalHours -ne 9 -or $tz.SupportsDaylightSavingTime) { throw 'This Windows recipe requires Korea Standard Time (UTC+09:00 without DST).' }
$runner = Join-Path $PSScriptRoot 'db_backup_run.ps1'
$arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$runner`" -RetentionDays $RetentionDays"
if ($BackupDir) { $arguments += " -BackupDir `"$BackupDir`"" }
if ($VaultName) { $arguments += " -VaultName `"$VaultName`"" }
if (!$Install) { [pscustomobject]@{TaskName=$TaskName;AtKST=$At;RetentionDays=$RetentionDays;Runner=$runner;Installed=$false;Requirement='Host awake and user logged in; unlocked vault or process-accessible SMTP configuration'}; exit 0 }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Select-Object TaskName,State
