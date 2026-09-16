import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStored, setStored, STORAGE_KEYS } from '../services/storage.js';
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

  // Reload all state from storage and sync in real-time with Supabase Cloud DB
  const refreshData = useCallback(async () => {
    // 1. Instant local render from storage cache
    const localCourses = getStored(STORAGE_KEYS.COURSES) || [];
    const localLecs = getStored(STORAGE_KEYS.LECTURES) || [];
    const localEnrs = getStored(STORAGE_KEYS.ENROLLMENTS) || [];
    const localPays = getStored(STORAGE_KEYS.PAYMENTS) || [];
    const localProg = getStored(STORAGE_KEYS.PROGRESS) || [];
    const localCerts = getStored(STORAGE_KEYS.CERTIFICATES) || [];
    const localQA = getStored(STORAGE_KEYS.QA_POSTS) || [];

    setCourses(localCourses);
    setLectures(localLecs);
    setEnrollments(localEnrs);
    setPayments(localPays);
    setProgressList(localProg);
    setCertificates(localCerts);
    setQaPosts(localQA);

    // 2. Cloud DB real-time sync if Supabase is configured
    if (isExternalDbConfigured) {
      try {
        const [rCourses, rLecs, rEnrs, rPays, rProg, rCerts, rQA] = await Promise.all([
          remoteDb.getCourses(),
          remoteDb.getLectures(),
          remoteDb.getEnrollments(),
          remoteDb.getPayments(),
          remoteDb.getProgress(),
          remoteDb.getCertificates(),
          remoteDb.getQAPosts()
        ]);

        const activeLecs = rLecs && rLecs.length > 0 ? rLecs : localLecs;
        if (rLecs && rLecs.length > 0) {
          setLectures(rLecs);
          setStored(STORAGE_KEYS.LECTURES, rLecs);
        }

        if (rCourses && rCourses.length > 0) {
          const populated = rCourses.map(c => ({
            ...c,
            lectureIds: activeLecs.filter(l => l.courseId === c.id).map(l => l.id)
          }));
          setCourses(populated);
          setStored(STORAGE_KEYS.COURSES, populated);
        }

        if (rEnrs) {
          const localNow = getStored(STORAGE_KEYS.ENROLLMENTS) || [];
          const mergedEnrs = [...(rEnrs || [])];
          localNow.forEach(le => {
            const idx = mergedEnrs.findIndex(me => me.id === le.id || (me.userId === le.userId && me.courseId === le.courseId));
            if (idx === -1) {
              mergedEnrs.push(le);
              if (isExternalDbConfigured) {
                remoteDb.upsertEnrollment(le).catch(() => {});
              }
            } else {
              // Preserve local status if local has status and remote differs
              if (le.status && mergedEnrs[idx].status !== le.status) {
                mergedEnrs[idx] = { ...mergedEnrs[idx], ...le };
              }
            }
          });
          setEnrollments(mergedEnrs);
          setStored(STORAGE_KEYS.ENROLLMENTS, mergedEnrs);
        }

        if (rPays) {
          const localNow = getStored(STORAGE_KEYS.PAYMENTS) || [];
          const mergedPays = [...(rPays || [])];
          localNow.forEach(lp => {
            const idx = mergedPays.findIndex(mp => mp.id === lp.id);
            if (idx === -1) {
              mergedPays.push(lp);
              if (isExternalDbConfigured) {
                remoteDb.insertPayment(lp).catch(() => {});
              }
            }
          });
          setPayments(mergedPays);
          setStored(STORAGE_KEYS.PAYMENTS, mergedPays);
        }

        if (rProg) {
          const localNow = getStored(STORAGE_KEYS.PROGRESS) || [];
          const mergedProg = [...(rProg || [])];
          localNow.forEach(lp => {
            const idx = mergedProg.findIndex(mp => mp.id === lp.id || (mp.userId === lp.userId && mp.lectureId === lp.lectureId));
            if (idx === -1) {
              mergedProg.push(lp);
              if (isExternalDbConfigured) {
                remoteDb.upsertProgress(lp).catch(() => {});
              }
            } else {
              if ((lp.progressRate || 0) > (mergedProg[idx].progressRate || 0) || lp.completed) {
                mergedProg[idx] = { ...mergedProg[idx], ...lp };
              }
            }
          });
          setProgressList(mergedProg);
          setStored(STORAGE_KEYS.PROGRESS, mergedProg);
        }

        if (rCerts) {
          const localNow = getStored(STORAGE_KEYS.CERTIFICATES) || [];
          const mergedCerts = [...(rCerts || [])];
          localNow.forEach(lc => {
            const idx = mergedCerts.findIndex(mc => mc.id === lc.id || (mc.userId === lc.userId && mc.courseId === lc.courseId));
            if (idx === -1) {
              mergedCerts.push(lc);
              if (isExternalDbConfigured) {
                remoteDb.insertCertificate(lc).catch(() => {});
              }
            }
          });
          setCertificates(mergedCerts);
          setStored(STORAGE_KEYS.CERTIFICATES, mergedCerts);
        }

        if (rQA) {
          const localNow = getStored(STORAGE_KEYS.QA_POSTS) || [];
          const mergedQA = [...(rQA || [])];
          localNow.forEach(lq => {
            const idx = mergedQA.findIndex(mq => mq.id === lq.id);
            if (idx === -1) {
              mergedQA.push(lq);
            }
          });
          setQaPosts(mergedQA);
          setStored(STORAGE_KEYS.QA_POSTS, mergedQA);
        }
      } catch (err) {
        console.warn('Supabase full sync error:', err);
      }
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // =========================================================================
  // RBAC & Access Control Logic
  // =========================================================================

  /**
   * Checks if a user has valid access to a course (Active or Completed)
   * If user is enrolled in 'bundle-all', they also have access to course-1 and course-2
   */
  const hasCourseAccess = useCallback((userId, courseId) => {
    if (!userId) return false;
    if (isAdmin) return true; // Admins have full preview access

    const userEnrs = enrollments.filter(e => e.userId === userId && (e.status === 'active' || e.status === 'completed'));
    
    // Direct enrollment check
    const directMatch = userEnrs.find(e => e.courseId === courseId);
    if (directMatch) return true;

    // Bundle enrollment check
    const hasBundle = userEnrs.some(e => e.courseId === 'bundle-all');
    if (hasBundle && (courseId === 'course-1' || courseId === 'course-2')) {
      return true;
    }

    return false;
  }, [enrollments, isAdmin]);

  /**
   * Checks if user has access to a specific lecture
   */
  const hasLectureAccess = useCallback((userId, lectureId) => {
    if (!userId) return false;
    if (isAdmin) return true;

    const lec = lectures.find(l => l.id === lectureId);
    if (!lec) return false;

    return hasCourseAccess(userId, lec.courseId);
  }, [lectures, hasCourseAccess, isAdmin]);

  /**
   * Checks if a lecture is locked by the sequential unlock rule
   * Rule: If course.sequentialUnlock is true, lecture N is locked unless lecture (N-1) is 100% completed
   */
  const isLectureLocked = useCallback((userId, lectureId) => {
    if (isAdmin) return false; // Admin can preview all
    const currentLec = lectures.find(l => l.id === lectureId);
    if (!currentLec) return false;

    const course = courses.find(c => c.id === currentLec.courseId);
    if (!course || !course.sequentialUnlock) return false;

    // Get all lectures in this course sorted by orderIndex
    const courseLecs = lectures
      .filter(l => l.courseId === currentLec.courseId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const currentIndex = courseLecs.findIndex(l => l.id === lectureId);
    if (currentIndex <= 0) return false; // First lecture is always unlocked

    // Check if the previous lecture was completed
    const prevLec = courseLecs[currentIndex - 1];
    const prevProg = progressList.find(p => p.userId === userId && p.lectureId === prevLec.id);
    return !(prevProg && (prevProg.completed || prevProg.progressRate >= 99));
  }, [lectures, courses, progressList, isAdmin]);

  // =========================================================================
  // Video Progress & Auto-Completion Tracking
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

  const updateProgress = useCallback((userId, lectureId, currentSeconds, totalDuration) => {
    if (!userId || !lectureId) return;

    const allProgress = getStored(STORAGE_KEYS.PROGRESS) || [];
    const existingIndex = allProgress.findIndex(p => p.userId === userId && p.lectureId === lectureId);
    const existing = existingIndex !== -1 ? allProgress[existingIndex] : null;

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

    if (existingIndex !== -1) {
      allProgress[existingIndex] = updatedItem;
    } else {
      allProgress.push(updatedItem);
    }

    setStored(STORAGE_KEYS.PROGRESS, allProgress);
    setProgressList(allProgress);

    // Sync progress to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.upsertProgress(updatedItem).catch(err => console.warn('Remote upsertProgress warning:', err));
    }

    // If lecture reached completion, check if the entire course is completed!
    if (isCompleted) {
      const lec = lectures.find(l => l.id === lectureId);
      if (lec) {
        checkCourseCompletion(userId, lec.courseId);
        // Also check bundle-all if enrolled
        checkCourseCompletion(userId, 'bundle-all');
        refreshData();
      }
    }
  }, [lectures, refreshData]);

  // Overall course progress percentage
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
  // Admin & Enrollment Operations
  // =========================================================================

  const enrollStudent = useCallback((userId, courseId, status = 'active') => {
    const allEnrs = getStored(STORAGE_KEYS.ENROLLMENTS) || [];
    const course = courses.find(c => c.id === courseId);
    const periodDays = course ? course.defaultPeriodDays : 90;

    const today = new Date();
    const expireDate = new Date();
    expireDate.setDate(today.getDate() + periodDays);

    const existingIndex = allEnrs.findIndex(e => e.userId === userId && e.courseId === courseId);
    const item = {
      id: existingIndex !== -1 ? allEnrs[existingIndex].id : `enr_${Date.now()}`,
      userId,
      courseId,
      status,
      enrolledAt: today.toISOString().split('T')[0],
      paidAt: status === 'active' ? today.toISOString().split('T')[0] : null,
      expireAt: expireDate.toISOString().split('T')[0]
    };

    if (existingIndex !== -1) {
      allEnrs[existingIndex] = { ...allEnrs[existingIndex], ...item };
    } else {
      allEnrs.push(item);
    }

    setStored(STORAGE_KEYS.ENROLLMENTS, allEnrs);
    setEnrollments(allEnrs);

    // Sync enrollment to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.upsertEnrollment(item).catch(err => console.warn('Remote upsertEnrollment warning:', err));
    }

    return item;
  }, [courses]);

  const recordPayment = useCallback(({ userId, courseId, manager, amount, methodMemo, paidAt }) => {
    const allPayments = getStored(STORAGE_KEYS.PAYMENTS) || [];
    const newPay = {
      id: `pay_${Date.now()}`,
      userId,
      courseId,
      paidAt: paidAt || new Date().toISOString().split('T')[0],
      manager: manager.trim(),
      amount: Number(amount) || 0,
      methodMemo: methodMemo.trim()
    };
    allPayments.push(newPay);
    setStored(STORAGE_KEYS.PAYMENTS, allPayments);
    setPayments(allPayments);

    // Sync payment to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.insertPayment(newPay).catch(err => console.warn('Remote insertPayment warning:', err));
    }

    // Update enrollment to 'active'
    enrollStudent(userId, courseId, 'active');
    refreshData();
    return newPay;
  }, [enrollStudent, refreshData]);

  const updateCourseSettings = useCallback((courseId, updates) => {
    const allCourses = getStored(STORAGE_KEYS.COURSES) || [];
    const index = allCourses.findIndex(c => c.id === courseId);
    if (index !== -1) {
      let finalUpdates = { ...updates };
      if (updates.rawExamText !== undefined) {
        finalUpdates.examQuestions = updates.rawExamText.trim() 
          ? parseExamText(updates.rawExamText) 
          : [];
      }
      allCourses[index] = { ...allCourses[index], ...finalUpdates };
      setStored(STORAGE_KEYS.COURSES, allCourses);
      setCourses(allCourses);

      // Sync course updates to Supabase Cloud DB
      if (isExternalDbConfigured) {
        remoteDb.updateCourse(courseId, finalUpdates).catch(err => console.warn('Remote updateCourse warning:', err));
      }
    }
  }, []);

  const addCourse = useCallback((courseData) => {
    const allCourses = getStored(STORAGE_KEYS.COURSES) || [];
    const certType = courseData.certType?.trim() || '불교의례법사';
    const certGrade = courseData.certGrade?.trim() || '2급';
    const certTypeFull = courseData.certTypeFull?.trim() || (certGrade ? `${certType} ${certGrade}` : certType);
    const certRegNo = courseData.certRegNo?.trim() || '';

    // Parse exam questions if raw text is provided
    let parsedExamQuestions = [];
    if (courseData.rawExamText && courseData.rawExamText.trim()) {
      parsedExamQuestions = parseExamText(courseData.rawExamText);
    } else if (Array.isArray(courseData.examQuestions) && courseData.examQuestions.length > 0) {
      parsedExamQuestions = courseData.examQuestions;
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
    allCourses.push(newCourse);
    setStored(STORAGE_KEYS.COURSES, allCourses);
    setCourses(allCourses);

    // Sync course to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.insertCourse(newCourse).catch(err => console.warn('Remote insertCourse warning:', err));
    }

    return newCourse;
  }, []);

  const deleteCourse = useCallback((courseId) => {
    const allCourses = getStored(STORAGE_KEYS.COURSES) || [];
    const updatedCourses = allCourses.filter(c => c.id !== courseId);
    setStored(STORAGE_KEYS.COURSES, updatedCourses);
    setCourses(updatedCourses);

    // Sync course deletion to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.deleteCourse(courseId).catch(err => console.warn('Remote deleteCourse warning:', err));
    }

    // Also remove associated lectures
    const allLecs = getStored(STORAGE_KEYS.LECTURES) || [];
    const lecsToDelete = allLecs.filter(l => l.courseId === courseId);
    const updatedLecs = allLecs.filter(l => l.courseId !== courseId);
    setStored(STORAGE_KEYS.LECTURES, updatedLecs);
    setLectures(updatedLecs);

    // Clean up videos in background
    lecsToDelete.forEach(l => {
      if (l.videoUrl && l.videoUrl.includes('/storage/v1/object/public/lectures/')) {
        try {
          const parts = l.videoUrl.split('/lectures/');
          if (parts[1]) {
            const fileName = decodeURIComponent(parts[1].split('?')[0]);
            deleteLectureVideo(fileName).catch(() => {});
          }
        } catch (e) {}
      }
    });

    return true;
  }, []);

  const addLecture = useCallback((lectureData) => {
    const allLecs = getStored(STORAGE_KEYS.LECTURES) || [];
    const newLec = {
      ...lectureData,
      id: lectureData.id || `lec_${Date.now()}`
    };
    allLecs.push(newLec);
    setStored(STORAGE_KEYS.LECTURES, allLecs);
    setLectures(allLecs);

    // Sync lecture to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.insertLecture(newLec).catch(err => console.warn('Remote insertLecture warning:', err));
    }

    // Add to course's lectureIds
    const allCourses = getStored(STORAGE_KEYS.COURSES) || [];
    const course = allCourses.find(c => c.id === newLec.courseId);
    if (course) {
      if (!course.lectureIds) course.lectureIds = [];
      if (!course.lectureIds.includes(newLec.id)) {
        course.lectureIds.push(newLec.id);
        setStored(STORAGE_KEYS.COURSES, allCourses);
        setCourses(allCourses);
      }
    }

    return newLec;
  }, []);

  const updateLecture = useCallback((lectureId, updates) => {
    const allLecs = getStored(STORAGE_KEYS.LECTURES) || [];
    const index = allLecs.findIndex(l => l.id === lectureId);
    if (index !== -1) {
      allLecs[index] = { ...allLecs[index], ...updates };
      setStored(STORAGE_KEYS.LECTURES, allLecs);
      setLectures(allLecs);

      // Sync lecture updates to Supabase Cloud DB
      if (isExternalDbConfigured) {
        remoteDb.updateLecture(lectureId, updates).catch(err => console.warn('Remote updateLecture warning:', err));
      }
    }
  }, []);

  const deleteLecture = useCallback((lectureId) => {
    const allLecs = getStored(STORAGE_KEYS.LECTURES) || [];
    const targetLec = allLecs.find(l => l.id === lectureId);
    const updatedLecs = allLecs.filter(l => l.id !== lectureId);
    setStored(STORAGE_KEYS.LECTURES, updatedLecs);
    setLectures(updatedLecs);

    // Sync lecture deletion to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.deleteLecture(lectureId).catch(err => console.warn('Remote deleteLecture warning:', err));
    }

    if (targetLec) {
      const allCourses = getStored(STORAGE_KEYS.COURSES) || [];
      const course = allCourses.find(c => c.id === targetLec.courseId);
      if (course && course.lectureIds) {
        course.lectureIds = course.lectureIds.filter(id => id !== lectureId);
        setStored(STORAGE_KEYS.COURSES, allCourses);
        setCourses(allCourses);
      }
      if (targetLec.videoUrl && targetLec.videoUrl.includes('/storage/v1/object/public/lectures/')) {
        try {
          const parts = targetLec.videoUrl.split('/lectures/');
          if (parts[1]) {
            const fileName = decodeURIComponent(parts[1].split('?')[0]);
            deleteLectureVideo(fileName).catch(() => {});
          }
        } catch (e) {}
      }
    }

    return true;
  }, []);



  // =========================================================================
  // Q&A Community Operations
  // =========================================================================

  const addQAPost = useCallback(({ courseId, lectureId, title, content, timestampSeconds = null, isPrivate = false }) => {
    if (!currentUser) throw new Error('질문을 작성하려면 로그인이 필요합니다.');
    const allPosts = getStored(STORAGE_KEYS.QA_POSTS) || [];
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

    allPosts.unshift(newPost);
    setStored(STORAGE_KEYS.QA_POSTS, allPosts);
    setQaPosts(allPosts);

    if (isExternalDbConfigured) {
      remoteDb.insertQAPost(newPost).catch(err => console.log('Remote post error:', err));
    }

    return newPost;
  }, [currentUser]);

  const addQAAnswer = useCallback((postId, { content, authorName = '지산 스님', badgeTitle = '담당 지도교수' }) => {
    if (!currentUser) throw new Error('답변을 작성하려면 로그인이 필요합니다.');
    const allPosts = getStored(STORAGE_KEYS.QA_POSTS) || [];
    const postIndex = allPosts.findIndex(p => p.id === postId);
    if (postIndex === -1) throw new Error('존재하지 않는 질문입니다.');

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

    allPosts[postIndex].answers.push(newAnswer);
    setStored(STORAGE_KEYS.QA_POSTS, allPosts);
    setQaPosts(allPosts);

    if (isExternalDbConfigured) {
      remoteDb.insertQAAnswer(postId, newAnswer).catch(err => console.log('Remote answer error:', err));
    }

    return newAnswer;
  }, [currentUser]);

  const deleteQAPost = useCallback((postId) => {
    const allPosts = getStored(STORAGE_KEYS.QA_POSTS) || [];
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    if (!isAdmin && post.authorId !== currentUser?.id) {
      throw new Error('질문 삭제 권한이 없습니다.');
    }

    const filtered = allPosts.filter(p => p.id !== postId);
    setStored(STORAGE_KEYS.QA_POSTS, filtered);
    setQaPosts(filtered);

    if (isExternalDbConfigured) {
      remoteDb.deleteQAPost(postId).catch(err => console.log('Remote delete error:', err));
    }
  }, [currentUser, isAdmin]);

  const getLectureQAPosts = useCallback((lectureId) => {
    return qaPosts.filter(p => p.lectureId === lectureId);
  }, [qaPosts]);

  // =========================================================================
  // Certificate & Qualification Exam Operations
  // =========================================================================

  const getCertificate = useCallback((userId, courseId) => {
    const certs = getStored(STORAGE_KEYS.CERTIFICATES) || [];
    const found = certs.find(c => c.userId === userId && c.courseId === courseId);
    return found ? enrichCertificate(found) : null;
  }, []);

  const claimCertificate = useCallback((courseId) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');
    const course = courses.find(c => c.id === courseId);
    if (!course) throw new Error('존재하지 않는 코스입니다.');

    // 1. Must complete lectures 100%
    if (!checkLecturesCompleted(currentUser.id, courseId)) {
      throw new Error('모든 강의 차시(진도율 100%)를 먼저 완강하셔야 합니다.');
    }

    // 2. Must pass exam with >= 60 points
    if (!hasPassedCourseExam(currentUser.id, courseId)) {
      throw new Error('자격 검정 시험(수료 기준 60점 이상)에 합격하셔야 공인 자격증이 발급됩니다.');
    }

    const newCert = issueCertificate(currentUser, course);
    if (isExternalDbConfigured) {
      remoteDb.insertCertificate(newCert).catch(err => console.warn('Remote insertCertificate warning:', err));
    }
    refreshData();
    return newCert;
  }, [currentUser, courses, refreshData]);

  // Exam helpers
  const getExamPool = useCallback((courseId) => {
    return getCourseExamPool(courseId, courses);
  }, [courses]);

  const getExamResult = useCallback((userId, courseId) => {
    return getLatestExamAttempt(userId, courseId);
  }, []);

  const isExamPassed = useCallback((userId, courseId) => {
    return hasPassedCourseExam(userId, courseId);
  }, []);

  const submitExam = useCallback((userId, courseId, questions, answers) => {
    const evaluation = evaluateExam(questions, answers);
    saveExamAttempt(userId, courseId, evaluation);

    // If both lectures completed and exam passed, update enrollment to completed!
    if (evaluation.passed && checkLecturesCompleted(userId, courseId)) {
      checkCourseCompletion(userId, courseId);
    }
    refreshData();
    return evaluation;
  }, [refreshData]);

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
        checkLecturesCompleted,
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
