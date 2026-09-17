// ==============================================================================
// Sehwa Buddha Academy - Storage Service: Zero-LocalStorage Policy
// All application entities (users, courses, lectures, progress, enrollments, etc.)
// are fetched from and stored exclusively in the Supabase Cloud Database.
// LocalStorage is strictly disabled and wiped to prevent any sensitive data retention.
// ==============================================================================

const STORAGE_KEYS = {
  CURRENT_USER: 'buddha_lms_current_user'
};

/**
 * Completely purges all localStorage keys to ensure 0 bytes stored on user disk
 */
export function purgeLegacyLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  } catch (e) {
    console.warn('LocalStorage clear error:', e);
  }
}

/**
 * Initializes storage with an immediate purge of localStorage
 */
export function initStorage() {
  purgeLegacyLocalStorage();
}

/**
 * Transient in-memory / session storage for active tab lifetime only
 * (Destroyed completely as soon as the tab or browser window is closed)
 */
export function getStored(key) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStored(key, data) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Session storage set error:', e);
  }
}

export function removeStored(key) {
  try {
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) window.sessionStorage.removeItem(key);
      if (window.localStorage) window.localStorage.removeItem(key);
    }
  } catch (e) {}
}

export { STORAGE_KEYS };
