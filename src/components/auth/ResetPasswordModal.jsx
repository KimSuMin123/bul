import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// 비밀번호를 잊은 회원의 셀프 재설정: 아이디·이름·생년월일이 모두 맞으면 새 비밀번호로 바꾼다.
// 계정별 5회 틀리면 30분 잠금(서버), 관리자 계정은 제외.
export default function ResetPasswordModal({ onClose, onReset, initialId = '' }) {
  const { resetPassword } = useAuth();
  const [form, setForm] = useState({ id: initialId, name: '', birthDate: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (form.next !== form.confirm) { setError('새 비밀번호와 확인이 일치하지 않습니다.'); return; }
    setSaving(true);
    try {
      await resetPassword({ id: form.id, name: form.name, birthDate: form.birthDate, newPassword: form.next });
      onReset?.(form.id.trim());
    } catch (err) {
      setError(err.message || '비밀번호를 재설정하지 못했습니다. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const field = (key, label, props = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`reset-${key}`}>{label}</label>
      <input id={`reset-${key}`} className="form-input" value={form[key]} onChange={set(key)} disabled={saving} {...props} />
    </div>
  );

  return (
    <div className="modal-backdrop" style={{ zIndex: 1500 }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-password-title" style={{ maxWidth: '440px', padding: '28px 24px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 id="reset-password-title" className="heading-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <KeyRound size={20} /> 비밀번호 재설정
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" disabled={saving}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        <p className="text-caption" style={{ marginBottom: '16px' }}>
          가입할 때 입력한 아이디, 이름, 생년월일이 모두 맞으면 새 비밀번호로 바꿀 수 있습니다.
        </p>
        <form onSubmit={submit}>
          {field('id', '아이디', { autoComplete: 'username' })}
          {field('name', '이름', { autoComplete: 'name' })}
          {field('birthDate', '생년월일', { type: 'date' })}
          <div className="form-group">
            <label className="form-label" htmlFor="reset-next">새 비밀번호</label>
            <input id="reset-next" type="password" className="form-input" autoComplete="new-password"
              value={form.next} onChange={set('next')} disabled={saving} />
            <p className="text-caption" style={{ marginTop: '4px' }}>영문, 숫자, 기호를 포함하여 8자 이상</p>
          </div>
          {field('confirm', '새 비밀번호 확인', { type: 'password', autoComplete: 'new-password' })}
          {error && <p role="alert" style={{ color: '#DC2626', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={saving}>
            {saving ? '확인하는 중...' : '비밀번호 재설정하기'}
          </button>
        </form>
        <p className="text-caption" style={{ marginTop: '14px', textAlign: 'center' }}>
          정보가 기억나지 않으면 교학처(010-4702-0283)로 문의해 주세요.
        </p>
      </div>
    </div>
  );
}
