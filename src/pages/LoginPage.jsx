import React, { useState } from 'react';
import { LogIn, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onNavigate }) {
  const { login, resetPassword } = useAuth();

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotName, setForgotName] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState({ text: '', isError: false });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      login(id, password);
      onNavigate('dashboard');
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    setForgotMsg({ text: '', isError: false });
    try {
      resetPassword({
        id: forgotId,
        name: forgotName,
        phone: forgotPhone,
        newPassword
      });
      setForgotMsg({ text: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해 주세요.', isError: false });
      setTimeout(() => {
        setShowForgotModal(false);
        setPassword(newPassword);
        setId(forgotId);
      }, 1500);
    } catch (err) {
      setForgotMsg({ text: err.message, isError: true });
    }
  };

  return (
    <div style={{ padding: '60px 0', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '440px' }}>
        
        {/* Login Card */}
        <div className="card" style={{ padding: '36px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ marginBottom: '16px' }}>
              <img 
                src="/images/logo.png" 
                alt="사단법인 세화불학원" 
                style={{ height: '42px', width: 'auto', objectFit: 'contain' }} 
              />
            </div>
            <h2 className="heading-1 font-serif" style={{ fontSize: '22px', marginBottom: '6px' }}>
              온라인 강의실 로그인
            </h2>
            <p className="text-caption">
              세화불학원 온라인 아카데미에 오신 것을 환영합니다.
            </p>
          </div>

          {error && (
            <div 
              style={{ 
                backgroundColor: 'var(--color-coral-subtle)', 
                color: 'var(--color-coral)', 
                padding: '10px 14px', 
                borderRadius: 'var(--radius-sm)', 
                fontSize: '13px', 
                marginBottom: '18px',
                border: '1px solid rgba(224, 109, 83, 0.2)'
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">아이디</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="아이디를 입력하세요"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required 
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>비밀번호</label>
                <button 
                  type="button" 
                  className="btn-ghost" 
                  style={{ fontSize: '12px', color: 'var(--color-sage)', padding: 0 }}
                  onClick={() => setShowForgotModal(true)}
                >
                  비밀번호 찾기
                </button>
              </div>
              <input 
                type="password" 
                className="form-input" 
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              disabled={isSubmitting}
            >
              <span>로그인</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13.5px', color: 'var(--color-text-muted)' }}>
            아직 회원이 아니신가요?{' '}
            <button 
              className="btn-ghost" 
              style={{ color: 'var(--color-sage)', fontWeight: 600, padding: 0 }}
              onClick={() => onNavigate('register')}
            >
              회원가입하기
            </button>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card" style={{ padding: '28px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="heading-2 font-serif" style={{ marginBottom: '6px' }}>비밀번호 찾기 및 재설정</h3>
            <p className="text-caption" style={{ marginBottom: '20px' }}>
              가입 시 등록하신 아이디, 성명, 휴대전화 번호를 입력하시면 새 비밀번호를 설정하실 수 있습니다.
            </p>

            {forgotMsg.text && (
              <div 
                style={{ 
                  backgroundColor: forgotMsg.isError ? 'var(--color-coral-subtle)' : 'var(--color-sage-subtle)', 
                  color: forgotMsg.isError ? 'var(--color-coral)' : 'var(--color-sage)', 
                  padding: '10px 14px', 
                  borderRadius: 'var(--radius-sm)', 
                  fontSize: '13px', 
                  marginBottom: '16px' 
                }}
              >
                {forgotMsg.text}
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">아이디</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={forgotId} 
                  onChange={(e) => setForgotId(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">이름</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={forgotName} 
                  onChange={(e) => setForgotName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">휴대전화 번호</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="예: 010-1234-5678"
                  value={forgotPhone} 
                  onChange={(e) => setForgotPhone(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>새 비밀번호</label>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-sage)', fontWeight: 600 }}>
                    영문, 숫자, 기호 모두 포함 (8자 이상)
                  </span>
                </div>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="영문, 숫자, 기호를 모두 포함하여 8자 이상 입력"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForgotModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  비밀번호 변경
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
