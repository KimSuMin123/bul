import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Clock, BookOpen, User, CheckCircle, ArrowLeft,
  Lock, PlayCircle, ShieldCheck, ChevronRight, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { useModalAlert } from '../context/ModalAlertContext';
import { APPROVAL_SCHEDULE, PAYMENT_ACCOUNT, enrollmentConfirmation } from '../config/sitePolicy.js';

export default function CourseDetailPage({ courseId, onNavigate, onStartLecture }) {
  const {
    courses, lectures, enrollments, hasCourseAccess, hasLectureAccess, enrollStudent,
    isLectureLocked, getLectureProgress
  } = useCourse();
  const { currentUser } = useAuth();
  const { showConfirm, showAlert } = useModalAlert();
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);

  const course = courses.find(c => c.id === courseId) || null;
  const courseLectures = useMemo(() => {
    if (!course) return [];
    return lectures
      .filter(l => l.courseId === course.id)
      .sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
  }, [lectures, course?.id]);

  const isEnrolled = hasCourseAccess(currentUser?.id, course?.id);
  const userEnr = enrollments.find(e => e.userId === currentUser?.id && e.courseId === course?.id);
  const isPending = userEnr?.status === 'pending' || userEnr?.status === 'applied';

  // Group lectures into collapsible parts (10 lectures per part)
  const chunkSize = 10;
  const lectureGroups = useMemo(() => {
    const groups = [];
    for (let i = 0; i < courseLectures.length; i += chunkSize) {
      const slice = courseLectures.slice(i, i + chunkSize);
      const startNum = slice[0]?.orderIndex;
      const endNum = slice[slice.length - 1]?.orderIndex;
      const partIndex = Math.floor(i / chunkSize) + 1;
      groups.push({
        id: `part-${partIndex}`,
        partIndex,
        title: `제${partIndex}부: 제${String(startNum).padStart(2, '0')}강 ~ 제${String(endNum).padStart(2, '0')}강`,
        lectures: slice
      });
    }
    return groups;
  }, [courseLectures]);

  // Open groups state (Set of group IDs)
  const [openGroupIds, setOpenGroupIds] = useState(() => new Set(['part-1']));

  // Automatically open the part that contains the current/next lecture
  useEffect(() => {
    if (courseLectures.length === 0) return;
    let targetPartId = 'part-1';
    for (let i = 0; i < courseLectures.length; i++) {
      const lec = courseLectures[i];
      const prog = getLectureProgress(currentUser?.id, lec.id);
      const isDone = prog?.completed || (Number(prog?.progressRate) || 0) >= 95;
      if (!isDone) {
        const partIdx = Math.floor(i / chunkSize) + 1;
        targetPartId = `part-${partIdx}`;
        break;
      }
    }
    setOpenGroupIds(new Set([targetPartId]));
  }, [courseLectures, currentUser?.id, getLectureProgress]);

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

  const handleApplyCourse = async () => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    try {
      if (!currentUser) {
        const ok = await showConfirm('수강 신청을 위해 로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?', {
          title: '로그인 필요 안내',
          type: 'info',
          confirmText: '로그인하기'
        });
        if (ok) {
          onNavigate('login');
        }
        return;
      }

      if (!course) return;

      await enrollStudent(currentUser.id, course.id, 'pending');
      await showAlert(enrollmentConfirmation(course), {
        title: '수강 신청 완료',
        type: 'success'
      });
      onNavigate('dashboard');
    } catch (error) {
      await showAlert(error.message || '수강 신청을 저장하지 못했습니다. 다시 시도해 주세요.', {
        type: 'error', title: '수강 신청 실패'
      });
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  };

  if (!course) {
    if (courses.length === 0) {
      return (
        <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div className="card" style={{ padding: '40px 20px', maxWidth: '480px', margin: '0 auto' }}>
            <p className="text-body" style={{ color: 'var(--color-text-muted)' }}>
              강좌 정보를 불러오는 중입니다...
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px 20px', maxWidth: '480px', margin: '0 auto' }}>
          <h2 className="heading-1 font-serif" style={{ fontSize: '22px', marginBottom: '12px' }}>
            강좌를 찾을 수 없습니다
          </h2>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            요청하신 강좌 정보가 존재하지 않거나 삭제되었습니다.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('home')}>
            강좌 목록으로 이동
          </button>
        </div>
      </div>
    );
  }

  const handleLectureClick = (lec) => {
    if (!hasLectureAccess(currentUser?.id, lec.id)) {
      if (isPending) {
        showAlert('수강 신청 접수 상태입니다. 4강부터는 교학처 수강료 납부 및 승인 후 수강하실 수 있습니다. (1~3강은 결제 전 무료 미리보기 가능)', { type: 'warning', title: '수강 권한 안내' });
      } else {
        showAlert('본 강좌의 수강 권한이 필요합니다. 먼저 [수강 신청 접수하기]를 진행하시면 1~3강을 즉시 미리 수강하실 수 있습니다.', { type: 'warning', title: '수강 권한 안내' });
      }
      return;
    }

    const locked = isLectureLocked(currentUser?.id, lec.id);
    if (locked) {
      showAlert(`이전 차시(제${Number(lec.orderIndex) - 1}강)를 80% 이상 수강하셔야 다음 차시를 수강하실 수 있습니다. (순차 학습 적용)`, {
        type: 'warning',
        title: '🔒 순차 학습 잠금 안내'
      });
      return;
    }

    onStartLecture(lec.id);
  };

  return (
    <div style={{ padding: '36px 0 70px 0' }}>
      <div className="container">

        {/* Back Button */}
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '20px' }}
          onClick={() => onNavigate('home')}
        >
          <ArrowLeft size={15} />
          <span>전체 강좌 목록으로</span>
        </button>

        {/* Course Hero Banner */}
        <div
          className="card"
          style={{
            padding: '36px',
            marginBottom: '36px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-sage">
                {course.category}
              </span>
              <span className="badge badge-neutral">
                {courseLectures.length}강 완성
              </span>
              <span className="badge badge-sage" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} />
                <span>{course.certType || '자격 연계 과정'}</span>
              </span>
            </div>

            <h1 className="heading-1 font-serif" style={{ fontSize: '28px' }}>
              {course.title}
            </h1>

            <p style={{ fontSize: '15px', color: '#64748B', maxWidth: '780px', lineHeight: '1.7' }}>
              {course.subtitle || '불교 전통 의식과 의례의 깊은 뜻을 바르게 학습하고 익히는 공인 전문 과정입니다.'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '10px', flexWrap: 'wrap' }}>
              <div>
                <span className="text-caption" style={{ display: 'block', marginBottom: '2px' }}>수강 인정 기간</span>
                <strong>{course.defaultPeriodDays}일 (수강 승인일 기준)</strong>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }} />
              <div>
                <span className="text-caption" style={{ display: 'block', marginBottom: '2px' }}>학습 방식</span>
                <strong style={{ color: course.sequentialUnlock !== false ? 'var(--color-amber-dark)' : 'inherit' }}>
                  {course.sequentialUnlock !== false ? '🔒 차시별 순차 학습' : '자유 수강'}
                </strong>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }} />
              <div>
                <span className="text-caption" style={{ display: 'block', marginBottom: '2px' }}>담당 교수/강사</span>
                <strong>{course.instructor || '세화불학원 교수진'}</strong>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
              {isEnrolled ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    if (courseLectures.length > 0) {
                      // Find first uncompleted and unlocked lecture
                      const firstAvail = courseLectures.find(l => !isLectureLocked(currentUser?.id, l.id)) || courseLectures[0];
                      onStartLecture(firstAvail.id);
                    }
                  }}
                >
                  <PlayCircle size={18} />
                  <span>내 강의실 바로 수강하기</span>
                </button>
              ) : isPending ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={() => {
                        const firstAvail = courseLectures.find(l => hasLectureAccess(currentUser?.id, l.id) && !isLectureLocked(currentUser?.id, l.id)) || courseLectures[0];
                        if (firstAvail) onStartLecture(firstAvail.id);
                      }}
                      style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', border: 'none', color: '#FFFFFF', fontWeight: 700 }}
                    >
                      <PlayCircle size={18} />
                      <span>1~3강 바로 수강하기 (무료 체험)</span>
                    </button>
                    <span className="badge badge-amber" style={{ padding: '8px 14px', fontSize: '13px' }}>
                      교학처 수납 대기 중 (4강부터 수납 후 승인)
                    </span>
                  </div>
                  <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                    {PAYMENT_ACCOUNT} | {APPROVAL_SCHEDULE}
                  </span>
                </div>
              ) : (
                <button
                  className="btn btn-amber btn-lg"
                  onClick={handleApplyCourse}
                  disabled={applying}
                  aria-busy={applying}
                >
                  <span>{applying ? '수강 신청 처리 중...' : '수강 신청 접수하기'}</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Course Curriculum Header & Collapsible Controls */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="heading-2 font-serif" style={{ fontSize: '22px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={22} color="var(--color-sage)" />
                <span>강의 상세 커리큘럼 ({courseLectures.length}차시)</span>
              </h2>
              <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
                {course.sequentialUnlock !== false ? '• 본 과정은 이전 차시 진도율이 80% 이상이면 다음 차시가 열리는 [순차 학습]이 적용되어 있습니다.' : '• 자유롭게 원하는 차시를 선택하여 수강하실 수 있습니다.'}
              </p>
            </div>

            {/* Accordion Controls */}
            {lectureGroups.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={expandAll}
                >
                  <ChevronDown size={14} />
                  <span>전체 펼치기</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={collapseAll}
                >
                  <ChevronUp size={14} />
                  <span>전체 접기</span>
                </button>
              </div>
            )}
          </div>

          {/* Grouped Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {lectureGroups.map((group) => {
              const isOpen = openGroupIds.has(group.id);
              // Calculate stats for this group
              const completedCount = group.lectures.filter(l => {
                const p = getLectureProgress(currentUser?.id, l.id);
                return p && (p.completed || (Number(p.progressRate) || 0) >= 95);
              }).length;
              const hasLockedInGroup = group.lectures.some(l => isLectureLocked(currentUser?.id, l.id));

              return (
                <div
                  key={group.id}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                    boxShadow: isOpen ? '0 4px 14px rgba(0,0,0,0.04)' : 'none'
                  }}
                >
                  {/* Group Header (Clickable Accordion) */}
                  <div
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      padding: '16px 20px',
                      backgroundColor: isOpen ? 'var(--color-surface-warm)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: isOpen ? '1px solid var(--color-border)' : 'none',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: isOpen ? 'var(--color-sage)' : '#E2E8F0',
                          color: isOpen ? '#FFFFFF' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px'
                        }}
                      >
                        {group.partIndex}부
                      </div>
                      <div>
                        <h3 style={{ fontSize: '15.5px', fontWeight: 700, margin: 0, color: 'var(--color-charcoal)' }}>
                          {group.title}
                        </h3>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          총 {group.lectures.length}개 차시
                          {isEnrolled && (
                            <span> • 완강: <strong style={{ color: 'var(--color-sage)' }}>{completedCount}</strong>/{group.lectures.length}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isEnrolled && completedCount === group.lectures.length && (
                        <span className="badge badge-sage" style={{ fontSize: '11px' }}>
                          <CheckCircle size={12} />
                          파트 완강
                        </span>
                      )}
                      {isEnrolled && hasLockedInGroup && completedCount < group.lectures.length && (
                        <span className="badge badge-neutral" style={{ fontSize: '11px', color: '#64748B' }}>
                          <Lock size={11} />
                          순차 잠금 포함
                        </span>
                      )}
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isOpen ? '#FFFFFF' : 'var(--color-surface-warm)',
                          color: 'var(--color-charcoal)'
                        }}
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Group Lecture Items (Collapsed when !isOpen) */}
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {group.lectures.map((lec, idx) => {
                        const prog = getLectureProgress(currentUser?.id, lec.id);
                        const isEpCompleted = Boolean(prog && (prog.completed || (Number(prog.progressRate) || 0) >= 95));
                        const isEpLocked = isLectureLocked(currentUser?.id, lec.id);
                        const isLastInGroup = idx === group.lectures.length - 1;

                        return (
                          <div
                            key={lec.id}
                            style={{
                              padding: '16px 20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '16px',
                              backgroundColor: isEpLocked ? '#FBFBFC' : '#FFFFFF',
                              borderBottom: isLastInGroup ? 'none' : '1px solid var(--color-border)',
                              opacity: isEpLocked ? 0.78 : 1,
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                              {/* Order Number / Status Icon */}
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: isEpCompleted
                                    ? 'var(--color-sage-subtle, #E8F5E9)'
                                    : isEpLocked
                                      ? '#F1F5F9'
                                      : 'var(--color-surface-warm)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  color: isEpCompleted
                                    ? 'var(--color-sage)'
                                    : isEpLocked
                                      ? '#94A3B8'
                                      : 'var(--color-charcoal)',
                                  flexShrink: 0
                                }}
                              >
                                {isEpCompleted ? (
                                  <CheckCircle size={18} color="var(--color-sage)" />
                                ) : isEpLocked ? (
                                  <Lock size={16} color="#94A3B8" />
                                ) : (
                                  <span>{lec.orderIndex}강</span>
                                )}
                              </div>

                              {/* Title & Description */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                  <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-charcoal)' }}>
                                    {lec.title}
                                  </h4>
                                  {isEpCompleted && (
                                    <span className="badge badge-sage" style={{ fontSize: '11px', padding: '1px 7px' }}>
                                      완강
                                    </span>
                                  )}
                                  {isEpLocked && (isEnrolled || hasLectureAccess(currentUser?.id, lec.id)) && (
                                    <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '1px 7px', color: '#64748B' }}>
                                      선수 차시 수강 필요
                                    </span>
                                  )}
                                  {!isEnrolled && isPending && hasLectureAccess(currentUser?.id, lec.id) && (
                                    <span className="badge" style={{ fontSize: '11px', padding: '1px 7px', backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', fontWeight: 600 }}>
                                      무료 체험 (1~3강)
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: '12.5px', color: '#64748B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '640px' }}>
                                  {lec.description || `${lec.orderIndex}차시 본 강의 및 심화 실습`}
                                </p>
                              </div>
                            </div>

                            {/* Duration & Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                              <span className="text-caption" style={{ whiteSpace: 'nowrap' }}>
                                약 {Math.round((lec.durationSeconds || 2400) / 60)}분
                              </span>

                              {hasLectureAccess(currentUser?.id, lec.id) ? (
                                isEpLocked ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      backgroundColor: '#F1F5F9',
                                      color: '#64748B',
                                      borderColor: '#CBD5E1',
                                      fontSize: '12.5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                    onClick={() => handleLectureClick(lec)}
                                    title="이전 차시를 80% 이상 수강하셔야 본 차시를 수강하실 수 있습니다."
                                  >
                                    <Lock size={13} color="#94A3B8" />
                                    <span>잠김</span>
                                  </button>
                                ) : isEpCompleted ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      fontSize: '12.5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                    onClick={() => handleLectureClick(lec)}
                                  >
                                    <PlayCircle size={13} />
                                    <span>복습 수강</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{
                                      fontSize: '12.5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      ...(isPending && !isEnrolled ? { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', border: 'none' } : {})
                                    }}
                                    onClick={() => handleLectureClick(lec)}
                                  >
                                    <PlayCircle size={13} />
                                    <span>{isPending && !isEnrolled ? '미리보기 수강' : '수강하기'}</span>
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => showAlert(isPending ? '수강 신청 접수 상태입니다. 4강부터는 교학처 수납 승인 후 수강하실 수 있습니다. (1~3강은 결제 전 무료 미리보기 가능)' : '본 강좌의 수강 권한이 필요합니다. 먼저 [수강 신청 접수하기]를 진행하시면 1~3강을 즉시 미리 수강하실 수 있습니다.', { type: 'warning', title: '수강 권한 안내' })}
                                  style={{ fontSize: '12.5px' }}
                                >
                                  <Lock size={13} color="var(--color-coral)" />
                                  <span>{isPending ? '수납 대기' : '잠김'}</span>
                                </button>
                              )}
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
  );
}
