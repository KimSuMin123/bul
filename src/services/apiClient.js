// Supabase & External DB REST Client (Lightweight Native Fetch Adapter)
// No heavy external packages required - works directly with standard web fetch!

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_STORAGE_KEY = import.meta.env.VITE_SUPABASE_STORAGE_KEY || SUPABASE_ANON_KEY;

export const isExternalDbConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isStorageConfigured = Boolean(SUPABASE_URL && (SUPABASE_STORAGE_KEY || SUPABASE_ANON_KEY));

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
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...options.headers
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`DB Error (${res.status}): ${errBody}`);
  }

  // If 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Complete Supabase Remote Operations (Users, Courses, Lectures, Enrollments, Progress, Payments, Certificates, Q&A)
 */
export const remoteDb = {
  // ================= USERS =================
  async getUsers() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/users?select=*');
      // Filter out legacy dummy test accounts
      return rows
        .filter(r => r.id !== 'student1' && r.id !== 'bodhi')
        .map(r => ({
          id: r.id,
          password: r.password,
          name: r.name,
          birthDate: r.birth_date,
          phone: r.phone,
          memberNo: r.member_no,
          role: r.role || 'student',
          createdAt: r.created_at
        }));
    } catch (err) {
      console.warn('Remote getUsers failed:', err);
      return null;
    }
  },

  async insertUser(userData) {
    if (!isExternalDbConfigured) return null;
    try {
      const payload = {
        id: userData.id,
        password: userData.password,
        name: userData.name,
        birth_date: userData.birthDate,
        phone: userData.phone,
        member_no: userData.memberNo,
        role: userData.role || 'student'
      };
      const [inserted] = await supabaseFetch('/users', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      return inserted;
    } catch (err) {
      console.warn('Remote insertUser failed:', err);
      return null;
    }
  },

  async updateUserPassword(id, newPassword) {
    if (!isExternalDbConfigured) return false;
    try {
      await supabaseFetch(`/users?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      return true;
    } catch (err) {
      console.warn('Remote updateUserPassword failed:', err);
      return false;
    }
  },

  async deleteUser(id) {
    if (!isExternalDbConfigured) return false;
    try {
      await supabaseFetch(`/users?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err) {
      console.warn('Remote deleteUser failed:', err);
      return false;
    }
  },

  // ================= COURSES =================
  async getCourses() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/courses?select=*');
      return rows.map(c => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        category: c.category,
        thumbnail: c.thumbnail,
        defaultPeriodDays: c.default_period_days,
        sequentialUnlock: c.sequential_unlock,
        price: c.price,
        instructor: c.instructor,
        lectureIds: []
      }));
    } catch (err) {
      console.warn('Remote getCourses failed:', err);
      return null;
    }
  },

  async insertCourse(courseData) {
    if (!isExternalDbConfigured) return null;
    try {
      const payload = {
        id: courseData.id,
        title: courseData.title,
        subtitle: courseData.subtitle,
        category: courseData.category,
        thumbnail: courseData.thumbnail,
        default_period_days: courseData.defaultPeriodDays,
        sequential_unlock: courseData.sequentialUnlock,
        price: courseData.price,
        instructor: courseData.instructor
      };
      const [inserted] = await supabaseFetch('/courses', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      return inserted;
    } catch (err) {
      console.warn('Remote insertCourse failed:', err);
      return null;
    }
  },

  async deleteCourse(courseId) {
    if (!isExternalDbConfigured) return false;
    try {
      await supabaseFetch(`/courses?id=eq.${encodeURIComponent(courseId)}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err) {
      console.warn('Remote deleteCourse failed:', err);
      return false;
    }
  },

  async updateCourse(courseId, updates) {
    if (!isExternalDbConfigured) return false;
    try {
      const payload = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.thumbnail !== undefined) payload.thumbnail = updates.thumbnail;
      if (updates.defaultPeriodDays !== undefined) payload.default_period_days = updates.defaultPeriodDays;
      if (updates.sequentialUnlock !== undefined) payload.sequential_unlock = updates.sequentialUnlock;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.instructor !== undefined) payload.instructor = updates.instructor;

      await supabaseFetch(`/courses?id=eq.${encodeURIComponent(courseId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return true;
    } catch (err) {
      console.warn('Remote updateCourse failed:', err);
      return false;
    }
  },

  // ================= LECTURES =================
  async getLectures() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/lectures?select=*&order=order_index.asc');
      return rows.map(l => ({
        id: l.id,
        courseId: l.course_id,
        orderIndex: l.order_index,
        title: l.title,
        description: l.description,
        durationSeconds: l.duration_seconds,
        videoUrl: l.video_url,
        attachmentName: l.attachment_name,
        attachments: []
      }));
    } catch (err) {
      console.warn('Remote getLectures failed:', err);
      return null;
    }
  },

  async insertLecture(lecData) {
    if (!isExternalDbConfigured) return null;
    try {
      const payload = {
        id: lecData.id,
        course_id: lecData.courseId,
        order_index: lecData.orderIndex,
        title: lecData.title,
        description: lecData.description,
        duration_seconds: lecData.durationSeconds,
        video_url: lecData.videoUrl,
        attachment_name: lecData.attachmentName || null
      };
      const [inserted] = await supabaseFetch('/lectures', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      return inserted;
    } catch (err) {
      console.warn('Remote insertLecture failed:', err);
      return null;
    }
  },

  async updateLecture(lectureId, updates) {
    if (!isExternalDbConfigured) return false;
    try {
      const payload = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.durationSeconds !== undefined) payload.duration_seconds = updates.durationSeconds;
      if (updates.videoUrl !== undefined) payload.video_url = updates.videoUrl;
      if (updates.attachmentName !== undefined) payload.attachment_name = updates.attachmentName;
      if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;

      await supabaseFetch(`/lectures?id=eq.${encodeURIComponent(lectureId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return true;
    } catch (err) {
      console.warn('Remote updateLecture failed:', err);
      return false;
    }
  },

  async deleteLecture(lectureId) {
    if (!isExternalDbConfigured) return false;
    try {
      await supabaseFetch(`/lectures?id=eq.${encodeURIComponent(lectureId)}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err) {
      console.warn('Remote deleteLecture failed:', err);
      return false;
    }
  },

  // ================= ENROLLMENTS =================
  async getEnrollments() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/enrollments?select=*');
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
      return null;
    }
  },

  async upsertEnrollment(enr) {
    if (!isExternalDbConfigured) return null;
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
      return upserted;
    } catch (err) {
      console.warn('Remote upsertEnrollment failed:', err);
      return null;
    }
  },

  // ================= PAYMENTS =================
  async getPayments() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/payments?select=*');
      return rows.map(p => ({
        id: p.id,
        userId: p.user_id,
        courseId: p.course_id,
        paidAt: p.paid_at,
        manager: p.manager,
        amount: p.amount,
        methodMemo: p.method_memo
      }));
    } catch (err) {
      console.warn('Remote getPayments failed:', err);
      return null;
    }
  },

  async insertPayment(pmt) {
    if (!isExternalDbConfigured) return null;
    try {
      const payload = {
        id: pmt.id,
        user_id: pmt.userId,
        course_id: pmt.courseId,
        paid_at: pmt.paidAt,
        manager: pmt.manager,
        amount: pmt.amount,
        method_memo: pmt.methodMemo
      };
      const [inserted] = await supabaseFetch('/payments', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      return inserted;
    } catch (err) {
      console.warn('Remote insertPayment failed:', err);
      return null;
    }
  },

  // ================= PROGRESS =================
  async getProgress() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/progress?select=*');
      return rows.map(p => ({
        id: p.id,
        userId: p.user_id,
        lectureId: p.lecture_id,
        lastPlayedSeconds: p.last_played_seconds,
        watchedSeconds: p.watched_seconds,
        progressRate: Number(p.progress_rate) || 0,
        completed: Boolean(p.completed),
        updatedAt: p.updated_at
      }));
    } catch (err) {
      console.warn('Remote getProgress failed:', err);
      return null;
    }
  },

  async upsertProgress(prog) {
    if (!isExternalDbConfigured) return null;
    try {
      const payload = {
        id: prog.id,
        user_id: prog.userId,
        lecture_id: prog.lectureId,
        last_played_seconds: Math.round(prog.lastPlayedSeconds || 0),
        watched_seconds: Math.round(prog.watchedSeconds || 0),
        progress_rate: Number(prog.progressRate) || 0,
        completed: Boolean(prog.completed),
        updated_at: new Date().toISOString()
      };
      const [upserted] = await supabaseFetch('/progress', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      return upserted;
    } catch (err) {
      console.warn('Remote upsertProgress failed:', err);
      return null;
    }
  },

  // ================= CERTIFICATES =================
  async getCertificates() {
    if (!isExternalDbConfigured) return null;
    try {
      const rows = await supabaseFetch('/certificates?select=*');
      return rows.map(c => ({
        certNo: c.cert_no,
        userId: c.user_id,
        courseId: c.course_id,
        memberNo: c.member_no,
        studentName: c.student_name,
        birthDate: c.birth_date,
        courseTitle: c.course_title,
        period: c.period,
        issuedAt: c.issued_at,
        status: c.status
      }));
    } catch (err) {
      console.warn('Remote getCertificates failed:', err);
      return null;
    }
  },

  async insertCertificate(cert) {
    if (!isExternalDbConfigured) return null;
    try {
      const payload = {
        cert_no: cert.certNo,
        user_id: cert.userId,
        course_id: cert.courseId,
        member_no: cert.memberNo,
        student_name: cert.studentName,
        birth_date: cert.birthDate,
        course_title: cert.courseTitle,
        period: cert.period,
        issued_at: cert.issuedAt,
        status: cert.status || 'valid'
      };
      const [inserted] = await supabaseFetch('/certificates', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(payload)
      });
      return inserted;
    } catch (err) {
      console.warn('Remote insertCertificate failed:', err);
      return null;
    }
  },

  // ================= Q&A =================
  // Fetch Q&A posts from remote DB
  async getQAPosts() {
    if (!isExternalDbConfigured) return null;
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
      console.warn('Remote getQAPosts failed, fallback to local:', err);
      return null;
    }
  },

  // Insert a new question post to remote DB
  async insertQAPost(postData) {
    if (!isExternalDbConfigured) return null;
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
      return inserted;
    } catch (err) {
      console.warn('Remote insertQAPost failed:', err);
      return null;
    }
  },

  // Insert a monk answer to remote DB
  async insertQAAnswer(postId, answerData) {
    if (!isExternalDbConfigured) return null;
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
      return inserted;
    } catch (err) {
      console.warn('Remote insertQAAnswer failed:', err);
      return null;
    }
  },

  // Delete Q&A post from remote DB
  async deleteQAPost(postId) {
    if (!isExternalDbConfigured) return null;
    try {
      await supabaseFetch(`/qa_posts?id=eq.${postId}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err) {
      console.warn('Remote deleteQAPost failed:', err);
      return false;
    }
  }
};

/**
 * Automatically inspects a video file in the browser to extract duration (seconds) and dimensions
 */
export function extractVideoMetadata(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const duration = Math.round(video.duration) || 0;
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        URL.revokeObjectURL(url);
        resolve({ duration, width, height });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ duration: 2400, width: 1920, height: 1080 }); // default fallback ~40 min
      };

      video.src = url;
    } catch (e) {
      resolve({ duration: 2400, width: 1920, height: 1080 });
    }
  });
}

/**
 * Uploads video file directly from the browser to Supabase Storage ('lectures' bucket)
 * @param {File} file - The video file to upload
 * @param {Function} onProgress - Progress callback ({ percent, loaded, total, speed })
 * @returns {Promise<{ publicUrl: string, fileName: string, size: number, duration: number }>}
 */
export function uploadLectureVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    // 1. Try seamless local server ingestion endpoint (transcodes & uploads automatically)
    const localEndpoint = `/api/upload-video?name=${encodeURIComponent(file.name)}`;
    const xhr = new XMLHttpRequest();
    let startTime = Date.now();

    let processingTimer = null;
    const clearTimer = () => {
      if (processingTimer) {
        clearInterval(processingTimer);
        processingTimer = null;
      }
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
        const bytesPerSec = event.loaded / elapsedSec;
        const speedMb = (bytesPerSec / (1024 * 1024)).toFixed(1);

        onProgress({
          percent,
          loaded: event.loaded,
          total: event.total,
          speed: `${speedMb} MB/s`,
          step: 'uploading'
        });

        if (event.loaded >= event.total && !processingTimer) {
          let compressSec = 0;
          onProgress({
            percent: 100,
            loaded: event.loaded,
            total: event.total,
            speed: '1080p 고화질 자동 압축 및 CDN 저장 중...',
            step: 'processing',
            compressSec: 0
          });

          processingTimer = setInterval(() => {
            compressSec++;
            onProgress({
              percent: 100,
              loaded: event.loaded,
              total: event.total,
              speed: `최적화 압축 중 (${compressSec}초 경과)`,
              step: 'processing',
              compressSec
            });
          }, 1000);
        }
      }
    };

    xhr.onload = () => {
      clearTimer();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.publicUrl) {
            if (onProgress) {
              onProgress({
                percent: 100,
                loaded: file.size,
                total: file.size,
                speed: '완료',
                step: 'done'
              });
            }
            return resolve({
              publicUrl: res.publicUrl,
              fileName: res.fileName,
              size: res.size || file.size,
              mimeType: 'video/mp4',
              compressedMb: res.compressedMb,
              originalMb: res.originalMb
            });
          }
        } catch (e) {}
      }

      // If local endpoint returns 404 (e.g. running on static production host without Node), fallback to direct Supabase
      if (xhr.status === 404) {
        return uploadDirectToSupabase(file, onProgress).then(resolve).catch(reject);
      }

      let errorMsg = `업로드 및 압축 실패 (HTTP ${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed.error) errorMsg = parsed.error;
        else if (parsed.message) errorMsg = parsed.message;
      } catch (e) {
        if (xhr.responseText) errorMsg = `${errorMsg}: ${xhr.responseText}`;
      }
      reject(new Error(errorMsg));
    };

    xhr.onerror = () => {
      clearTimer();
      // If network fails to local endpoint, fallback to direct Supabase if under 48MB
      if (file.size <= 48 * 1024 * 1024) {
        return uploadDirectToSupabase(file, onProgress).then(resolve).catch(reject);
      }
      reject(new Error('로컬 영상 처리 서버와 연결할 수 없습니다.'));
    };

    xhr.open('POST', localEndpoint);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.send(file);
  });
}

