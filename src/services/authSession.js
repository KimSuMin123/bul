// Only Supabase-issued tokens are stored here. Profile/role data is verified by RPC.
const env = import.meta.env || (typeof process !== 'undefined' ? process.env : {});
const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';
const SESSION_KEY = 'buddha_lms_auth_session';
let memorySession = null;
let refreshing = null;
let generation = 0;
// 자동 로그인: 켜면 브라우저를 닫아도 남는 localStorage, 끄면 탭을 닫을 때 지워지는 sessionStorage에 보관한다.
let persistent = false;

function readStored(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(SESSION_KEY) || 'null');
    return saved?.access_token && saved?.refresh_token ? saved : null;
  } catch { return null; }
}

export function getAuthSession() {
  // 자동 로그인은 여러 탭이 같은 세션을 쓰므로, 다른 탭이 연장한 최신 토큰을 매번 읽는다.
  if (persistent) {
    const shared = readStored(globalThis.localStorage);
    if (shared) memorySession = shared;
  }
  if (memorySession) return memorySession;
  const tab = readStored(globalThis.sessionStorage);
  if (tab) return tab;
  const kept = readStored(globalThis.localStorage);
  if (kept) persistent = true;
  return kept;
}

export function setRememberLogin(remember) { persistent = remember === true; }

export function beginAuthAttempt() { return ++generation; }

export function setAuthSession(session, expectedGeneration) {
  if (expectedGeneration !== undefined && expectedGeneration !== generation) throw new Error('로그인 상태가 변경되었습니다. 다시 시도해 주세요.');
  if (!session?.access_token || !session?.refresh_token) throw new Error('로그인 세션을 확인하지 못했습니다.');
  generation++;
  memorySession = { access_token: session.access_token, refresh_token: session.refresh_token,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600) };
  const [keep, drop] = persistent ? [globalThis.localStorage, globalThis.sessionStorage] : [globalThis.sessionStorage, globalThis.localStorage];
  try { keep?.setItem(SESSION_KEY, JSON.stringify(memorySession)); } catch { /* memory session remains usable */ }
  try { drop?.removeItem(SESSION_KEY); } catch { /* private mode */ }
  return memorySession;
}

export function clearAuthSession() {
  generation++;
  memorySession = null;
  persistent = false;
  try { globalThis.sessionStorage?.removeItem(SESSION_KEY); } catch { /* private mode */ }
  try { globalThis.localStorage?.removeItem(SESSION_KEY); } catch { /* private mode */ }
}

export async function authRequest(path, body, token = key, method = 'POST') {
  if (!url || !key) throw new Error('서버 연결 설정을 확인해 주세요.');
  const response = await fetch(`${url}${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error || result?.msg || result?.message || '인증 요청을 처리하지 못했습니다.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function getAccessToken() {
  const session = getAuthSession();
  if (!session) return key;
  if (session.expires_at > Date.now() / 1000 + 30) return session.access_token;
  if (!refreshing) {
    const started = generation;
    refreshing = authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(next => {
        if (generation !== started) throw new Error('로그인 상태가 변경되었습니다.');
        return setAuthSession(next).access_token;
      })
      .catch(error => {
        if (generation === started && (error.status === 400 || error.status === 401)) {
          clearAuthSession();
          // 로그인 연장 거절: 다른 기기 로그인으로 끊겼거나 서버에서 세션이 무효화된 경우
          globalThis.window?.dispatchEvent(new CustomEvent('buddha_auth_expired', { detail: { reason: 'refresh' } }));
        }
        throw error;
      }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function callAuthAction(action, fields = {}, authenticated = false) {
  return authRequest('/functions/v1/lms-auth', { action, ...fields }, authenticated ? await getAccessToken() : key);
}

// 1인 1기기: 방금 로그인한 기기만 남기고 같은 계정의 다른 기기 로그인을 끊는다.
// 끊긴 기기는 다음 로그인 연장(최대 1시간 이내) 때 거절되어 중복 로그인 안내 후 로그아웃된다.
export async function revokeOtherSessions() {
  await authRequest('/auth/v1/logout?scope=others', undefined, await getAccessToken());
}

// 본인 비밀번호 변경: 현재 비밀번호로 다시 로그인해 본인임을 확인한 뒤, 그 세션으로 Supabase Auth 비밀번호를 바꾼다.
export async function changeOwnPassword(loginId, currentPassword, newPassword) {
  let verified;
  try {
    verified = await callAuthAction('login', { id: loginId, password: currentPassword });
  } catch (error) {
    if (error.status === 401) throw new Error('현재 비밀번호가 일치하지 않습니다.');
    throw error;
  }
  if (!verified?.session?.access_token) throw new Error('본인 확인에 실패했습니다. 다시 시도해 주세요.');
  await authRequest('/auth/v1/user', { password: newPassword }, verified.session.access_token, 'PUT');
  // 확인에 쓴 새 세션을 이 기기의 세션으로 이어서 사용한다.
  setAuthSession(verified.session);
}

export async function signOutSession() {
  const token = getAuthSession()?.access_token;
  clearAuthSession();
  if (token) await authRequest('/auth/v1/logout', undefined, token);
}
