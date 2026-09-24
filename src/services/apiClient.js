// Supabase & External DB REST Client (Lightweight Native Fetch Adapter)
// Public API key identifies the project; user JWTs carry the authenticated identity.
import { getAccessToken, getAuthSession, setAuthSession, beginAuthAttempt, clearAuthSession, callAuthAction } from './authSession.js';
import { getThumbnailUrl } from './mediaStorage.js';
export { uploadLectureVideo, deleteLectureVideo, uploadThumbnailImage, getLectureVideoUrl, getThumbnailUrl } from './mediaStorage.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const SUPABASE_URL = env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = env?.VITE_SUPABASE_ANON_KEY || '';

export const isExternalDbConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isStorageConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function requireExternalDb() {
  if (!isExternalDbConfigured) throw new Error('데이터베이스 연결이 설정되지 않았습니다.');
}

function requireSavedRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.some(row => !row || Array.isArray(row) || !row.id)) throw new Error('변경 결과를 확인하지 못했습니다. 권한과 최신 목록을 확인해 주세요.');
  return rows;
}

// Keep expiring signed URLs out of persisted course metadata.
function storageObjectReference(value) {
  if (!value) return value;
  try {
    const parsed = new URL(value);
    if (parsed.origin === new URL(SUPABASE_URL).origin && parsed.pathname.startsWith('/storage/v1/object/sign/')) {
      return `${parsed.origin}${parsed.pathname.replace('/object/sign/', '/object/')}`;
    }
  } catch { /* Non-Storage URLs are left intact. */ }
  return value;
}

function mapProgress(p) {
  return { id: p.id, userId: p.user_id, courseId: p.course_id, lectureId: p.lecture_id,
    lastPlayedSeconds: p.last_played_seconds, watchedSeconds: p.watched_seconds,
    progressRate: Number(p.progress_rate) || 0, completed: Boolean(p.completed), updatedAt: p.updated_at };
}

function mapCertificate(c) {
  return { certNo: c.cert_no, userId: c.user_id, courseId: c.course_id, memberNo: c.member_no,
    studentName: c.student_name, dharmaName: c.dharma_name || '', birthDate: c.birth_date, courseTitle: c.course_title,
    period: c.period, issuedAt: c.issued_at, status: c.status };
}

/**
 * Standard Web Crypto SHA-256 Password Hashing Helper
 * Protects passwords from plain-text exposure in databases and network logs
 */
export async function hashPassword(plainTextPassword) {
  if (!plainTextPassword) return '';
  const msgUint8 = new TextEncoder().encode(plainTextPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}

/**
 * Verifies an input password against stored hash (with legacy plain-text backward compatibility)
 */
export async function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith('sha256:')) {
    const hashedInput = await hashPassword(inputPassword);
    return hashedInput === storedPassword;
  }
  // Backward compatibility with initial plain text accounts
  return inputPassword === storedPassword;
}

export async function testSupabaseConnection() {
  if (!isExternalDbConfigured) {
    return {
      configured: false,
      success: false,
      message: '.env 파일에 VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY가 아직 설정되지 않았습니다. (현재 안전한 로컬 스토리지 모드로 작동 중)'
    };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/courses?select=count`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      return {
        configured: true,
        success: true,
        message: 'Supabase 클라우드 데이터베이스에 정상적으로 연결되었습니다! (실시간 동기화 활성)'
      };
    } else {
      return {
        configured: true,
        success: false,
        message: `연결 실패 (${res.status}): API 키를 확인하거나 database_setup.sql 테이블 생성을 먼저 진행해 주세요.`
      };
    }
  } catch (e) {
    return {
      configured: true,
      success: false,
      message: `네트워크 연결 실패: ${e.message}`
    };
  }
}

/**
 * Generic REST requester for Supabase PostgREST
 */
async function supabaseFetch(endpoint, options = {}) {
  if (!isExternalDbConfigured) {
    throw new Error('Supabase 외부 DB가 설정되지 않았습니다. .env 환경변수를 확인해 주세요.');
  }

  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  
  // Ensure return=representation is preserved unless caller specifies otherwise
  let preferHeader = options.prefer || 'return=representation';
  if (!preferHeader.includes('return=')) {
    preferHeader += ',return=representation';
  }

  const requestToken = await getAccessToken();
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${requestToken}`,
    'Content-Type': 'application/json',
    'Prefer': preferHeader,
    ...(options.headers || {})
  };

  // 10 second timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const signal = options.signal || controller.signal;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401 && getAuthSession()?.access_token === requestToken) {
        clearAuthSession();
        globalThis.window?.dispatchEvent(new Event('buddha_auth_expired'));
      }
      const errText = await res.text();
      throw new Error(`DB Error (${res.status}): ${errText}`);
    }

    if (res.status === 204) return null; // No Content
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    try { return JSON.parse(text); }
    catch { throw new Error('서버 응답 형식을 확인하지 못했습니다.'); }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('네트워크 요청 시간이 초과되었습니다. (10초 타임아웃)');
    }
    throw err;
  }
}

