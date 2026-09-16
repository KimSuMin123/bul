import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function getFFmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  // Try standard system PATH
  return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

function loadSupabaseConfig() {
  const envPath = path.join(rootDir, '.env');
  let supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  let storageKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
    const anonMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (anonMatch) storageKey = anonMatch[1].trim();
  }

  return { supabaseUrl, storageKey };
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`FFmpeg 실행 실패: ${err.message}\n${stderr}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

export function createVideoUploadMiddleware() {
  const uploadDir = path.join(rootDir, 'scratch', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return async function videoUploadMiddleware(req, res, next) {
    if (req.method === 'POST' && req.url && req.url.startsWith('/api/upload-video')) {
      const { supabaseUrl, storageKey } = loadSupabaseConfig();
      if (!supabaseUrl || !storageKey) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'Supabase 서버 환경 변수가 설정되지 않았습니다.' }));
      }

      const reqUrl = new URL(req.url, 'http://localhost:3000');
      const originalName = reqUrl.searchParams.get('name') || 'video.mp4';
      const cleanBaseName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const nameWithoutExt = cleanBaseName.replace(/\.[^/.]+$/, "") || 'video';
      
      const rawFilePath = path.join(uploadDir, `raw_${Date.now()}_${cleanBaseName}`);
      const compFilePath = path.join(uploadDir, `comp_${Date.now()}_${nameWithoutExt}.mp4`);

      console.log(`[VOD 자동 인제스천 파이프라인] 클라이언트로부터 수신 시작: ${originalName}`);

      try {
        // 1. Pipe incoming upload stream to temporary file
        const writeStream = fs.createWriteStream(rawFilePath);
        await new Promise((resolve, reject) => {
          req.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const rawSizeMb = fs.statSync(rawFilePath).size / (1024 * 1024);
        console.log(`[VOD 자동 인제스천 파이프라인] 수신 완료 (${rawSizeMb.toFixed(1)} MB). 1080p 고화질 자동 압축 실행 중...`);

        // 2. Transcode with 1080p CRF 26 + Faststart for instant playback
        const ffmpegArgs = [
          '-y',
          '-threads', '0',
          '-i', rawFilePath,
          '-c:v', 'libx264',
          '-crf', '26',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-b:a', '64k',
          '-movflags', '+faststart',
          compFilePath
        ];
        await runFFmpeg(ffmpegArgs);

        let finalCompPath = compFilePath;
        let compSizeMb = fs.statSync(finalCompPath).size / (1024 * 1024);
        console.log(`[VOD 자동 인제스천 파이프라인] 1차 압축 완료: ${compSizeMb.toFixed(1)} MB`);

        // 3. Fallback pass if still > 48MB
        if (compSizeMb > 48.0) {
          console.log(`[VOD 자동 인제스천 파이프라인] 48MB 초과(${compSizeMb.toFixed(1)} MB) 감지, 720p 2차 최적화 진행...`);
          const fallbackPath = path.join(uploadDir, `fallback_${Date.now()}_${nameWithoutExt}.mp4`);
          await runFFmpeg([
            '-y',
            '-threads', '0',
            '-i', rawFilePath,
            '-c:v', 'libx264',
            '-crf', '27',
            '-vf', 'scale=1280:-2',
            '-preset', 'ultrafast',
            '-c:a', 'aac',
            '-b:a', '64k',
            '-movflags', '+faststart',
            fallbackPath
          ]);
          if (fs.existsSync(compFilePath)) fs.unlinkSync(compFilePath);
          finalCompPath = fallbackPath;
          compSizeMb = fs.statSync(finalCompPath).size / (1024 * 1024);
          console.log(`[VOD 자동 인제스천 파이프라인] 2차 최적화 완료: ${compSizeMb.toFixed(1)} MB`);
        }

        // 4. Upload compressed video to Supabase Storage CDN
        console.log(`[VOD 자동 인제스천 파이프라인] Supabase 클라우드 스토리지로 전송 중...`);
        const finalBuffer = fs.readFileSync(finalCompPath);
        const finalStorageName = `lec_${Date.now()}_${nameWithoutExt}.mp4`;
        const targetUploadUrl = `${supabaseUrl}/storage/v1/object/lectures/${encodeURIComponent(finalStorageName)}`;

        const uploadRes = await fetch(targetUploadUrl, {
          method: 'POST',
          headers: {
            'apikey': storageKey,
            'Authorization': `Bearer ${storageKey}`,
            'Content-Type': 'video/mp4'
          },
          body: finalBuffer
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`스토리지 업로드 실패 (${uploadRes.status}): ${errText}`);
        }

        const publicUrl = `${supabaseUrl}/storage/v1/object/public/lectures/${encodeURIComponent(finalStorageName)}`;
        console.log(`[VOD 자동 인제스천 파이프라인] 성공! 스트리밍 URL 발급: ${publicUrl}`);

        // 5. Clean up temporary files
        try { if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath); } catch {}
        try { if (fs.existsSync(finalCompPath)) fs.unlinkSync(finalCompPath); } catch {}

        // 6. Return response to browser
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          publicUrl,
          fileName: finalStorageName,
          size: finalBuffer.length,
          compressedMb: compSizeMb.toFixed(1),
          originalMb: rawSizeMb.toFixed(1)
        }));
      } catch (err) {
        console.error('[VOD 자동 인제스천 파이프라인] 오류 발생:', err);
        // Clean up on error
        try { if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath); } catch {}
        try { if (fs.existsSync(compFilePath)) fs.unlinkSync(compFilePath); } catch {}

        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message || '동영상 자동 압축 및 업로드 중 오류가 발생했습니다.' }));
      }
    } else {
      next();
    }
  };
}
