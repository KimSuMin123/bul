import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  MessageSquare, Clock, CheckCircle2, Lock, Unlock, 
  Send, Trash2, Edit3, PlayCircle, PlusCircle, AlertCircle, 
  ChevronDown, ChevronUp, UserCheck, Shield 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { useModalAlert } from '../../context/ModalAlertContext';

export default function LectureQABoard({ 
  lecture, 
  course, 
  lectureId,
  courseId,
  currentVideoTime = 0, 
  onSeek 
}) {
  const { currentUser, isAdmin } = useAuth();
  const { qaPosts, addQAPost, addQAAnswer, deleteQAPost } = useCourse();
  const { showAlert, showConfirm } = useModalAlert();
  const [qaBusy, setQaBusy] = useState(false);
  const qaBusyRef = useRef(false);
  const focusedQuestionLink = useRef(null);
  const runQAAction = async (action) => {
    if (qaBusyRef.current) return;
    qaBusyRef.current = true;
    setQaBusy(true);
    try {
      return await action();
    } catch (error) {
      await showAlert(error.message || '질의응답을 저장하지 못했습니다. 다시 시도해 주세요.', {
        type: 'error', title: '질의응답 처리 실패'
      });
    } finally {
      qaBusyRef.current = false;
      setQaBusy(false);
    }
  };

  const currentLecId = lecture?.id || lectureId || '';
  const currentCrsId = course?.id || courseId || '';

  // Filter: 'all' | 'pending' | 'answered'
  const [filter, setFilter] = useState('all');
  const [showWriteForm, setShowWriteForm] = useState(false);

  // New Question Form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [attachTimestamp, setAttachTimestamp] = useState(false);
  const [timestampSecs, setTimestampSecs] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Admin inline answer state: { [postId]: { showForm: boolean, content: string, monkName: string, badgeTitle: string } }
  const [answerForms, setAnswerForms] = useState({});

  // Questions for this lecture
  const lectureQuestions = useMemo(() => {
    if (!currentLecId) return [];
    return (qaPosts || []).filter(p => p.lectureId === currentLecId);
  }, [qaPosts, currentLecId]);

  useEffect(() => {
    const focusQuestion = () => {
      const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('question');
      if (!id || !lectureQuestions.some(post => post.id === id)) return;
      const target = `${currentLecId}:${id}`;
      if (focusedQuestionLink.current === target) return;
      if (filter !== 'all') { setFilter('all'); return; }
      const element = document.getElementById(`question-${id}`);
      if (!element) return;
      focusedQuestionLink.current = target;
      element?.scrollIntoView({ block: 'center' });
      element?.focus({ preventScroll: true });
    };
    focusQuestion();
    window.addEventListener('hashchange', focusQuestion);
    return () => window.removeEventListener('hashchange', focusQuestion);
  }, [lectureQuestions, filter]);

  // Statistics
  const stats = useMemo(() => {
    const total = lectureQuestions.length;
    const answered = lectureQuestions.filter(q => q.answers && q.answers.length > 0).length;
    const pending = total - answered;
    return { total, answered, pending };
  }, [lectureQuestions]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return lectureQuestions.filter(q => {
      const hasAnswer = q.answers && q.answers.length > 0;
      if (filter === 'pending') return !hasAnswer;
      if (filter === 'answered') return hasAnswer;
      return true;
    });
  }, [lectureQuestions, filter]);

  // Format MM:SS
  const formatTime = (secs) => {
    const totalSecs = Math.floor(secs || 0);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Mask student name for privacy: "김도현" -> "김*현", "이보디" -> "이*디"
  const maskName = (name) => {
    if (!name) return '학인';
    if (name.length <= 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  // Open Form & auto sync current video timestamp
  const handleOpenForm = () => {
    if (!currentUser) {
      showAlert('질문을 작성하시려면 먼저 로그인해 주세요.', { type: 'warning', title: '로그인 필요' });
      return;
    }
    const currentSec = Math.round(currentVideoTime || 0);
    setTimestampSecs(currentSec);
    setAttachTimestamp(currentSec > 5);
    setShowWriteForm(true);
    setFormError('');
  };

  // Attach / update timestamp from live video
  const handleSyncCurrentTime = () => {
    const currentSec = Math.round(currentVideoTime || 0);
    setTimestampSecs(currentSec);
    setAttachTimestamp(true);
  };

  // Submit New Question
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    return runQAAction(async () => {
      setFormError('');

      if (!newTitle.trim()) {
        setFormError('질문 제목을 입력해 주세요.');
        return;
      }
      if (!newContent.trim()) {
        setFormError('질문 내용을 입력해 주세요.');
        return;
      }

      setSubmitting(true);
      try {
        await addQAPost({
          courseId: currentCrsId,
          lectureId: currentLecId,
          title: newTitle,
          content: newContent,
          timestampSeconds: attachTimestamp ? timestampSecs : null,
          isPrivate
        });

        // Reset form
        setNewTitle('');
        setNewContent('');
        setAttachTimestamp(false);
        setIsPrivate(false);
        setShowWriteForm(false);
      } catch (err) {
        setFormError(err.message || '질문 등록 중 오류가 발생했습니다.');
      } finally {
        setSubmitting(false);
      }
    });
  };

  // Toggle Admin Answer Form for a post
  const toggleAnswerForm = (post) => {
    const current = answerForms[post.id];
    const defaultMonk = course?.instructor?.split('(')[0]?.trim() || '지산 스님';
    const defaultBadge = course?.instructor?.includes('원장') ? '불교학술원 원장' : '담당 지도교수';

    setAnswerForms(prev => ({
      ...prev,
      [post.id]: {
        showForm: !current?.showForm,
        content: current?.content || (post.answers?.[0]?.content || ''),
        monkName: current?.monkName || (post.answers?.[0]?.authorName || defaultMonk),
        badgeTitle: current?.badgeTitle || (post.answers?.[0]?.badgeTitle || defaultBadge)
      }
    }));
  };

  // Submit Monk Answer (Admin)
  const handleSubmitAnswer = async (postId) => {
    return runQAAction(async () => {
      const formData = answerForms[postId];
      if (!formData || !formData.content?.trim()) {
        showAlert('답변 내용을 입력해 주세요.', { type: 'warning', title: '입력 확인' });
        return;
      }

      try {
        await addQAAnswer(postId, {
          content: formData.content,
          authorName: formData.monkName || '지산 스님',
          badgeTitle: formData.badgeTitle || '담당 지도교수'
        });

        setAnswerForms(prev => ({
          ...prev,
          [postId]: { ...prev[postId], showForm: false }
        }));
        showAlert('스님 명의의 법문 답변이 성공적으로 등록되었습니다.', { type: 'success', title: '답변 등록 완료' });
      } catch (err) {
        showAlert(err.message, { type: 'error', title: '답변 등록 오류' });
      }
    });
  };

  // Handle Delete
  const handleDelete = async (postId) => {
    return runQAAction(async () => {
      const ok = await showConfirm('정말로 이 질문을 삭제하시겠습니까?\n작성된 답변 내용도 함께 삭제됩니다.', {
        title: '질문 삭제 확인',
        type: 'warning',
        confirmText: '삭제'
      });
      if (ok) {
        try {
          await deleteQAPost(postId);
        } catch (err) {
          showAlert(err.message, { type: 'error', title: '삭제 오류' });
        }
      }
    });
  };

  return (
    <div className="qa-board-wrapper" style={{ marginTop: '4px' }}>
      
      {/* Top Header & Action */}
      <div className="qa-top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
        <div>
          <h3 className="heading-2 font-serif" style={{ fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} color="var(--color-sage)" />
            <span>학습 질의응답 (Q&A)</span>
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '3px', wordBreak: 'keep-all', lineHeight: '1.55' }}>
            강의 내용 중 궁금한 점을 여쭤보시면 담당 지도 스님/교수님께서 직접 답변을 남겨 드립니다.
          </p>
        </div>

        <div className="qa-action-wrap">
          <button 
            className="btn btn-primary btn-sm qa-write-btn"
            onClick={() => setShowWriteForm(!showWriteForm)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            {showWriteForm ? (
              <>
                <ChevronUp size={16} />
                <span>작성 취소</span>
              </>
            ) : (
              <>
                <PlusCircle size={16} />
                <span>스님께 질문 올리기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats and Filter Tabs */}
      <div 
        className="qa-stats-filter-bar"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '10px',
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface-warm)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-warm)',
          marginBottom: '20px'
        }}
      >
        {/* Filter Pills */}
        <div className="qa-filter-pills" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button 
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '5px 10px', whiteSpace: 'nowrap' }}
            onClick={() => setFilter('all')}
          >
            전체 질문 ({stats.total})
          </button>
          <button 
            className={`btn btn-sm ${filter === 'pending' ? 'btn-amber' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '5px 10px', whiteSpace: 'nowrap' }}
            onClick={() => setFilter('pending')}
          >
            답변 대기 ({stats.pending})
          </button>
          <button 
            className={`btn btn-sm ${filter === 'answered' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', padding: '5px 10px', whiteSpace: 'nowrap' }}
            onClick={() => setFilter('answered')}
          >
            답변 완료 ({stats.answered})
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          * 본 차시({lecture.orderIndex}강)에 등록된 질의 목록입니다.
        </div>
      </div>

      {/* New Question Form Card */}
      {showWriteForm && (
        <div 
          className="card qa-write-form-card" 
          style={{ 
            padding: '24px', 
            marginBottom: '28px', 
            border: '2px solid var(--color-sage)',
            boxShadow: '0 8px 24px rgba(59, 82, 73, 0.12)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--color-sage-subtle)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Edit3 size={17} color="var(--color-sage-dark)" />
            </div>
            <div>
              <h4 className="heading-3 font-serif" style={{ fontSize: '17px' }}>
                새로운 학습 질문 작성
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                질문 작성 시점의 영상 타임스탬프를 함께 남기시면 스님께서 훨씬 정확하게 맥락을 파악하실 수 있습니다.
              </p>
            </div>
          </div>

          {formError && (
            <div 
              style={{ 
                padding: '10px 14px', 
                backgroundColor: 'var(--color-coral-subtle)', 
                color: 'var(--color-coral-dark)', 
                borderRadius: 'var(--radius-sm)', 
                fontSize: '13px', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={15} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitQuestion}>
            {/* Title */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                질문 제목
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="예: 사문유관에서 네 번째 문에서 마주한 사문의 역사적 배경이 궁금합니다"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Video Timestamp Attachment Control */}
            <div 
              style={{ 
                backgroundColor: 'var(--color-surface-warm)', 
                padding: '12px 16px', 
                borderRadius: 'var(--radius-sm)', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                border: '1px solid var(--color-border-warm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="attachTimestampCheck"
                  checked={attachTimestamp}
                  onChange={(e) => setAttachTimestamp(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-sage)' }}
                />
                <label htmlFor="attachTimestampCheck" style={{ fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>
                  현재 동영상 재생 위치 <strong>[{formatTime(timestampSecs)}]</strong> 첨부하기
                </label>
              </div>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={handleSyncCurrentTime}
                style={{ fontSize: '12px', padding: '4px 10px' }}
                title="현재 동영상 플레이어의 재생 위치로 갱신합니다"
              >
                <Clock size={13} color="var(--color-amber-dark)" />
                <span>현재 시점({formatTime(currentVideoTime)})으로 갱신</span>
              </button>
            </div>

            {/* Content */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                질문 내용
              </label>
              <textarea 
                className="form-input" 
                rows={5}
                placeholder="스님께 여쭙고 싶은 학문적 의문이나 실천 수행에서의 고민을 편안하게 적어주세요."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>

            {/* Private Mode Toggle & Submit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="isPrivateCheck"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-amber)' }}
                />
                <label htmlFor="isPrivateCheck" style={{ fontSize: '13px', color: '#4A5568', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={13} color="#64748B" />
                  <span>스님/관리자만 볼 수 있는 비밀글로 등록</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowWriteForm(false)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={submitting || qaBusy}
                >
                  <Send size={14} />
                  <span>질문 등록하기</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Question List */}
      {filteredQuestions.length === 0 ? (
        <div 
          className="card" 
          style={{ 
            padding: '50px 20px', 
            textAlign: 'center', 
            color: 'var(--color-text-muted)',
            backgroundColor: 'var(--color-surface-warm)',
            border: '1px dashed var(--color-border-warm)' 
          }}
        >
          <MessageSquare size={36} color="#CBD5E1" style={{ margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-charcoal)', marginBottom: '4px' }}>
            {filter === 'pending' ? '답변 대기 중인 질문이 없습니다.' : filter === 'answered' ? '답변 완료된 질문이 없습니다.' : '아직 등록된 질문이 없습니다.'}
          </p>
          <p style={{ fontSize: '13px', marginBottom: '18px' }}>
            첫 번째 학인이 되어 스님께 지혜의 가르침을 청해 보세요.
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleOpenForm}>
            질문 남기기
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredQuestions.map((post) => {
            const hasAnswer = post.answers && post.answers.length > 0;
            const isAuthor = currentUser?.id === post.authorId;
            const canView = !post.isPrivate || isAuthor || isAdmin;
            const canDelete = isAuthor || isAdmin;
            const hasTimestamp = typeof post.timestampSeconds === 'number' && post.timestampSeconds >= 0;

            return (
              <div 
                key={post.id}
                id={`question-${post.id}`}
                tabIndex={-1}
                className="card qa-question-card" 
                style={{ 
                  padding: '24px', 
                  border: hasAnswer ? '1px solid var(--color-border)' : '1px solid rgba(212, 155, 75, 0.4)',
                  transition: 'var(--transition)'
                }}
              >
                {/* Card Header: Badges & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Status Badge */}
                    {hasAnswer ? (
                      <span className="badge badge-sage" style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                        <CheckCircle2 size={13} />
                        <span>답변 완료</span>
                      </span>
                    ) : (
                      <span className="badge badge-amber" style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                        <Clock size={13} />
                        <span>답변 대기중</span>
                      </span>
                    )}

                    {/* Private Badge */}
                    {post.isPrivate && (
                      <span className="badge badge-neutral" style={{ fontSize: '11.5px', backgroundColor: '#F1F5F9', color: '#475569' }}>
                        <Lock size={12} />
                        <span>비밀글</span>
                      </span>
                    )}

                    {/* Timestamp Jump Badge (Clickable to Seek Video) */}
                    {hasTimestamp && (
                      <button 
                        className="badge" 
                        onClick={() => onSeek && onSeek(post.timestampSeconds)}
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: 'var(--color-sage-subtle)', 
                          color: 'var(--color-sage-dark)',
                          border: '1px solid rgba(59, 82, 73, 0.2)',
                          padding: '3px 9px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'var(--transition)'
                        }}
                        title={`${formatTime(post.timestampSeconds)} 구간으로 동영상 이동`}
                      >
                        <PlayCircle size={13} color="var(--color-sage-dark)" />
                        <strong>{formatTime(post.timestampSeconds)}</strong>
                        <span style={{ fontSize: '11px', opacity: 0.85 }}>구간 질문</span>
                      </button>
                    )}
                  </div>

                  {/* Header Meta: Author & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    <span>
                      {isAuthor ? `${post.authorName} (본인)` : maskName(post.authorName)}
                    </span>
                    <span>•</span>
                    <span>{post.createdAt}</span>

                    {/* Delete button */}
                    {canDelete && (
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ padding: '4px 6px', color: '#94A3B8' }}
                        onClick={() => handleDelete(post.id)}
                        disabled={qaBusy}
                        title="질문 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Secret Question Protected Notice */}
                {!canView ? (
                  <div 
                    style={{ 
                      padding: '24px 16px', 
                      backgroundColor: 'var(--color-surface-warm)', 
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: 'var(--color-text-muted)',
                      fontSize: '13.5px'
                    }}
                  >
                    <Lock size={16} />
                    <span>작성자와 담당 지도 스님만 열람할 수 있는 비공개 질문입니다.</span>
                  </div>
                ) : (
                  <>
                    {/* Question Title & Content */}
                    <h4 className="heading-3" style={{ fontSize: '16.5px', marginBottom: '8px', lineHeight: '1.4' }}>
                      {post.title}
                    </h4>

                    <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: '18px' }}>
                      {post.content}
                    </p>

                    {/* Answer Section */}
                    {hasAnswer && post.answers.map((ans) => (
                      <div 
                        key={ans.id}
                        style={{ 
                          backgroundColor: '#FAF9F6', 
                          border: '1.5px solid #E2D9C8', 
                          borderLeft: '4px solid var(--color-amber)', 
                          borderRadius: 'var(--radius-sm)',
                          padding: '18px 20px',
                          marginTop: '16px'
                        }}
                      >
                        {/* Monk Profile Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div 
                              style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '50%', 
                                backgroundColor: 'var(--color-amber-subtle)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                              }}
                            >
                              <Shield size={15} color="var(--color-amber-dark)" />
                            </div>
                            <strong style={{ fontSize: '14.5px', color: 'var(--color-charcoal)' }}>
                              {ans.authorName}
                            </strong>
                            <span className="badge badge-amber" style={{ fontSize: '11px' }}>
                              {ans.badgeTitle || '담당 지도교수'}
                            </span>
                          </div>

                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            회신일시: {ans.createdAt}
                          </span>
                        </div>

                        {/* Monk Answer Content */}
                        <p style={{ fontSize: '14px', color: '#2D3748', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                          {ans.content}
                        </p>
                      </div>
                    ))}

                    {/* Admin Answer Action Trigger */}
                    {isAdmin && (
                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                          onClick={() => toggleAnswerForm(post)}
                        >
                          <Edit3 size={13} color="var(--color-amber-dark)" />
                          <span>{hasAnswer ? '스님 답변 수정' : '스님 명의로 답변 등록'}</span>
                        </button>
                      </div>
                    )}

                    {/* Admin Inline Answer Form */}
                    {isAdmin && answerForms[post.id]?.showForm && (
                      <div 
                        style={{ 
                          marginTop: '12px', 
                          padding: '16px', 
                          backgroundColor: '#F8FAFC', 
                          borderRadius: 'var(--radius-sm)', 
                          border: '1px solid #CBD5E1' 
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                              회신 스님/교수 선택
                            </label>
                            <select 
                              className="form-input" 
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              value={answerForms[post.id]?.monkName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAnswerForms(prev => ({
                                  ...prev,
                                  [post.id]: {
                                    ...prev[post.id],
                                    monkName: val,
                                    badgeTitle: val.includes('원명') ? '불교학술원 원장' : '담당 지도교수'
                                  }
                                }));
                              }}
                            >
                              <option value="지산 스님">지산 스님 (동국불교아카데미 교수)</option>
                              <option value="원명 스님">원명 스님 (불교학술원 원장)</option>
                              <option value="교학처 학술위원">교학처 학술위원</option>
                            </select>
                          </div>

                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                              직책/칭호
                            </label>
                            <input 
                              type="text"
                              className="form-input"
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              value={answerForms[post.id]?.badgeTitle}
                              onChange={(e) => setAnswerForms(prev => ({
                                ...prev,
                                [post.id]: { ...prev[post.id], badgeTitle: e.target.value }
                              }))}
                            />
                          </div>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                            스님 법문 답변 내용
                          </label>
                          <textarea 
                            className="form-input"
                            rows={4}
                            style={{ fontSize: '13.5px' }}
                            placeholder="학인의 질문에 대한 자비로운 법문과 해설을 입력해 주세요."
                            value={answerForms[post.id]?.content}
                            onChange={(e) => setAnswerForms(prev => ({
                              ...prev,
                              [post.id]: { ...prev[post.id], content: e.target.value }
                            }))}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button 
                            type="button" 
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleAnswerForm(post)}
                          >
                            취소
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-amber btn-sm"
                            onClick={() => handleSubmitAnswer(post.id)}
                            disabled={qaBusy}
                          >
                            <CheckCircle2 size={14} />
                            <span>답변 등록 완료</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