/**
 * Complete Supabase Remote Operations (Users, Courses, Lectures, Enrollments, Progress, Payments, Certificates, Q&A)
 */
export const remoteDb = {
  // ================= USERS =================
  /**
   * Securely retrieve user list WITHOUT passwords (protects student and admin credentials)
   */
  async getUsers() {
    requireExternalDb();
    try {
      // SECURITY: Explicitly omit the 'password' column to prevent credential harvesting in browser
      const rows = await supabaseFetch('/users?select=id,login_id,name,dharma_name,birth_date,phone,member_no,role,created_at');
      return rows
        .map(r => ({
          id: r.id,
          loginId: r.login_id || r.id,
          name: r.name,
          dharmaName: r.dharma_name || '',
          birthDate: r.birth_date,
          phone: r.phone,
          memberNo: r.member_no,
          role: r.role || 'student',
          createdAt: r.created_at
        }));
    } catch (err) {
      console.warn('Remote getUsers failed:', err);
      throw err;
    }
  },

  /**
   * Secure single-user authentication routine
   * Exchanges credentials with the server for a standard authenticated session.
   */
  async authenticateUser(id, inputPassword) {
    requireExternalDb();
    const generation = beginAuthAttempt();
    const result = await callAuthAction('login', { id: id.trim(), password: inputPassword });
    if (!result?.user?.id) throw new Error('로그인 정보를 확인하지 못했습니다.');
    setAuthSession(result.session, generation);
    return result.user;
  },

  async getCurrentUser() {
    if (!getAuthSession()) return null;
    const user = await supabaseFetch('/rpc/current_lms_user', { method: 'POST', body: '{}' });
    return user?.id ? user : null;
  },

  async checkAvailability(fields) {
    return callAuthAction('availability', fields);
  },

  /**
   * Creates the Auth identity and profile through the server.
   */
  async insertUser(userData, asAdmin = false) {
    requireExternalDb();
    const result = await callAuthAction(asAdmin ? 'admin-register' : 'register', userData, asAdmin);
    if (!result?.user?.id) throw new Error('회원 저장 결과를 확인하지 못했습니다. 재시도 전에 회원 목록을 확인해 주세요.');
    return result.user;
  },

  /**
   * Updates passwords through the administrator-only server action.
   */
  async updateUserPassword(id, newPassword) {
    const result = await callAuthAction('admin-reset', { userId: id, newPassword }, true);
    if (!result?.success) throw new Error('비밀번호 변경을 확인하지 못했습니다.');
    return true;
  },

  async deleteUser(id) {
    const result = await callAuthAction('admin-delete', { userId: id }, true);
    if (!result?.success) throw new Error('회원 삭제를 확인하지 못했습니다.');
    return true;
  },

  // ================= COURSES =================
  async getCourses() {
    requireExternalDb();
    try {
      const rows = await supabaseFetch('/courses?select=id,title,subtitle,category,thumbnail,default_period_days,sequential_unlock,price,instructor,cert_type,cert_grade,cert_type_full,cert_reg_no,cert_reg_office');
      return Promise.all(rows.map(async c => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        category: c.category,
        thumbnail: await getThumbnailUrl(c.thumbnail),
        defaultPeriodDays: c.default_period_days,
        sequentialUnlock: c.sequential_unlock,
        price: c.price,
        instructor: c.instructor,
        certType: c.cert_type || '불교의례법사',
        certGrade: c.cert_grade || '2급',
        certTypeFull: c.cert_type_full || `${c.cert_type || '불교의례법사'} ${c.cert_grade || '2급'}`.trim(),
        certRegNo: c.cert_reg_no || '민간자격 등록번호 제 2026- 00183호',
        certRegOffice: c.cert_reg_office || '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
        rawExamText: null,
        lectureIds: []
      })));
    } catch (err) {
      console.warn('Remote getCourses failed:', err);
      throw err;
    }
  },

  async updateCourseExamText(courseId, rawExamText) {
    const { parseExamText } = await import('./examService.js');
    return this.saveCourseExam(courseId, parseExamText(rawExamText));
  },

  async getCourseExam(courseId) {
    return supabaseFetch('/rpc/get_course_exam', { method: 'POST', body: JSON.stringify({ p_course_id: courseId }) });
  },
  async saveCourseExam(courseId, questions) {
    const result = await supabaseFetch('/rpc/save_course_exam', { method: 'POST', body: JSON.stringify({ p_course_id: courseId, p_questions: questions }) });
    if (result !== true && !result?.success) throw new Error('시험 문제 저장을 확인하지 못했습니다.');
    return result;
  },

  async insertCourse(courseData) {
    requireExternalDb();
    try {
      const payload = {
        id: courseData.id,
        title: courseData.title,
        subtitle: courseData.subtitle,
        category: courseData.category,
        thumbnail: storageObjectReference(courseData.thumbnail),
        default_period_days: courseData.defaultPeriodDays,
        sequential_unlock: courseData.sequentialUnlock,
        price: courseData.price,
        instructor: courseData.instructor,
        cert_type: courseData.certType || '불교의례법사',
        cert_grade: courseData.certGrade || '2급',
        cert_type_full: courseData.certTypeFull || '불교의례법사 2급',
        cert_reg_no: courseData.certRegNo || '민간자격 등록번호 제 2026- 00183호',
        cert_reg_office: courseData.certRegOffice || '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)'
      };
      const inserted = await supabaseFetch('/rpc/save_course_record', {
        method: 'POST',
        body: JSON.stringify({ p_course: payload, p_questions: courseData.examQuestions?.length ? courseData.examQuestions : null })
      });
      requireSavedRows(inserted ? [inserted] : []);
      return inserted;
    } catch (err) {
      console.warn('Remote insertCourse failed:', err);
      throw err;
    }
  },

  async deleteCourse(courseId) {
    requireExternalDb();
    try {
      const changed = await supabaseFetch(`/courses?id=eq.${encodeURIComponent(courseId)}`, {
        method: 'DELETE'
      });
      requireSavedRows(changed);
      return true;
    } catch (err) {
      console.warn('Remote deleteCourse failed:', err);
      throw err;
    }
  },

  async updateCourse(courseId, updates) {
    requireExternalDb();
    try {
      const payload = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.thumbnail !== undefined) payload.thumbnail = storageObjectReference(updates.thumbnail);
      if (updates.defaultPeriodDays !== undefined) payload.default_period_days = updates.defaultPeriodDays;
      if (updates.sequentialUnlock !== undefined) payload.sequential_unlock = updates.sequentialUnlock;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.instructor !== undefined) payload.instructor = updates.instructor;
      if (updates.certType !== undefined) payload.cert_type = updates.certType;
      if (updates.certGrade !== undefined) payload.cert_grade = updates.certGrade;
      if (updates.certTypeFull !== undefined) payload.cert_type_full = updates.certTypeFull;
      if (updates.certRegNo !== undefined) payload.cert_reg_no = updates.certRegNo;
      if (updates.certRegOffice !== undefined) payload.cert_reg_office = updates.certRegOffice;

      const changed = await supabaseFetch('/rpc/save_course_record', {
        method: 'POST',
        body: JSON.stringify({ p_course: { ...payload, id: courseId }, p_questions: updates.examQuestions ?? null })
      });
      requireSavedRows(changed?.id ? [changed] : []);
      return true;
    } catch (err) {
      console.warn('Remote updateCourse failed:', err);
      throw err;
    }
  },

  // ================= LECTURES =================
  async getLectures() {
    requireExternalDb();
    try {
      const rows = await supabaseFetch('/lectures?select=*&order=order_index.asc');
      return Promise.all(rows.map(async l => ({
        id: l.id,
        courseId: l.course_id,
        orderIndex: l.order_index,
        title: l.title,
        description: l.description,
        durationSeconds: l.duration_seconds,
        videoUrl: l.video_url,
        thumbnail: await getThumbnailUrl(l.thumbnail),
        attachmentName: l.attachment_name,
        attachments: []
      })));
    } catch (err) {
      console.warn('Remote getLectures failed:', err);
      throw err;
    }
  },

  async insertLecture(lecData) {
    requireExternalDb();
    try {
      const payload = {
        id: lecData.id,
        course_id: lecData.courseId,
        order_index: lecData.orderIndex,
        title: lecData.title,
        description: lecData.description,
        duration_seconds: lecData.durationSeconds,
        video_url: lecData.videoUrl,
        thumbnail: storageObjectReference(lecData.thumbnail),
        attachment_name: lecData.attachmentName || null
      };
      const [inserted] = await supabaseFetch('/lectures', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      requireSavedRows(inserted ? [inserted] : []);
      return inserted;
    } catch (err) {
      console.warn('Remote insertLecture failed:', err);
      throw err;
    }
  },

  async updateLecture(lectureId, updates) {
    requireExternalDb();
    try {
      const payload = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.durationSeconds !== undefined) payload.duration_seconds = updates.durationSeconds;
      if (updates.videoUrl !== undefined) payload.video_url = updates.videoUrl;
      if (updates.thumbnail !== undefined) payload.thumbnail = storageObjectReference(updates.thumbnail);
      if (updates.attachmentName !== undefined) payload.attachment_name = updates.attachmentName;
      if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;

      const changed = await supabaseFetch(`/lectures?id=eq.${encodeURIComponent(lectureId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      requireSavedRows(changed);
      return true;
    } catch (err) {
      console.warn('Remote updateLecture failed:', err);
      throw err;
    }
  },

  async deleteLecture(lectureId) {
    requireExternalDb();
    try {
      const changed = await supabaseFetch(`/lectures?id=eq.${encodeURIComponent(lectureId)}`, {
        method: 'DELETE'
      });
      requireSavedRows(changed);
      return true;
    } catch (err) {
      console.warn('Remote deleteLecture failed:', err);
      throw err;
    }
  },

  // ================= ENROLLMENTS =================
  async getEnrollments(userId = null) {
    requireExternalDb();
    try {
      const endpoint = userId 
        ? `/enrollments?user_id=eq.${encodeURIComponent(userId)}`
        : '/enrollments?select=*';
      const rows = await supabaseFetch(endpoint);
      return rows.map(e => ({
        id: e.id,
        userId: e.user_id,
        courseId: e.course_id,
        status: e.status,
        enrolledAt: e.enrolled_at,
        paidAt: e.paid_at,
        expireAt: e.expire_at
      }));
    } catch (err) {
      console.warn('Remote getEnrollments failed:', err);
      throw err;
    }
  },

  async upsertEnrollment(enr) {
    requireExternalDb();
    try {
      const payload = {
        id: enr.id,
        user_id: enr.userId,
        course_id: enr.courseId,
        status: enr.status,
        enrolled_at: enr.enrolledAt,
        paid_at: enr.paidAt || null,
        expire_at: enr.expireAt
      };
      const [upserted] = await supabaseFetch('/enrollments', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      if (!upserted) throw new Error('저장 결과를 확인하지 못했습니다. 재시도 전에 새로고침하여 확인해 주세요.');
      return upserted;
    } catch (err) {
      console.warn('Remote upsertEnrollment failed:', err);
      throw err;
    }
  },

  // ================= PAYMENTS =================
  async getPayments() {
    requireExternalDb();
    try {
      const rows = await supabaseFetch('/payments?select=*');
      return rows.map(p => ({
        id: p.id,
        userId: p.user_id,
        courseId: p.course_id,
        paidAt: p.paid_at,
        manager: p.manager,
        amount: p.amount,
        methodMemo: p.method_memo,
        donationReceiptIssued: Boolean(p.donation_receipt_issued)
      }));
    } catch (err) {
      console.warn('Remote getPayments failed:', err);
      throw err;
    }
  },

  async insertPayment(pmt) {
    requireExternalDb();
    try {
      const payload = {
        id: pmt.id,
        user_id: pmt.userId,
        course_id: pmt.courseId,
        paid_at: pmt.paidAt,
        manager: pmt.manager,
        amount: pmt.amount,
        method_memo: pmt.methodMemo,
        donation_receipt_issued: Boolean(pmt.donationReceiptIssued)
      };
      const [inserted] = await supabaseFetch('/payments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!inserted) throw new Error('저장 결과를 확인하지 못했습니다. 재시도 전에 새로고침하여 확인해 주세요.');
      return inserted;
    } catch (err) {
      console.warn('Remote insertPayment failed:', err);
      throw err;
    }
  },

  async updatePaymentDonationReceiptStatus(paymentId, issued = true) {
    if (!isExternalDbConfigured || !paymentId) return null;
    try {
      const [updated] = await supabaseFetch(`/payments?id=eq.${encodeURIComponent(paymentId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ donation_receipt_issued: issued })
      });
      return updated;
    } catch (err) {
      console.warn('Remote updatePaymentDonationReceiptStatus failed:', err);
      return null;
    }
  },

  /**
   * Atomic Transaction for payment recording + enrollment activation
   */
  async processCoursePayment({ userId, courseId, amount, manager, methodMemo, paidAt, requestId }) {
    requireExternalDb();
    try {
      const res = await supabaseFetch('/rpc/process_course_payment', {
        method: 'POST',
        body: JSON.stringify({
          p_request_id: requestId,
          p_user_id: userId,
          p_course_id: courseId,
          p_amount: Number(amount) || 0,
          p_manager: (manager || '').trim(),
          p_method_memo: (methodMemo || '').trim(),
          p_paid_at: paidAt || new Date().toISOString().split('T')[0]
        })
      });
      if (!res || res.success !== true || !res.paymentId) {
        throw new Error('수납 결과를 확인하지 못했습니다. 재시도 전에 새로고침하여 장부를 확인해 주세요.');
      }
      return res;
    } catch (err) {
      console.warn('Remote processCoursePayment failed:', err);
      throw err;
    }
  },

  // ================= DONATION RECEIPTS (1전화번호 1행 엄격 누적) =================
  async getDonationReceipts() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/donation_receipts?select=*&order=last_issued_at.desc');
      return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        phone: r.phone,
        totalAmount: Number(r.total_amount) || 0,
        lastIssuedAt: r.last_issued_at,
        createdAt: r.created_at,
        donationCount: Number(r.donation_count) || (Array.isArray(r.history) ? r.history.length : 1),
        history: Array.isArray(r.history) ? r.history : []
      }));
    } catch (err) {
      console.warn('Remote getDonationReceipts failed (fallback to in-memory):', err);
      return null;
    }
  },

  async upsertDonationReceipt(receipt) {
    if (!isExternalDbConfigured || !receipt) return null;
    try {
      const payload = {
        id: receipt.id,
        user_id: receipt.userId || null,
        name: receipt.name,
        phone: receipt.phone,
        total_amount: Number(receipt.totalAmount) || 0,
        last_issued_at: receipt.lastIssuedAt || new Date().toISOString().split('T')[0],
        created_at: receipt.createdAt || new Date().toISOString(),
        donation_count: Number(receipt.donationCount) || 1,
        history: receipt.history || []
      };

      // Upsert using phone as unique conflict target
      const [result] = await supabaseFetch('/donation_receipts?on_conflict=phone', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      return result;
    } catch (err) {
      console.warn('Remote upsertDonationReceipt warning:', err);
      return null;
    }
  },

  // ================= PROGRESS =================
  async getProgress(userId = null) {
    requireExternalDb();
    try {
      const endpoint = userId
        ? `/progress?user_id=eq.${encodeURIComponent(userId)}`
        : '/progress?select=*';
      const rows = await supabaseFetch(endpoint);
      return rows.map(p => ({
        id: p.id,
        userId: p.user_id,
        courseId: p.course_id || null,
        lectureId: p.lecture_id,
        lastPlayedSeconds: p.last_played_seconds,
        watchedSeconds: p.watched_seconds,
        progressRate: Number(p.progress_rate) || 0,
        completed: Boolean(p.completed),
        updatedAt: p.updated_at
      }));
    } catch (err) {
      console.warn('Remote getProgress failed:', err);
      throw err;
    }
  },

  async upsertProgress(prog) {
    requireExternalDb();
    const row = await supabaseFetch('/rpc/update_lecture_progress', { method: 'POST', body: JSON.stringify({ p_lecture_id: prog.lectureId, p_position: prog.lastPlayedSeconds }) });
    if (!row?.id) throw new Error('진도 저장 결과를 확인하지 못했습니다.');
    return mapProgress(row);
  },

  // ================= CERTIFICATES =================
  async getCertificates(userId = null) {
    requireExternalDb();
    try {
      const endpoint = userId
        ? `/certificates?user_id=eq.${encodeURIComponent(userId)}`
        : '/certificates?select=*';
      const rows = await supabaseFetch(endpoint);
      return rows.map(c => ({
        certNo: c.cert_no,
        userId: c.user_id,
        courseId: c.course_id,
        memberNo: c.member_no,
        studentName: c.student_name,
        dharmaName: c.dharma_name || '',
        birthDate: c.birth_date,
        courseTitle: c.course_title,
        period: c.period,
        issuedAt: c.issued_at,
        status: c.status
      }));
    } catch (err) {
      console.warn('Remote getCertificates failed:', err);
      throw err;
    }
  },

  async insertCertificate(cert) {
    requireExternalDb();
    const row = await supabaseFetch('/rpc/issue_course_certificate', { method: 'POST', body: JSON.stringify({ p_course_id: cert.courseId }) });
    if (!row?.cert_no) throw new Error('자격증 발급 결과를 확인하지 못했습니다.');
    return mapCertificate(row);
  },

  async getCertificateByNo(certNo) {
    if (!isExternalDbConfigured || !certNo) return null;
    try {
      const verified = await supabaseFetch('/rpc/verify_course_certificate', { method: 'POST', body: JSON.stringify({ p_cert_no: certNo.trim() }) });
      const rows = verified ? [verified] : [];
      if (Array.isArray(rows) && rows.length > 0) {
        const c = rows[0];
        return {
          certNo: c.cert_no,
          userId: c.user_id,
          courseId: c.course_id,
          memberNo: c.member_no,
          studentName: c.student_name,
          birthDate: c.birth_date,
          courseTitle: c.course_title,
          period: c.period,
          issuedAt: c.issued_at,
          status: c.status || 'valid'
        };
      }
      return null;
    } catch (err) {
      console.warn('Remote getCertificateByNo failed:', err);
      throw err;
    }
  },

  // ================= Q&A =================
  // Fetch Q&A posts from remote DB
  async getQAPosts() {
    requireExternalDb();
    try {
      const posts = await supabaseFetch('/qa_posts?select=*,qa_answers(*)&order=created_at.desc');
      return posts.map(p => ({
        id: p.id,
        courseId: p.course_id,
        lectureId: p.lecture_id,
        authorId: p.author_id,
        authorName: p.author_name,
        authorMemberNo: p.author_member_no,
        timestampSeconds: p.timestamp_seconds,
        title: p.title,
        content: p.content,
        isPrivate: p.is_private,
        createdAt: p.created_at,
        answers: (p.qa_answers || []).map(a => ({
          id: a.id,
          authorId: a.author_id,
          authorName: a.author_name,
          role: a.role,
          badgeTitle: a.badge_title,
          content: a.content,
          createdAt: a.created_at
        }))
      }));
    } catch (err) {
      console.warn('Remote getQAPosts failed:', err);
      throw err;
    }
  },

  // Insert a new question post to remote DB
  async insertQAPost(postData) {
    requireExternalDb();
    try {
      const payload = {
        id: postData.id,
        course_id: postData.courseId,
        lecture_id: postData.lectureId,
        author_id: postData.authorId,
        author_name: postData.authorName,
        author_member_no: postData.authorMemberNo,
        timestamp_seconds: postData.timestampSeconds,
        title: postData.title,
        content: postData.content,
        is_private: postData.isPrivate,
        created_at: postData.createdAt
      };
      const [inserted] = await supabaseFetch('/qa_posts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      requireSavedRows(inserted ? [inserted] : []);
      return inserted;
    } catch (err) {
      console.warn('Remote insertQAPost failed:', err);
      throw err;
    }
  },

  // Insert a monk answer to remote DB
  async insertQAAnswer(postId, answerData) {
    requireExternalDb();
    try {
      const payload = {
        id: answerData.id,
        post_id: postId,
        author_id: answerData.authorId,
        author_name: answerData.authorName,
        role: answerData.role,
        badge_title: answerData.badgeTitle,
        content: answerData.content,
        created_at: answerData.createdAt
      };
      const [inserted] = await supabaseFetch('/qa_answers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      requireSavedRows(inserted ? [inserted] : []);
      return inserted;
    } catch (err) {
      console.warn('Remote insertQAAnswer failed:', err);
      throw err;
    }
  },

  // Delete Q&A post from remote DB
  async deleteQAPost(postId) {
    requireExternalDb();
    try {
      const changed = await supabaseFetch(`/qa_posts?id=eq.${postId}`, {
        method: 'DELETE'
      });
      requireSavedRows(changed);
      return true;
    } catch (err) {
      console.warn('Remote deleteQAPost failed:', err);
      throw err;
    }
  },

  // ================= EXAM ATTEMPTS =================
  async getExamAttempts(userId = null, courseId = null) {
    requireExternalDb();
    try {
      let query = '/exam_attempts?select=*&order=created_at.desc';
      if (userId && courseId) {
        query += `&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}`;
      } else if (userId) {
        query += `&user_id=eq.${encodeURIComponent(userId)}`;
      } else if (courseId) {
        query += `&course_id=eq.${encodeURIComponent(courseId)}`;
      }
      const rows = await supabaseFetch(query);
      return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        courseId: r.course_id,
        score: r.score,
        passed: r.passed,
        correctCount: r.correct_count,
        totalCount: r.total_count,
        questionResults: r.question_results,
        createdAt: r.created_at
      }));
    } catch (err) {
      console.warn('Remote getExamAttempts warning (table might be initializing):', err.message);
      throw err;
    }
  },

  async insertExamAttempt() {
    throw new Error('시험 결과는 서버 채점을 통해서만 저장할 수 있습니다.');
  },
  async startCourseExam(courseId) {
    const result = await supabaseFetch('/rpc/start_course_exam', { method: 'POST', body: JSON.stringify({ p_course_id: courseId }) });
    if (!result?.attemptId || !result.questions?.length) throw new Error('시험 문제를 불러오지 못했습니다.');
    return result;
  },
  async submitCourseExam(attemptId, answers) {
    const result = await supabaseFetch('/rpc/submit_course_exam', { method: 'POST', body: JSON.stringify({ p_attempt_id: attemptId, p_answers: answers }) });
    if (!result?.id || typeof result.passed !== 'boolean') throw new Error('시험 제출 결과를 확인하지 못했습니다. 같은 답안으로 다시 시도해 주세요.');
    return result;
  },

  async hasPassedExam(userId, courseId) {
    if (!isExternalDbConfigured || !userId || !courseId) return false;
    try {
      const rows = await supabaseFetch(`/exam_attempts?select=id&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&passed=eq.true&limit=1`);
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      console.warn('Remote hasPassedExam failed:', err);
      return false;
    }
  }
};

