import React, { useState } from 'react';
import { UserPlus, Check, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PrivacyConsent from '../components/common/PrivacyConsent.jsx';
import { PRIVACY_POLICY_VERSION } from '../config/sitePolicy.js';

export default function RegisterPage({ onNavigate }) {
  const { register, checkIdAvailable, checkPhoneAvailable, login } = useAuth();

  const [formData, setFormData] = useState({
    id: '',
    password: '',
    confirmPassword: '',
    name: '',
    dharmaName: '',
    birthDate: '',
    phone: ''
  });

  const [idChecked, setIdChecked] = useState(false);
  const [idCheckMsg, setIdCheckMsg] = useState({ text: '', isError: false });
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'id') {
      setIdChecked(false);
      setIdCheckMsg({ text: '', isError: false });
    }
  };

  const handleCheckId = async () => {
    const id = formData.id.trim();
    if (!id) {
      setIdCheckMsg({ text: '아이디를 입력해 주세요.', isError: true });
      return;
    }
    if (id.length < 4) {
      setIdCheckMsg({ text: '아이디는 최소 4자 이상이어야 합니다.', isError: true });
      return;
    }

    try {
      const available = await checkIdAvailable(id);
      if (available) {
        setIdChecked(true);
        setIdCheckMsg({ text: '사용 가능한 멋진 아이디입니다.', isError: false });
      } else {
        setIdChecked(false);
        setIdCheckMsg({ text: '이미 사용 중인 아이디입니다.', isError: true });
      }
    } catch (err) {
      setIdCheckMsg({ text: '중복 확인 중 오류가 발생했습니다.', isError: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!privacyConsent) {
      setError('개인정보 수집·이용에 동의해 주세요.');
      return;
    }

    if (!idChecked) {
      setError('아이디 중복확인을 완료해 주세요.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await register({
        id: formData.id,
        password: formData.password,
        name: formData.name,
        dharmaName: formData.dharmaName,
        birthDate: formData.birthDate,
        phone: formData.phone,
        privacyConsent,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION
      });

      setSuccessResult(newUser);
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '60px 0', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '480px' }}>

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
              신규 회원가입
            </h2>
            <p className="text-caption">
              세화붓다아카데미의 정통 강좌를 수강하기 위한 계정을 생성합니다.
            </p>
          </div>

          {/* Registration Success Overlay Banner */}
          {successResult && (
            <div
              style={{
                backgroundColor: 'var(--color-sage-subtle)',
                border: '1px solid var(--color-sage)',
                padding: '28px 20px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                marginBottom: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                <ShieldCheck size={28} color="var(--color-sage)" />
                <strong style={{ fontSize: '18px', color: 'var(--color-sage-dark)' }}>회원가입이 완료되었습니다!</strong>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--color-charcoal)', lineHeight: '1.7', marginBottom: '20px' }}>
                <strong>{successResult.name}</strong> 님 환영합니다.<br />
                등록하신 아이디: <strong>{successResult.id}</strong><br />
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                  (등록하신 아이디와 비밀번호로 로그인하여 강의를 수강하실 수 있습니다.)
                </span>
              </p>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14.5px' }}
                onClick={() => onNavigate('login')}
              >
                <span>로그인 하러가기</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

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

          {!successResult && (
            <form onSubmit={handleSubmit}>
              {/* 아이디 & 중복확인 */}
              <div className="form-group">
                <label className="form-label">
                  <span>아이디 *</span>
                  {idChecked && <span style={{ color: 'var(--color-sage)', fontSize: '12px' }}>확인 완료</span>}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    name="id"
                    className="form-input"
                    placeholder="영문, 숫자 4자 이상"
                    value={formData.id}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCheckId}
                    style={{ minWidth: '90px' }}
                  >
                    중복확인
                  </button>
                </div>
                {idCheckMsg.text && (
                  <div style={{ fontSize: '12px', color: idCheckMsg.isError ? 'var(--color-coral)' : 'var(--color-sage)', marginTop: '4px' }}>
                    {idCheckMsg.text}
                  </div>
                )}
              </div>

              {/* 비밀번호 */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>비밀번호 *</label>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-sage)', fontWeight: 600 }}>
                    영문, 숫자, 기호 모두 포함 (8자 이상)
                  </span>
                </div>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="영문, 숫자, 기호를 모두 포함하여 8자 이상 입력"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* 비밀번호 확인 */}
              <div className="form-group">
                <label className="form-label">비밀번호 확인 *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="form-input"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* 이름 */}
              <div className="form-group">
                <label className="form-label">이름 (실명) *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="예: 홍길동"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* 법명 */}
              <div className="form-group">
                <label className="form-label">법명</label>
                <input
                  type="text"
                  name="dharmaName"
                  className="form-input"
                  placeholder="예: 원행 (법명이 있으면 자격증에 함께 표기됩니다)"
                  value={formData.dharmaName}
                  onChange={handleChange}
                  maxLength={50}
                />
              </div>

              {/* 생년월일 */}
              <div className="form-group">
                <label className="form-label">생년월일 *</label>
                <input
                  type="date"
                  name="birthDate"
                  className="form-input"
                  value={formData.birthDate}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* 휴대전화 번호 */}
              <div className="form-group">
                <label className="form-label">
                  <span>휴대전화 번호 *</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>중복 가입 방지</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="010-1234-5678"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <PrivacyConsent checked={privacyConsent} onChange={setPrivacyConsent} disabled={isSubmitting} />

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '12px', opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                disabled={isSubmitting || !privacyConsent}
              >
                <span>{isSubmitting ? '가입 처리 중...' : '회원가입 완료'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {!successResult && (
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13.5px', color: 'var(--color-text-muted)' }}>
              이미 계정이 있으신가요?{' '}
              <button
                className="btn-ghost"
                style={{ color: 'var(--color-sage)', fontWeight: 600, padding: 0 }}
                onClick={() => onNavigate('login')}
              >
                로그인하기
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
