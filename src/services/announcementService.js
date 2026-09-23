import { getAccessToken } from './authSession.js';

const env = import.meta.env || (typeof process !== 'undefined' ? process.env : {});
const base = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';
const columns = 'id,title,content,type,image_url,link_url,enabled,starts_at,ends_at,created_at,updated_at';

export function safeHttpUrl(value) {
  if (!value?.trim()) return '';
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

export function isAnnouncementActive(item, now = new Date()) {
  const time = now.getTime();
  return item.enabled === true && (!item.starts_at || Date.parse(item.starts_at) <= time)
    && (!item.ends_at || Date.parse(item.ends_at) > time);
}

export async function validateAnnouncementImage(file) {
  if (!file || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 이미지를 선택해 주세요.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const png = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const gif = String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/);
  const detected = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : gif ? 'image/gif' : '';
  if (!detected || file.type !== detected) throw new Error('JPG, PNG, WEBP, GIF 이미지 형식을 확인해 주세요.');
  return detected;
}

async function request(path, { method = 'GET', body, admin = false, headers = {} } = {}) {
  if (!base || !key) throw new Error('공지 서버 연결 설정을 확인해 주세요.');
  const token = admin ? await getAccessToken() : key;
  if (admin && (!token || token === key)) throw new Error('관리자 로그인이 필요합니다.');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, ...headers },
    ...(body === undefined ? {} : { body }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.error || `공지 요청에 실패했습니다. (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json().catch(() => { throw new Error('공지 서버 응답을 읽지 못했습니다. 다시 시도해 주세요.'); });
}

export async function listActiveAnnouncements() {
  const now = new Date().toISOString();
  const rows = await request(`/rest/v1/site_announcements?select=${columns}&enabled=eq.true&and=(or(starts_at.is.null,starts_at.lte.${now}),or(ends_at.is.null,ends_at.gt.${now}))&order=updated_at.desc`);
  return (rows || []).filter(item => isAnnouncementActive(item));
}

export async function listAdminAnnouncements() {
  return (await request(`/rest/v1/site_announcements?select=${columns}&order=updated_at.desc`, { admin: true })) || [];
}

export async function saveAnnouncement(item) {
  const title = item.title?.trim();
  const content = item.content?.trim() || '';
  if (!title) throw new Error('공지 제목을 입력해 주세요.');
  if (!content && !item.image_url) throw new Error('본문 또는 이미지를 입력해 주세요.');
  if (item.link_url && !safeHttpUrl(item.link_url)) throw new Error('링크는 http 또는 https 주소여야 합니다.');
  if (item.starts_at && item.ends_at && Date.parse(item.starts_at) >= Date.parse(item.ends_at)) throw new Error('종료 시각은 시작 시각보다 늦어야 합니다.');
  const payload = { title, content, type: item.image_url ? 'image' : 'text', image_url: item.image_url || null,
    link_url: item.link_url ? safeHttpUrl(item.link_url) : null, enabled: Boolean(item.enabled),
    starts_at: item.starts_at || null, ends_at: item.ends_at || null };
  const editing = Boolean(item.id);
  const path = `/rest/v1/site_announcements${editing ? `?id=eq.${encodeURIComponent(item.id)}` : ''}`;
  const rows = await request(path, { method: editing ? 'PATCH' : 'POST', admin: true,
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  if (!rows?.[0]?.id) throw new Error('공지 저장 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요.');
  return rows[0];
}

export async function deleteAnnouncement(id) {
  const rows = await request(`/rest/v1/site_announcements?id=eq.${encodeURIComponent(id)}&select=id`, { method: 'DELETE', admin: true, headers: { Prefer: 'return=representation' } });
  if (!rows?.some(row => row.id === id)) throw new Error('공지 삭제 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요.');
}

export async function uploadAnnouncementImage(file) {
  const mime = await validateAnnouncementImage(file);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
  const name = `${crypto.randomUUID()}.${ext}`;
  await request(`/storage/v1/object/announcement-images/${name}`, { method: 'POST', admin: true, body: file,
    headers: { 'Content-Type': mime, 'x-upsert': 'false' } });
  return `${base}/storage/v1/object/public/announcement-images/${name}`;
}