/**
 * Automatically inspects a video file in the browser to extract duration (seconds) and dimensions
 */
export function extractVideoMetadata(file, { signal } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    let video;
    let timer;
    let settled = false;
    const abort = () => finish(new Error('영상 정보 확인을 취소했습니다.'));
    const finish = (error, metadata) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (video) {
        video.onloadedmetadata = null;
        video.onerror = null;
        try { video.removeAttribute('src'); video.load(); } catch { /* cleanup must not block settlement */ }
      }
      if (url) {
        try { URL.revokeObjectURL(url); } catch { /* best-effort object URL cleanup */ }
      }
      if (error) reject(error); else resolve(metadata);
    };
    try {
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      url = URL.createObjectURL(file);
      video = document.createElement('video');
      video.preload = 'metadata';
      timer = setTimeout(() => finish(new Error('영상 길이 확인 시간이 초과되었습니다. 파일을 확인해 주세요.')), 15000);
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          finish(new Error('영상 길이를 확인할 수 없습니다. 재생 가능한 영상 파일을 선택해 주세요.'));
          return;
        }
        finish(null, { duration: Math.max(1, Math.round(video.duration)), width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => finish(new Error('영상 정보를 읽지 못했습니다. 브라우저에서 재생 가능한 파일을 선택해 주세요.'));
      video.src = url;
    } catch (e) {
      finish(e);
    }
  });
}

