import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock, CheckCircle, FileText, Download, ChevronLeft,
  ChevronRight, BookOpen, Clock, AlertTriangle, ArrowLeft, MessageSquare,
  ChevronDown, ChevronUp, Layers, Shield
} from 'lucide-react';
import VideoPlayer from '../components/player/VideoPlayer';
import AccessDeniedModal from '../components/common/AccessDeniedModal';
import LectureQABoard from '../components/qa/LectureQABoard';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { useModalAlert } from '../context/ModalAlertContext';

export default function WatchPage({ lectureId, onNavigate, onSelectLecture }) {
  const { currentUser, isAdmin } = useAuth();
  const { showAlert, showConfirm } = useModalAlert();
  const {
    lectures, courses, enrollments, hasLectureAccess, isLectureLocked,
    getLectureProgress, qaPosts, adminBypassLock, toggleAdminBypassLock
  } = useCourse();

  const [currentLecture, setCurrentLecture] = useState(null);
  const [course, setCourse] = useState(null);
  const [showDeniedModal, setShowDeniedModal] = useState(false);
  const [unauthorizedCourseTitle, setUnauthorizedCourseTitle] = useState('');

  // Tab state: 'info' | 'qa'
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || '').has('question') ? 'qa' : 'info');
  useEffect(() => {
    const selectLinkedQuestion = () => {
      if (new URLSearchParams(window.location.hash.split('?')[1] || '').has('question')) setActiveTab('qa');
    };
    selectLinkedQuestion();
    window.addEventListener('hashchange', selectLinkedQuestion);
    return () => window.removeEventListener('hashchange', selectLinkedQuestion);
  }, [lectureId]);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [seekTrigger, setSeekTrigger] = useState(null);

  // Find lecture and course
  useEffect(() => {
    if (lectures.length === 0) return;
    const lec = lectures.find(l => l.id === lectureId) || null;
    if (lec) {
      setCurrentLecture(lec);
      const c = courses.find(item => item.id === lec.courseId);
      setCourse(c);

      // Verify expiration
      const userEnr = enrollments.find(e => e.userId === currentUser?.id && e.courseId === lec.courseId);
      const isExpired = userEnr?.expireAt && new Date(userEnr.expireAt) < new Date(new Date().toDateString());

      // Verify Access Permission (RBAC)
      if (isExpired) {
        setUnauthorizedCourseTitle(`${c ? c.title : '해당 강좌'} (수강 기간이 만료되었습니다)`);
        setShowDeniedModal(true);
      } else if (!hasLectureAccess(currentUser?.id, lec.id)) {
        setUnauthorizedCourseTitle(c ? c.title : '해당 강좌');
        setShowDeniedModal(true);
      } else {
        setShowDeniedModal(false);
      }
    } else {
      setCurrentLecture(null);
    }
  }, [lectureId, lectures, courses, enrollments, currentUser?.id, hasLectureAccess]);

  // Course playlist
  const courseLectures = useMemo(() => {
    if (!course) return [];
    return lectures
      .filter(l => l.courseId === course.id)
      .sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
  }, [lectures, course?.id]);

  // Group playlist into collapsible parts (10 lectures per part)
  const chunkSize = 10;
  const lectureGroups = useMemo(() => {
    const groups = [];
    for (let i = 0; i < courseLectures.length; i += chunkSize) {
      const slice = courseLectures.slice(i, i + chunkSize);
      const startNum = slice[0]?.orderIndex;
      const endNum = slice[slice.length - 1]?.orderIndex;
      const partIndex = Math.floor(i / chunkSize) + 1;
      groups.push({
        id: `watch-part-${partIndex}`,
        partIndex,
        title: `제${partIndex}부: 제${String(startNum).padStart(2, '0')}강 ~ 제${String(endNum).padStart(2, '0')}강`,
        lectures: slice
      });
    }
    return groups;
  }, [courseLectures]);

  // Open groups state in sidebar
  const [openGroupIds, setOpenGroupIds] = useState(() => new Set(['watch-part-1']));

  // Automatically open the part that contains currentLecture
  useEffect(() => {
    if (!currentLecture || courseLectures.length === 0) return;
    const curIdx = courseLectures.findIndex(l => l.id === currentLecture.id);
    if (curIdx >= 0) {
      const partIdx = Math.floor(curIdx / chunkSize) + 1;
      setOpenGroupIds(new Set([`watch-part-${partIdx}`]));
    }
  }, [currentLecture?.id, courseLectures.length]);

  const toggleGroup = (groupId) => {
    setOpenGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenGroupIds(new Set(lectureGroups.map(g => g.id)));
  };

  const collapseAll = () => {
    setOpenGroupIds(new Set());
  };

  if (!currentLecture || !course) {
    if (lectures.length === 0) {
      return (
        <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div className="card" style={{ padding: '40px 20px', maxWidth: '480px', margin: '0 auto' }}>
            <p className="text-body" style={{ color: 'var(--color-text-muted)' }}>
              강의 정보를 불러오는 중입니다...
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px 20px', maxWidth: '480px', margin: '0 auto' }}>
          <h2 className="heading-1 font-serif" style={{ fontSize: '22px', marginBottom: '12px' }}>
            강의를 찾을 수 없습니다
          </h2>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            요청하신 강의 차시가 존재하지 않거나 삭제되었습니다.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('dashboard')}>
            내 강의실로 돌아가기
          </button>
        </div>
      </div>
    );
  }

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
      showAlert(`이전 차시(제${Number(targetLec.orderIndex) - 1}강)를 80% 이상 수강하셔야 다음 차시를 수강하실 수 있습니다. (순차 학습 적용)`, {
        type: 'warning',
        title: '🔒 순차 학습 잠금 안내'
      });
      return;
    }

    onSelectLecture(targetLec.id);
  };

  const handleVideoEnded = () => {
    // If there's a next lecture, notify user
    if (nextLec) {
      setTimeout(async () => {
        const ok = await showConfirm(`제${currentLecture.orderIndex}강을 완강하셨습니다!\n다음 차시(제${nextLec.orderIndex}강)로 바로 이동하시겠습니까?`, {
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

        {/* Top Header & Breadcrumb & Admin Bypass Controls */}
        <div className="watch-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="watch-breadcrumb-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('dashboard')} style={{ whiteSpace: 'nowrap' }}>
              <ArrowLeft size={15} />
              <span>내 강의실로 돌아가기</span>
            </button>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>/</span>
            <span className="watch-breadcrumb-title" style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-sage)' }}>{course.title}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Admin Bypass Lock Test Switch */}
            {isAdmin && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFFFFF',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: adminBypassLock ? '1px solid #16A34A' : '1px solid #D97706',
                  fontSize: '12px'
                }}
              >
                <span style={{ fontWeight: 700, color: adminBypassLock ? '#16A34A' : '#D97706' }}>
                  {adminBypassLock ? '🔓 관리자 프리패스 ON (잠금 해제)' : '🔒 순차 잠금 테스트 중 (잠금 적용)'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                  onClick={toggleAdminBypassLock}
                  title="관리자 권한으로 잠금을 강제 해제하거나 일반 학생과 동일한 잠금을 테스트합니다."
                >
                  {adminBypassLock ? '잠금 테스트하기' : '프리패스 켜기'}
                </button>
              </div>
            )}

            <div className="badge badge-sage" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
              {currentLecture.orderIndex}차시 / 총 {courseLectures.length}차시
            </div>
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
                  padding: '40px 24px'
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(217, 119, 6, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}
                >
                  <Lock size={36} color="var(--color-amber)" />
                </div>
                <h3 className="heading-2" style={{ color: '#FFFFFF', marginBottom: '8px' }}>
                  선수 차시 학습이 필요합니다 (순차 학습 잠금)
                </h3>
                <p style={{ color: '#CBD5E1', fontSize: '14px', maxWidth: '460px', lineHeight: '1.6', marginBottom: '20px' }}>
                  본 과정은 단계별 체계적인 학습을 위해 <strong>이전 차시(제{Number(currentLecture.orderIndex) - 1}강)를 80% 이상 수강</strong>하셔야 본 차시가 오픈됩니다.
                </p>
                {prevLec && (
                  <button className="btn btn-amber btn-sm" onClick={() => handleSelectEpisode(prevLec)}>
                    <ChevronLeft size={15} />
                    <span>이전 제{prevLec.orderIndex}강 학습하러 가기</span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-sage">
                      제{currentLecture.orderIndex}강
                    </span>
                    <span className="badge badge-neutral">
                      약 {Math.round((currentLecture.durationSeconds || 2400) / 60)}분
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '14.5px', color: '#4A5568', lineHeight: '1.7', marginBottom: '24px' }}>
                  {currentLecture.description || `${course.title}의 ${currentLecture.orderIndex}차시 강의입니다. 경전과 의식집의 핵심 구절을 살피며 심도 있는 해설과 집전 방법을 학습합니다.`}
                </p>

                {/* Attachments Download */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} color="var(--color-sage)" />
                    <span>학습 교안 및 교재 다운로드</span>
                  </h4>
                  {currentLecture.attachments && currentLecture.attachments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentLecture.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.url}
                          download={att.name}
                          className="btn btn-secondary btn-sm"
                          style={{ justifyContent: 'space-between', padding: '10px 16px', fontSize: '13px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={14} color="var(--color-sage)" />
                            <span>{att.name}</span>
                          </div>
                          <Download size={14} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '14px', backgroundColor: 'var(--color-surface-warm)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      본 차시에는 별도 첨부된 PDF 교안이 없습니다. 영상 내 자막과 강의 교재를 참고해 주십시오.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Q&A Board */}
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

          {/* Right Column: Lecture Curriculum Playlist (Collapsible Accordion by Parts) */}
          <div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                <div>
                  <h3 className="heading-3 font-serif" style={{ fontSize: '17px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={17} color="var(--color-sage)" />
                    <span>강의 커리큘럼 목차</span>
                  </h3>
                  <p className="text-caption" style={{ marginTop: '4px', marginBottom: 0 }}>
                    {course.sequentialUnlock !== false ? '🔒 순차 학습 적용 (80% 이상 시 오픈)' : '자유 수강 코스'}
                  </p>
                </div>

                {/* Quick Toggle All */}
                {lectureGroups.length > 1 && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '3px 6px', color: '#64748B' }}
                      onClick={expandAll}
                      title="모든 파트 펼치기"
                    >
                      전체 펼침
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '3px 6px', color: '#64748B' }}
                      onClick={collapseAll}
                      title="모든 파트 접기"
                    >
                      접기
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                {lectureGroups.map((group) => {
                  const isOpen = openGroupIds.has(group.id);
                  const isCurrentInGroup = group.lectures.some(l => l.id === currentLecture.id);
                  const completedInGroup = group.lectures.filter(l => {
                    const p = getLectureProgress(currentUser?.id, l.id);
                    return p && (p.completed || (Number(p.progressRate) || 0) >= 95);
                  }).length;

                  return (
                    <div
                      key={group.id}
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        border: isCurrentInGroup ? '1.5px solid var(--color-sage)' : '1px solid var(--color-border)',
                        overflow: 'hidden',
                        backgroundColor: '#FFFFFF'
                      }}
                    >
                      {/* Part Accordion Header */}
                      <div
                        onClick={() => toggleGroup(group.id)}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: isCurrentInGroup ? 'var(--color-surface-warm)' : '#F8FAFC',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          userSelect: 'none',
                          borderBottom: isOpen ? '1px solid var(--color-border)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isCurrentInGroup ? 'var(--color-sage)' : '#E2E8F0',
                              color: isCurrentInGroup ? '#FFFFFF' : '#475569'
                            }}
                          >
                            {group.partIndex}부
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-charcoal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {group.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            {completedInGroup}/{group.lectures.length}
                          </span>
                          {isOpen ? <ChevronUp size={14} color="#64748B" /> : <ChevronDown size={14} color="#64748B" />}
                        </div>
                      </div>

                      {/* Part Lecture Items */}
                      {isOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px' }}>
                          {group.lectures.map((lec) => {
                            const isCurrent = lec.id === currentLecture.id;
                            const prog = getLectureProgress(currentUser?.id, lec.id);
                            const isEpCompleted = Boolean(prog && (prog.completed || (Number(prog.progressRate) || 0) >= 95));
                            const isEpLocked = isLectureLocked(currentUser?.id, lec.id);
                            const hasEpAccess = hasLectureAccess(currentUser?.id, lec.id);

                            return (
                              <div
                                key={lec.id}
                                onClick={() => handleSelectEpisode(lec)}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: isCurrent ? 'var(--color-surface-warm)' : '#FFFFFF',
                                  border: isCurrent ? '1.5px solid var(--color-sage)' : '1px solid transparent',
                                  cursor: 'pointer',
                                  transition: 'var(--transition)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  opacity: isEpLocked ? 0.72 : 1
                                }}
                              >
                                {/* Status Icon */}
                                <div style={{ flexShrink: 0 }}>
                                  {isEpCompleted ? (
                                    <CheckCircle size={16} color="var(--color-sage)" />
                                  ) : !hasEpAccess ? (
                                    <Lock size={15} color="var(--color-coral)" />
                                  ) : isEpLocked ? (
                                    <Lock size={15} color="#94A3B8" />
                                  ) : (
                                    <div
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        border: '1.5px solid #CBD5E1',
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
                                <div style={{ width: '42px', height: '26px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1E2022', flexShrink: 0 }}>
                                  <img
                                    src={lec.thumbnail || course?.thumbnail}
                                    alt={lec.title}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '12.5px', fontWeight: isCurrent ? 700 : 500, color: 'var(--color-charcoal)', lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {lec.orderIndex}강. {lec.title}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    <span>{Math.round((lec.durationSeconds || 2400) / 60)}분</span>
                                    <span>•</span>
                                    <span>
                                      {isEpCompleted ? '완강 (100%)' : isEpLocked ? '🔒 이전 강의 80% 필요' : prog?.progressRate > 0 ? `진도 ${prog.progressRate}%` : '미수강'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
