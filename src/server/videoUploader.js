import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_RAW_BYTES = 1024 * 1024 * 1024;
const MAX_FINAL_BYTES = 48 * 1024 * 1024;
class UploadError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createVideoUploadMiddleware({ supabaseUrl = process.env.VITE_SUPABASE_URL,
  anonKey = process.env.VITE_SUPABASE_ANON_KEY, request = globalThis.fetch,
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg', exec = execFile,
  uploadDir = path.join(rootDir, 'scratch', 'uploads'), maxBytes = MAX_RAW_BYTES } = {}) {
  let busy = false;
  const transcode = (args, signal) => new Promise((resolve, reject) => {
    exec(ffmpegPath, args, { timeout: 10 * 60 * 1000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024, signal, windowsHide: true }, error => {
      if (error) reject(new UploadError(500, '동영상 변환에 실패했습니다. 파일 형식과 FFmpeg 설치 상태를 확인해 주세요.'));
      else resolve();
    });
  });
  return async (req, res, next) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    if (parsed.pathname !== '/api/upload-video') return next();
    const respond = (status, data) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST') return respond(405, { error: 'POST 요청만 지원합니다.' });
    let workDir;
    let ownsSlot = false;
    const abort = new AbortController();
    const disconnect = () => abort.abort();
    const close = () => { if (!res.writableEnded) abort.abort(); };
    req.once('aborted', disconnect);
    res.once('close', close);
    const timer = setTimeout(() => abort.abort(), 15 * 60 * 1000);
    timer.unref?.();
    try {
      if (!supabaseUrl || !anonKey) throw new UploadError(503, '스토리지 연결 설정을 확인해 주세요.');
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith('Bearer ') || authorization === `Bearer ${anonKey}`) throw new UploadError(401, '관리자 로그인이 필요합니다.');
      const headers = { apikey: anonKey, Authorization: authorization };
      // Verify Auth identity and database role before reading the request body.
      const identity = await request(`${supabaseUrl}/auth/v1/user`, { headers, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
      if (!identity.ok || !(await identity.json()).id) throw new UploadError(401, '유효한 로그인 세션이 필요합니다.');
      const profileRes = await request(`${supabaseUrl}/rest/v1/rpc/current_lms_user`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
      const profile = profileRes.ok ? await profileRes.json() : null;
      if (profile?.role !== 'admin') throw new UploadError(403, '관리자만 영상을 업로드할 수 있습니다.');
      if (busy) throw new UploadError(429, '다른 영상을 처리하고 있습니다. 완료 후 다시 시도해 주세요.');
      if (!/^video\//.test(req.headers['content-type'] || '')) throw new UploadError(415, '동영상 파일만 업로드할 수 있습니다.');
      if (Number(req.headers['content-length']) > maxBytes) throw new UploadError(413, '업로드 파일은 1GB 이하여야 합니다.');
      busy = true; ownsSlot = true;
      await fsp.mkdir(uploadDir, { recursive: true });
      workDir = await fsp.mkdtemp(path.join(uploadDir, 'video-'));
      const raw = path.join(workDir, 'source');
      const compressed = path.join(workDir, 'compressed.mp4');
      let bytes = 0;
      const limit = new Transform({ transform(chunk, encoding, callback) {
        bytes += chunk.length;
        callback(bytes > maxBytes ? new UploadError(413, '업로드 파일은 1GB 이하여야 합니다.') : null, chunk);
      } });
      await pipeline(req, limit, fs.createWriteStream(raw, { flags: 'wx' }), { signal: abort.signal });
      if (!bytes) throw new UploadError(400, '빈 파일은 업로드할 수 없습니다.');
      await transcode(['-nostdin', '-y', '-threads', '2', '-i', raw, '-vf', 'scale=min(1920\\,iw):-2', '-c:v', 'libx264', '-crf', '26', '-preset', 'ultrafast', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', compressed], abort.signal);
      let size = (await fsp.stat(compressed)).size;
      if (size > MAX_FINAL_BYTES) {
        await transcode(['-nostdin', '-y', '-threads', '2', '-i', raw, '-vf', 'scale=min(1280\\,iw):-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'ultrafast', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', compressed], abort.signal);
        size = (await fsp.stat(compressed)).size;
      }
      if (size > MAX_FINAL_BYTES) throw new UploadError(413, '변환 후에도 48MB를 초과합니다. 영상을 나누거나 더 압축해 주세요.');
      const fileName = `lec_${crypto.randomUUID()}.mp4`;
      const target = `${supabaseUrl}/storage/v1/object/lectures/${fileName}`;
      const uploaded = await request(target, { method: 'POST', headers: { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.createReadStream(compressed), duplex: 'half', signal: abort.signal });
      if (!uploaded.ok) throw new UploadError(502, `스토리지 업로드에 실패했습니다. (${uploaded.status})`);
      respond(200, { success: true, publicUrl: target, fileName, size, mimeType: 'video/mp4', originalMb: (bytes / 1024 / 1024).toFixed(1), compressedMb: (size / 1024 / 1024).toFixed(1) });
    } catch (error) {
      respond(error.status || (abort.signal.aborted ? 408 : 500), { error: error instanceof UploadError ? error.message : '동영상 처리 중 연결이 끊기거나 오류가 발생했습니다.' });
    } finally {
      clearTimeout(timer);
      req.removeListener('aborted', disconnect);
      res.removeListener('close', close);
      if (ownsSlot) busy = false;
      // Remove only the temporary directory created immediately inside our upload root.
      if (workDir && path.dirname(path.resolve(workDir)) === path.resolve(uploadDir)) await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
}
