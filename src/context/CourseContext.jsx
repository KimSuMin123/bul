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
  const [loading, setLoading] = useState(true);

  // 100% Supabase Cloud DB Direct Fetch
  const refreshData = useCallback(async () => {
    if (!isExternalDbConfigured) {
      setLoading(false);
      return;
    }

    try {
      const [rCourses, rLecs, rEnrs, rPays, rProg, rCerts, rQA, rAttempts] = await Promise.all([
        remoteDb.getCourses(),
        remoteDb.getLectures(),
        remoteDb.getEnrollments(),
        remoteDb.getPayments(),
        remoteDb.getProgress(),
        remoteDb.getCertificates(),
        remoteDb.getQAPosts(),
        remoteDb.getExamAttempts()
      ]);

      const activeLecs = Array.isArray(rLecs) ? rLecs : [];
      setLectures(activeLecs);

      if (Array.isArray(rCourses)) {
        const populated = rCourses.map(c => {
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
      }

      if (Array.isArray(rEnrs)) setEnrollments(rEnrs);
      if (Array.isArray(rPays)) setPayments(rPays);
      if (Array.isArray(rProg)) setProgressList(rProg);
      if (Array.isArray(rCerts)) setCertificates(rCerts);
      if (Array.isArray(rQA)) setQaPosts(rQA);
      if (Array.isArray(rAttempts)) setExamAttempts(rAttempts);

    } catch (err) {
      console.warn('Supabase pure data fetch warning:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
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

  const isLectureLocked = useCallback((userId, lectureId) => {
    if (isAdmin) return false;
    const currentLec = lectures.find(l => l.id === lectureId);
    if (!currentLec) return false;

    const course = courses.find(c => c.id === currentLec.courseId);
    if (!course || !course.sequentialUnlock) return false;

    const courseLecs = lectures
      .filter(l => l.courseId === currentLec.courseId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const currentIndex = courseLecs.findIndex(l => l.id === lectureId);
    if (currentIndex <= 0) return false;

    const prevLec = courseLecs[currentIndex - 1];
    const prevProg = progressList.find(p => p.userId === userId && p.lectureId === prevLec.id);
    return !(prevProg && (prevProg.completed || prevProg.progressRate >= 99));
  }, [lectures, courses, progressList, isAdmin]);

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

    const updatedItem = {
      id: existing ? existing.id : `prog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
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
  }, [progressList, lectures, courses, enrollments, examAttempts]);

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

    return item;
  }, [courses, enrollments, currentUser]);

  const recordPayment = useCallback(async ({ userId, courseId, manager, amount, methodMemo, paidAt }) => {
    const newPay = {
      id: `pay_${Date.now()}`,
      userId,
      courseId,
      paidAt: paidAt || new Date().toISOString().split('T')[0],
      manager: manager.trim(),
      amount: Number(amount) || 0,
      methodMemo: methodMemo.trim()
    };

    setPayments(prev => [...prev, newPay]);

    if (isExternalDbConfigured) {
      await remoteDb.insertPayment(newPay).catch(err => console.warn('Supabase insertPayment warning:', err));
    }

    // Activate enrollment
    await enrollStudent(userId, courseId, 'active');
    await refreshData();
    return newPay;
  }, [enrollStudent, refreshData]);

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
    const certType = courseData.certType?.trim() || '불교의례법사';
    const certGrade = courseData.certGrade?.trim() || '2급';
    const certTypeFull = courseData.certTypeFull?.trim() || (certGrade ? `${certType} ${certGrade}` : certType);
    const certRegNo = courseData.certRegNo?.trim() || '';

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
      certRegOffice: courseData.certRegOffice?.trim() || '문화체육관광부 (민간자격 등록번호: 제 2024-003892 호)',
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

    return newCert;
  }, [currentUser, courses, lectures, progressList, examAttempts, certificates]);

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

    return evaluation;
  }, [courses, lectures, progressList, enrollments]);

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
        getLectureProgress,
        updateProgress,
        getCourseProgress,
        enrollStudent,
        recordPayment,
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