/**
 * Fallback: Direct upload to Supabase Storage if file is <= 48MB
 */
function uploadDirectToSupabase(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL) {
      return reject(new Error('Supabase URL이 설정되지 않았습니다. .env 환경변수를 확인해 주세요.'));
    }
    const uploadKey = SUPABASE_STORAGE_KEY || SUPABASE_ANON_KEY;
    if (!uploadKey) {
      return reject(new Error('스토리지 업로드 API 키가 설정되지 않았습니다.'));
    }

    if (file.size > 48 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return reject(new Error(`파일 용량(${sizeMb}MB)이 클라우드 스토리지 허용 한도(48MB)를 초과했습니다.`));
    }

    const cleanBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    const fileName = `lec_${Date.now()}_${cleanBaseName}`;
    const targetUrl = `${SUPABASE_URL}/storage/v1/object/lectures/${encodeURIComponent(fileName)}`;

    const xhr = new XMLHttpRequest();
    let startTime = Date.now();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
        const speedMb = ((event.loaded / elapsedSec) / (1024 * 1024)).toFixed(1);
        onProgress({ percent, loaded: event.loaded, total: event.total, speed: `${speedMb} MB/s` });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/lectures/${encodeURIComponent(fileName)}`;
        resolve({ publicUrl, fileName, size: file.size, mimeType: file.type || 'video/mp4' });
      } else {
        reject(new Error(`업로드 실패 (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('네트워크 오류가 발생했습니다.'));
    xhr.open('POST', targetUrl);
    xhr.setRequestHeader('apikey', uploadKey);
    xhr.setRequestHeader('Authorization', `Bearer ${uploadKey}`);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.send(file);
  });
}


