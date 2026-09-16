import React, { useState, useEffect } from 'react';
import { 
  Lock, CheckCircle, FileText, Download, ChevronLeft, 
  ChevronRight, BookOpen, Clock, AlertTriangle, ArrowLeft, MessageSquare 
} from 'lucide-react';
import VideoPlayer from '../components/player/VideoPlayer';
import AccessDeniedModal from '../components/common/AccessDeniedModal';
import LectureQABoard from '../components/qa/LectureQABoard';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { useModalAlert } from '../context/ModalAlertContext';

export default function WatchPage({ lectureId, onNavigate, onSelectLecture }) {
  const { currentUser } = useAuth();
  const { showConfirm } = useModalAlert();
  const { 
    lectures, courses, hasLectureAccess, isLectureLocked, 
    getLectureProgress, qaPosts 
  } = useCourse();

  const [currentLecture, setCurrentLecture] = useState(null);
  const [course, setCourse] = useState(null);
  const [showDeniedModal, setShowDeniedModal] = useState(false);
  const [unauthorizedCourseTitle, setUnauthorizedCourseTitle] = useState('');
  
  // Tab state: 'info' | 'qa'
  const [activeTab, setActiveTab] = useState('info');
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [seekTrigger, setSeekTrigger] = useState(null);

  // Find lecture and course
  useEffect(() => {
    const lec = lectures.find(l => l.id === lectureId) || lectures[0];
    if (lec) {
      setCurrentLecture(lec);
      const c = courses.find(item => item.id === lec.courseId);
      setCourse(c);

      // Verify Access Permission (RBAC)
      if (!hasLectureAccess(currentUser?.id, lec.id)) {
        setUnauthorizedCourseTitle(c ? c.title : '해당 강좌');
        setShowDeniedModal(true);
      } else {
        setShowDeniedModal(false);
      }
    }
  }, [lectureId, lectures, courses, currentUser?.id, hasLectureAccess]);

  if (!currentLecture || !course) {
    return (
      <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
        <p>강의 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  // Course playlist
  const courseLectures = lectures
    .filter(l => l.courseId === course.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const currentIndex = courseLectures.findIndex(l => l.id === currentLecture.id);
  const prevLec = currentIndex > 0 ? courseLectures[currentIndex - 1] : null;
  const nextLec = currentIndex < courseLectures.length - 1 ? courseLectures[currentIndex + 1] : null;

  const handleSelectEpisode = (targetLec) => {
    // Check RBAC
    if (!hasLectureAccess(currentUser?.id, targetLec.id)) {
      setUnauthorizedCourseTitle(course.title);
      setShowDeniedModal(true);
      return;
    }

    // Check sequential lock
    if (isLectureLocked(currentUser?.id, targetLec.id)) {
      alert('이전 차시를 100% 완강하셔야 다음 차시를 수강하실 수 있습니다. (순차 학습 적용)');
      return;
    }

    onSelectLecture(targetLec.id);
  };

  const handleVideoEnded = () => {
    // If there's a next lecture, notify user
    if (nextLec) {
      setTimeout(async () => {
        const ok = await showConfirm('현재 차시를 완강하셨습니다! 다음 차시로 바로 이동하시겠습니까?', {
          title: '🎉 차시 완강 축하',
          type: 'success',
          confirmText: '다음 차시 이동'
        });
        if (ok) {
          handleSelectEpisode(nextLec);
        }
      }, 500);
    }
  };

  const hasAccess = hasLectureAccess(currentUser?.id, currentLecture.id);
  const isLocked = isLectureLocked(currentUser?.id, currentLecture.id);

  return (
    <div style={{ padding: '24px 0 60px 0' }}>
      <div className="container">
        
        {/* Top Header & Breadcrumb */}
        <div className="watch-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="watch-breadcrumb-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('dashboard')} style={{ whiteSpace: 'nowrap' }}>
              <ArrowLeft size={15} />
              <span>내 강의실로 돌아가기</span>
            </button>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>/</span>
            <span className="watch-breadcrumb-title" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-sage)' }}>{course.title}</span>
          </div>

          <div className="badge badge-sage" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            {currentLecture.orderIndex}차시 / 총 {courseLectures.length}차시
          </div>
        </div>

        {/* Video Player & Playlist Layout */}
        <div className="watch-layout">
          
          {/* Left Column: Player & Lecture Description */}
          <div>
            {/* If Unauthorized or Locked, show placeholder */}
            {!hasAccess ? (
              <div 
                className="player-wrapper" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#161819',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  padding: '30px'
                }}
              >
                <div 
                  style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%', 
                    background: 'var(--color-coral-subtle)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    marginBottom: '16px' 
                  }}
                >
                  <Lock size={32} color="var(--color-coral)" />
                </div>
                <h3 className="heading-2" style={{ color: '#FFFFFF', marginBottom: '8px' }}>
                  수강 권한이 필요한 강좌입니다
                </h3>
                <p style={{ color: '#A0AEC0', fontSize: '14px', maxWidth: '440px', lineHeight: '1.6', marginBottom: '20px' }}>
                  본 차시는 [{course.title}] 수강생 전용입니다. 교학처 대면 수납 승인 후 시청하실 수 있습니다.
                </p>
                <button className="btn btn-coral btn-sm" onClick={() => setShowDeniedModal(true)}>
                  수강 권한 안내 팝업 확인
                </button>
              </div>
            ) : isLocked ? (
              <div 
                className="player-wrapper" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#161819',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  padding: '30px'
                }}
              >
                <Lock size={40} color="var(--color-amber)" style={{ marginBottom: '14px' }} />
                <h3 className="heading-2" style={{ color: '#FFFFFF', marginBottom: '8px' }}>
                  선수 차시 학습이 필요합니다
                </h3>
                <p style={{ color: '#CBD5E1', fontSize: '14px', maxWidth: '420px', lineHeight: '1.6', marginBottom: '16px' }}>
                  본 코스는 단계별 깊이 있는 이해를 돕기 위해 <strong>이전 차시 완강(100%)</strong> 후 순차적으로 열립니다.
                </p>
                {prevLec && (
                  <button className="btn btn-amber btn-sm" onClick={() => handleSelectEpisode(prevLec)}>
                    이전 {prevLec.orderIndex}차시 학습하러 가기
                  </button>
                )}
              </div>
            ) : (
              <VideoPlayer 
                lecture={{
                  ...currentLecture,
                  thumbnail: currentLecture.thumbnail || course?.thumbnail
                }}
                userId={currentUser?.id}
                onEnded={handleVideoEnded}
                onPrevious={prevLec ? () => handleSelectEpisode(prevLec) : null}
                onNext={nextLec ? () => handleSelectEpisode(nextLec) : null}
                hasPrevious={Boolean(prevLec)}
                hasNext={Boolean(nextLec)}
                seekTime={seekTrigger}
                onCurrentTimeChange={(time) => setCurrentVideoTime(time)}
              />
            )}

            {/* Sub Navigation Tabs: Overview & Materials vs Q&A Board */}
            <div className="watch-tabs-bar" style={{ display: 'flex', gap: '8px', marginTop: '20px', borderBottom: '2px solid var(--color-border)' }}>
              <button
                className={`btn btn-ghost watch-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                style={{
                  borderRadius: '6px 6px 0 0',
                  borderBottom: activeTab === 'info' ? '3px solid var(--color-sage)' : '3px solid transparent',
                  color: activeTab === 'info' ? 'var(--color-sage)' : 'var(--color-text-muted)',
                  fontWeight: activeTab === 'info' ? 700 : 500,
                  padding: '12px 18px',
                  fontSize: '14.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => setActiveTab('info')}
              >
                <FileText size={16} />
                <span>강의 개요 및 교안 자료</span>
              </button>

              <button
                className={`btn btn-ghost watch-tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
                style={{
                  borderRadius: '6px 6px 0 0',
                  borderBottom: activeTab === 'qa' ? '3px solid var(--color-sage)' : '3px solid transparent',
                  color: activeTab === 'qa' ? 'var(--color-sage)' : 'var(--color-text-muted)',
                  fontWeight: activeTab === 'qa' ? 700 : 500,
                  padding: '12px 18px',
                  fontSize: '14.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => setActiveTab('qa')}
              >
                <MessageSquare size={16} />
                <span>학습 질의응답 (Q&A)</span>
                {qaPosts?.filter(p => p.lectureId === currentLecture.id).length > 0 && (
                  <span className="badge badge-amber" style={{ fontSize: '11px', padding: '1px 7px' }}>
                    {qaPosts.filter(p => p.lectureId === currentLecture.id).length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: Overview & Attachments */}
            {activeTab === 'info' && (
              <div className="card" style={{ marginTop: '16px', padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h2 className="heading-1 font-serif" style={{ fontSize: '22px' }}>
                    {currentLecture.title}
                  </h2>
                  <span className="badge badge-neutral">
                    <Clock size={12} />
                    <span>약 {Math.round(currentLecture.durationSeconds / 60)}분</span>
                  </span>
                </div>

                <p style={{ fontSize: '14.5px', color: '#334155', lineHeight: '1.8', marginBottom: '24px' }}>
                  {currentLecture.description}
                </p>

                {/* Attachments Section (PDF 등 교재 다운로드) */}
                {currentLecture.attachments && currentLecture.attachments.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} color="var(--color-sage)" />
                      <span>강의 교안 및 첨부자료 ({currentLecture.attachments.length})</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentLecture.attachments.map((file, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            backgroundColor: 'var(--color-surface-warm)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-warm)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                            <FileText size={15} color="#E06D53" />
                            <span style={{ fontWeight: 500 }}>{file.name}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '11.5px' }}>({file.size})</span>
                          </div>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => alert(`[${file.name}] 교안 다운로드가 시작되었습니다.`)}
                          >
                            <Download size={13} />
                            <span>다운로드</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Learning Q&A Community Board */}
            {activeTab === 'qa' && (
              <div style={{ marginTop: '16px' }}>
                <LectureQABoard
                  lecture={currentLecture}
                  course={course}
                  currentVideoTime={currentVideoTime}
                  onSeek={(targetSec) => {
                    setSeekTrigger({ time: targetSec, key: Date.now() });
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Lecture Curriculum Playlist */}
          <div>
            <div className="card" style={{ padding: '20px' }}>
              <h3 className="heading-3 font-serif" style={{ marginBottom: '6px' }}>
                강의 커리큘럼 목차
              </h3>
              <p className="text-caption" style={{ marginBottom: '16px' }}>
                {course.sequentialUnlock ? '순차 학습 적용 (완강 시 다음 차시 오픈)' : '자유 수강 코스'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {courseLectures.map((lec) => {
                  const isCurrent = lec.id === currentLecture.id;
                  const prog = getLectureProgress(currentUser?.id, lec.id);
                  const isEpCompleted = prog?.completed || prog?.progressRate >= 99;
                  const isEpLocked = isLectureLocked(currentUser?.id, lec.id);
                  const hasEpAccess = hasLectureAccess(currentUser?.id, lec.id);

                  return (
                    <div
                      key={lec.id}
                      onClick={() => handleSelectEpisode(lec)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isCurrent ? 'var(--color-surface-warm)' : '#FFFFFF',
                        border: isCurrent ? '1.5px solid var(--color-sage)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      {/* Status Icon */}
                      <div style={{ marginTop: '2px' }}>
                        {isEpCompleted ? (
                          <CheckCircle size={18} color="var(--color-sage)" />
                        ) : !hasEpAccess ? (
                          <Lock size={17} color="var(--color-coral)" />
                        ) : isEpLocked ? (
                          <Lock size={17} color="#94A3B8" />
                        ) : (
                          <div 
                            style={{ 
                              width: '18px', 
                              height: '18px', 
                              borderRadius: '50%', 
                              border: '2px solid #CBD5E1', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#64748B'
                            }}
                          >
                            {lec.orderIndex}
                          </div>
                        )}
                      </div>

                      {/* Mini Thumbnail */}
                      <div style={{ width: '48px', height: '30px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1E2022', flexShrink: 0, marginTop: '2px' }}>
                        <img 
                          src={lec.thumbnail || course?.thumbnail} 
                          alt={lec.title} 
                          onError={(e) => { e.target.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: isCurrent ? 700 : 500, color: 'var(--color-charcoal)', lineHeight: '1.4' }}>
                          {lec.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                          <span>{Math.round(lec.durationSeconds / 60)}분</span>
                          <span>•</span>
                          <span>
                            {isEpCompleted ? '완강 (100%)' : prog?.progressRate > 0 ? `진도율 ${prog.progressRate}%` : '미수강'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* RBAC Access Denied Sandbox Modal */}
      <AccessDeniedModal
        isOpen={showDeniedModal}
        courseTitle={unauthorizedCourseTitle}
        onClose={() => setShowDeniedModal(false)}
        onNavigateCourses={() => onNavigate('home')}
      />
    </div>
  );
}
