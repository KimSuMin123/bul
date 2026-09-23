#requires -Version 7.0
# Set FFMPEG_BIN to a verified local FFmpeg executable, then run:
# pwsh -File scripts/prepare_namo_audio.ps1 -ArchivePath <original-master.zip>
# Optional tool bootstrap (workspace-local only):
# python -m pip install --target scratch/audio-tools --no-deps imageio-ffmpeg==0.6.0
# Package source: https://pypi.org/project/imageio-ffmpeg/0.6.0/
param(
 [Parameter(Mandatory=$true)][string]$ArchivePath,
 [string]$FfmpegBin=$env:FFMPEG_BIN
)
$ErrorActionPreference='Stop'
$workspaceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function WorkspacePath([string]$relative) {
 $resolved=[IO.Path]::GetFullPath((Join-Path $workspaceRoot $relative))
 if(-not $resolved.StartsWith($workspaceRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Output path is outside the workspace'}
 return $resolved
}
$workDirectory=WorkspacePath 'test_artifacts/audio'
$outputDirectory=WorkspacePath 'public/audio'
New-Item -ItemType Directory -Force -Path $workDirectory,$outputDirectory | Out-Null
$sourcePath=WorkspacePath 'test_artifacts/audio/source-master.mp3'
$temporarySource=WorkspacePath 'test_artifacts/audio/source-master.part'
$temporaryOutput=WorkspacePath 'test_artifacts/audio/optimized.mp3'
$outputPath=WorkspacePath 'public/audio/namo_buddhaya_song.mp3'
$archiveFull=(Resolve-Path -LiteralPath $ArchivePath).Path
$originalHash=(Get-FileHash -LiteralPath $archiveFull -Algorithm SHA256).Hash.ToLowerInvariant()
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[IO.Compression.ZipFile]::OpenRead($archiveFull)
try {
 $entries=@($archive.Entries | Where-Object { $_.FullName.EndsWith('.mp3',[StringComparison]::OrdinalIgnoreCase) })
 if($entries.Count -ne 1 -or $entries[0].Length -le 0){throw 'Archive must contain exactly one nonempty MP3'}
 $entry=$entries[0]
 # Never use ZIP entry paths as filesystem destinations (prevents Zip Slip).
 $inputStream=$entry.Open()
 $outputStream=[IO.File]::Open($temporarySource,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try {$inputStream.CopyTo($outputStream)} finally {$outputStream.Dispose();$inputStream.Dispose()}
 if((Get-Item -LiteralPath $temporarySource).Length -ne $entry.Length){throw 'Extraction length mismatch'}
 Move-Item -LiteralPath $temporarySource -Destination $sourcePath -Force
} finally {$archive.Dispose()}
if(-not $FfmpegBin){$candidate=Get-Command ffmpeg -ErrorAction SilentlyContinue;if($candidate){$FfmpegBin=$candidate.Source}}
if(-not $FfmpegBin -or -not (Test-Path -LiteralPath $FfmpegBin -PathType Leaf)){throw 'Set FFMPEG_BIN to a verified FFmpeg executable; extracted original is preserved'}
function RunFfmpeg([string[]]$arguments) {
 $start=[Diagnostics.ProcessStartInfo]::new()
 $start.FileName=$FfmpegBin;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardError=$true;$start.RedirectStandardOutput=$true
 foreach($argument in $arguments){[void]$start.ArgumentList.Add($argument)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$start
 try {
  [void]$process.Start()
  $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  return @{Code=$process.ExitCode;Text=$stdout.GetAwaiter().GetResult()+$stderr.GetAwaiter().GetResult()}
 } finally {$process.Dispose()}
}
function DurationSeconds([string]$text) {
 $match=[regex]::Match($text,'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)')
 if(-not $match.Success){throw 'Unable to verify audio duration'}
 return 3600*[double]$match.Groups[1].Value+60*[double]$match.Groups[2].Value+[double]::Parse($match.Groups[3].Value,[Globalization.CultureInfo]::InvariantCulture)
}
$sourceProbe=RunFfmpeg @('-hide_banner','-i',$sourcePath)
$sourceDuration=DurationSeconds $sourceProbe.Text
$encoding=RunFfmpeg @('-hide_banner','-loglevel','error','-nostdin','-y','-i',$sourcePath,'-map','0:a:0','-vn','-map_metadata','-1','-c:a','libmp3lame','-b:a','128k','-ar','44100','-ac','2','-write_xing','1',$temporaryOutput)
if($encoding.Code -ne 0){throw 'Audio encoding failed; original preserved'}
$outputProbe=RunFfmpeg @('-hide_banner','-i',$temporaryOutput)
$outputDuration=DurationSeconds $outputProbe.Text
if([Math]::Abs($sourceDuration-$outputDuration) -gt 0.15){throw 'Duration changed during conversion; refusing publication'}
# Fully decode the output once so a truncated/corrupt tail cannot pass metadata-only checks.
$decode=RunFfmpeg @('-hide_banner','-loglevel','error','-nostdin','-xerror','-i',$temporaryOutput,'-f','null','-')
if($decode.Code -ne 0){throw 'Full audio decode verification failed'}
if((Get-FileHash -LiteralPath $archiveFull -Algorithm SHA256).Hash.ToLowerInvariant() -ne $originalHash){throw 'Source archive changed during processing'}
Move-Item -LiteralPath $temporaryOutput -Destination $outputPath -Force
$summary=[ordered]@{
 preparedAt=[DateTime]::UtcNow.ToString('o');sourceArchiveUnchanged=$true;sourceArchiveSha256=$originalHash
 sourceBytes=(Get-Item -LiteralPath $sourcePath).Length;sourceDurationSeconds=$sourceDuration;sourceSha256=(Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
 output='public/audio/namo_buddhaya_song.mp3';outputBytes=(Get-Item -LiteralPath $outputPath).Length;outputDurationSeconds=$outputDuration
 outputSha256=(Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash.ToLowerInvariant();encoding='MP3 libmp3lame 128kbps stereo 44100Hz';fullDecodePassed=$true
}
$summary | ConvertTo-Json | Set-Content -LiteralPath (WorkspacePath 'test_artifacts/audio/prepared-audio.json') -Encoding utf8
$summary | ConvertTo-Json
