import React from 'react';
import { 
  Clock, BookOpen, User, CheckCircle, ArrowLeft, 
  Lock, PlayCircle, ShieldCheck, ChevronRight 
} from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { useModalAlert } from '../context/ModalAlertContext';

export default function CourseDetailPage({ courseId, onNavigate, onStartLecture }) {
  const { courses, lectures, enrollments, hasCourseAccess, enrollStudent } = useCourse();
  const { currentUser } = useAuth();
  const { showConfirm, showAlert } = useModalAlert();

  const course = courses.find(c => c.id === courseId) || courses[0];
  const courseLectures = lectures
    .filter(l => l.courseId === course?.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const isEnrolled = hasCourseAccess(currentUser?.id, course?.id);
  const userEnr = enrollments.find(e => e.userId === currentUser?.id && e.courseId === course?.id);
  const isPending = userEnr?.status === 'pending' || userEnr?.status === 'applied';

  const handleApplyCourse = async () => {
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

    enrollStudent(currentUser.id, course.id, 'pending');
    await showAlert(`[${course.title}] 수강 신청이 완료되었습니다!\n\n• 현재 [대기상태 (대면 수납 대기)]로 접수되었습니다.\n• 교학처(02-2260-8888)에 방문하시어 수납을 완료하시면 [수강 중]으로 즉시 전환됩니다.\n• [내 강의실]에서 신청 내역을 언제든 확인하실 수 있습니다.`, {
      title: '수강 신청 완료',
      type: 'success'
    });
    onNavigate('dashboard');
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
          className="card course-detail-banner" 
          style={{ 
            overflow: 'hidden',
            marginBottom: '36px'
          }}
        >
          {/* Left Info */}
          <div className="course-detail-info" style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="badge badge-sage" style={{ marginBottom: '12px' }}>{course.category}</span>
              <h1 className="heading-1 font-serif" style={{ fontSize: '28px', marginBottom: '12px', lineHeight: '1.4' }}>
                {course.title}
              </h1>
              <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: '1.7', marginBottom: '24px' }}>
                {course.subtitle}
              </p>

              <div className="course-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13.5px', color: 'var(--color-charcoal)', borderTop: '1px solid var(--color-border)', paddingTop: '18px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>지도 교수:</span>{' '}
                  <strong>{course.instructor}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>수강료(회비):</span>{' '}
                  <strong style={{ color: 'var(--color-sage)' }}>{(course.price || 50000).toLocaleString()}원</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>수강 유효기간:</span>{' '}
                  <strong>{course.defaultPeriodDays}일 (결제일 기준)</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>총 강의 수:</span>{' '}
                  <strong>{courseLectures.length}개 차시</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>학습 방식:</span>{' '}
                  <strong>{course.sequentialUnlock ? '차시별 순차 학습' : '자유 수강'}</strong>
                </div>
              </div>
            </div>

            <div className="course-detail-cta-wrap" style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {isEnrolled ? (
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    if (courseLectures.length > 0) onStartLecture(courseLectures[0].id);
                  }}
                >
                  <PlayCircle size={18} />
                  <span>수강 시작하기 (1강 입장)</span>
                </button>
              ) : isPending ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-amber btn-lg"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <Clock size={18} />
                    <span>대기상태 (대면 수납 대기) - 내 강의실 보기</span>
                  </button>
                  <span style={{ fontSize: '13px', color: 'var(--color-amber-dark)' }}>
                    ※ 교학처 대면 수납 완료 후 수강 가능
                  </span>
                </div>
              ) : (
                <button 
                  className="btn btn-amber btn-lg"
                  onClick={handleApplyCourse}
                >
                  <span>수강 신청 접수 (대면 수납 안내)</span>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Right Thumbnail Image */}
          <div 
            style={{ 
              position: 'relative', 
              height: '100%', 
              minHeight: '220px',
              backgroundColor: 'var(--color-sage)',
              backgroundImage: 'linear-gradient(135deg, #2B3D36 0%, #3B5249 60%, #1E2022 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            {/* Background Dharma emblem */}
            <svg width="120" height="120" viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', opacity: 0.15 }}>
              <circle cx="50" cy="50" r="44" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="36" stroke="#D49B4B" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M50 20 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42 Z" fill="#FFFFFF" />
            </svg>
            <img 
              src={course.thumbnail} 
              alt={course.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }} 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Course Curriculum */}
        <div>
          <h2 className="heading-2 font-serif" style={{ marginBottom: '18px' }}>
            강의 상세 커리큘럼 ({courseLectures.length}차시)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {courseLectures.map((lec) => (
              <div 
                key={lec.id}
                className="card"
                style={{ 
                  padding: '20px 24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: '16px' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: 'var(--color-surface-warm)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--color-sage)' 
                    }}
                  >
                    {lec.orderIndex}강
                  </div>
                  <div>
                    <h3 className="heading-3" style={{ fontSize: '16px', marginBottom: '4px' }}>
                      {lec.title}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '620px' }}>
                      {lec.description}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="text-caption">
                    약 {Math.round(lec.durationSeconds / 60)}분
                  </span>
                  {isEnrolled ? (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onStartLecture(lec.id)}
                    >
                      <PlayCircle size={14} />
                      <span>수강</span>
                    </button>
                  ) : (
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => showAlert('본 강좌의 수강 권한이 필요합니다. 교학처 수납 후 승인됩니다.', { type: 'warning', title: '수강 권한 안내' })}
                    >
                      <Lock size={14} color="var(--color-coral)" />
                      <span>잠김</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
