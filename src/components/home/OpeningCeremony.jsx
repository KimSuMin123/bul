import React, { useEffect, useState } from 'react';
import { getOpeningTimeline, OPENING_DURATION, OPENING_START_AT } from '../../config/openingCeremony.js';

const startAt = Date.parse(import.meta.env?.VITE_OPENING_START_AT || OPENING_START_AT);
const format = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const startLabel = Number.isFinite(startAt) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startAt)) : '';

export default function OpeningCeremony({ now: testNow } = {}) {
  const [clock, setClock] = useState(() => Date.now());
  const [lotusBloom, setLotusBloom] = useState(0);
  useEffect(() => {
    if (testNow !== undefined) return undefined;
    let timer;
    const tick = () => {
      const current = Date.now();
      setClock(current);
      // Align ticks so the 18:29 visibility boundary is not skipped by a partial second.
      timer = setTimeout(tick, 250 - (current % 250));
    };
    tick();
    return () => clearTimeout(timer);
  }, [testNow]);
  const state = getOpeningTimeline(testNow === undefined ? clock : testNow, startAt);
  if (!state.visible) return null;
  const { elapsed, before, finished, phase, countdown, cutCountdown, cut, celebrating } = state;
  return <section className="opening-ceremony" aria-labelledby="opening-title">
    <span className="badge badge-amber">OPENING</span><h2 id="opening-title">개원 리본 세리머니</h2>
    <p>{startLabel} (한국 시간) · 5분</p>
    <div className="opening-stage">
      {celebrating && <div className="opening-celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--spark-index': index }} />)}</div>}
      <div className={`opening-ribbon ${cut ? 'cut' : ''} ${!before && !finished && !cut ? 'animated' : ''}`} aria-hidden="true"><span /><span /></div>
      <strong role="status">{before ? '개원을 기다리고 있습니다' : finished ? '행사가 마무리되었습니다' : phase.title}</strong>
      <p>{before ? '잠시 후 개원식이 시작됩니다. 함께 축하해 주세요.' : finished ? '함께해 주셔서 감사합니다. 아래 강좌를 살펴보세요.' : phase.description}</p>
      {before && <div className="opening-countdown" role="timer" aria-label="개원식 시작까지 남은 시간"><span className="opening-countdown-number">{format(countdown)}</span><span>시작까지 남은 시간</span></div>}
      {cutCountdown !== null && <div className="opening-cut-countdown" role="status" aria-atomic="true"><span className="sr-only">리본 커팅까지 </span><span className="opening-countdown-number">{cutCountdown}</span><span>초</span></div>}
      <span className="opening-elapsed">{before ? '시작 전' : `${format(elapsed)} / 5:00`}</span>
    </div>
    <progress max={OPENING_DURATION} value={elapsed} aria-label="세리머니 진행률" />
    <div className="opening-controls"><button type="button" className="btn btn-secondary" onClick={() => setLotusBloom(value => value + 1)} aria-describedby="opening-lotus-note">축하 연꽃 피우기</button></div>
    <div className="opening-lotus-reaction">
      {lotusBloom > 0 && <span key={lotusBloom} className="opening-lotus" aria-hidden="true">🪷</span>}
      <p role="status">{lotusBloom > 0 ? '이 화면에 축하 연꽃을 피웠습니다. 개원을 축하합니다!' : ''}</p>
    </div>
    <p id="opening-lotus-note" className="opening-note">축하 연꽃은 내 화면에서만 보이는 반응이며 다른 방문자에게 전송되지 않습니다.</p>
    <p className="opening-note">행사 화면은 기기 시계를 기준으로 같은 시각에 진행됩니다. 소리는 자동으로 재생되지 않습니다.</p>
  </section>;
}
