import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkCourseCompletion, issueCertificate, enrichCertificate, checkLecturesCompleted } from '../services/certService.js';
import { 
  parseExamText, 
  selectRandomQuestions, 
  evaluateExam, 
  saveExamAttempt, 
  getLatestExamAttempt, 
  hasPassedCourseExam, 
  getCourseExamPool,
  PRESET_EXAM_QUESTIONS
} from '../services/examService.js';
import { remoteDb, isExternalDbConfigured, deleteLectureVideo } from '../services/apiClient.js';
import { notifyAdminCourseApplication } from '../services/notificationService.js';
import { aggregateDonationReceipt, normalizePhone, findReceiptByPhoneOrUser } from '../services/donationService.js';
import { useAuth } from './AuthContext.jsx';

export const DEFAULT_COURSES = [
  {
    id: 'course-ritual-8-11',
    title: '불교의례법사 과정 I (8강~11강)',
    subtitle: '하단시식 및 칠칠재 영혼식 등 핵심 불교의례 집전과 해설',
    category: '불교의례법사',
    thumbnail: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=800&q=80',
    defaultPeriodDays: 90,
    sequentialUnlock: true,
    price: 50000,
    instructor: '불교의례 전문 법사',
    certType: '불교의례해설사',
    certGrade: '2급',
    certTypeFull: '불교의례해설사 2급',
    certRegNo: '민간자격 등록번호 제 2026- 00183호',
    certRegOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
    rawExamText: ''
  },
  {
    id: 'course-ritual-12-15',
    title: '불교의례법사 과정 II (12강~15강)',
    subtitle: '심화 불교의례 및 영산수륙예수 작법 실습',
    category: '불교의례법사',
    thumbnail: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    defaultPeriodDays: 90,
    sequentialUnlock: true,
    price: 50000,
    instructor: '불교의례 전문 법사',
    certType: '불교의례해설사',
    certGrade: '1급',
    certTypeFull: '불교의례해설사 1급',
    certRegNo: '민간자격 등록번호 제 2026- 00183호',
    certRegOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
    rawExamText: ''
  }
];

