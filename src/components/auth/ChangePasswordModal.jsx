import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// 본인 비밀번호 변경: 현재 비밀번호 확인 후 새 비밀번호(가입 규칙과 동일)로 바꾼다.
export default function ChangePasswordModal({ onClose, onChanged }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (next !== confirm) { setError('새 비밀번호와 확인이 일치하지 않습니다.'); return; }
    setSaving(true);
    try {
      await changePassword(current, next);
      onChanged?.();
    } catch (err) {
      setError(err.message || '비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1500 }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-password-title" style={{ maxWidth: '420px', padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 id="change-password-title" className="heading-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <KeyRound size={20} /> 비밀번호 변경
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" disabled={saving}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-current">현재 비밀번호</label>
            <input id="pw-current" type="password" className="form-input" autoComplete="current-password"
              value={current} onChange={e => setCurrent(e.target.value)} disabled={saving} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-next">새 비밀번호</label>
            <input id="pw-next" type="password" className="form-input" autoComplete="new-password"
              value={next} onChange={e => setNext(e.target.value)} disabled={saving} />
            <p className="text-caption" style={{ marginTop: '4px' }}>영문, 숫자, 기호를 포함하여 8자 이상</p>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-confirm">새 비밀번호 확인</label>
            <input id="pw-confirm" type="password" className="form-input" autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)} disabled={saving} />
          </div>
          {error && <p role="alert" style={{ color: '#DC2626', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={saving}>
            {saving ? '변경하는 중...' : '비밀번호 변경하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
