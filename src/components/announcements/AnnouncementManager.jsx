import React, { useCallback, useEffect, useState } from 'react';
import { deleteAnnouncement, listAdminAnnouncements, saveAnnouncement, uploadAnnouncementImage } from '../../services/announcementService.js';

const blank = { title: '', content: '', image_url: '', link_url: '', enabled: false, starts_at: '', ends_at: '' };
const localInput = value => value ? new Date(value).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T').slice(0, 16) : '';
const toIso = value => value ? new Date(`${value}:00+09:00`).toISOString() : null;

export default function AnnouncementManager() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await listAdminAnnouncements()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const edit = row => setForm({ ...row, starts_at: localInput(row.starts_at), ends_at: localInput(row.ends_at) });
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await saveAnnouncement({ ...form, starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at) });
      setForm(blank); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try { const image_url = await uploadAnnouncementImage(file); setForm(previous => ({ ...previous, image_url })); }
    catch (e) { setError(e.message); }
    finally { event.target.value = ''; setBusy(false); }
  };
  const remove = async id => {
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return;
    setBusy(true); setError('');
    try { await deleteAnnouncement(id); if (form.id === id) setForm(blank); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <section className="announcement-admin" aria-labelledby="announcement-admin-title">
    <h2 id="announcement-admin-title">메인 공지 관리</h2>
    <p>활성화된 공지만 방문자에게 표시됩니다. 시간은 한국 표준시 기준입니다.</p>
    {error && <p role="alert" className="announcement-error">{error}</p>}
    <form onSubmit={save} className="announcement-admin-form">
      <fieldset disabled={busy} className="announcement-fieldset">
      <label>제목 <input className="form-input" required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label>본문 <textarea className="form-textarea" rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label>
      <label>이미지 (5MB 이하 JPG, PNG, WEBP, GIF) <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={busy} /></label>
      {form.image_url && <div><img className="announcement-admin-preview" src={form.image_url} alt="선택한 공지 이미지 미리보기" /><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, image_url: '' })}>이미지 제거</button></div>}
      <label>클릭 링크 (선택) <input className="form-input" type="url" placeholder="https://" value={form.link_url || ''} onChange={e => setForm({ ...form, link_url: e.target.value })} /></label>
      <div className="announcement-admin-dates"><label>시작 시각 <input className="form-input" type="datetime-local" value={form.starts_at || ''} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label><label>종료 시각 <input className="form-input" type="datetime-local" value={form.ends_at || ''} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label></div>
      <label className="announcement-checkbox"><input type="checkbox" checked={Boolean(form.enabled)} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> 방문자에게 공개</label>
      <div className="announcement-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '처리 중…' : form.id ? '공지 수정' : '공지 등록'}</button>{form.id && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setForm(blank)}>편집 취소</button>}</div>
      </fieldset>
    </form>
    <h3>등록된 공지</h3>
    {loading ? <p role="status">공지를 불러오는 중…</p> : rows.length === 0 ? <p>등록된 공지가 없습니다.</p> : <ul className="announcement-admin-list">{rows.map(row => <li key={row.id}><div><strong>{row.title}</strong> <span>{row.enabled ? '공개' : '비공개'}</span><p>{row.content}</p></div><div className="announcement-actions"><button className="btn btn-secondary btn-sm" onClick={() => edit(row)} disabled={busy}>수정</button><button className="btn btn-secondary btn-sm" onClick={() => remove(row.id)} disabled={busy}>삭제</button></div></li>)}</ul>}
  </section>;
}
