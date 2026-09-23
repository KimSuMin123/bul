"""Package built public files only, with index.html at ZIP root. Does not deploy."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import zipfile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
required = ['index.html', '_redirects', '_headers', 'audio/namo_buddhaya_song.mp3']
for name in required:
    if not (dist / name).is_file():
        raise SystemExit('Required public build file is missing: ' + name)

files = sorted(p for p in dist.rglob('*') if p.is_file())
for file in files:
    relative = file.relative_to(dist)
    if file.is_symlink() or any(part.startswith('.env') or part in ['.git', 'node_modules', 'backups'] for part in relative.parts):
        raise SystemExit('Unexpected private or linked build artifact')

# Detect accidental bundling of known server-only secret values without displaying them.
secrets = []
env_file = root / '.env'
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.lstrip().startswith('#'):
            continue
        name, value = line.split('=', 1)
        if name.strip() in ['SUPABASE_SERVICE_ROLE_KEY', 'SMTP_PASSWORD', 'NEW_ADMIN_PASSWORD', 'BACKUP_ENCRYPTION_KEY']:
            value = value.strip().strip('"\'')
            if value:
                secrets.append(value.encode())
for file in files:
    if file.suffix in ['.js', '.css', '.html', '.json', '.txt']:
        data = file.read_bytes()
        if any(secret in data for secret in secrets):
            raise SystemExit('Server-only credential found in build; archive not created')

out = root / 'output' / 'netlify'
out.mkdir(parents=True, exist_ok=True)
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
archive = out / ('sehwa-buddha-academy-' + stamp + '.zip')
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for file in files:
        package.write(file, file.relative_to(dist).as_posix())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for name in required:
        assert name in package.namelist()
    assert not any(name.startswith('dist/') for name in package.namelist())

manifest = {'createdAt': datetime.now(timezone.utc).isoformat(), 'archive': str(archive), 'bytes': archive.stat().st_size,
            'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'fileCount': len(files), 'rootIndex': True,
            'hasRedirects': True, 'hasHeaders': True, 'hasLocalAudio': True, 'serverSecretScan': 'passed', 'deployed': False,
            'files': [{'name': f.relative_to(dist).as_posix(), 'bytes': f.stat().st_size} for f in files]}
manifest_file = archive.with_suffix('.manifest.json')
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in manifest.items() if key != 'files'}, ensure_ascii=False))
print('Manifest: ' + str(manifest_file))
