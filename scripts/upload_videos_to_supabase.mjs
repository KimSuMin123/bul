import fs from 'fs';
import path from 'path';
import { spawnSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Read .env
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://cxvavdxfcrprcbpnrimw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const BUCKET_NAME = 'lectures';

// 2. Resolve Target Video Directory from CLI argument or intelligent auto-detection
const cliArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
let targetDirName = cliArgs[0];

if (!targetDirName) {
  // If no argument, check available directories
  if (fs.existsSync(path.join(projectRoot, '불교해설사'))) {
    targetDirName = '불교해설사';
  } else if (fs.existsSync(path.join(projectRoot, '웹업로드용_압축영상'))) {
    targetDirName = '웹업로드용_압축영상';
  } else {
    targetDirName = '불교해설사';
  }
}

const VIDEO_DIR = path.isAbsolute(targetDirName) ? targetDirName : path.join(projectRoot, targetDirName);
const isHaeseolsa = path.basename(VIDEO_DIR).includes('해설사') || targetDirName.includes('해설사');

// Output directory for compressed mp4 if transcoding is needed
const COMPRESSED_OUT_DIR = path.join(projectRoot, isHaeseolsa ? '웹업로드용_압축영상_해설사' : '웹업로드용_압축영상');

console.log('================================================================');
console.log('  세화붓다아카데미 - Supabase Storage 동영상 스마트 업로드 도구');
console.log('================================================================');
console.log(`Supabase URL : ${SUPABASE_URL}`);
console.log(`사용 키 타입 : ${SUPABASE_KEY && SUPABASE_KEY.includes('service_role') ? 'Service Role Key (관리자)' : 'Anon Key'}`);
console.log(`대상 버킷    : ${BUCKET_NAME}`);
console.log(`대상 영상폴더: ${VIDEO_DIR}`);
console.log(`압축본 보관함: ${COMPRESSED_OUT_DIR}`);
console.log('----------------------------------------------------------------\n');

// 3. Find FFmpeg Executable
function findFFmpeg() {
  const commonPaths = [
    'C:\\Users\\sehyeon\\AppData\\Local\\Programs\\Python\\Python311\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe',
    'ffmpeg'
  ];
  for (const p of commonPaths) {
    try {
      const res = spawnSync(p, ['-version'], { stdio: 'ignore' });
      if (res.status === 0) return p;
    } catch (e) {}
  }
  try {
    const pythonOut = execSync('python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"', { encoding: 'utf8' }).trim();
    if (pythonOut && fs.existsSync(pythonOut)) return pythonOut;
  } catch (e) {}
  return 'ffmpeg';
}

const FFMPEG_PATH = findFFmpeg();

// 4. Ensure Bucket exists
async function ensureBucket() {
  console.log(`▶ 1단계: '${BUCKET_NAME}' 버킷 상태 점검...`);
  const checkRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET_NAME}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (checkRes.ok) {
    console.log(`✔ '${BUCKET_NAME}' 버킷이 정상 확인되었습니다.`);
    return true;
  }

  console.log(`! '${BUCKET_NAME}' 버킷 생성을 시도합니다...`);
  const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: BUCKET_NAME,
      name: BUCKET_NAME,
      public: true,
      file_size_limit: 52428800 // 50MB
    })
  });

  if (createRes.ok) {
    console.log(`✔ '${BUCKET_NAME}' 버킷이 성공적으로 생성되었습니다 (Public)`);
    return true;
  }

  const errText = await createRes.text();
  console.error(`✖ 버킷 생성 실패 (HTTP ${createRes.status}): ${errText}`);
  return false;
}

// 5. Intelligent Storage Key Generator
function getStorageKey(originalName) {
  // Pattern 1: 해설사_제X-Y강_슬라이드.avi or .mp4 -> haeseolsa_0X_Y.mp4
  const matchHaeseolsa = originalName.match(/해설사_제?(\d+)[-_](\d+)강?/);
  if (matchHaeseolsa) {
    const num = String(matchHaeseolsa[1]).padStart(2, '0');
    const part = matchHaeseolsa[2];
    return `haeseolsa_${num}_${part}.mp4`;
  }

  // Pattern 2: 법사01-1_... -> lecture_01_1.mp4
  const matchBubsa = originalName.match(/^법사(\d{2})-(\d)/);
  if (matchBubsa) {
    const num = matchBubsa[1];
    const part = matchBubsa[2];
    return `lecture_${num}_${part}.mp4`;
  }

  // Pattern 3: General Clean ASCII
  const cleanExt = '.mp4';
  const baseNoExt = path.basename(originalName, path.extname(originalName));
  const safeBase = baseNoExt.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return `lec_${safeBase}${cleanExt}`;
}

