import React from 'react';
import { AlertTriangle, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ConflictModal() {
  const { sessionConflict, clearConflictAlert } = useAuth();

  if (!sessionConflict) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 2000 }}>
      <div 
        className="modal-card" 
        style={{ maxWidth: '420px', padding: '32px 24px', textAlign: 'center' }}
      >
        <div 
          style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--color-coral-subtle)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}
        >
          <AlertTriangle size={32} color="var(--color-coral)" />
        </div>

        <h3 className="heading-2" style={{ marginBottom: '8px' }}>중복 로그인 감지</h3>
        <p style={{ fontSize: '14.5px', color: 'var(--color-charcoal)', lineHeight: '1.6', marginBottom: '16px' }}>
          다른 기기 또는 브라우저 탭에서 동일한 아이디로 새로운 로그인이 발생하여, 
          <strong> 1인 1기기 접속 보안 규정</strong>에 따라 현재 세션이 안전하게 종료되었습니다.
        </p>

        <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
          본인이 로그인하지 않았다면 즉시 비밀번호를 변경하시기 바랍니다.
        </p>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '12px' }}
          onClick={clearConflictAlert}
        >
          <LogIn size={16} />
          <span>다시 로그인하기</span>
        </button>
      </div>
    </div>
  );
}
