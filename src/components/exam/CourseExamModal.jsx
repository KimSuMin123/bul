import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle, 
  Award, 
  RotateCcw, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  X, 
  BookOpen, 
  Sparkles,
  Check,
  FileText
} from 'lucide-react';
import { useCourse } from '../../context/CourseContext';
import { useAuth } from '../../context/AuthContext';
import { useModalAlert } from '../../context/ModalAlertContext';

export default function CourseExamModal({ 
  course, 
  onClose, 
  onOpenCertificate 
}) {
  const { currentUser } = useAuth();
  const { 
    getExamPool, 
    submitExam, 
    selectRandomQuestions, 
    getExamResult,
    isExamPassed 
  } = useCourse();
  const { showConfirm, showAlert } = useModalAlert();

  // Test session state: 'intro' | 'testing' | 'result'
  const [viewState, setViewState] = useState('intro');

  // Question pool and currently selected 20 questions
  const [examQuestions, setExamQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { [questionId]: chosenOptionNumber (1,2,3,4) }
  const [evaluationResult, setEvaluationResult] = useState(null);

  // Load previous attempt if any
  const previousAttempt = useMemo(() => {
    if (!currentUser || !course) return null;
    return getExamResult(currentUser.id, course.id);
  }, [currentUser, course, getExamResult]);

  // Start new exam session with 20 randomly selected questions
  const handleStartExam = () => {
    const pool = getExamPool(course.id);
    const selected20 = selectRandomQuestions(pool, 20);
    setExamQuestions(selected20);
    setCurrentIndex(0);
    setUserAnswers({});
    setEvaluationResult(null);
    setViewState('testing');
  };

  // Answer a question
  const handleSelectOption = (qId, optionNumber) => {
    setUserAnswers(prev => ({
      ...prev,
      [qId]: optionNumber
    }));
  };

  // Progress metrics
  const answeredCount = Object.keys(userAnswers).length;
  const totalQuestions = examQuestions.length || 20;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  // Submit and grade exam
  const handleSubmitExam = async () => {
    const unAnsweredCount = totalQuestions - answeredCount;
    if (unAnsweredCount > 0) {
      const ok = await showConfirm(
        `아직 ${unAnsweredCount}개의 문제에 답하지 않았습니다.\n\n미응답 문항은 오답(0점) 처리됩니다. 그래도 제출하시겠습니까?`,
        {
          title: '미응답 문항 확인',
          type: 'warning',
          confirmText: '그대로 제출',
          cancelText: '더 풀기'
        }
      );
      if (!ok) return;
    }

    const evaluation = submitExam(currentUser.id, course.id, examQuestions, userAnswers);
    setEvaluationResult(evaluation);
    setViewState('result');
  };

  const currentQ = examQuestions[currentIndex] || null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999, padding: '16px' }}>
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: '860px', 
          width: '100%', 
          maxHeight: '94vh', 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: '18px',
          overflow: 'hidden'
        }}
      >
        {/* Modal Top Bar */}
        <div 
          style={{ 
            padding: '16px 24px', 
            background: 'linear-gradient(135deg, #2A3832 0%, #1E2723 100%)', 
            color: '#FFFFFF',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#D49B4B', padding: '6px', borderRadius: '8px', color: '#1E2022' }}>
              <Award size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#E0AE67', fontWeight: 600, letterSpacing: '0.05em' }}>
                사단법인 세화불학원 수료 자격 평가
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                {course.certTypeFull || course.title} 자격 평가 시험
              </h3>
            </div>
          </div>
          <button 
            className="alert-modal-close-btn" 
            onClick={onClose}
            style={{ position: 'static', background: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* 1. INTRO VIEW */}
          {viewState === 'intro' && (
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div 
                style={{ 
                  width: '74px', 
                  height: '74px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 20px rgba(212, 155, 75, 0.2)'
                }}
              >
                <Award size={40} color="#B45309" />
              </div>

              <h2 className="heading-1 font-serif" style={{ fontSize: '24px', marginBottom: '8px' }}>
                온라인 자격 검정 평가 안내
              </h2>
              <p style={{ fontSize: '14.5px', color: '#64748B', maxWidth: '540px', margin: '0 auto 24px', lineHeight: '1.6' }}>
                본 과정의 모든 강의를 성실히 이수하셨습니다. <br />
                아래 평가 기준에 따라 시험을 통과하시면 사단법인 세화불학원 <strong>정식 수료증</strong>이 즉시 발급됩니다.
              </p>

              {/* Exam Rules Card Grid */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '12px', 
                  maxWidth: '680px', 
                  margin: '0 auto 28px',
                  textAlign: 'left'
                }}
              >
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>출제 문항 수</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
                    총 20문항
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                    문제풀에서 무작위 20문제 랜덤 추출
                  </div>
                </div>

                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>합격 기준 점수</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
                    60점 이상 (수료)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#86EFAC', marginTop: '2px' }}>
                    문항당 5점 (12문제 이상 정답)
                  </div>
                </div>

                <div style={{ background: '#FEF9C3', border: '1px solid #FEF08A', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#854D0E', fontWeight: 600 }}>응시 기회</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#A16207', marginTop: '4px' }}>
                    재응시 가능
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#CA8A04', marginTop: '2px' }}>
                    불합격 시 언제든 재응시 가능
                  </div>
                </div>
              </div>

              {/* Previous Attempt Summary if any */}
              {previousAttempt && (
                <div 
                  style={{ 
                    maxWidth: '680px', 
                    margin: '0 auto 24px', 
                    padding: '14px 18px', 
                    borderRadius: '10px',
                    background: previousAttempt.passed ? '#F0FDF4' : '#FFF1F2',
                    border: previousAttempt.passed ? '1px solid #86EFAC' : '1px solid #FECDD3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: previousAttempt.passed ? '#15803D' : '#BE123C' }}>
                      {previousAttempt.passed ? '🎉 최근 시험 합격 완료' : '⚠️ 최근 시험 불합격 (재응시 필요)'}
                    </span>
                    <div style={{ fontSize: '13.5px', color: '#334155', marginTop: '2px' }}>
                      최근 점수: <strong>{previousAttempt.score}점</strong> (정답 {previousAttempt.correctCount} / 20)
                      <span style={{ color: '#94A3B8', marginLeft: '8px', fontSize: '12px' }}>
                        응시일: {previousAttempt.submittedAt?.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                  {previousAttempt.passed && (
                    <button
                      type="button"
                      className="btn btn-sm btn-amber"
                      onClick={() => {
                        onClose();
                        if (onOpenCertificate) onOpenCertificate(course);
                      }}
                    >
                      <span>자격증 보기</span>
                    </button>
                  )}
                </div>
              )}

              {/* Start Button */}
              <button 
                type="button" 
                className="btn btn-primary btn-lg" 
                style={{ 
                  padding: '14px 44px', 
                  fontSize: '16px', 
                  fontWeight: 700,
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(59, 82, 73, 0.35)'
                }}
                onClick={handleStartExam}
              >
                <span>📝 자격 평가 시험 시작하기 ▶</span>
              </button>
            </div>
          )}

          {/* 2. TESTING VIEW (응시 중) */}
          {viewState === 'testing' && currentQ && (
            <div>
              {/* Progress & Quick Nav Bar */}
              <div 
                style={{ 
                  background: '#F8FAFC', 
                  border: '1px solid #E2E8F0', 
                  borderRadius: '12px', 
                  padding: '14px 18px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-sage)' }}>
                      문항 {currentIndex + 1}
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>/ 총 20문항</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 600 }}>
                    답변 완료: <strong style={{ color: 'var(--color-sage)' }}>{answeredCount}</strong> / 20 ({progressPercent}%)
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--color-sage)', transition: 'width 0.3s ease' }} />
                </div>

                {/* Question Pills (1 to 20) */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {examQuestions.map((q, idx) => {
                    const isAnswered = userAnswers[q.id] !== undefined;
                    const isCurrent = idx === currentIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: isCurrent ? '2px solid var(--color-sage)' : '1px solid #CBD5E1',
                          background: isCurrent ? 'var(--color-sage)' : (isAnswered ? '#DCFCE7' : '#FFFFFF'),
                          color: isCurrent ? '#FFFFFF' : (isAnswered ? '#15803D' : '#64748B'),
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        title={`문항 ${idx + 1}로 이동`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Question Box */}
              <div 
                style={{ 
                  background: '#FFFFFF', 
                  border: '1px solid #E2E8F0', 
                  borderRadius: '14px', 
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
                  <span 
                    style={{ 
                      background: 'var(--color-sage-subtle)', 
                      color: 'var(--color-sage)', 
                      fontWeight: 800, 
                      fontSize: '14px', 
                      padding: '4px 10px', 
                      borderRadius: '6px',
                      flexShrink: 0
                    }}
                  >
                    제 {currentIndex + 1} 번 (배점 5점)
                  </span>
                  <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1E293B', lineHeight: '1.5' }}>
                    {currentQ.question}
                  </h4>
                </div>

                {/* 4 Options Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentQ.options.map((opt, optIdx) => {
                    const optNumber = optIdx + 1;
                    const isSelected = userAnswers[currentQ.id] === optNumber;
                    const circledNumbers = ['①', '②', '③', '④', '⑤'];
                    const circledSymbol = circledNumbers[optIdx] || `${optNumber}.`;

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectOption(currentQ.id, optNumber)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '14px 18px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--color-sage)' : '1px solid #E2E8F0',
                          background: isSelected ? 'rgba(59, 82, 73, 0.08)' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: isSelected ? '0 2px 10px rgba(59, 82, 73, 0.12)' : 'none'
                        }}
                      >
                        <div 
                          style={{ 
                            width: '26px', 
                            height: '26px', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 700,
                            background: isSelected ? 'var(--color-sage)' : '#F1F5F9',
                            color: isSelected ? '#FFFFFF' : '#475569'
                          }}
                        >
                          {circledSymbol}
                        </div>
                        <div style={{ flex: 1, fontSize: '15px', color: isSelected ? '#1E293B' : '#334155', fontWeight: isSelected ? 600 : 400, lineHeight: '1.45' }}>
                          {opt}
                        </div>
                        {isSelected && (
                          <div style={{ color: 'var(--color-sage)' }}>
                            <CheckCircle2 size={20} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  style={{ minWidth: '100px', opacity: currentIndex === 0 ? 0.4 : 1 }}
                >
                  <ArrowLeft size={16} />
                  <span>이전 문제</span>
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentIndex < totalQuestions - 1 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                      style={{ minWidth: '110px' }}
                    >
                      <span>다음 문제</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-amber"
                    onClick={handleSubmitExam}
                    style={{ 
                      minWidth: '140px', 
                      backgroundColor: '#D49B4B', 
                      color: '#FFFFFF', 
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(212, 155, 75, 0.3)'
                    }}
                  >
                    <Send size={16} />
                    <span>시험 제출하기</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. RESULT VIEW (채점 결과 요약 - 정답/오답 상세 해설 미제공) */}
          {viewState === 'result' && evaluationResult && (
            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '10px 0 20px' }}>
              {/* Score Hero Card */}
              <div 
                style={{ 
                  borderRadius: '16px', 
                  padding: '32px 24px', 
                  textAlign: 'center',
                  background: evaluationResult.passed ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' : 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
                  border: evaluationResult.passed ? '1.5px solid #6EE7B7' : '1.5px solid #FDA4AF',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  {evaluationResult.passed ? (
                    <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: '#10B981', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}>
                      <CheckCircle2 size={40} strokeWidth={2.3} />
                    </div>
                  ) : (
                    <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: '#E11D48', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(225, 29, 72, 0.35)' }}>
                      <XCircle size={40} strokeWidth={2.3} />
                    </div>
                  )}
                </div>

                <span 
                  style={{ 
                    display: 'inline-block',
                    padding: '5px 16px', 
                    borderRadius: '20px', 
                    fontSize: '13px', 
                    fontWeight: 800,
                    background: evaluationResult.passed ? '#059669' : '#BE123C',
                    color: '#FFFFFF',
                    marginBottom: '10px'
                  }}
                >
                  {evaluationResult.passed ? '🎉 [합격] 수료 기준 60점 통과' : '⚠️ [불합격] 수료 기준 60점 미달'}
                </span>

                <div style={{ fontSize: '44px', fontWeight: 900, color: evaluationResult.passed ? '#065F46' : '#881337', margin: '4px 0 10px' }}>
                  {evaluationResult.score}점 <span style={{ fontSize: '20px', fontWeight: 500, color: '#64748B' }}>/ 100점</span>
                </div>

                <p style={{ fontSize: '15px', color: '#334155', maxWidth: '520px', margin: '0 auto 24px', lineHeight: '1.6' }}>
                  {evaluationResult.passed ? (
                    <>
                      축하합니다! 총 20문항 중 <strong>{evaluationResult.correctCount}문항</strong>을 맞추어 자격 검정에 당당히 합격하셨습니다.<br />
                      이제 사단법인 세화불학원 이사장 직인이 날인된 정식 수료증을 발급받으실 수 있습니다.
                    </>
                  ) : (
                    <>
                      총 20문항 중 <strong>{evaluationResult.correctCount}문항</strong>을 맞추어 합격 기준(60점)에 도달하지 못했습니다.<br />
                      본 자격 시험은 <strong>재응시가 가능</strong>하므로, 강의를 복습하신 후 언제든 다시 도전해 보세요!
                    </>
                  )}
                </p>

                {/* Score Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '480px', margin: '0 auto 24px' }}>
                  <div style={{ background: '#FFFFFF', padding: '14px 10px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>총 출제 문항</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', marginTop: '3px' }}>20문항</div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '14px 10px', borderRadius: '10px', border: '1px solid #BBF7D0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', color: '#15803D', fontWeight: 600 }}>정답 문항 수</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '3px' }}>{evaluationResult.correctCount}개 (+{evaluationResult.correctCount * 5}점)</div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '14px 10px', borderRadius: '10px', border: '1px solid #FECDD3', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '12px', color: '#BE123C', fontWeight: 600 }}>오답 문항 수</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#BE123C', marginTop: '3px' }}>{20 - evaluationResult.correctCount}개</div>
                  </div>
                </div>

                {/* Notice Box: No individual question answers revealed */}
                <div style={{ background: 'rgba(255, 255, 255, 0.75)', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '12px 16px', maxWidth: '480px', margin: '0 auto 24px', fontSize: '12.5px', color: '#64748B', lineHeight: '1.5' }}>
                  ※ 공정한 자격 검정 평가 관리 및 시험 보안을 위해 문항별 정답과 개별 해설은 공개되지 않습니다.
                </div>

                {/* Primary Action Button */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {evaluationResult.passed && (
                    <button
                      type="button"
                      className="btn btn-amber btn-lg"
                      style={{ 
                        padding: '12px 30px', 
                        fontSize: '15px', 
                        fontWeight: 800,
                        backgroundColor: '#D49B4B', 
                        color: '#FFFFFF',
                        boxShadow: '0 4px 16px rgba(212, 155, 75, 0.4)'
                      }}
                      onClick={() => {
                        onClose();
                        if (onOpenCertificate) onOpenCertificate(course);
                      }}
                    >
                      <Award size={20} />
                      <span>🎓 정식 수료증 확인 및 출력</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', fontWeight: 700 }}
                    onClick={handleStartExam}
                  >
                    <RotateCcw size={16} />
                    <span>🔄 새로운 20문제로 재응시하기</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

