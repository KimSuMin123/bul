import React, { useEffect, useState } from 'react';

const DURATION = 300;
const configured = import.meta.env?.VITE_OPENING_START_AT || '2026-10-01T18:30:00+09:00';
const startAt = Date.parse(configured);
const phases = [
  { end: 40, title: '환영합니다', description: '세화붓다아카데미의 첫걸음을 함께해 주셔서 감사합니다. 오늘의 인연을 떠올려 보세요.' },
  { end: 110, title: '개원 인사', description: '배움과 실천을 잇는 새로운 공간이 열립니다. 화면 앞에서 잠시 합장하며 축하해 주세요.' },
  { end: 165, title: '함께 준비하는 순간', description: '곧 리본을 엽니다. 함께하는 분들과 개원의 의미를 나눠 보세요.' },
  { end: 180, title: '리본 커팅 카운트다운', description: '다섯, 넷, 셋, 둘, 하나. 새로운 배움의 문을 엽니다!' },
  { end: 240, title: '개원을 축하합니다', description: '리본이 열렸습니다. 이 배움이 삶 속의 따뜻한 실천으로 이어지길 바랍니다.' },
  { end: 300, title: '앞으로의 배움', description: '아래 개설 강좌에서 첫 수업을 살펴보세요. 함께해 주셔서 감사합니다.' }
];
const format = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function OpeningCeremony() {
  const [now, setNow] = useState(() => Date.now());
  const [rehearsal, setRehearsal] = useState(false);
  const [elapsedPreview, setElapsedPreview] = useState(0);
  const [previewRunning, setPreviewRunning] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!previewRunning) return undefined;
    let previous = performance.now();
    const timer = setInterval(() => { const current = performance.now(); setElapsedPreview(value => Math.min(DURATION, value + (current - previous) / 1000)); previous = current; }, 100);
    return () => clearInterval(timer);
  }, [previewRunning]);
  useEffect(() => { if (elapsedPreview >= DURATION) setPreviewRunning(false); }, [elapsedPreview]);
  const valid = Number.isFinite(startAt);
  const liveElapsed = valid ? Math.max(0, Math.min(DURATION, (now - startAt) / 1000)) : 0;
  const elapsed = rehearsal ? elapsedPreview : liveElapsed;
  const before = !rehearsal && valid && now < startAt;
  const finished = !rehearsal && valid && now >= startAt + DURATION * 1000;
  const phase = phases.find(item => elapsed < item.end) || phases.at(-1);
  const countdown = valid ? Math.max(0, Math.ceil((startAt - now) / 1000)) : 0;
  const startLabel = valid ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startAt)) : '일정 설정을 확인해 주세요';
  return <section className="opening-ceremony" aria-labelledby="opening-title">
    <span className="badge badge-amber">OPENING</span><h2 id="opening-title">개원 리본 세리머니</h2>
    <p>{startLabel} (한국 시간) · 5분</p>
    <div className="opening-stage" aria-live="polite"><div className={`opening-ribbon ${elapsed >= 180 ? 'cut' : ''} ${!before && !finished ? 'animated' : ''}`} aria-hidden="true"><span /><span /></div>
      <strong>{!valid ? '행사 시각 설정 오류' : before ? '개원을 기다리고 있습니다' : finished ? '행사가 마무리되었습니다' : phase.title}</strong>
      <p>{before ? `시작까지 ${format(countdown)} 남았습니다.` : finished ? '함께해 주셔서 감사합니다. 아래 강좌를 살펴보세요.' : phase.description}</p>
      <span>{before ? '시작 전' : `${format(elapsed)} / 5:00`}</span>
    </div>
    <progress max={DURATION} value={elapsed} aria-label="세리머니 진행률" />
    <div className="opening-controls"><button type="button" className="btn btn-secondary" onClick={() => { setRehearsal(value => !value); setPreviewRunning(false); setElapsedPreview(0); }}>{rehearsal ? '행사 시간 보기' : '미리 체험하기'}</button>{rehearsal && <><button type="button" className="btn btn-primary" onClick={() => setPreviewRunning(value => !value)} disabled={elapsedPreview >= DURATION}>{previewRunning ? '일시정지' : elapsedPreview > 0 ? '이어보기' : '체험 시작'}</button><button type="button" className="btn btn-secondary" onClick={() => { setPreviewRunning(false); setElapsedPreview(0); }}>처음부터</button></>}</div>
    <p className="opening-note">행사 화면은 기기 시계를 기준으로 같은 시각에 진행됩니다. 미리 체험은 각자 시작·일시정지할 수 있습니다.</p>
  </section>;
}
