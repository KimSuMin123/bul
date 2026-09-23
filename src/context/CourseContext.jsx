import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { enrichCertificate, checkLecturesCompleted } from '../services/certService.js';
import { parseExamText, formatExamText, getLatestExamAttempt, hasPassedCourseExam } from '../services/examService.js';
import { remoteDb, isExternalDbConfigured, deleteLectureVideo } from '../services/apiClient.js';
import { notifyAdminCourseApplication } from '../services/notificationService.js';
import { aggregateDonationReceipt, normalizePhone, findReceiptByPhoneOrUser } from '../services/donationService.js';
import { useAuth } from './AuthContext.jsx';

const CourseContext = createContext(null);

export function CourseProvider({ children }) {
  const { currentUser, isAdmin } = useAuth();
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [progressList, setProgressList] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [qaPosts, setQaPosts] = useState([]);
  const [examAttempts, setExamAttempts] = useState([]);
  const [donationReceipts, setDonationReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestVersion = useRef(0);
  const progressReadVersion = useRef(0);
  const pendingPayments = useRef({});
  const syncSource = useRef(`course_${Math.random().toString(36).slice(2)}`);
  const scope = `${currentUser?.id || ''}:${isAdmin}:${currentUser?.activeSessionToken || ''}`;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  // Admin bypass mode for sequential lock testing (default false: enforce lock even for admin)
  const [adminBypassLock, setAdminBypassLock] = useState(false);

  const toggleAdminBypassLock = useCallback(() => {
    setAdminBypassLock(prev => !prev);
  }, []);

  // A successful empty response replaces old data; a failed request preserves it.
  const refreshData = useCallback(async () => {
    const version = ++requestVersion.current;
    const progressVersion = ++progressReadVersion.current;
    if (!isExternalDbConfigured) {
      setError('서버 연결 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요.');
      setLoading(false);
      return false;
    }
    const userId = isAdmin ? null : currentUser?.id;
    const requests = [
      [remoteDb.getCourses().then(async rows => isAdmin ? Promise.all(rows.map(async course => {
        const bank = await remoteDb.getCourseExam(course.id);
        return { ...course, rawExamText: bank?.rawExamText || formatExamText(bank?.questions || []) };
      })) : rows), setCourses],
      [remoteDb.getLectures(), setLectures]
    ];
    if (currentUser?.id) {
      requests.push(
        [remoteDb.getEnrollments(userId), setEnrollments],
        [remoteDb.getProgress(userId), setProgressList],
        [remoteDb.getCertificates(userId), setCertificates],
        [remoteDb.getQAPosts(), setQaPosts],
        [remoteDb.getExamAttempts(userId), setExamAttempts]
      );
      if (isAdmin) requests.push(
        [remoteDb.getPayments(), setPayments],
        [remoteDb.getDonationReceipts().then(rows => {
          if (!Array.isArray(rows)) throw new Error('기부금 영수증을 불러오지 못했습니다.');
          return rows;
        }), setDonationReceipts]
      );
    }
    const results = await Promise.allSettled(requests.map(([promise]) => promise));
    if (version !== requestVersion.current || activeScope.current !== scope) return false;
    results.forEach((result, index) => {
      // Commit the public catalog as a pair; progress has its own newer reads.
      if (index < 2 || (index === 3 && progressVersion !== progressReadVersion.current)) return;
      if (result.status === 'fulfilled') requests[index][1](result.value);
    });
    // These two resources define one catalog; only derive IDs when both succeeded.
    if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
      setLectures(results[1].value);
      setCourses(results[0].value.map(course => ({
        ...course,
        examQuestions: course.rawExamText?.trim() ? parseExamText(course.rawExamText) : [],
        lectureIds: results[1].value.filter(lecture => lecture.courseId === course.id).map(lecture => lecture.id)
      })));
    }
    const failed = results.some(result => result.status === 'rejected');
    setError(failed ? '일부 정보를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.' : null);
    setLoading(false);
    return !failed;
  }, [currentUser?.id, isAdmin, scope]);

  // Real-time synchronization helper (Cross-tab & Same-tab without page reload)
  const notifySyncUpdate = useCallback((detail = {}) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('buddha_course_sync_channel');
        ch.postMessage({ ...detail, type: 'COURSE_SYNC_REFRESH', reason: detail.type, source: syncSource.current });
        ch.close();
      }
    } catch (e) {}
    // The originating tab has already applied the confirmed mutation locally.
  }, []);

  // Listen for real-time synchronization updates without manual refresh
  useEffect(() => {
    // Administrator-only answer banks must disappear immediately on identity change.
    setCourses([]);
    setLectures([]);
    setEnrollments([]);
    setPayments([]);
    setDonationReceipts([]);
    setProgressList([]);
    setCertificates([]);
    setQaPosts([]);
    setExamAttempts([]);
    setAdminBypassLock(false);
    setLoading(true);
    refreshData();

    let syncChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        syncChannel = new BroadcastChannel('buddha_course_sync_channel');
        syncChannel.onmessage = async (e) => {
          if (e.data && e.data.type === 'COURSE_SYNC_REFRESH' && e.data.source !== syncSource.current) {
            if (e.data.reason === 'PROGRESS_UPDATED') {
              if (!currentUser?.id || (!isAdmin && e.data.userId !== currentUser.id)) return;
              const version = ++progressReadVersion.current;
              try {
                const progress = await remoteDb.getProgress(isAdmin ? null : currentUser.id);
                if (activeScope.current === scope && version === progressReadVersion.current) setProgressList(progress);
              } catch {
                if (activeScope.current === scope && version === progressReadVersion.current) setError('학습 진도를 불러오지 못했습니다. 다시 시도해 주세요.');
              }
            } else {
              refreshData();
            }
          }
        };
      }
    } catch (e) {
      console.warn('Sync BroadcastChannel not available:', e);
    }

    const handleLocalSync = () => {
      refreshData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('buddha_sync_update', handleLocalSync);
    }

    return () => {
      requestVersion.current++;
      progressReadVersion.current++;
      if (syncChannel) syncChannel.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('buddha_sync_update', handleLocalSync);
      }
    };
  }, [refreshData, scope, currentUser?.id, isAdmin]);

  // =========================================================================
  // RBAC & Access Control Logic
  // =========================================================================

  const hasCourseAccess = useCallback((userId, courseId) => {
    if (!userId) return false;
    if (isAdmin) return true; // Admins have full preview access

    const today = new Date().toISOString().slice(0, 10);
    const userEnrs = enrollments.filter(e => e.userId === userId && (e.status === 'active' || e.status === 'completed') && e.expireAt && e.expireAt.slice(0, 10) >= today);
    const directMatch = userEnrs.find(e => e.courseId === courseId);
    if (directMatch) return true;

    const hasBundle = userEnrs.some(e => e.courseId === 'bundle-all');
    if (hasBundle) {
      return true;
    }

    return false;
  }, [enrollments, isAdmin]);

  const hasLectureAccess = useCallback((userId, lectureId) => {
    if (!userId) return false;
    if (isAdmin) return true;

    const lec = lectures.find(l => l.id === lectureId);
    if (!lec) return false;

    return hasCourseAccess(userId, lec.courseId);
  }, [lectures, hasCourseAccess, isAdmin]);

  const isLectureLocked = useCallback((userId, lectureId, options = {}) => {
    // If admin explicitly enabled bypass mode, allow unlock for testing
    if (isAdmin && (adminBypassLock || options.bypassAdmin)) return false;

    const currentLec = lectures.find(l => l.id === lectureId);
    if (!currentLec) return false;

    const course = courses.find(c => c.id === currentLec.courseId);
    if (!course) return false;

    // Check if sequential unlock is enabled (default is true if undefined)
    const rawSeq = course.sequentialUnlock !== undefined ? course.sequentialUnlock : course.sequential_unlock;
    const isSeqEnabled = rawSeq === undefined || rawSeq === null || rawSeq === true || rawSeq === 'true' || rawSeq === 1;
    if (!isSeqEnabled) return false;

    // Sort lectures by orderIndex
    const courseLecs = lectures
      .filter(l => l.courseId === currentLec.courseId)
      .sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));

    const currentIndex = courseLecs.findIndex(l => l.id === lectureId);
    if (currentIndex <= 0) return false; // 1st lecture is always unlocked

    // Check previous lecture completion
    const targetUserId = userId || currentUser?.id;
    if (!targetUserId) return true; // not logged in -> locked

    const prevLec = courseLecs[currentIndex - 1];
    const prevProg = progressList.find(p => String(p.userId) === String(targetUserId) && p.lectureId === prevLec.id);
    
    const isCompleted = Boolean(prevProg && (prevProg.completed === true || (Number(prevProg.progressRate) || 0) >= 100));
    return !isCompleted;
  }, [lectures, courses, progressList, isAdmin, adminBypassLock, currentUser?.id]);

  // =========================================================================
  // Video Progress Tracking (100% Supabase Direct)
  // =========================================================================

  const getLectureProgress = useCallback((userId, lectureId) => {
    if (!userId) return null;
    return progressList.find(p => p.userId === userId && p.lectureId === lectureId) || {
      lastPlayedSeconds: 0,
      watchedSeconds: 0,
      progressRate: 0,
      completed: false
    };
  }, [progressList]);

  const updateProgress = useCallback(async (userId, lectureId, currentSeconds) => {
    if (!userId || !lectureId) return null;
    const updatedItem = await remoteDb.upsertProgress({ lectureId, lastPlayedSeconds: currentSeconds });
    if (activeScope.current !== scope) return updatedItem;
    requestVersion.current++;
    progressReadVersion.current++;
    setLoading(false);
    setProgressList(prev => [...prev.filter(p => !(p.userId === updatedItem.userId && p.lectureId === updatedItem.lectureId)), updatedItem]);
    notifySyncUpdate({type:'PROGRESS_UPDATED',userId,lectureId});
    return updatedItem;
  }, [scope, notifySyncUpdate]);

  const getCourseProgress = useCallback((userId, courseId) => {
    if (!userId) return 0;
    let targetLecs = [];
    if (courseId === 'bundle-all') {
      targetLecs = lectures;
    } else {
      targetLecs = lectures.filter(l => l.courseId === courseId);
    }

    if (targetLecs.length === 0) return 0;

    let totalRate = 0;
    targetLecs.forEach(lec => {
      const p = progressList.find(prog => prog.userId === userId && prog.lectureId === lec.id);
      totalRate += p ? (p.completed ? 100 : p.progressRate || 0) : 0;
    });

    return Math.round(totalRate / targetLecs.length);
  }, [lectures, progressList]);

  // =========================================================================
  // Admin & Enrollment Operations (100% Supabase Direct)
  // =========================================================================

  const enrollStudent = useCallback(async (userId, courseId, status = 'active') => {
    const course = courses.find(c => c.id === courseId);
    const periodDays = course ? course.defaultPeriodDays : 90;

    const today = new Date();
    const expireDate = new Date();
    expireDate.setDate(today.getDate() + periodDays);

    const existing = enrollments.find(e => e.userId === userId && e.courseId === courseId);
    const item = {
      id: existing ? existing.id : `enr_${Date.now()}`,
      userId,
      courseId,
      status,
      enrolledAt: today.toISOString().split('T')[0],
      paidAt: status === 'active' ? today.toISOString().split('T')[0] : null,
      expireAt: expireDate.toISOString().split('T')[0]
    };

    await remoteDb.upsertEnrollment(item);
    if (activeScope.current !== scope) return item;
    requestVersion.current++;
    setLoading(false);
    setEnrollments(prev => {
      const idx = prev.findIndex(e => e.userId === userId && e.courseId === courseId);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });

    // Dispatch real-time Push Notification to Admin devices
    if (status === 'pending' || status === 'applied') {
      notifyAdminCourseApplication({
        studentName: currentUser?.name || userId,
        courseTitle: course?.title || '강좌',
        studentId: userId,
        courseId
      }).catch(err => console.warn('Admin push notification dispatch note:', err));
    }

    notifySyncUpdate({ type: 'ENROLLMENT_UPDATED', userId, courseId, status });
    return item;
  }, [courses, enrollments, currentUser, notifySyncUpdate, scope]);

  // 1전화번호당 1행 엄격 누적 가산 기부금 영수증 발행 함수
  const issueDonationReceipt = useCallback(async ({
    userId,
    name,
    phone,
    amount,
    courseTitle = '강좌 수강료',
    paymentId = null,
    paidAt = null
  }) => {
    let resultReceipt = null;

    setDonationReceipts(prev => {
      const res = aggregateDonationReceipt(prev, {
        userId,
        name,
        phone,
        amount,
        courseTitle,
        paymentId,
        paidAt
      });
      resultReceipt = res.targetReceipt;
      return res.updatedList;
    });

    if (paymentId) {
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, donationReceiptIssued: true } : p));
      if (isExternalDbConfigured) {
        remoteDb.updatePaymentDonationReceiptStatus(paymentId, true).catch(err => console.warn(err));
      }
    }

    if (isExternalDbConfigured && resultReceipt) {
      await remoteDb.upsertDonationReceipt(resultReceipt).catch(err => console.warn('Supabase upsertDonationReceipt warning:', err));
    }

    notifySyncUpdate({ type: 'DONATION_RECEIPT_ISSUED', phone, userId });
    return resultReceipt;
  }, [notifySyncUpdate]);

  const recordPayment = useCallback(async ({
    userId,
    courseId,
    manager,
    amount,
    methodMemo,
    paidAt,
    withDonationReceipt = false,
    studentName = '',
    studentPhone = '',
    courseTitle = ''
  }) => {
    const newPay = {
      id: `pay_${Date.now()}`,
      userId,
      courseId,
      paidAt: paidAt || new Date().toISOString().split('T')[0],
      manager: manager.trim(),
      amount: Number(amount) || 0,
      methodMemo: methodMemo.trim(),
      donationReceiptIssued: Boolean(withDonationReceipt)
    };

    // Retain the same key across a timeout/reload; clear only after confirmed success.
    const requestKey = JSON.stringify([currentUser?.id, userId, courseId, Number(amount), manager.trim(), methodMemo.trim(), newPay.paidAt]);
    let pending = pendingPayments.current;
    try {
      const stored = JSON.parse(sessionStorage.getItem('buddha_pending_payments') || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) Object.assign(pending, stored);
    } catch { /* Retain in-memory retry keys when browser storage is unavailable. */ }
    const requestId = pending[requestKey] || crypto.randomUUID();
    pending[requestKey] = requestId;
    try { sessionStorage.setItem('buddha_pending_payments', JSON.stringify(pending)); } catch { /* browser storage unavailable */ }

    // A lost RPC response is not safe to repeat as separate writes.
    const rpcResult = await remoteDb.processCoursePayment({
        userId,
        courseId,
        amount,
        manager,
        methodMemo,
        paidAt,
        requestId
    });
    delete pending[requestKey];
    try { sessionStorage.setItem('buddha_pending_payments', JSON.stringify(pending)); } catch { /* private mode */ }
    newPay.id = rpcResult.paymentId;
    if (activeScope.current !== scope) return newPay;
    if (withDonationReceipt && (studentPhone || userId)) {
      await issueDonationReceipt({
        userId,
        name: studentName,
        phone: studentPhone,
        amount: Number(amount) || 0,
        courseTitle: courseTitle || '불교의례 강좌 수강료',
        paymentId: newPay.id,
        paidAt: newPay.paidAt
      });
    }
    if (activeScope.current !== scope) return newPay;
    const version = ++requestVersion.current;
    setLoading(false);
    setPayments(prev => [...prev.filter(payment => payment.id !== newPay.id), newPay]);
    try {
      const updated = await remoteDb.getEnrollments(userId);
      if (activeScope.current === scope && version === requestVersion.current) {
        setEnrollments(prev => [...prev.filter(enrollment => enrollment.userId !== userId), ...updated]);
      }
    } catch {
      // The transaction succeeded: do not prompt a second payment submission.
      if (activeScope.current === scope && version === requestVersion.current) setError('수납은 완료되었지만 수강 목록을 불러오지 못했습니다. 재수납하지 말고 새로고침해 주세요.');
    }

    notifySyncUpdate({ type: 'PAYMENT_RECORDED', userId, courseId });
    return newPay;
  }, [notifySyncUpdate, scope, currentUser?.id, issueDonationReceipt]);

  const updateCourseSettings = useCallback(async (courseId, updates) => {
    let finalUpdates = { ...updates };
    if (updates.rawExamText !== undefined) {
      finalUpdates.examQuestions = updates.rawExamText.trim() 
        ? parseExamText(updates.rawExamText) 
        : [];
      if (!finalUpdates.examQuestions.length || finalUpdates.examQuestions.some(question => !question.correctAnswer)) {
        throw new Error('시험 문제와 각 문항의 정답을 입력해 주세요.');
      }
    }

    await remoteDb.updateCourse(courseId, finalUpdates);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, ...finalUpdates } : c));

  }, [scope]);

  const addCourse = useCallback(async (courseData) => {
    const certType = courseData.certType?.trim() || '불교의례해설사';
    const certGrade = courseData.certGrade?.trim() || '2급';
    const certTypeFull = courseData.certTypeFull?.trim() || (certGrade ? `${certType} ${certGrade}` : certType);
    const certRegNo = courseData.certRegNo?.trim() || '민간자격 등록번호 제 2026- 00183호';
    const certRegOffice = courseData.certRegOffice?.trim() || '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)';

    let parsedExamQuestions = [];
    if (courseData.rawExamText && courseData.rawExamText.trim()) {
      parsedExamQuestions = parseExamText(courseData.rawExamText);
    } else {
      parsedExamQuestions = [];
    }

    const newCourse = {
      id: courseData.id?.trim() || `course-${Date.now()}`,
      title: courseData.title?.trim() || '새 교육과정',
      subtitle: courseData.subtitle?.trim() || '',
      category: courseData.category?.trim() || '불교의례법사',
      thumbnail: courseData.thumbnail?.trim() || 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=800&q=80',
      defaultPeriodDays: Number(courseData.defaultPeriodDays) || 90,
      sequentialUnlock: courseData.sequentialUnlock !== undefined ? Boolean(courseData.sequentialUnlock) : true,
      price: Number(courseData.price) || 0,
      instructor: courseData.instructor?.trim() || '불교의례 전문 법사',
      certType,
      certGrade,
      certTypeFull,
      certRegNo,
      certRegOffice,
      rawExamText: courseData.rawExamText?.trim() || '',
      examQuestions: parsedExamQuestions,
      lectureIds: []
    };

    await remoteDb.insertCourse(newCourse);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setCourses(prev => [...prev, newCourse]);

    return newCourse;
  }, [scope]);

  const deleteCourse = useCallback(async (courseId) => {
    await remoteDb.deleteCourse(courseId);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setCourses(prev => prev.filter(c => c.id !== courseId));
    setLectures(prev => prev.filter(l => l.courseId !== courseId));

    return true;
  }, [scope]);

  const addLecture = useCallback(async (lectureData) => {
    const newLec = {
      ...lectureData,
      id: lectureData.id || `lec_${Date.now()}`
    };

    await remoteDb.insertLecture(newLec);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setLectures(prev => [...prev, newLec]);
    setCourses(prev => prev.map(c => {
      if (c.id === newLec.courseId) {
        const nextIds = c.lectureIds ? [...c.lectureIds] : [];
        if (!nextIds.includes(newLec.id)) nextIds.push(newLec.id);
        return { ...c, lectureIds: nextIds };
      }
      return c;
    }));

    return newLec;
  }, [scope]);

  const updateLecture = useCallback(async (lectureId, updates) => {
    await remoteDb.updateLecture(lectureId, updates);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setLectures(prev => prev.map(l => l.id === lectureId ? { ...l, ...updates } : l));

  }, [scope]);

  const deleteLecture = useCallback(async (lectureId) => {
    const targetLec = lectures.find(l => l.id === lectureId);
    await remoteDb.deleteLecture(lectureId);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setLectures(prev => prev.filter(l => l.id !== lectureId));

    if (targetLec) {
      setCourses(prev => prev.map(c => {
        if (c.id === targetLec.courseId && c.lectureIds) {
          return { ...c, lectureIds: c.lectureIds.filter(id => id !== lectureId) };
        }
        return c;
      }));
    }

    if (targetLec?.videoUrl && !lectures.some(lecture => lecture.id !== lectureId && lecture.videoUrl === targetLec.videoUrl)) {
      try {
        await deleteLectureVideo(targetLec.videoUrl);
      } catch {
        if (activeScope.current === scope) setError('차시는 삭제되었지만 영상 파일 정리에 실패했습니다. 관리자에게 문의해 주세요.');
      }
    }

    return true;
  }, [lectures, scope]);

  // =========================================================================
  // Q&A Community Operations (100% Supabase Direct)
  // =========================================================================

  const addQAPost = useCallback(async ({ courseId, lectureId, title, content, timestampSeconds = null, isPrivate = false }) => {
    if (!currentUser) throw new Error('질문을 작성하려면 로그인이 필요합니다.');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newPost = {
      id: `qa-${Date.now()}`,
      courseId,
      lectureId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorMemberNo: currentUser.memberNo || '학인',
      timestampSeconds: typeof timestampSeconds === 'number' && timestampSeconds > 0 ? Math.round(timestampSeconds) : null,
      title: title.trim(),
      content: content.trim(),
      isPrivate: Boolean(isPrivate),
      createdAt: dateStr,
      answers: []
    };

    await remoteDb.insertQAPost(newPost);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setQaPosts(prev => [newPost, ...prev]);

    return newPost;
  }, [currentUser, scope]);

  const addQAAnswer = useCallback(async (postId, { content, authorName = '지산 스님', badgeTitle = '담당 지도교수' }) => {
    if (!currentUser) throw new Error('답변을 작성하려면 로그인이 필요합니다.');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newAnswer = {
      id: `ans-${Date.now()}`,
      authorId: currentUser.id,
      authorName: authorName.trim(),
      role: 'instructor',
      badgeTitle: badgeTitle || '담당 지도교수',
      content: content.trim(),
      createdAt: dateStr
    };

    await remoteDb.insertQAAnswer(postId, newAnswer);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setQaPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, answers: [...(p.answers || []), newAnswer] };
      }
      return p;
    }));

    return newAnswer;
  }, [currentUser, scope]);

  const deleteQAPost = useCallback(async (postId) => {
    const post = qaPosts.find(p => p.id === postId);
    if (!post) return;

    if (!isAdmin && post.authorId !== currentUser?.id) {
      throw new Error('질문 삭제 권한이 없습니다.');
    }

    await remoteDb.deleteQAPost(postId);
    if (activeScope.current !== scope) return null;
    requestVersion.current++;
    setQaPosts(prev => prev.filter(p => p.id !== postId));

  }, [currentUser, isAdmin, qaPosts, scope]);

  const getLectureQAPosts = useCallback((lectureId) => {
    return qaPosts.filter(p => p.lectureId === lectureId);
  }, [qaPosts]);

  // =========================================================================
  // Certificate & Qualification Exam Operations (100% Supabase Direct)
  // =========================================================================

  const getCertificate = useCallback((userId, courseId) => {
    const found = certificates.find(c => c.userId === userId && c.courseId === courseId);
    const course = courses.find(c => c.id === courseId);
    return found ? enrichCertificate(found, course) : null;
  }, [certificates, courses]);

  const checkCourseAllLecturesDone = useCallback((userId, courseId) => {
    return checkLecturesCompleted(userId, courseId, courses, lectures, progressList);
  }, [courses, lectures, progressList]);

  const claimCertificate = useCallback(async (courseId) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');
    const course = courses.find(c => c.id === courseId);
    if (!course) throw new Error('존재하지 않는 코스입니다.');

    // 1. Must complete lectures 100%
    if (!checkLecturesCompleted(currentUser.id, courseId, courses, lectures, progressList)) {
      throw new Error('모든 강의 차시(진도율 100%)를 먼저 완강하셔야 합니다.');
    }

    // 2. Must pass exam with >= 60 points
    if (!hasPassedCourseExam(currentUser.id, courseId, examAttempts)) {
      throw new Error('자격 평가 시험(수료 기준 60점 이상)에 합격하셔야 정식 수료증이 발급됩니다.');
    }

    const newCert = await remoteDb.insertCertificate({ courseId });
    if (activeScope.current !== scope) return newCert;
    requestVersion.current++;
    setLoading(false);
    setCertificates(prev => [...prev.filter(cert => cert.certNo !== newCert.certNo), newCert]);

    notifySyncUpdate({ type: 'CERTIFICATE_CLAIMED', userId: currentUser.id, courseId });
    return newCert;
  }, [currentUser, courses, lectures, progressList, examAttempts, certificates, notifySyncUpdate, scope]);

  // Exam helpers
  const beginExam = useCallback(courseId => remoteDb.startCourseExam(courseId), []);

  const getExamResult = useCallback((arg1, arg2) => {
    const isFirstCourse = typeof arg1 === 'string' && arg1.startsWith('course-');
    const userId = isFirstCourse ? arg2 : arg1;
    const courseId = isFirstCourse ? arg1 : arg2;
    return getLatestExamAttempt(userId, courseId, examAttempts);
  }, [examAttempts]);

  const isExamPassed = useCallback((arg1, arg2) => {
    const isFirstCourse = typeof arg1 === 'string' && arg1.startsWith('course-');
    const userId = isFirstCourse ? arg2 : arg1;
    const courseId = isFirstCourse ? arg1 : arg2;
    return hasPassedCourseExam(userId, courseId, examAttempts);
  }, [examAttempts]);

  const submitExam = useCallback(async (userId, courseId, attemptId, answers) => {
    const evaluation = await remoteDb.submitCourseExam(attemptId, answers);
    if (activeScope.current !== scope) return evaluation;
    requestVersion.current++;
    setLoading(false);
    setExamAttempts(prev => [evaluation, ...prev.filter(attempt => attempt.id !== evaluation.id)]);
    await refreshData();
    notifySyncUpdate({type:'EXAM_SUBMITTED',userId,courseId});
    return evaluation;
  }, [scope, refreshData, notifySyncUpdate]);

  return (
    <CourseContext.Provider
      value={{
        courses,
        lectures,
        enrollments,
        payments,
        progressList,
        certificates,
        qaPosts,
        examAttempts,
        loading,
        error,
        refreshData,
        hasCourseAccess,
        hasLectureAccess,
        isLectureLocked,
        adminBypassLock,
        toggleAdminBypassLock,
        getLectureProgress,
        updateProgress,
        getCourseProgress,
        enrollStudent,
        recordPayment,
        donationReceipts,
        setDonationReceipts,
        issueDonationReceipt,
        updateCourseSettings,
        addCourse,
        deleteCourse,
        addLecture,
        updateLecture,
        deleteLecture,
        getCertificate,
        claimCertificate,
        checkLecturesCompleted: checkCourseAllLecturesDone,
        beginExam,
        getExamResult,
        isExamPassed,
        submitExam,
        parseExamText,
        addQAPost,
        addQAAnswer,
        deleteQAPost,
        getLectureQAPosts
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
}
