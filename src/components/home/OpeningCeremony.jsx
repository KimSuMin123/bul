import React, { useEffect, useState, useRef } from 'react';
import { getOpeningTimeline, OPENING_DURATION, OPENING_START_AT, OPENING_PHASES } from '../../config/openingCeremony.js';

const startAt = Date.parse(import.meta.env?.VITE_OPENING_START_AT || OPENING_START_AT);
const format = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const startLabel = Number.isFinite(startAt) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startAt)) : '';

const TICKER_MESSAGES = [
  '서울 종로 법우님: 세화붓다아카데미 개원을 진심으로 축하드립니다! 🙏',
  '부산 해운대 보살님: 부처님의 지혜와 자비가 온 누리에 가득하길 발원합니다 🪷',
  '대구 수성 거사님: 온라인으로 전국의 도반들과 함께하니 환희롭습니다 ✨',
  '광주 무등 법우님: 불교의례해설사 1기 정진하겠습니다! 성불하십시오 📜',
  '경기 수원 보살님: 법음의 향기가 널리 퍼지는 배움의 도량이 되길 축원합니다 🌸',
  '제주 서귀포 법우님: 원호 스님 개원 법문 기대하며 함께 합장합니다 🔔',
  '대전 유성 거사님: 역사적인 세화불학원의 출범에 동참하여 감격스럽습니다 🎗️',
  '강원 강릉 보살님: 언제 어디서나 배우는 온라인 불학원 개원을 축원합니다 🎉'
];

