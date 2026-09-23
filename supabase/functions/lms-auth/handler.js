// Runtime-independent handler: dependency injection keeps tests entirely offline.
const profileColumns = 'id,auth_user_id,name,birth_date,phone,member_no,role,created_at';
const publicProfile = p => ({ id: p.id, name: p.name, birthDate: p.birth_date,
  phone: p.phone, memberNo: p.member_no, role: p.role, createdAt: p.created_at });
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const syntheticEmail = async id => `${await digest(id.trim().toLowerCase())}@lms.invalid`;
async function legacyMatches(input, stored) {
  if (!stored || input.startsWith('sha256:')) return false;
  const expected = stored.startsWith('sha256:') ? `sha256:${await digest(input)}` : input;
  // Fixed-size digest comparison, without returning credentials to the browser.
  const a = await digest(expected), b = await digest(stored);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export function createHandler({ url, serviceKey, anonKey, allowedOrigins = [], fetch: request = globalThis.fetch }) {
  async function api(path, { method = 'GET', body, token = serviceKey, prefer } = {}) {
    const response = await request(`${url}${path}`, { method, headers: {
      apikey: token === serviceKey ? serviceKey : anonKey, Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    let value;
    try { value = text ? JSON.parse(text) : null; } catch { throw new HttpError(502, '인증 서버 응답을 확인하지 못했습니다.'); }
    if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 400, '요청을 처리하지 못했습니다. 입력 정보 또는 계정 상태를 확인해 주세요.');
    return value;
  }
  const find = async id => await api('/rest/v1/rpc/lms_find_user', { method: 'POST', body: { p_id: id } });
  async function admin(req) {
    const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || token === anonKey || token === serviceKey) throw new HttpError(401, '로그인이 필요합니다.');
    let identity;
    try { identity = await api('/auth/v1/user', { token }); } catch { throw new HttpError(401, '세션이 만료되었습니다.'); }
    const profile = (await api(`/rest/v1/users?auth_user_id=eq.${encodeURIComponent(identity.id)}&select=${profileColumns}`))?.[0];
    if (profile?.role !== 'admin') throw new HttpError(403, '관리자 권한이 필요합니다.');
    return profile;
  }
  async function createAuth(id, password) {
    const value = await api('/auth/v1/admin/users', { method: 'POST', body: { email: await syntheticEmail(id), password, email_confirm: true } });
    return value.user || value;
  }
  async function signIn(id, password) {
    try { return await api('/auth/v1/token?grant_type=password', { method: 'POST', token: anonKey, body: { email: await syntheticEmail(id), password } }); }
    catch { throw new HttpError(401, '아이디 또는 비밀번호가 일치하지 않습니다.'); }
  }
  return async req => {
    const origin = req.headers.get('Origin');
    const cors = { 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', Vary: 'Origin', ...(origin && allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) };
    const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (origin && !allowedOrigins.includes(origin)) return respond({ error: '허용되지 않은 출처입니다.' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return respond({ error: 'POST 요청만 지원합니다.' }, 405);
    try {
      if (!url || !serviceKey || !anonKey) throw new HttpError(503, '인증 서비스가 준비되지 않았습니다.');
      const text = await req.text();
      if (text.length > 8192) throw new HttpError(413, '요청 크기가 너무 큽니다.');
      let body;
      try { body = JSON.parse(text); } catch { throw new HttpError(400, '잘못된 요청입니다.'); }
      const action = body?.action;
      const supported = ['login','register','admin-register','admin-reset','admin-delete','availability'];
      if (!supported.includes(action)) throw new HttpError(400, '지원하지 않는 요청입니다. 비밀번호 재설정은 관리자에게 문의해 주세요.');
      const actor = action.startsWith('admin-') ? await admin(req) : null;
      const id = String(body.id || body.userId || '').trim().toLowerCase();
      const phoneLookup = String(body.phone || '').replace(/[^0-9]/g, '');
      const newRegistration = action === 'register' || action === 'admin-register';
      if (newRegistration && !/^[a-z0-9_.-]{2,50}$/.test(id)) throw new HttpError(400, '신규 아이디는 영문, 숫자, 점, 밑줄, 하이픈 2~50자로 입력해 주세요.');
      if (!newRegistration && !(action === 'availability' && !id && /^\d{9,15}$/.test(phoneLookup)) && (!id || id.length > 50)) throw new HttpError(400, '아이디를 확인해 주세요.');
      if (!actor) {
        const allowed = await api('/rest/v1/rpc/lms_auth_rate_limit', { method: 'POST', body: { p_key: await digest(`${action}:${id || phoneLookup}`) } });
        if (!allowed) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (action === 'availability') {
        const taken = id ? Boolean(await find(id)) : false;
        const phone = String(body.phone || '').replace(/[^0-9]/g, '');
        const phones = phone ? await api('/rest/v1/rpc/lms_phone_available', { method: 'POST', body: { p_phone: phone } }) : true;
        return respond({ idAvailable: !taken, phoneAvailable: phones === true });
      }
      const existing = await find(id);
      const password = String(body.password || body.newPassword || '');
      if (action === 'login') {
        if (!existing || !password || password.length > 1024) throw new HttpError(401, '아이디 또는 비밀번호가 일치하지 않습니다.');
        if (!existing.auth_user_id) {
          if (!await legacyMatches(password, existing.password)) throw new HttpError(401, '아이디 또는 비밀번호가 일치하지 않습니다.');
          let authUser;
          try { authUser = await createAuth(id, password); }
          catch {
            // Recover an interrupted first migration only by proving the same Auth password.
            const session = await signIn(id, password);
            authUser = session.user;
          }
          const linked = await api(`/rest/v1/users?id=eq.${encodeURIComponent(existing.id)}&auth_user_id=is.null`, { method: 'PATCH', prefer: 'return=representation', body: { auth_user_id: authUser.id, password: null } });
          if (!linked?.length) {
            const current = await find(id);
            if (current?.auth_user_id !== authUser.id) throw new HttpError(409, '계정 연결 상태를 확인해 주세요.');
          }
        }
        const session = await signIn(id, password);
        const current = await find(id);
        if (session.user?.id !== current?.auth_user_id) throw new HttpError(401, '계정 연결 상태를 확인해 주세요.');
        return respond({ session, user: publicProfile(current) });
      }
      if (action === 'admin-delete') {
        if (!existing) throw new HttpError(404, '회원을 찾을 수 없습니다.');
        if (existing.id === actor.id || existing.role === 'admin') throw new HttpError(403, '관리자 계정은 이 화면에서 삭제할 수 없습니다.');
        // Delete profile first: if Auth deletion fails the orphan has no profile or RLS access.
        await api(`/rest/v1/users?id=eq.${encodeURIComponent(existing.id)}`, { method: 'DELETE' });
        if (existing.auth_user_id) await api(`/auth/v1/admin/users/${existing.auth_user_id}`, { method: 'DELETE' });
        return respond({ success: true });
      }
      if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new HttpError(400, '비밀번호는 영문, 숫자, 기호를 포함한 8~128자로 입력해 주세요.');
      if (action === 'admin-reset') {
        if (!existing) throw new HttpError(404, '회원을 찾을 수 없습니다.');
        let authId = existing.auth_user_id;
        if (authId) await api(`/auth/v1/admin/users/${authId}`, { method: 'PUT', body: { password } });
        else authId = (await createAuth(existing.id, password)).id;
        await api(`/rest/v1/users?id=eq.${encodeURIComponent(existing.id)}`, { method: 'PATCH', body: { auth_user_id: authId, password: null } });
        return respond({ success: true });
      }
      if (existing) throw new HttpError(409, '이미 등록된 아이디입니다.');
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').replace(/[^0-9]/g, '');
      const birthDate = String(body.birthDate || '');
      if (!name || name.length > 100 || !/^\d{9,15}$/.test(phone) || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate))) throw new HttpError(400, '이름, 생년월일, 전화번호를 확인해 주세요.');
      let authUser;
      try { authUser = await createAuth(id, password); }
      catch { authUser = (await signIn(id, password)).user; }
      let profile;
      try {
        const rows = await api('/rest/v1/users', { method: 'POST', prefer: 'return=representation', body: {
          id, auth_user_id: authUser.id, password: null, name, birth_date: birthDate, phone,
          member_no: `BUDDHA-${crypto.randomUUID()}`, role: actor && body.role === 'admin' ? 'admin' : 'student'
        } });
        profile = rows?.[0];
        if (!profile) throw new HttpError(502, '회원 저장을 확인하지 못했습니다.');
      } catch (error) {
        // A lost response may follow a committed insert; never delete its linked Auth user.
        const saved = await find(id).catch(() => undefined);
        if (saved?.auth_user_id === authUser.id) profile = saved;
        else {
          if (saved === null) await api(`/auth/v1/admin/users/${authUser.id}`, { method: 'DELETE' }).catch(() => {});
          throw error;
        }
      }
      return respond({ user: publicProfile(profile) });
    } catch (error) {
      return respond({ error: error instanceof HttpError ? error.message : '인증 서비스 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, error instanceof HttpError ? error.status : 500);
    }
  };
}
