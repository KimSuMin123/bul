import React, { useState } from 'react';
import { ShieldAlert, X, PhoneCall, HelpCircle, ArrowRight } from 'lucide-react';

export default function AccessDeniedModal({
  isOpen,
  onClose,
  courseTitle = '해당 코스',
  isPending = false,
  onStartTrial,
  onNavigateCourses
}) {
  const [showOfficeInfo, setShowOfficeInfo] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '460px', padding: '32px 28px', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn-ghost"
          style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px' }}
          onClick={onClose}
        >
          <X size={20} color="#6C757D" />
        </button>

        {/* Coral Warning Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: isPending ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-coral-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}
        >
          <ShieldAlert size={34} color={isPending ? '#10B981' : 'var(--color-coral)'} />
        </div>

        <h3 className="heading-2" style={{ marginBottom: '8px' }}>
          {isPending ? '수강 신청 접수 완료 안내' : '수강 권한 제한 안내'}
        </h3>

        {/* Exact Specification Message */}
        {isPending ? (
          <>
            <p style={{ fontSize: '15px', color: 'var(--color-charcoal)', lineHeight: '1.6', marginBottom: '14px' }}>
              <strong>[{courseTitle}]</strong> 수강 신청이 정상 접수되었습니다.<br />
              본 강좌는 <strong>1~3강까지 무료 체험으로 시청</strong>하실 수 있으며,<br />
              4강부터는 교학처 수납 승인 후 개방됩니다.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              교학처 방문 또는 지정 계좌 납부 완료 시 관리자가 승인하면 즉시 전체 강좌와 자격증 자격이 부여됩니다.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: '15px', color: 'var(--color-charcoal)', lineHeight: '1.6', marginBottom: '14px' }}>
              본 강의는 <strong>[{courseTitle}]</strong> 수강생 전용입니다.<br />
              현재 수강 권한이 없습니다. 학과 사무실(관리자)에 문의하세요.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              대면 수납 완료 후 관리자가 수강 승인을 처리하면 즉시 모든 강의와 학습자료를 열람하실 수 있습니다.
            </p>
          </>
        )}

        {showOfficeInfo ? (
          <div
            style={{
              background: 'var(--color-surface-warm)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              textAlign: 'left',
              fontSize: '13.5px',
              marginBottom: '20px',
              border: '1px solid var(--color-border-warm)'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PhoneCall size={16} color="var(--color-sage)" />
              <span>세화불학원 교학처 안내</span>
            </div>
            <p style={{ color: 'var(--color-text-main)', margin: '3px 0' }}>• 대표 이메일: <strong>sehwaba@gmail.com</strong></p>
            <p style={{ color: 'var(--color-text-main)', margin: '3px 0' }}>• 운영 시간: 평일 09:00 ~ 17:00 (주말 및 공휴일 휴무)</p>
            <p style={{ color: 'var(--color-text-main)', margin: '3px 0' }}>• 방문 수납처: 서울 종로구 삼봉로 81, 613호 (수송동, 두산위브파빌리온)</p>
            <p style={{ color: 'var(--color-text-main)', margin: '3px 0' }}>• 수납 전용 계좌: 농협 <strong>301-0264-3664-41</strong> ([사] 세화불학원)</p>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isPending && onStartTrial ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              onClick={() => {
                onClose();
                onStartTrial();
              }}
            >
              <span>1강 무료 체험 시청하기</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
              onClick={() => {
                onClose();
                if (onNavigateCourses) onNavigateCourses();
              }}
            >
              <span>코스 수강 신청 안내</span>
              <ArrowRight size={16} />
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ width: '100%', padding: '12px' }}
            onClick={() => setShowOfficeInfo(!showOfficeInfo)}
          >
            <HelpCircle size={16} />
            <span>{showOfficeInfo ? '학과 사무실 안내 닫기' : '교학처 수납 및 문의 안내'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
