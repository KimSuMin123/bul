import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useModalAlert } from '../context/ModalAlertContext';

export default function LoginPage({ onNavigate }) {
  const { login, currentUser } = useAuth();
  const { showAlert } = useModalAlert();

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginTargetUserId, setLoginTargetUserId] = useState(null);

  // Route only after the verified identity has reached the rendered auth state.
  useEffect(() => {
    if (!loginTargetUserId || currentUser?.id !== loginTargetUserId) return;
    setLoginTargetUserId(null);
    try {
      const target = sessionStorage.getItem('sehwa-login-return');
      sessionStorage.removeItem('sehwa-login-return');
      if (target?.startsWith('#watch?') && new URLSearchParams(target.split('?')[1]).has('id')) {
        window.location.hash = target;
        return;
      }
    } catch { /* Continue with the normal signed-in landing page. */ }
    onNavigate(currentUser.role === 'admin' ? 'admin' : 'dashboard');
  }, [currentUser?.id, currentUser?.role, loginTargetUserId, onNavigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoginTargetUserId(null);
    setIsSubmitting(true);
    try {
      const user = await login(id, password);
      if (user?.id) setLoginTargetUserId(user.id);
    } catch (err) {
      setError(err.message || '아이디 또는 비밀번호가 일치하지 않습니다.');
    } finally {
      setIsSubmitting(false);
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
                alt="[사] 세화불학원"
                style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <h2 className="heading-1 font-serif" style={{ fontSize: '22px', marginBottom: '6px' }}>
              온라인 강의실 로그인
            </h2>
            <p className="text-caption">
              세화붓다아카데미에 오신 것을 환영합니다.
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
                  onClick={() => showAlert('비밀번호를 잊으셨다면 교학처(010-4702-0283)로 문의해 주세요.\n\n교학처에서 본인 확인을 마친 뒤 관리자가 비밀번호를 초기화해 드립니다.', { type: 'info', title: '비밀번호 재설정 안내' })}
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

    </div>
  );
}