// 6. Video Transcoding (AVI -> H.264 MP4 & 48MB Limit Compliance)
function ensureWebOptimizedMp4(srcPath, originalName) {
  const ext = path.extname(srcPath).toLowerCase();
  const origSizeMb = fs.statSync(srcPath).size / (1024 * 1024);
  fs.mkdirSync(COMPRESSED_OUT_DIR, { recursive: true });

  const targetMp4Name = `${path.basename(originalName, ext)}.mp4`;
  const dstPath = path.join(COMPRESSED_OUT_DIR, targetMp4Name);

  // If already an MP4 under 48MB and in good state, use directly
  if (ext === '.mp4' && origSizeMb <= 48.0 && !srcPath.includes(COMPRESSED_OUT_DIR)) {
    return { uploadPath: srcPath, wasCompressed: false, sizeMb: origSizeMb.toFixed(2) };
  }

  // If already compressed previously and exists under 48MB
  if (fs.existsSync(dstPath)) {
    const compSizeMb = fs.statSync(dstPath).size / (1024 * 1024);
    if (compSizeMb <= 48.0 && compSizeMb > 0.5) {
      console.log(`  [캐시 사용] 이미 최적화된 압축본이 존재합니다 (${compSizeMb.toFixed(1)} MB): ${targetMp4Name}`);
      return { uploadPath: dstPath, wasCompressed: true, sizeMb: compSizeMb.toFixed(2) };
    }
  }

  console.log(`\n  ▶ [고화질 자동 압축 실행] ${originalName} (${origSizeMb.toFixed(1)} MB)`);
  console.log(`    - 규격: 1080p FHD H.264 (CRF 26) + Faststart 웹 가속`);
  const t0 = Date.now();

  const cmdArgs = [
    '-y',
    '-i', srcPath,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-c:v', 'libx264',
    '-crf', '26',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-movflags', '+faststart',
    dstPath
  ];

  const res = spawnSync(FFMPEG_PATH, cmdArgs, { stdio: 'ignore' });
  if (res.status !== 0) {
    throw new Error(`FFmpeg 인코딩 실패 (코드 ${res.status})`);
  }

  let finalSizeMb = fs.statSync(dstPath).size / (1024 * 1024);

  // 48MB Limit Safety Guard (720p Second Pass if needed)
  if (finalSizeMb > 48.0) {
    console.log(`    ! 48MB 초과(${finalSizeMb.toFixed(1)}MB)로 720p 최적화 2차 압축을 실행합니다...`);
    const tempPath = path.join(COMPRESSED_OUT_DIR, `temp_${targetMp4Name}`);
    const cmdArgs2 = [
      '-y',
      '-i', srcPath,
      '-c:v', 'libx264',
      '-crf', '27',
      '-vf', 'scale=1280:-2',
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-movflags', '+faststart',
      tempPath
    ];
    const res2 = spawnSync(FFMPEG_PATH, cmdArgs2, { stdio: 'ignore' });
    if (res2.status === 0 && fs.existsSync(tempPath)) {
      fs.unlinkSync(dstPath);
      fs.renameSync(tempPath, dstPath);
      finalSizeMb = fs.statSync(dstPath).size / (1024 * 1024);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const reduction = (((origSizeMb - finalSizeMb) / origSizeMb) * 100).toFixed(1);
  console.log(`    ★ 압축 완료: ${origSizeMb.toFixed(1)}MB -> ${finalSizeMb.toFixed(1)}MB (${reduction}% 절감, ${elapsed}초 소요)\n`);

  return { uploadPath: dstPath, wasCompressed: true, sizeMb: finalSizeMb.toFixed(2) };
}

// 7. Supabase Upload Routine
async function uploadFile(filePath, fileName, storageKey, sizeMb, index, total) {
  const fileBuffer = fs.readFileSync(filePath);
  const targetUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${encodeURIComponent(storageKey)}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(storageKey)}`;

  console.log(`[${index + 1}/${total}] Supabase 업로드 중: ${storageKey} (${sizeMb} MB)`);
  const startTime = Date.now();

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'video/mp4',
      'x-upsert': 'true'
    },
    body: fileBuffer
  });

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✖ 업로드 실패 (${res.status}): ${err}`);
    return {
      success: false,
      fileName,
      storageKey,
      sizeMb,
      error: err
    };
  }

  console.log(`  ✔ 업로드 완료 (${elapsedSec}초) -> ${publicUrl}`);
  return {
    success: true,
    fileName,
    storageKey,
    sizeMb,
    publicUrl,
    elapsedSec
  };
}

// Natural sort helper for Korean lecture filenames
function naturalSort(a, b) {
  const numA = a.match(/\d+/g) ? a.match(/\d+/g).map(Number) : [0];
  const numB = b.match(/\d+/g) ? b.match(/\d+/g).map(Number) : [0];
  for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
    const valA = numA[i] || 0;
    const valB = numB[i] || 0;
    if (valA !== valB) return valA - valB;
  }
  return a.localeCompare(b);
}