/**
 * Deletes a video file from the lectures bucket
 */
export async function deleteLectureVideo(fileName) {
  if (!SUPABASE_URL) return false;
  const uploadKey = SUPABASE_STORAGE_KEY || SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/lectures`, {
      method: 'DELETE',
      headers: {
        'apikey': uploadKey,
        'Authorization': `Bearer ${uploadKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prefixes: [fileName] })
    });
    return res.ok;
  } catch (err) {
    console.warn('deleteLectureVideo error:', err);
    return false;
  }
}

/**
 * Optimizes an image file and uploads to Supabase Storage (or returns compressed dataURL if storage unconfigured)
 * @param {File|Blob} file - The image file to process
 * @param {number} maxWidth - Maximum image width in pixels (default: 1200)
 * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default: 0.82)
 * @returns {Promise<{ publicUrl: string, dataUrl: string, size: number }>}
 */
export async function uploadThumbnailImage(file, maxWidth = 1200, quality = 0.82) {
  // 1. Optimize image in browser canvas
  const compressedDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('파일 읽기 오류'));
    reader.readAsDataURL(file);
  });

  // 2. If Supabase Storage is configured, upload to cloud storage
  if (isStorageConfigured && SUPABASE_URL) {
    try {
      const uploadKey = SUPABASE_STORAGE_KEY || SUPABASE_ANON_KEY;
      const cleanName = (file.name || 'thumbnail.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `thumbs/thumb_${Date.now()}_${cleanName}`;
      const targetUrl = `${SUPABASE_URL}/storage/v1/object/lectures/${encodeURIComponent(fileName)}`;

      // Convert dataURL back to blob for upload
      const res = await fetch(compressedDataUrl);
      const blob = await res.blob();

      const uploadRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'apikey': uploadKey,
          'Authorization': `Bearer ${uploadKey}`,
          'Content-Type': 'image/jpeg'
        },
        body: blob
      });

      if (uploadRes.ok) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/lectures/${encodeURIComponent(fileName)}`;
        return {
          publicUrl,
          dataUrl: compressedDataUrl,
          size: blob.size
        };
      }
    } catch (err) {
      console.warn('Cloud thumbnail upload warning, falling back to local dataUrl:', err);
    }
  }

  // 3. Fallback to high-quality compressed dataUrl (offline / local storage safe)
  return {
    publicUrl: compressedDataUrl,
    dataUrl: compressedDataUrl,
    size: Math.round(compressedDataUrl.length * 0.75)
  };
}