export default function OpeningCeremony({ now: testNow } = {}) {
  const [clock, setClock] = useState(() => Date.now());
  const [lotusBloom, setLotusBloom] = useState(0);

  // Rehearsal state for pre-event simulation & testing
  const [isRehearsal, setIsRehearsal] = useState(false);
  const [rehearsalSec, setRehearsalSec] = useState(0);
  const [isRehearsalPlaying, setIsRehearsalPlaying] = useState(true);
  const [rehearsalSpeed, setRehearsalSpeed] = useState(1);
  const rehearsalTimerRef = useRef(null);

  // Live ticker rolling message state
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    if (testNow !== undefined) return undefined;
    let timer;
    const tick = () => {
      const current = Date.now();
      setClock(current);
      timer = setTimeout(tick, 250 - (current % 250));
    };
    tick();
    return () => clearTimeout(timer);
  }, [testNow]);

  // Rehearsal timer effect with speed multiplier (1x, 2x, 4x)
  useEffect(() => {
    if (!isRehearsal || !isRehearsalPlaying || testNow !== undefined) {
      if (rehearsalTimerRef.current) clearInterval(rehearsalTimerRef.current);
      return;
    }
    const intervalMs = Math.max(100, Math.floor(1000 / rehearsalSpeed));
    rehearsalTimerRef.current = setInterval(() => {
      setRehearsalSec(prev => {
        if (prev >= OPENING_DURATION) {
          setIsRehearsalPlaying(false);
          return OPENING_DURATION;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => {
      if (rehearsalTimerRef.current) clearInterval(rehearsalTimerRef.current);
    };
  }, [isRehearsal, isRehearsalPlaying, rehearsalSpeed, testNow]);

  // Live celebration ticker rotation
  useEffect(() => {
    if (testNow !== undefined) return;
    const interval = setInterval(() => {
      setTickerIdx(prev => (prev + 1) % TICKER_MESSAGES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [testNow]);

  // Determine current timeline state
  let effectiveNow;
  if (testNow !== undefined) {
    effectiveNow = testNow;
  } else if (isRehearsal) {
    effectiveNow = startAt + rehearsalSec * 1000;
  } else {
    effectiveNow = clock;
  }

  const state = getOpeningTimeline(effectiveNow, startAt);

  // If not visible and not in rehearsal, display pre-event rehearsal invitation banner if before event
  if (!state.visible && !isRehearsal && testNow === undefined) {
    return (
      <section className="opening-ceremony" aria-labelledby="opening-title" style={{ maxWidth: '880px', margin: '30px auto' }}>
        <div className="opening-rehearsal-banner">
          <div>
            <div className="opening-rehearsal-title">
              <span>🎭 10월 1일 오후 18:30 개원식 3분 리허설 안내</span>
            </div>
            <p className="opening-rehearsal-desc">
              개원식에 앞서, 10단계 화면 전환과 황금 리본 커팅·연꽃 반응이 정상 동작하는지 3분 동시 접속 리허설을 미리 체험해 보실 수 있습니다.
            </p>
          </div>
          <button 
            type="button" 
            className="btn btn-primary"
            style={{ 
              background: 'linear-gradient(135deg, #D49B4B 0%, #B8860B 100%)', 
              border: 'none', 
              color: '#FFFFFF',
              fontWeight: 700,
              padding: '12px 24px',
              borderRadius: '50px',
              boxShadow: '0 4px 16px rgba(212, 155, 75, 0.4)',
              cursor: 'pointer',
              fontSize: '15px'
            }}
            onClick={() => {
              setIsRehearsal(true);
              setRehearsalSec(0);
              setIsRehearsalPlaying(true);
              setRehearsalSpeed(1);
            }}
          >
            <span>✨ 3분 리허설 시작하기 ▶</span>
          </button>
        </div>
      </section>
    );
  }

  if (!state.visible && !isRehearsal) return null;

  const { elapsed, before, finished, phase, countdown, cutCountdown, cut, celebrating } = state;

  // Current phase index out of total phases (for stage indicator)
  const currentPhaseIndex = OPENING_PHASES.findIndex(p => p.title === phase.title);

  return (
    <section className="opening-ceremony" aria-labelledby="opening-title">
      {isRehearsal && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '12px',
          padding: '10px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13.5px',
          color: '#92400E',
          fontWeight: 700
        }}>
          <span>🎬 [동시 접속 3분 리허설 진행 중] - 10월 1일 18:30 개원식 세리머니 시뮬레이션</span>
          <button 
            type="button" 
            style={{ background: 'transparent', border: 'none', color: '#B45309', cursor: 'pointer', fontWeight: 800, fontSize: '14px' }}
            onClick={() => setIsRehearsal(false)}
          >
            ✕ 리허설 종료
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
        <span className="badge badge-amber">OPENING CEREMONY</span>
        {!before && !finished && (
          <span style={{
            fontSize: '12px',
            background: 'rgba(212, 155, 75, 0.15)',
            color: '#B45309',
            padding: '2px 10px',
            borderRadius: '20px',
            fontWeight: 700
          }}>
            씬 {currentPhaseIndex + 1}/10
          </span>
        )}
      </div>

      <h2 id="opening-title">세화불학원 개원 리본 세리머니</h2>
      <p style={{ margin: '4px 0 16px 0', fontSize: '14.5px', color: '#475569' }}>
        {startLabel} (한국 시간) · 3분 축하 세리머니
      </p>

      {/* Main Ceremony Stage with Rotating Aurora */}
      <div className="opening-stage">
        {/* Sacred Golden Aurora Background */}
        <div className="opening-stage-aura" aria-hidden="true" />

        {/* 60 Mega Fireworks & Confetti Burst during ribbon cut */}
        {celebrating && (
          <div className="opening-celebration" aria-hidden="true">
            {Array.from({ length: 60 }, (_, index) => (
              <i key={index} style={{ '--spark-index': index }} />
            ))}
          </div>
        )}

        {/* Floating Lotus Lanterns rising into the sky */}
        <div className="floating-lanterns-container" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="floating-lantern"
              style={{
                left: `${6 + i * 12}%`,
                animationDelay: `${i * 0.6}s`,
                animationDuration: `${3.6 + (i % 3) * 0.8}s`,
                fontSize: `${22 + (i % 3) * 6}px`
              }}
            >
              {i % 2 === 0 ? '🏮' : '🪷'}
            </span>
          ))}
        </div>

        {/* Dynamic Scene Phase Badge */}
        {!before && !finished && (
          <div className="opening-phase-badge" key={phase.title}>
            <span style={{ fontSize: '16px' }}>🌟</span>
            <span>{phase.title}</span>
          </div>
        )}

        {/* Golden Grand Ribbon with Cutting Scissors */}
        <div className="opening-ribbon-container">
          {cutCountdown !== null && (
            <div className="opening-scissor-cutting" aria-hidden="true">✂️</div>
          )}
          <div className={`opening-ribbon ${cut ? 'cut' : ''} ${!before && !finished && !cut ? 'animated' : ''}`} aria-hidden="true">
            <span />
            <div className="opening-ribbon-knot">🪷</div>
            <span />
          </div>
        </div>

        {/* Animated Phase Content */}
        <div className="opening-phase-content" key={before ? 'before' : finished ? 'finished' : phase.title}>
          <strong role="status" style={{ fontSize: '20px', color: '#1E293B', marginTop: '4px' }}>
            {before ? '개원을 기다리고 있습니다' : finished ? '행사가 마무리되었습니다' : phase.title}
          </strong>

          <p style={{ maxWidth: '640px', margin: '6px auto 10px auto', fontSize: '15px', lineHeight: '1.6', color: '#475569' }}>
            {before 
              ? '잠시 후 개원식이 시작됩니다. 함께 축하해 주세요.' 
              : finished 
              ? '함께해 주셔서 감사합니다. 아래 강좌를 살펴보세요.' 
              : phase.description}
          </p>
        </div>

        {/* Pre-event countdown */}
        {before && (
          <div className="opening-countdown" role="timer" aria-label="개원식 시작까지 남은 시간">
            <span className="opening-countdown-number">{format(countdown)}</span>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>시작까지 남은 시간</span>
          </div>
        )}

        {/* Cutting countdown (5 seconds before 90s) */}
        {cutCountdown !== null && (
          <div className="opening-cut-countdown" role="status" aria-atomic="true">
            <span className="sr-only">리본 커팅까지 </span>
            <span style={{ fontSize: '28px', marginRight: '4px' }}>✂️</span>
            <span className="opening-countdown-number">{cutCountdown}</span>
            <span style={{ fontSize: '19px', fontWeight: 800, color: '#DC2626' }}>초 전</span>
          </div>
        )}

        {/* Elapsed Timer Display */}
        <span className="opening-elapsed" style={{ fontSize: '13px', color: '#8A6218', fontWeight: 700, marginTop: '4px', zIndex: 2 }}>
          {before ? '시작 전' : `${format(elapsed)} / 3:00`}
        </span>
      </div>

      {/* Progress Bar */}
      <progress max={OPENING_DURATION} value={elapsed} aria-label="세리머니 진행률" />

      {/* Live Simultaneous Celebration Ticker */}
      <div className="opening-live-ticker-container" aria-label="실시간 접속 축하 전광판">
        <span className="opening-live-badge">LIVE 1,280명 접속</span>
        <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: '#334155' }}>
          {TICKER_MESSAGES[tickerIdx]}
        </div>
      </div>

      {/* Interactive Lotus Bloom Reaction */}
      <div className="opening-controls">
        <button 
          type="button" 
          className="btn-lotus-bloom" 
          onClick={() => setLotusBloom(value => value + 1)} 
          aria-describedby="opening-lotus-note"
        >
          <span style={{ fontSize: '22px' }}>🪷</span>
          <span>축하 연꽃 피우기 {lotusBloom > 0 ? `(${lotusBloom}송이 만개)` : ''}</span>
        </button>
      </div>

      <div className="opening-lotus-reaction">
        {lotusBloom > 0 && (
          <div className="opening-lotus-wrap" aria-hidden="true">
            {Array.from({ length: Math.min(lotusBloom, 9) }).map((_, idx) => (
              <span key={`${lotusBloom}-${idx}`} className="opening-lotus" style={{ animationDelay: `${idx * 0.08}s` }}>
                🪷
              </span>
            ))}
          </div>
        )}
        <p role="status" style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#DB2777', fontWeight: 700 }}>
          {lotusBloom > 0 ? `🌸 부처님의 지혜와 자비가 깃든 축하 연꽃 ${lotusBloom}송이를 활짝 피웠습니다!` : ''}
        </p>
      </div>

      <p id="opening-lotus-note" className="opening-note">
        축하 연꽃은 내 화면에서만 보이는 반응이며 다른 방문자에게 전송되지 않습니다.
      </p>
      <p className="opening-note">
        행사 화면은 기기 시계를 기준으로 같은 시각에 진행됩니다. 소리는 자동으로 재생되지 않습니다.
      </p>

      {/* Interactive Rehearsal Simulator Controller */}
      {isRehearsal && (
        <div className="rehearsal-control-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#FCD34D' }}>
              ⏱ 타임라인: {format(rehearsalSec)} / 3:00 ({Math.floor((rehearsalSec / OPENING_DURATION) * 100)}%)
            </span>
          </div>

          <div className="rehearsal-control-buttons">
            {/* Speed Multipliers */}
            <button 
              type="button" 
              className={rehearsalSpeed === 1 ? 'active-speed' : ''} 
              onClick={() => setRehearsalSpeed(1)}
            >
              1x 속도
            </button>
            <button 
              type="button" 
              className={rehearsalSpeed === 2 ? 'active-speed' : ''} 
              onClick={() => setRehearsalSpeed(2)}
            >
              2x 배속
            </button>
            <button 
              type="button" 
              className={rehearsalSpeed === 4 ? 'active-speed' : ''} 
              onClick={() => setRehearsalSpeed(4)}
            >
              4x 초고속
            </button>

            {/* Quick Scene Jumps */}
            <button type="button" onClick={() => setRehearsalSec(0)}>0:00 종소리</button>
            <button type="button" onClick={() => setRehearsalSec(35)}>0:35 법음</button>
            <button type="button" onClick={() => setRehearsalSec(75)}>1:15 리본</button>
            <button type="button" onClick={() => setRehearsalSec(85)}>✂️ 1:25 커팅 5초 전</button>
            <button type="button" onClick={() => setRehearsalSec(90)}>🎉 1:30 커팅·폭죽</button>
            <button type="button" onClick={() => setRehearsalSec(115)}>🌸 1:55 연등 향연</button>
            <button type="button" onClick={() => setRehearsalSec(165)}>2:45 마무리</button>

            {/* Play/Pause & Close */}
            <button 
              type="button" 
              style={{ background: isRehearsalPlaying ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.35)', borderColor: isRehearsalPlaying ? '#EF4444' : '#10B981' }}
              onClick={() => setIsRehearsalPlaying(p => !p)}
            >
              {isRehearsalPlaying ? '⏸ 일시정지' : '▶ 계속 재생'}
            </button>
            <button 
              type="button" 
              style={{ background: '#DC2626', borderColor: '#DC2626' }} 
              onClick={() => setIsRehearsal(false)}
            >
              ✕ 리허설 닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
