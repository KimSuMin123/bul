import React, { useEffect, useRef, useState } from 'react';
import { listActiveAnnouncements, safeHttpUrl } from '../../services/announcementService.js';

const todaySeoul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const keyFor = id => `sewha-announcement-hide:${id}:${todaySeoul()}`;

export default function AnnouncementPopup() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const closeButton = useRef(null);
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    let active = true;
    listActiveAnnouncements().then(rows => {
      if (!active) return;
      setItems(rows.filter(item => { try { return !localStorage.getItem(keyFor(item.id)); } catch { return true; } }));
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const item = items[index];
  useEffect(() => {
    if (!item) { previousFocus.current?.focus?.(); previousFocus.current = null; return; }
    if (!previousFocus.current) previousFocus.current = document.activeElement;
    closeButton.current?.focus();
  }, [item?.id]);
  useEffect(() => {
    if (!item) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); setIndex(i => i + 1); }
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled),a[href]')];
        if (!controls.length) return;
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item]);
  const next = hide => {
    if (hide) { try { localStorage.setItem(keyFor(item.id), '1'); } catch { /* storage unavailable */ } }
    setIndex(i => i + 1);
  };
  if (loading) return <span className="sr-only" role="status">공지를 확인하는 중입니다.</span>;
  if (error) return <div className="announcement-load-error" role="alert">공지를 불러오지 못했습니다. 새로고침하여 다시 시도해 주세요.</div>;
  if (!item) return null;
  const link = safeHttpUrl(item.link_url);
  return <div className="announcement-overlay" role="presentation">
    <section ref={dialogRef} className="announcement-popup" role="dialog" aria-modal="true" aria-labelledby="announcement-popup-title" aria-describedby="announcement-popup-content">
      <div className="announcement-popup-top"><span>알림 {index + 1} / {items.length}</span><button ref={closeButton} className="btn btn-ghost btn-sm" onClick={() => next(false)} aria-label="공지 닫기">닫기 ×</button></div>
      {item.image_url && (link ? <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} 자세히 보기, 새 창`}><img className="announcement-popup-image" src={item.image_url} alt={item.title} /></a> : <img className="announcement-popup-image" src={item.image_url} alt={item.title} />)}
      <div className="announcement-popup-body"><h2 id="announcement-popup-title">{item.title}</h2><p id="announcement-popup-content">{item.content}</p>{link && <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer">자세히 보기 <span className="sr-only">새 창</span></a>}</div>
      <div className="announcement-popup-bottom"><button className="btn btn-secondary" onClick={() => next(true)}>오늘 하루 보지 않기</button><button className="btn btn-secondary" onClick={() => next(false)}>닫기</button></div>
    </section>
  </div>;
}
