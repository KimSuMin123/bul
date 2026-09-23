param([string]$BackupDir = '', [ValidateRange(1,3650)][int]$RetentionDays = 7, [string]$VaultName = '')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDir
if (!$BackupDir) { $BackupDir = Join-Path $projectDir 'test_artifacts/backups' }
$env:BACKUP_DIR = $BackupDir
$env:BACKUP_RETENTION_DAYS = [string]$RetentionDays
$bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
if (!$env:PYTHON_BIN -and (Test-Path -LiteralPath $bundledPython)) { $env:PYTHON_BIN = $bundledPython }
try {
    # Optional unlocked vault; only secret names are in this script or the task definition.
    if ($VaultName) {
        Import-Module Microsoft.PowerShell.SecretManagement -ErrorAction Stop
        foreach ($key in @('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SMTP_HOST','SMTP_PORT','SMTP_FROM','SMTP_USER','SMTP_PASSWORD')) {
            $value = Get-Secret -Vault $VaultName -Name $key -AsPlainText -ErrorAction Stop
            [Environment]::SetEnvironmentVariable($key, [string]$value, 'Process')
        }
    }
    if (Test-Path -LiteralPath '.env') { & node --env-file=.env scripts/db_backup_select.mjs }
    else { & node scripts/db_backup_select.mjs }
    $jobExit = $LASTEXITCODE
} catch { Write-Error 'Backup runner failed. Inspect configured variable names and vault access; no secret values are logged.'; $jobExit = 1 }
finally {
    foreach ($key in @('SUPABASE_SERVICE_ROLE_KEY','SMTP_PASSWORD')) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
}
exit $jobExit