async function main() {
  if (!fs.existsSync(VIDEO_DIR)) {
    console.error(`동영상 디렉토리를 찾을 수 없습니다: ${VIDEO_DIR}`);
    process.exit(1);
  }

  const supportedExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
  const rawFiles = fs.readdirSync(VIDEO_DIR)
    .filter(f => supportedExts.includes(path.extname(f).toLowerCase()))
    .sort(naturalSort);

  const isDryRun = process.argv.includes('--dry-run');

  console.log(`총 ${rawFiles.length}개의 동영상 파일이 감지되었습니다.\n`);
  if (rawFiles.length === 0) {
    console.log('업로드할 영상 파일이 없습니다.');
    return;
  }

  if (isDryRun) {
    console.log('【DRY-RUN 모드】 실제 압축 및 업로드 없이 파일 매핑 목록만 출력합니다.\n');
    console.log('| 번호 | 원본 파일명 | 원본 용량 | 변환 후 스토리지 키 | 예상 CDN URL |');
    console.log('| :--- | :--- | :--- | :--- | :--- |');
    rawFiles.forEach((f, idx) => {
      const fullP = path.join(VIDEO_DIR, f);
      const szMb = (fs.statSync(fullP).size / (1024 * 1024)).toFixed(1);
      const key = getStorageKey(f);
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(key)}`;
      console.log(`| ${idx + 1} | ${f} | ${szMb} MB | \`${key}\` | ${url} |`);
    });
    console.log('\n✔ 드라이런 검증이 완료되었습니다.');
    return;
  }

  const bucketReady = await ensureBucket();
  if (!bucketReady) {
    console.log('\n================================================================');
    console.log('【중요 안내】 Supabase Storage 버킷 접근 권한이 필요합니다.');
    console.log('.env 파일에 SUPABASE_SERVICE_ROLE_KEY 값이 설정되었는지 확인해 주세요.');
    console.log('================================================================\n');
    process.exit(1);
  }

  console.log('\n▶ 2단계: 파일 규격 검사 및 웹 최적화 압축 / 업로드 시작...');
  const results = [];

  for (let i = 0; i < rawFiles.length; i++) {
    const origFileName = rawFiles[i];
    const fullPath = path.join(VIDEO_DIR, origFileName);
    const storageKey = getStorageKey(origFileName);

    console.log(`\n------------------------------------------------------------`);
    console.log(`[작업 ${i + 1}/${rawFiles.length}] 원본: ${origFileName}`);

    // Check if compression / format conversion is required
    const optResult = ensureWebOptimizedMp4(fullPath, origFileName);

    // Upload optimized MP4 to Supabase
    const uploadRes = await uploadFile(
      optResult.uploadPath,
      origFileName,
      storageKey,
      optResult.sizeMb,
      i,
      rawFiles.length
    );
    results.push(uploadRes);
  }

  // 8. Generate and Save Reports
  const reportPrefix = isHaeseolsa ? 'supabase_haeseolsa_urls' : 'supabase_video_urls';
  const reportPath = path.join(projectRoot, `${reportPrefix}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');

  const mdPath = path.join(projectRoot, `${reportPrefix}.md`);
  let mdContent = `# 세화붓다아카데미 Supabase Storage 영상 URL 목록 (${isHaeseolsa ? '불교해설사' : '불교의례'})\n\n`;
  mdContent += `* 생성 일시: ${new Date().toLocaleString('ko-KR')}\n`;
  mdContent += `* 소스 폴더: \`${path.basename(VIDEO_DIR)}\`\n`;
  mdContent += `* 총 파일 수: ${results.length}개\n\n`;
  mdContent += `| 번호 | 원본 파일명 | 저장소 식별자 | 용량 (MB) | 공개 CDN 스트리밍 URL |\n`;
  mdContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

  results.forEach((r, idx) => {
    if (r.success) {
      mdContent += `| ${idx + 1} | ${r.fileName} | \`${r.storageKey}\` | ${r.sizeMb} MB | [스트리밍 링크](${r.publicUrl}) |\n`;
    } else {
      mdContent += `| ${idx + 1} | ${r.fileName} | \`${r.storageKey}\` | ${r.sizeMb} MB | **업로드 실패: ${r.error}** |\n`;
    }
  });

  fs.writeFileSync(mdPath, mdContent, 'utf8');

  console.log('\n================================================================');
  console.log('✔ 전체 업로드 작업이 성공적으로 완료되었습니다!');
  console.log(`- 결과 보고서(MD): ${mdPath}`);
  console.log(`- 결과 데이터(JSON): ${reportPath}`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('실행 중 예외 발생:', err);
  process.exit(1);
});
