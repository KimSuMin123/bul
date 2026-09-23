import { getAccessToken } from './authSession.js';

const env = import.meta.env || (typeof process !== 'undefined' ? process.env : {});
const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
export function createMediaStorage({ url, key, token = getAccessToken, request = globalThis.fetch,
  xhrFactory = () => new XMLHttpRequest(), localMode = false }) {
  const configured = () => { if (!url || !key) throw new Error('스토리지 연결 설정을 확인해 주세요.'); };
  async function authHeaders(required = true) {
    configured();
    const access = await token();
    if (required && (!access || access === key)) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
    return { apikey: key, Authorization: `Bearer ${access || key}` };
  }
  function objectPath(value, bucket) {
    if (!value) return null;
    try {
      const parsed = new URL(value);
      if (parsed.origin !== new URL(url).origin) return null;
      const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/]+)\/(.+)$/);
      if (!match || match[1] !== bucket) return null;
      return decodeURIComponent(match[2]);
    } catch { return null; }
  }
  async function signedUrl(path, required) {
    const headers = await authHeaders(required);
    const res = await request(`${url}/storage/v1/object/sign/lectures/${encodePath(path)}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 }), signal: AbortSignal.timeout(15000)
    });
    const result = await res.json().catch(() => null);
    const signed = result?.signedURL || result?.signedUrl;
    if (!res.ok || !signed) throw new Error('미디어 접근 권한을 확인하지 못했습니다. 수강권 또는 로그인 상태를 확인해 주세요.');
    if (/^https?:\/\//.test(signed)) return signed;
    return `${url}${signed.startsWith('/storage/v1/') ? '' : '/storage/v1'}${signed.startsWith('/') ? '' : '/'}${signed}`;
  }
  async function getLectureVideoUrl(value) {
    const path = objectPath(value, 'lectures');
    return path ? signedUrl(path, true) : value;
  }
  async function getThumbnailUrl(value) {
    const path = objectPath(value, 'lectures');
    return path && /^thumbs\/[^/]+\.(?:jpe?g|png|webp|gif)$/i.test(path) ? signedUrl(path, false) : value;
  }
  async function getNamoAudioUrl() {
    // The matching DB policy exposes only this public greeting audio object.
    return signedUrl('audio/namo_buddhaya_song.mp3', false);
  }
  async function sendFile(file, target, headers, onProgress, local = false) {
    return new Promise((resolve, reject) => {
      const xhr = xhrFactory();
      const started = Date.now();
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        const elapsed = Math.max(0.1, (Date.now() - started) / 1000);
        onProgress?.({ percent: Math.min(99, Math.round(100 * event.loaded / event.total)), loaded: event.loaded,
          total: event.total, speed: `${(event.loaded / elapsed / 1024 / 1024).toFixed(1)} MB/s`,
          step: local && event.loaded >= event.total ? 'processing' : 'uploading' });
      };
      xhr.onload = () => {
        let result;
        try { result = JSON.parse(xhr.responseText || '{}'); } catch { return reject(new Error('업로드 서버 응답 형식이 올바르지 않습니다.')); }
        if (xhr.status < 200 || xhr.status >= 300 || (local && (!result.success || !result.publicUrl))) {
          return reject(new Error(result.error || result.message || `업로드에 실패했습니다. (${xhr.status})`));
        }
        onProgress?.({ percent: 100, loaded: file.size, total: file.size, speed: '완료', step: 'done' });
        resolve(result);
      };
      xhr.onerror = () => reject(new Error('미디어 업로드 중 네트워크 오류가 발생했습니다.'));
      xhr.ontimeout = () => reject(new Error('미디어 업로드 시간이 초과되었습니다.'));
      xhr.onabort = () => reject(new Error('미디어 업로드가 취소되었습니다.'));
      xhr.open('POST', target);
      xhr.timeout = 15 * 60 * 1000;
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }
  async function uploadLectureVideo(file, onProgress) {
    const headers = await authHeaders();
    if (!file || !file.size || !/^video\//.test(file.type || '')) throw new Error('동영상 파일을 선택해 주세요.');
    if (localMode) {
      if (file.size > 1024 * 1024 * 1024) throw new Error('로컬 변환 파일은 1GB 이하여야 합니다.');
      return sendFile(file, `/api/upload-video?name=${encodeURIComponent(file.name)}`, headers, onProgress, true);
    }
    if (file.size > 48 * 1024 * 1024) throw new Error('영상 파일을 48MB 이하로 압축한 후 업로드해 주세요.');
    const cleanName = (file.name || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `lec_${crypto.randomUUID()}_${cleanName}`;
    await sendFile(file, `${url}/storage/v1/object/lectures/${encodePath(fileName)}`, headers, onProgress);
    return { publicUrl: `${url}/storage/v1/object/lectures/${encodePath(fileName)}`, fileName, size: file.size, mimeType: file.type };
  }
  async function deleteLectureVideo(fileName) {
    if (/^https?:\/\//.test(fileName || '')) {
      fileName = objectPath(fileName, 'lectures');
      if (!fileName) return false;
    }
    if (!fileName) throw new Error('삭제할 영상 파일을 확인해 주세요.');
    const headers = await authHeaders();
    const res = await request(`${url}/storage/v1/object/lectures`, { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [fileName] }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('동영상 삭제에 실패했습니다.');
    return true;
  }
  async function uploadThumbnailImage(file, maxWidth = 1200, quality = 0.82) {
    const headers = await authHeaders();
    if (!file || !/^image\/(?:jpeg|png|webp|gif)$/.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error('10MB 이하의 JPG, PNG, WEBP, GIF 이미지를 선택해 주세요.');
    const bitmap = await createImageBitmap(file);
    let blob;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(bitmap.width, maxWidth);
      canvas.height = Math.max(1, Math.round(bitmap.height * canvas.width / bitmap.width));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 압축에 실패했습니다.')), 'image/jpeg', quality));
    } finally { bitmap.close(); }
    const fileName = `thumb_${crypto.randomUUID()}.jpg`;
    const res = await request(`${url}/storage/v1/object/thumbnails/${fileName}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'image/jpeg' }, body: blob, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error('이미지 저장에 실패했습니다. 다시 시도해 주세요.');
    return { publicUrl: `${url}/storage/v1/object/public/thumbnails/${fileName}`, fileName, size: blob.size };
  }
  return { getLectureVideoUrl, getThumbnailUrl, getNamoAudioUrl, uploadLectureVideo, deleteLectureVideo, uploadThumbnailImage };
}

const media = createMediaStorage({ url: env.VITE_SUPABASE_URL || '', key: env.VITE_SUPABASE_ANON_KEY || '',
  localMode: import.meta.env?.DEV === true && env.VITE_VIDEO_UPLOAD_MODE === 'local' });
export const { getLectureVideoUrl, getThumbnailUrl, getNamoAudioUrl, uploadLectureVideo, deleteLectureVideo, uploadThumbnailImage } = media;