export const DEFAULT_LECTURES = [
  {
    id: 'lec-ritual-08-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 8,
    title: '제8강 불교 영가천도의 의미와 하단시식 개요',
    description: '불교 영가천도의 근본 종지와 하단시식의 의식 구조 및 봉송 절차를 체계적으로 학습합니다.',
    durationSeconds: 2400,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    attachmentName: '제8강_불교영가천도_교안.pdf',
    attachments: [{ name: '제8강_불교영가천도_교안.pdf', size: '2.5 MB' }]
  },
  {
    id: 'lec-ritual-09-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 9,
    title: '제9강 칠칠재 영혼식의 구성과 의궤 해설',
    description: '초재부터 칠재까지 49재 영혼식의 각 단별 독송 진언과 집전 순서를 상세히 익힙니다.',
    durationSeconds: 2400,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    attachmentName: '제9강_칠칠재_영혼식_의궤.pdf',
    attachments: [{ name: '제9강_칠칠재_영혼식_의궤.pdf', size: '3.1 MB' }]
  },
  {
    id: 'lec-ritual-10-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 10,
    title: '제10강 각 칠재의례 및 영반 실수 실습',
    description: '사찰 영반 집전 시 바라 및 요령 타법과 영가 이양의식을 실무 중심으로 학습합니다.',
    durationSeconds: 2400,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    attachmentName: '제10강_영반실수_해설.pdf',
    attachments: [{ name: '제10강_영반실수_해설.pdf', size: '2.8 MB' }]
  },
  {
    id: 'lec-ritual-11-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 11,
    title: '제11강 하단 퇴공 및 봉송 회향의식',
    description: '시식 회향 및 영가 봉송 의식의 핵심 게송과 회향발원을 정리합니다.',
    durationSeconds: 2400,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    attachmentName: '제11강_봉송회향_교안.pdf',
    attachments: [{ name: '제11강_봉송회향_교안.pdf', size: '1.9 MB' }]
  }
];

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
  // Admin bypass mode for sequential lock testing (default false: enforce lock even for admin)
  const [adminBypassLock, setAdminBypassLock] = useState(false);

  const toggleAdminBypassLock = useCallback(() => {
    setAdminBypassLock(prev => !prev);
  }, []);

  // 100% Supabase Cloud DB Direct Fetch (Optimized Lazy Fetching + Seamless Fallback)
  const refreshData = useCallback(async () => {
    try {
      let activeCourses = DEFAULT_COURSES;
      let activeLecs = DEFAULT_LECTURES;

      if (isExternalDbConfigured) {
        // 1. Fetch public courses and lectures for everyone
        const [rCourses, rLecs] = await Promise.all([
          remoteDb.getCourses().catch(() => null),
          remoteDb.getLectures().catch(() => null)
        ]);

        if (Array.isArray(rLecs) && rLecs.length > 0) {
          activeLecs = rLecs;
        }
        if (Array.isArray(rCourses) && rCourses.length > 0) {
          activeCourses = rCourses;
        }
      }

      setLectures(activeLecs);

      const populated = activeCourses.map(c => {
        let parsedExam = [];
        if (c.rawExamText && c.rawExamText.trim()) {
          parsedExam = parseExamText(c.rawExamText);
        } else {
          parsedExam = PRESET_EXAM_QUESTIONS;
        }
        return {
          ...c,
          examQuestions: parsedExam,
          lectureIds: activeLecs.filter(l => l.courseId === c.id).map(l => l.id)
        };
      });
      setCourses(populated);

      // 2. Role-based targeted lazy fetching & seamless state preservation
      const localEnrs = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('buddha_lms_enrollments') || '[]') : [];

      if (isAdmin) {
        if (isExternalDbConfigured) {
          const [rEnrs, rPays, rProg, rCerts, rQA, rAttempts, rDonations] = await Promise.all([
            remoteDb.getEnrollments().catch(() => []),
            remoteDb.getPayments().catch(() => []),
            remoteDb.getProgress().catch(() => []),
            remoteDb.getCertificates().catch(() => []),
            remoteDb.getQAPosts().catch(() => []),
            remoteDb.getExamAttempts().catch(() => []),
            remoteDb.getDonationReceipts().catch(() => [])
          ]);
          setEnrollments(prev => {
            const combined = [...(Array.isArray(rEnrs) ? rEnrs : [])];
            [...localEnrs, ...prev].forEach(p => {
              if (!combined.some(c => c.id === p.id || (c.userId === p.userId && c.courseId === p.courseId))) {
                combined.push(p);
              }
            });
            return combined;
          });
          if (Array.isArray(rPays) && rPays.length > 0) setPayments(rPays);
          if (Array.isArray(rProg) && rProg.length > 0) setProgressList(rProg);
          if (Array.isArray(rCerts) && rCerts.length > 0) setCertificates(rCerts);
          if (Array.isArray(rQA)) setQaPosts(rQA);
          if (Array.isArray(rAttempts) && rAttempts.length > 0) setExamAttempts(rAttempts);
          if (Array.isArray(rDonations) && rDonations.length > 0) setDonationReceipts(rDonations);
        } else {
          setEnrollments(localEnrs);
        }
      } else if (currentUser?.id) {
        if (isExternalDbConfigured) {
          const [rEnrs, rProg, rCerts, rQA, rAttempts] = await Promise.all([
            remoteDb.getEnrollments(currentUser.id).catch(() => []),
            remoteDb.getProgress(currentUser.id).catch(() => []),
            remoteDb.getCertificates(currentUser.id).catch(() => []),
            remoteDb.getQAPosts().catch(() => []),
            remoteDb.getExamAttempts(currentUser.id).catch(() => [])
          ]);
          setEnrollments(prev => {
            const combined = [...(Array.isArray(rEnrs) ? rEnrs : [])];
            [...localEnrs, ...prev].forEach(p => {
              if (p.userId === currentUser.id && !combined.some(c => c.id === p.id || (c.userId === p.userId && c.courseId === p.courseId))) {
                combined.push(p);
              }
            });
            return combined;
          });
          if (Array.isArray(rProg) && rProg.length > 0) setProgressList(rProg);
          if (Array.isArray(rCerts) && rCerts.length > 0) setCertificates(rCerts);
          if (Array.isArray(rQA)) setQaPosts(rQA);
          if (Array.isArray(rAttempts) && rAttempts.length > 0) setExamAttempts(rAttempts);
        } else {
          setEnrollments(localEnrs.filter(e => e.userId === currentUser.id));
        }
      }
    } catch (err) {
      console.warn('CourseContext refreshData error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, isAdmin]);

  // Real-time synchronization helper (Cross-tab & Same-tab without page reload)
  const notifySyncUpdate = useCallback((detail = {}) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('buddha_course_sync_channel');
        ch.postMessage({ type: 'COURSE_SYNC_REFRESH', ...detail });
        ch.close();
      }
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('buddha_sync_update', { detail }));
    }
  }, []);

  // Listen for real-time synchronization updates without manual refresh
  useEffect(() => {
    refreshData();

    let syncChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        syncChannel = new BroadcastChannel('buddha_course_sync_channel');
        syncChannel.onmessage = (e) => {
          if (e.data && e.data.type === 'COURSE_SYNC_REFRESH') {
            refreshData();
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
      if (syncChannel) syncChannel.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('buddha_sync_update', handleLocalSync);
      }
    };
  }, [refreshData]);

  // =========================================================================
  // RBAC & Access Control Logic
  // =========================================================================

  const hasCourseAccess = useCallback((userId, courseId) => {
    if (!userId) return false;
    if (isAdmin) return true; // Admins have full preview access

    const userEnrs = enrollments.filter(e => e.userId === userId && (e.status === 'active' || e.status === 'completed'));
    const directMatch = userEnrs.find(e => e.courseId === courseId);
    if (directMatch) return true;

    const hasBundle = userEnrs.some(e => e.courseId === 'bundle-all');
    if (hasBundle && (courseId === 'course-1' || courseId === 'course-2' || courseId === 'course-ritual-8-11' || courseId === 'course-ritual-12-15')) {
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
    
    // Completed if marked completed OR progressRate >= 95
    const isCompleted = Boolean(prevProg && (prevProg.completed === true || (Number(prevProg.progressRate) || 0) >= 95));
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

  const updateProgress = useCallback(async (userId, lectureId, currentSeconds, totalDuration) => {
    if (!userId || !lectureId) return;

    const existingIndex = progressList.findIndex(p => p.userId === userId && p.lectureId === lectureId);
    const existing = existingIndex !== -1 ? progressList[existingIndex] : null;

    const lastPlayed = Math.round(currentSeconds);
    const maxDuration = totalDuration || 1;
    const calcRate = Math.min(100, Math.round((lastPlayed / maxDuration) * 100));
    const highestRate = existing ? Math.max(existing.progressRate || 0, calcRate) : calcRate;
    const isCompleted = highestRate >= 99 || (existing && existing.completed);

    const targetLec = lectures.find(l => l.id === lectureId);
    const courseId = targetLec?.courseId || existing?.courseId || null;

    const updatedItem = {
      id: existing ? existing.id : `prog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      courseId,
      lectureId,
      lastPlayedSeconds: lastPlayed,
      watchedSeconds: existing ? Math.max(existing.watchedSeconds || 0, lastPlayed) : lastPlayed,
      progressRate: highestRate,
      completed: isCompleted,
      updatedAt: new Date().toISOString()
    };

    // Update memory state immediately
    setProgressList(prev => {
      const idx = prev.findIndex(p => p.userId === userId && p.lectureId === lectureId);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updatedItem;
        return next;
      }
      return [...prev, updatedItem];
    });

    // Save directly to Supabase Cloud DB
    if (isExternalDbConfigured) {
      await remoteDb.upsertProgress(updatedItem).catch(err => console.warn('Supabase upsertProgress warning:', err));
    }

    // If lecture reached completion, check if full course is completed
    if (isCompleted) {
      const lec = lectures.find(l => l.id === lectureId);
      if (lec) {
        const nextProgress = progressList.map(p => (p.userId === userId && p.lectureId === lectureId ? updatedItem : p));
        const allDone = checkCourseCompletion(userId, lec.courseId, courses, lectures, nextProgress, examAttempts);
        if (allDone) {
          const enr = enrollments.find(e => e.userId === userId && e.courseId === lec.courseId);
          if (enr && enr.status !== 'completed') {
            const updatedEnr = { ...enr, status: 'completed' };
            setEnrollments(prev => prev.map(e => e.id === enr.id ? updatedEnr : e));
            remoteDb.upsertEnrollment(updatedEnr).catch(() => {});
          }
        }
      }
    }
    notifySyncUpdate({ type: 'PROGRESS_UPDATED', userId, lectureId });
  }, [progressList, lectures, courses, enrollments, examAttempts, notifySyncUpdate]);

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

    setEnrollments(prev => {
      const idx = prev.findIndex(e => e.userId === userId && e.courseId === courseId);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });

    if (isExternalDbConfigured) {
      await remoteDb.upsertEnrollment(item).catch(err => console.warn('Supabase upsertEnrollment warning:', err));
    }

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
  }, [courses, enrollments, currentUser, notifySyncUpdate]);

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

    setPayments(prev => [...prev, newPay]);

    // 기부 영수증 동시 발행 옵션이 활성화된 경우 1전번 1행 누적 가산 대장에 자동 등재
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

    if (isExternalDbConfigured) {
      // 1. Attempt atomic transaction RPC first
      const rpcResult = await remoteDb.processCoursePayment({
        userId,
        courseId,
        amount,
        manager,
        methodMemo,
        paidAt
      });
      if (!rpcResult) {
        // Fallback to sequential write if RPC unavailable
        await remoteDb.insertPayment(newPay).catch(err => console.warn('Supabase insertPayment warning:', err));
        await enrollStudent(userId, courseId, 'active');
      } else {
        // Optimistic enrollment update
        setEnrollments(prev => {
          const target = prev.find(e => e.userId === userId && e.courseId === courseId);
          if (target) {
            return prev.map(e => e.id === target.id ? { ...e, status: 'active', paidAt: newPay.paidAt } : e);
          }
          return [...prev, {
            id: rpcResult.paymentId ? `enr_${rpcResult.paymentId.replace('pay_', '')}` : `enr_${Date.now()}`,
            userId,
            courseId,
            status: 'active',
            enrolledAt: new Date().toISOString().split('T')[0],
            paidAt: newPay.paidAt,
            expireAt: rpcResult.expireAt || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
          }];
        });
      }
    } else {
      await enrollStudent(userId, courseId, 'active');
    }

    notifySyncUpdate({ type: 'PAYMENT_RECORDED', userId, courseId });
    return newPay;
  }, [enrollStudent, issueDonationReceipt, notifySyncUpdate]);

  const updateCourseSettings = useCallback(async (courseId, updates) => {
    let finalUpdates = { ...updates };
    if (updates.rawExamText !== undefined) {
      finalUpdates.examQuestions = updates.rawExamText.trim() 
        ? parseExamText(updates.rawExamText) 
        : PRESET_EXAM_QUESTIONS;
    }

    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, ...finalUpdates } : c));

    if (isExternalDbConfigured) {
      await remoteDb.updateCourse(courseId, finalUpdates).catch(err => console.warn('Supabase updateCourse warning:', err));
    }
  }, []);

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
      parsedExamQuestions = PRESET_EXAM_QUESTIONS;
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

    setCourses(prev => [...prev, newCourse]);

    if (isExternalDbConfigured) {
      await remoteDb.insertCourse(newCourse).catch(err => console.warn('Supabase insertCourse warning:', err));
    }

    return newCourse;
  }, []);

  const deleteCourse = useCallback(async (courseId) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
    setLectures(prev => prev.filter(l => l.courseId !== courseId));

    if (isExternalDbConfigured) {
      await remoteDb.deleteCourse(courseId).catch(err => console.warn('Supabase deleteCourse warning:', err));
    }

    return true;
  }, []);

  const addLecture = useCallback(async (lectureData) => {
    const newLec = {
      ...lectureData,
      id: lectureData.id || `lec_${Date.now()}`
    };

    setLectures(prev => [...prev, newLec]);
    setCourses(prev => prev.map(c => {
      if (c.id === newLec.courseId) {
        const nextIds = c.lectureIds ? [...c.lectureIds] : [];
        if (!nextIds.includes(newLec.id)) nextIds.push(newLec.id);
        return { ...c, lectureIds: nextIds };
      }
      return c;
    }));

    if (isExternalDbConfigured) {
      await remoteDb.insertLecture(newLec).catch(err => console.warn('Supabase insertLecture warning:', err));
    }

    return newLec;
  }, []);

  const updateLecture = useCallback(async (lectureId, updates) => {
    setLectures(prev => prev.map(l => l.id === lectureId ? { ...l, ...updates } : l));

    if (isExternalDbConfigured) {
      await remoteDb.updateLecture(lectureId, updates).catch(err => console.warn('Supabase updateLecture warning:', err));
    }
  }, []);

  const deleteLecture = useCallback(async (lectureId) => {
    const targetLec = lectures.find(l => l.id === lectureId);
    setLectures(prev => prev.filter(l => l.id !== lectureId));

    if (targetLec) {
      setCourses(prev => prev.map(c => {
        if (c.id === targetLec.courseId && c.lectureIds) {
          return { ...c, lectureIds: c.lectureIds.filter(id => id !== lectureId) };
        }
        return c;
      }));
    }

    if (isExternalDbConfigured) {
      await remoteDb.deleteLecture(lectureId).catch(err => console.warn('Supabase deleteLecture warning:', err));
    }

    if (targetLec && targetLec.videoUrl && targetLec.videoUrl.includes('/storage/v1/object/public/lectures/')) {
      try {
        const parts = targetLec.videoUrl.split('/lectures/');
        if (parts[1]) {
          const fileName = decodeURIComponent(parts[1].split('?')[0]);
          deleteLectureVideo(fileName).catch(() => {});
        }
      } catch (e) {}
    }

    return true;
  }, [lectures]);

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

    setQaPosts(prev => [newPost, ...prev]);

    if (isExternalDbConfigured) {
      await remoteDb.insertQAPost(newPost).catch(err => console.log('Supabase post error:', err));
    }

    return newPost;
  }, [currentUser]);

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

    setQaPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, answers: [...(p.answers || []), newAnswer] };
      }
      return p;
    }));

    if (isExternalDbConfigured) {
      await remoteDb.insertQAAnswer(postId, newAnswer).catch(err => console.log('Supabase answer error:', err));
    }

    return newAnswer;
  }, [currentUser]);

  const deleteQAPost = useCallback(async (postId) => {
    const post = qaPosts.find(p => p.id === postId);
    if (!post) return;

    if (!isAdmin && post.authorId !== currentUser?.id) {
      throw new Error('질문 삭제 권한이 없습니다.');
    }

    setQaPosts(prev => prev.filter(p => p.id !== postId));

    if (isExternalDbConfigured) {
      await remoteDb.deleteQAPost(postId).catch(err => console.log('Supabase delete error:', err));
    }
  }, [currentUser, isAdmin, qaPosts]);

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

    const newCert = issueCertificate(currentUser, course, certificates, certificates.length);
    setCertificates(prev => [...prev, newCert]);

    if (isExternalDbConfigured) {
      await remoteDb.insertCertificate(newCert).catch(err => console.warn('Supabase insertCertificate warning:', err));
    }

    notifySyncUpdate({ type: 'CERTIFICATE_CLAIMED', userId: currentUser.id, courseId });
    return newCert;
  }, [currentUser, courses, lectures, progressList, examAttempts, certificates, notifySyncUpdate]);

  // Exam helpers
  const getExamPool = useCallback((courseId) => {
    return getCourseExamPool(courseId, courses);
  }, [courses]);

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

  const submitExam = useCallback(async (userId, courseId, questions, answers) => {
    const evaluation = evaluateExam(questions, answers);
    
    // Save to Supabase and update memory state
    const savedAttempt = await saveExamAttempt(userId, courseId, evaluation);
    setExamAttempts(prev => [savedAttempt, ...prev]);

    // If both lectures completed and exam passed, update enrollment to completed!
    const lecturesDone = checkLecturesCompleted(userId, courseId, courses, lectures, progressList);
    if (evaluation.passed && lecturesDone) {
      const enr = enrollments.find(e => e.userId === userId && e.courseId === courseId);
      if (enr && enr.status !== 'completed') {
        const updatedEnr = { ...enr, status: 'completed' };
        setEnrollments(prev => prev.map(e => e.id === enr.id ? updatedEnr : e));
        if (isExternalDbConfigured) {
          remoteDb.upsertEnrollment(updatedEnr).catch(() => {});
        }
      }
    }

    notifySyncUpdate({ type: 'EXAM_SUBMITTED', userId, courseId });
    return evaluation;
  }, [courses, lectures, progressList, enrollments, notifySyncUpdate]);

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
        getExamPool,
        getExamResult,
        isExamPassed,
        submitExam,
        selectRandomQuestions,
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
