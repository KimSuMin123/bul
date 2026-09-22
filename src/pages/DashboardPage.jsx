import React, { useState, useMemo } from 'react';
import { 
  PlayCircle, Clock, Award, CheckCircle2, AlertCircle, 
  Calendar, BookOpen, ExternalLink, HelpCircle, ArrowRight,
  X, MapPin, Phone, CreditCard, Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../context/CourseContext';
import { useModalAlert } from '../context/ModalAlertContext';
import CertificateModal from '../components/certificate/CertificateModal';
import CourseExamModal from '../components/exam/CourseExamModal';

export default function DashboardPage({ onNavigate, onStartLecture }) {
  const { currentUser } = useAuth();
  const { showAlert } = useModalAlert();
  const { 
    courses, lectures, enrollments, getCourseProgress, 
    progressList, claimCertificate, getCertificate,
    checkLecturesCompleted, isExamPassed, getExamResult,
    enrollStudent, updateProgress, refreshData, isLectureLocked
  } = useCourse();

  const [activeCert, setActiveCert] = useState(null);
  const [activeExamCourse, setActiveExamCourse] = useState(null);
  const [showPaymentInfoModal, setShowPaymentInfoModal] = useState(false);

  // Get current user enrollments
  const userEnrollments = useMemo(() => {
    if (!currentUser) return [];
    return enrollments.filter(e => e.userId === currentUser.id);
  }, [enrollments, currentUser?.id]);

  // Courses not yet enrolled by current user
  const notEnrolledCourses = useMemo(() => {
    if (!currentUser) return courses;
    return courses.filter(c => !userEnrollments.some(e => e.courseId === c.id));
  }, [courses, userEnrollments, currentUser]);

  // Find most recent played lecture for Sticky "이어서 학습"
  const recentResumeLecture = useMemo(() => {
    if (!currentUser) return null;
    const userProgress = progressList
      .filter(p => p.userId === currentUser.id && p.lastPlayedSeconds > 0 && !p.completed)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    if (userProgress.length > 0) {
      const targetLec = lectures.find(l => l.id === userProgress[0].lectureId);
      if (targetLec) {
        return {
          lecture: targetLec,
          progress: userProgress[0]
        };
      }
    }

    // Default to first lecture of first active course if no in-progress
    const firstActiveEnr = userEnrollments.find(e => e.status === 'active' || e.status === 'completed');
    if (firstActiveEnr) {
      const firstLec = lectures.find(l => l.courseId === firstActiveEnr.courseId);
      if (firstLec) {
        return { lecture: firstLec, progress: null };
      }
    }

    return null;
  }, [progressList, lectures, userEnrollments, currentUser?.id]);

  // If not logged in, prompt to log in safely after all hooks are declared
  if (!currentUser) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center', maxWidth: '500px' }}>
        <div className="card" style={{ padding: '40px 30px' }}>
          <BookOpen size={48} color="var(--color-sage)" style={{ margin: '0 auto 16px auto' }} />
          <h2 className="heading-1 font-serif" style={{ fontSize: '24px', marginBottom: '8px' }}>로그인이 필요합니다</h2>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            내 강의실을 이용하시려면 먼저 회원 계정으로 로그인해 주세요.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onNavigate('login')}>
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  // Calculate remaining days for an enrollment
  const getRemainingDays = (expireAt) => {
    if (!expireAt) return 90;
    const diffTime = new Date(expireAt) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleOpenCert = async (course) => {
    let cert = getCertificate(currentUser.id, course.id);
    if (!cert) {
      try {
        cert = await claimCertificate(course.id);
      } catch (e) {
        showAlert(e.message, { type: 'error', title: '수료증 발급 오류' });
        return;
      }
    }
    if (cert) {
      setActiveCert(cert);
    }
  };

  // Direct Apply from Dashboard
  const handleApplyCourseFromDashboard = async (courseId) => {
    await enrollStudent(currentUser.id, courseId, 'pending');
    showAlert(`수강 신청이 정상 접수되었습니다!\n\n현재 [대기상태 (대면 수납 대기)]로 등록되었습니다.\n교학처(010-4702-0283)에 방문하시어 수납을 완료하시면 [수강 중]으로 전환됩니다.`, { type: 'success', title: '수강 신청 접수 완료' });
    refreshData();
  };

  return (
    <div style={{ padding: '36px 0 60px 0' }}>
      <div className="container">
        
        {/* Student Welcome Header */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '28px',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <div className="badge badge-sage" style={{ marginBottom: '6px' }}>
              {currentUser.role === 'admin' ? '교학처 관리자 모드' : '내 강의실 (Dashboard)'}
            </div>
            <h1 className="heading-1 font-serif">
              {currentUser.name} 님의 배움터
            </h1>
            <p className="text-caption" style={{ marginTop: '4px' }}>
              오늘도 맑고 고요한 마음으로 지혜의 가르침을 이어갑니다.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {currentUser.role === 'admin' && (
              <button 
                className="btn btn-primary btn-sm" 
                style={{ fontWeight: 700, padding: '8px 16px', background: 'var(--color-charcoal-dark)' }} 
                onClick={() => onNavigate('admin')}
              >
                <Award size={15} />
                <span>교학처 관리자 CMS 대시보드 바로가기 ▶</span>
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('home')}>
              <BookOpen size={15} />
              <span>전체 강좌 둘러보기</span>
            </button>
          </div>
        </div>

        {/* Sticky '이어서 학습' Quick Action Bar */}
        {recentResumeLecture && (
          <div className="sticky-resume-bar">
            <div className="sticky-resume-info" style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div 
                style={{ 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '50%', 
                  background: 'var(--color-amber)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--color-charcoal-dark)',
                  flexShrink: 0
                }}
              >
                <PlayCircle size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--color-amber)', fontWeight: 600 }}>
                  최근 수강 중인 강의
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#FFFFFF', wordBreak: 'keep-all', lineHeight: '1.35' }}>
                  {recentResumeLecture.lecture.title}
                </div>
              </div>
            </div>

            <button 
              className="btn btn-amber btn-sm sticky-resume-btn"
              style={{ fontWeight: 600, padding: '8px 18px', whiteSpace: 'nowrap' }}
              onClick={() => onStartLecture(recentResumeLecture.lecture.id)}
            >
              <span>이어서 학습하기</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Enrolled Courses Section */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 className="heading-2 font-serif" style={{ margin: 0 }}>나의 수강 과정 ({userEnrollments.length})</h2>
              <span className="text-caption">납부 전: 대기상태 | 납부 후: 수강 중 | 100% 완강: 수료 완료 및 수료증 발급</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('home')}>
              <BookOpen size={14} />
              <span>전체 개설 강좌 둘러보기</span>
            </button>
          </div>

          {userEnrollments.length === 0 ? (
            <div className="card card-warm" style={{ padding: '40px 24px', textAlign: 'center', marginBottom: '32px' }}>
              <BookOpen size={40} color="var(--color-sage)" style={{ margin: '0 auto 12px auto' }} />
              <h3 className="heading-3" style={{ marginBottom: '6px' }}>현재 신청된 수강 과정이 없습니다</h3>
              <p className="text-caption" style={{ marginBottom: '18px' }}>
                아래 개설 강좌에서 [수강 신청 접수]를 누르시면 내 강의실에 [대기상태]로 바로 등록됩니다.
              </p>
            </div>
          ) : (
            <div 
              className="courses-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}
            >
              {userEnrollments.map((enr) => {
                const course = courses.find(c => c.id === enr.courseId);
                if (!course) return null;

                const progress = getCourseProgress(currentUser.id, course.id);
                const remainingDays = getRemainingDays(enr.expireAt);
                const isPending = enr.status === 'pending' || enr.status === 'applied';
                const isLecturesDone = progress >= 100;
                const hasPassedExam = isExamPassed(currentUser.id, course.id);
                const isFullyCompleted = isLecturesDone && hasPassedExam;
                const latestExam = getExamResult(currentUser.id, course.id);

                return (
                  <div key={enr.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Card Header & Status */}
                    <div style={{ position: 'relative', height: '140px', overflow: 'hidden' }}>
                      <img src={course.thumbnail} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      
                      {/* Status Tag */}
                      <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                        {isFullyCompleted ? (
                          <span className="badge" style={{ background: 'linear-gradient(135deg, #D49B4B 0%, #B8860B 100%)', color: '#FFFFFF', border: 'none', fontWeight: 800, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                            <CheckCircle2 size={14} />
                            <span>🏆 수료 및 자격취득</span>
                          </span>
                        ) : isPending ? (
                          <span className="badge" style={{ background: '#F59E0B', color: '#1E2022', border: 'none', fontWeight: 800, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                            <Clock size={14} />
                            <span>⏳ 대기상태 (대면 수납 대기)</span>
                          </span>
                        ) : isLecturesDone ? (
                          <span className="badge" style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', fontWeight: 700, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Award size={14} />
                            <span>✍ 시험 응시 대상</span>
                          </span>
                        ) : (
                          <span className="badge badge-sage" style={{ background: 'var(--color-sage)', color: '#FFFFFF', border: 'none', fontWeight: 700, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <PlayCircle size={14} />
                            <span>▶ 수강 중</span>
                          </span>
                        )}
                      </div>

                      {/* Remaining Days */}
                      {!isPending && (
                        <div 
                          style={{ 
                            position: 'absolute', 
                            bottom: '10px', 
                            right: '12px',
                            background: 'rgba(30, 32, 34, 0.85)',
                            backdropFilter: 'blur(4px)',
                            color: '#FFFFFF',
                            fontSize: '11.5px',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)'
                          }}
                        >
                          D-{remainingDays}
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-sage)', fontWeight: 600 }}>{course.category}</span>
                        <h3 style={{ fontSize: '17px', margin: '4px 0 6px 0', fontWeight: 700, lineHeight: '1.4' }}>{course.title}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>강사: {course.instructor}</p>
                      </div>                      {/* 1. 납부 전 (대기 상태) UI */}
                      {isPending && (
                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                          <div style={{ fontWeight: 700, color: '#92400E', fontSize: '13.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={15} />
                            <span>교학처 대면 수납 승인 대기 중</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12.5px', color: '#B45309', lineHeight: '1.5' }}>
                            수강 신청이 접수되었습니다. 교학처(010-4702-0283)에 방문하시어 수강료를 납부하시면 즉시 [수강 중]으로 전환되어 강의 시청이 가능합니다.
                          </p>
                        </div>
                      )}

                      {/* 2. 강의 수강 중 (진도율 미달) UI */}
                      {!isPending && !isLecturesDone && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>강의 학습 진도율</span>
                            <strong style={{ color: 'var(--color-sage)' }}>{progress}%</strong>
                          </div>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      )}

                      {/* 3. 강의 완강 완료 BUT 시험 미통과 상태 UI */}
                      {!isPending && isLecturesDone && !hasPassedExam && (
                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                          <div style={{ fontWeight: 700, color: '#B45309', fontSize: '13.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Award size={16} />
                            <span>전 강좌 100% 완강 (자격 검정 시험 대상)</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12.5px', color: '#92400E', lineHeight: '1.5' }}>
                            강의를 모두 이수하셨습니다! 수료증을 취득하려면 <strong>[자격 검정 평가 시험]</strong>에서 <strong>60점 이상</strong>을 득점하셔야 합니다. (재응시 가능)
                          </p>
                          {latestExam && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#B91C1C', fontWeight: 600 }}>
                              * 최근 시험 점수: {latestExam.score}점 (불합격) — 오답을 복습하고 언제든 다시 응시하세요.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. 강의 완강 + 시험 합격 (수료증 발급 자격 완료) UI */}
                      {!isPending && isFullyCompleted && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                          <div style={{ fontWeight: 700, color: '#166534', fontSize: '13.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={16} />
                            <span>전 강좌 완강 및 자격 검정 합격 ({latestExam ? `${latestExam.score}점` : '합격'})</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12.5px', color: '#15803D', lineHeight: '1.5' }}>
                            축하드립니다! 자격 검정 기준(60점)을 통과하여 사단법인 세화불학원 이사장 직인이 날인된 정식 수료증이 발급되었습니다.
                          </p>
                        </div>
                      )}

                      {/* Card Action Buttons */}
                      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isPending ? (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ width: '100%', fontWeight: 600, padding: '10px' }}
                            onClick={() => setShowPaymentInfoModal(true)}
                          >
                            <HelpCircle size={15} color="#D97706" />
                            <span>대면 수납 절차 및 위치 안내</span>
                          </button>
                        ) : isFullyCompleted ? (
                          <>
                            {/* Prominent Certificate Button */}
                            <button 
                              className="btn btn-amber btn-lg" 
                              style={{ 
                                width: '100%', 
                                backgroundColor: '#D49B4B', 
                                borderColor: '#B8860B', 
                                color: '#FFFFFF', 
                                fontWeight: 800, 
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px',
                                boxShadow: '0 3px 10px rgba(212, 155, 75, 0.35)'
                              }}
                              onClick={() => handleOpenCert(course)}
                            >
                              <Award size={20} />
                              <span>🎓 정식 수료증 발급 및 출력</span>
                            </button>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setActiveExamCourse(course)}
                                title="성적 갱신이나 복습을 위해 언제든 다시 응시할 수 있습니다."
                              >
                                <span>📝 시험 결과 / 재응시</span>
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => {
                                  const firstLec = lectures.find(l => l.courseId === course.id);
                                  if (firstLec) onStartLecture(firstLec.id);
                                }}
                              >
                                <span>강의 복습하기</span>
                              </button>
                            </div>
                          </>
                        ) : isLecturesDone && !hasPassedExam ? (
                          <>
                            {/* Exam Take Button */}
                            <button 
                              className="btn btn-primary btn-lg" 
                              style={{ 
                                width: '100%', 
                                fontWeight: 800, 
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px',
                                background: 'linear-gradient(135deg, #3B5249 0%, #22332D 100%)',
                                boxShadow: '0 4px 14px rgba(59, 82, 73, 0.35)'
                              }}
                              onClick={() => setActiveExamCourse(course)}
                            >
                              <Award size={18} color="#FDE68A" />
                              <span>📝 자격 검정 시험 응시하기 (60점 이상 수료)</span>
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ width: '100%' }}
                              onClick={() => {
                                const firstLec = lectures.find(l => l.courseId === course.id);
                                if (firstLec) onStartLecture(firstLec.id);
                              }}
                            >
                              <PlayCircle size={14} />
                              <span>강의 다시 복습하기</span>
                            </button>
                          </>
                        ) : (
                          <button 
                            className="btn btn-primary btn-md" 
                            style={{ width: '100%', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                            onClick={() => {
                              const sortedLecs = lectures
                                .filter(l => l.courseId === course.id)
                                .sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
                              // Find first uncompleted and unlocked lecture
                              const targetLec = sortedLecs.find(l => {
                                const p = progressList.find(prog => String(prog.userId) === String(currentUser?.id) && prog.lectureId === l.id);
                                const isDone = p && (p.completed || (Number(p.progressRate) || 0) >= 95);
                                return !isDone && !isLectureLocked(currentUser?.id, l.id);
                              }) || sortedLecs[0];
                              if (targetLec) onStartLecture(targetLec.id);
                            }}
                          >
                            <PlayCircle size={16} />
                            <span>강의실 입장 (학습 이어하기) ▶</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Not yet enrolled courses */}
          {notEnrolledCourses.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 className="heading-3 font-serif" style={{ margin: 0 }}>수강 신청 가능한 강좌 ({notEnrolledCourses.length})</h3>
                <span className="text-caption">원하시는 과정을 신청하시면 [대기상태]로 접수됩니다.</span>
              </div>
              <div 
                className="courses-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px' }}
              >
                {notEnrolledCourses.map(c => (
                  <div key={c.id} className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '14px' }}>
                      <img src={c.thumbnail} alt={c.title} style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '6px' }} />
                      <div>
                        <span className="badge badge-sage" style={{ fontSize: '10.5px', marginBottom: '3px' }}>{c.category}</span>
                        <h4 style={{ margin: '2px 0 4px 0', fontSize: '14.5px', fontWeight: 700 }}>{c.title}</h4>
                        <div style={{ fontSize: '12px', color: 'var(--color-sage)', fontWeight: 700 }}>
                          {(c.price || 50000).toLocaleString()}원 <span style={{ color: '#94A3B8', fontWeight: 400 }}>(대면 수납)</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ width: '100%', fontWeight: 600 }}
                      onClick={() => handleApplyCourseFromDashboard(c.id)}
                    >
                      <span>+ 수강 신청 접수 (대기상태로 담기)</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Learning Guide & FAQ Accordion Section */}
        <div className="card card-warm" style={{ padding: '28px' }}>
          <h3 className="heading-3 font-serif" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={18} color="var(--color-sage)" />
            <span>온라인 수강 안내 및 필수 유의사항</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '13px', color: '#4A5568', lineHeight: '1.7' }}>
            <div>
              <strong>• 이어보기 기능 안내</strong>
              <p>동영상 시청 중 일시 정지하거나 브라우저를 닫아도 시청 위치가 자동 저장되어 언제든 직전 시점부터 이어보실 수 있습니다.</p>
            </div>
            <div>
              <strong>• 순차 학습 시스템 (선수 차시 잠금)</strong>
              <p>깊이 있는 이해를 위해 이전 차시를 100% 완강해야 다음 차시가 열립니다. (일부 통합 코스 제외)</p>
            </div>
            <div>
              <strong>• 수료증 진위 확인</strong>
              <p>발급된 수료증의 우측 하단 고유 발급번호(CERT-2026-XXXXX)는 수료증 진위 확인 페이지를 통해 즉시 진위 조회가 가능합니다.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Certificate Modal */}
      {activeCert && (
        <CertificateModal 
          certificate={activeCert} 
          onClose={() => setActiveCert(null)} 
        />
      )}

      {/* Payment Info Modal */}
      {showPaymentInfoModal && (
        <div 
          className="modal-backdrop" 
          style={{ zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentInfoModal(false); }}
        >
          <div className="modal-card" style={{ maxWidth: '480px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <CreditCard size={18} />
                </div>
                <h3 className="heading-3 font-serif" style={{ margin: 0 }}>교학처 대면 수납 안내</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPaymentInfoModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#92400E', lineHeight: '1.6' }}>
                사단법인 세화불학원은 학사 관리를 위해 <strong>교학처 대면 및 전용 계좌 수납</strong>을 진행하고 있습니다.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px', color: 'var(--color-charcoal)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <MapPin size={18} color="var(--color-sage)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>교학처 방문 위치</strong>
                  <div style={{ color: '#64748B', marginTop: '2px' }}>서울 종로구 삼봉로 81, 613호 (수송동, 두산위브파빌리온)</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CreditCard size={18} color="var(--color-sage)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>수납 전용 계좌 (농협)</strong>
                  <div style={{ color: 'var(--color-charcoal)', fontWeight: 600, marginTop: '2px' }}>농협 301-0264-3664-41 <span style={{ fontWeight: 400, color: '#64748B' }}>(사단법인 세화불학원)</span></div>
                  <div style={{ color: '#94A3B8', fontSize: '12px' }}>* 입금자명에 학인 성명을 기재해 주시면 신속히 수강 승인됩니다.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Mail size={18} color="var(--color-sage)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>수납 및 학사 문의 이메일</strong>
                  <div style={{ color: '#64748B', marginTop: '2px' }}>sehwaba@gmail.com (평일 09:00 ~ 17:00)</div>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontWeight: 700 }}
              onClick={() => setShowPaymentInfoModal(false)}
            >
              확인하였습니다
            </button>
          </div>
        </div>
      )}

      {/* Course Qualification Exam Modal */}
      {activeExamCourse && (
        <CourseExamModal
          course={activeExamCourse}
          onClose={() => setActiveExamCourse(null)}
          onOpenCertificate={(c) => {
            setActiveExamCourse(null);
            handleOpenCert(c);
          }}
        />
      )}
    </div>
  );
}
