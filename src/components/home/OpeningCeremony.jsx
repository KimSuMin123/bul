import React, { useEffect, useState, useRef } from 'react';
import { getOpeningTimeline, OPENING_DURATION, OPENING_START_AT, OPENING_PHASES } from '../../config/openingCeremony.js';

const startAt = Date.parse(import.meta.env?.VITE_OPENING_START_AT || OPENING_START_AT);
const format = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const startLabel = Number.isFinite(startAt) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startAt)) : '';

const TICKER_MESSAGES = [
  '서울 종로 법우님: 나무붓다야! 세화붓다아카데미 개원을 진심으로 축하드립니다! 🙏',
  '부산 해운대 보살님: 부처님의 지혜와 자비가 온 누리에 가득하길 발원합니다 🪷',
  '대구 수성 거사님: 온라인으로 전국의 도반들과 함께하니 환희롭습니다 ✨',
  '광주 무등 법우님: 나모붓다야, 불교의례해설사 1기 정진하겠습니다! 성불하십시오 📜',
  '경기 수원 보살님: 법음의 향기가 널리 퍼지는 배움의 도량이 되길 축원합니다 🌸',
  '제주 서귀포 법우님: 원호 스님 개원 법문 기대하며 함께 합장합니다 🔔',
  '대전 유성 거사님: 역사적인 세화불학원의 출범에 동참하여 감격스럽습니다 🎗️',
  '강원 강릉 보살님: 언제 어디서나 배우는 온라인 불학원 개원을 축원합니다 🎉'
];

export default function OpeningCeremony({ now: testNow } = {}) {
  const [clock, setClock] = useState(() => Date.now());
  const [lotusBloom, setLotusBloom] = useState(0);

  // Fullscreen state: true by default during test/event or when rehearsal activated
  const [isFullscreen, setIsFullscreen] = useState(() => testNow !== undefined);

  // Rehearsal state for pre-event simulation & testing
  const [isRehearsal, setIsRehearsal] = useState(false);
  const [rehearsalSec, setRehearsalSec] = useState(0);
  const [isRehearsalPlaying, setIsRehearsalPlaying] = useState(true);
  const [rehearsalSpeed, setRehearsalSpeed] = useState(1);
  const rehearsalTimerRef = useRef(null);

  // Namo Buddhaya audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);

  // Live ticker rolling message state
  const [tickerIdx, setTickerIdx] = useState(0);

  // Initialize clock
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

  // Audio cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleNamoAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/namo_buddhaya_song.mp3');
      audioRef.current.addEventListener('ended', () => setIsPlayingAudio(false));
    }
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(() => {
        setIsPlayingAudio(false);
      });
    }
  };

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

  // Automatically trigger fullscreen if the real live ceremony starts
  useEffect(() => {
    if (state.visible && !state.finished && testNow === undefined) {
      setIsFullscreen(true);
    }
  }, [state.visible, state.finished, testNow]);

  // SSR test boundary check: if not visible and SSR, return null
  if (!state.visible && testNow !== undefined) return null;

  // When not in fullscreen and not in rehearsal, display premium invitation banner on home
  if (!isFullscreen && !isRehearsal && testNow === undefined) {
    return (
      <section className="opening-ceremony" aria-labelledby="opening-title" style={{ maxWidth: '960px', margin: '30px auto' }}>
        <div className="opening-rehearsal-banner" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)', border: '1.5px solid #F59E0B', color: '#FFFBEB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/images/namo_buddhaya.png" alt="" style={{ width: '64px', height: '64px', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.7))' }} />
            <div>
              <div className="opening-rehearsal-title" style={{ color: '#FCD34D', fontSize: '17px' }}>
                <span>🪷 10월 1일 18:30 세화불학원 개원식 · 나모붓다야의 시간</span>
              </div>
              <p className="opening-rehearsal-desc" style={{ color: '#E2E8F0', marginTop: '4px' }}>
                나모붓다야(부처님께 귀의합니다)의 장엄한 법음과 함께 전체 화면으로 펼쳐지는 3분 개원 세리머니를 미리 체험해 보세요.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-primary"
            style={{ 
              background: 'linear-gradient(135deg, #F59E0B 0%, #B8860B 100%)', 
              border: 'none', 
              color: '#FFFFFF',
              fontWeight: 800,
              padding: '12px 26px',
              borderRadius: '50px',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.45)',
              cursor: 'pointer',
              fontSize: '15.5px'
            }}
            onClick={() => {
              setIsFullscreen(true);
              setIsRehearsal(true);
              setRehearsalSec(0);
              setIsRehearsalPlaying(true);
              setRehearsalSpeed(1);
            }}
          >
            <span>✨ 나모붓다야 전체화면 입장하기 ▶</span>
          </button>
        </div>
      </section>
    );
  }

  const { elapsed, before, finished, phase, countdown, cutCountdown, cut, celebrating } = state;
  const currentPhaseIndex = OPENING_PHASES.findIndex(p => p.title === phase.title);

  return (
    <div 
      className="opening-ceremony opening-ceremony-fullscreen-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="opening-title"
    >
      {/* Top Header Bar */}
      <header className="fullscreen-header">
        <div className="fullscreen-title-area">
          <span style={{ fontSize: '22px' }}>🪷</span>
          <div>
            <div className="fullscreen-title">
              나모붓다야 (Namo Buddhaya) · 개원 세리머니
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'left' }}>
              {startLabel} (한국 시간) · 3분 축하 세리머니
            </div>
          </div>
        </div>

        <div className="fullscreen-actions">
          <span className="opening-live-badge" style={{ margin: 0 }}>
            LIVE 1,280명 동시 접속
          </span>

          <button 
            type="button" 
            className="btn-namo-audio-toggle" 
            onClick={toggleNamoAudio}
            aria-label="나모붓다야 음성 재생 토글"
          >
            <span>{isPlayingAudio ? '🔊' : '🔈'}</span>
            <span>{isPlayingAudio ? '나모붓다야 일시정지' : '나모붓다야 음성 듣기'}</span>
          </button>

          {testNow === undefined && (
            <button 
              type="button" 
              className="btn-fullscreen-close"
              onClick={() => {
                setIsFullscreen(false);
                setIsRehearsal(false);
                if (audioRef.current) audioRef.current.pause();
                setIsPlayingAudio(false);
              }}
              aria-label="전체화면 닫기"
            >
              ✕ 전체화면 닫기
            </button>
          )}
        </div>
      </header>

      {/* Main Fullscreen Stage */}
      <main className="fullscreen-stage">
        {/* Sacred Conic Aurora Rotating Backdrop */}
        <div className="opening-stage-aura" aria-hidden="true" />

        {/* 80 Mega Fireworks & Confetti Burst */}
        {celebrating && (
          <div className="opening-celebration" aria-hidden="true">
            {Array.from({ length: 60 }, (_, index) => (
              <i key={index} style={{ '--spark-index': index }} />
            ))}
          </div>
        )}

        {/* Floating Sacred Lanterns rising into space */}
        <div className="floating-lanterns-container" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="floating-lantern"
              style={{
                left: `${4 + i * 8.2}%`,
                animationDelay: `${i * 0.45}s`,
                animationDuration: `${3.6 + (i % 3) * 0.7}s`,
                fontSize: `${24 + (i % 4) * 6}px`
              }}
            >
              {i % 2 === 0 ? '🏮' : '🪷'}
            </span>
          ))}
        </div>

        {/* Namo Buddhaya Hero Emblem */}
        <div className="namo-buddhaya-emblem">
          <img src="/images/namo_buddhaya.png" alt="나무붓다야" />
        </div>

        {/* Dynamic 10-Scene Phase Badge */}
        {!before && !finished && (
          <div className="opening-phase-badge" key={phase.title} style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '15px' }}>✨</span>
            <span>씬 {currentPhaseIndex + 1}/10 : {phase.title}</span>
          </div>
        )}

        <h2 id="opening-title" style={{ fontSize: 'clamp(24px, 4vw, 36px)', color: '#FFFBEB', margin: '4px 0 10px 0', textShadow: '0 0 25px rgba(251, 191, 36, 0.6)' }}>
          세화불학원 개원 리본 세리머니
        </h2>

        {/* 3D Golden Ribbon with Cutting Scissors */}
        <div className="opening-ribbon-container" style={{ width: 'min(92vw, 560px)', height: '70px', margin: '14px 0' }}>
          {cutCountdown !== null && (
            <div className="opening-scissor-cutting" aria-hidden="true" style={{ fontSize: '48px', top: '-42px' }}>✂️</div>
          )}
          <div className={`opening-ribbon ${cut ? 'cut' : ''} ${!before && !finished && !cut ? 'animated' : ''}`} aria-hidden="true" style={{ height: '56px' }}>
            <span />
            <div className="opening-ribbon-knot" style={{ width: '58px', height: '58px', fontSize: '28px' }}>🪷</div>
            <span />
          </div>
        </div>

        {/* Dynamic Phase Text Presentation */}
        <div className="opening-phase-content" key={before ? 'before' : finished ? 'finished' : phase.title}>
          <strong role="status" style={{ fontSize: '22px', color: '#FDE68A', marginTop: '4px', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            {before ? '개원을 기다리고 있습니다' : finished ? '행사가 마무리되었습니다' : phase.title}
          </strong>

          <p style={{ maxWidth: '720px', margin: '8px auto 12px auto', fontSize: '16px', lineHeight: '1.7', color: '#E2E8F0', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
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
            <span className="opening-countdown-number" style={{ color: '#FBBF24', textShadow: '0 0 30px rgba(251, 191, 36, 0.8)' }}>
              {format(countdown)}
            </span>
            <span style={{ fontSize: '14px', color: '#CBD5E1', fontWeight: 600 }}>시작까지 남은 시간</span>
          </div>
        )}

        {/* Cutting countdown (5 seconds before 90s) */}
        {cutCountdown !== null && (
          <div className="opening-cut-countdown" role="status" aria-atomic="true">
            <span className="sr-only">리본 커팅까지 </span>
            <span style={{ fontSize: '32px', marginRight: '6px' }}>✂️</span>
            <span className="opening-countdown-number">{cutCountdown}</span>
            <span style={{ fontSize: '22px', fontWeight: 900, color: '#EF4444' }}>초 전</span>
          </div>
        )}

        {/* Timeline Elapsed Indicator */}
        <span className="opening-elapsed" style={{ fontSize: '14px', color: '#FCD34D', fontWeight: 800, marginTop: '8px', zIndex: 2 }}>
          {before ? '시작 전' : `${format(elapsed)} / 3:00`}
        </span>

        {/* Progress Bar */}
        <div style={{ width: '100%', maxWidth: '680px', marginTop: '12px' }}>
          <progress max={OPENING_DURATION} value={elapsed} aria-label="세리머니 진행률" />
        </div>
      </main>

      {/* Fullscreen Footer Controls */}
      <footer className="fullscreen-footer">
        {/* Realtime Simultaneous Celebration Ticker */}
        <div className="opening-live-ticker-container" style={{ background: 'rgba(15, 23, 42, 0.8)', borderColor: 'rgba(212, 155, 75, 0.35)', color: '#F8FAFC' }}>
          <span className="opening-live-badge">LIVE 축하 한마디</span>
          <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: '#FDE68A' }}>
            {TICKER_MESSAGES[tickerIdx]}
          </div>
        </div>

        {/* Lotus Bloom Reaction */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn-lotus-bloom" 
            onClick={() => setLotusBloom(v => v + 1)}
            aria-describedby="opening-lotus-note"
            style={{ fontSize: '16.5px', padding: '14px 34px' }}
          >
            <span style={{ fontSize: '24px' }}>🪷</span>
            <span>축하 연꽃 피우기 {lotusBloom > 0 ? `(${lotusBloom}송이 만개)` : ''}</span>
          </button>

          <div className="opening-lotus-reaction" style={{ minHeight: '44px' }}>
            {lotusBloom > 0 && (
              <div className="opening-lotus-wrap" aria-hidden="true">
                {Array.from({ length: Math.min(lotusBloom, 10) }).map((_, idx) => (
                  <span key={`${lotusBloom}-${idx}`} className="opening-lotus" style={{ animationDelay: `${idx * 0.08}s` }}>
                    🪷
                  </span>
                ))}
              </div>
            )}
            <p role="status" style={{ margin: '4px 0 0 0', fontSize: '14.5px', color: '#F472B6', fontWeight: 800 }}>
              {lotusBloom > 0 ? `🌸 부처님의 지혜와 자비가 깃든 축하 연꽃 ${lotusBloom}송이를 활짝 피웠습니다!` : ''}
            </p>
          </div>
        </div>

        <p id="opening-lotus-note" className="opening-note" style={{ color: '#94A3B8', margin: '2px 0' }}>
          축하 연꽃은 내 화면에서만 보이는 반응이며 다른 방문자에게 전송되지 않습니다.
        </p>
        <p className="opening-note" style={{ color: '#64748B', margin: '2px 0' }}>
          행사 화면은 기기 시계를 기준으로 같은 시각에 진행됩니다. 소리는 자동으로 재생되지 않습니다.
        </p>

        {/* Rehearsal Simulator Control Bar */}
        {isRehearsal && (
          <div className="rehearsal-control-bar" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#FCD34D' }}>
                ⏱ 나모붓다야 타임라인: {format(rehearsalSec)} / 3:00 ({Math.floor((rehearsalSec / OPENING_DURATION) * 100)}%)
              </span>
            </div>

            <div className="rehearsal-control-buttons">
              {/* Speed controls */}
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

              {/* Scene shortcuts */}
              <button type="button" onClick={() => setRehearsalSec(0)}>0:00 종소리</button>
              <button type="button" onClick={() => setRehearsalSec(35)}>0:35 법음</button>
              <button type="button" onClick={() => setRehearsalSec(75)}>1:15 리본</button>
              <button type="button" onClick={() => setRehearsalSec(85)}>✂️ 1:25 커팅 5초 전</button>
              <button type="button" onClick={() => setRehearsalSec(90)}>🎉 1:30 커팅·폭죽</button>
              <button type="button" onClick={() => setRehearsalSec(115)}>🌸 1:55 연등 향연</button>
              <button type="button" onClick={() => setRehearsalSec(165)}>2:45 회향</button>

              {/* Play/Pause */}
              <button 
                type="button" 
                style={{ background: isRehearsalPlaying ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.45)', borderColor: isRehearsalPlaying ? '#EF4444' : '#10B981' }}
                onClick={() => setIsRehearsalPlaying(p => !p)}
              >
                {isRehearsalPlaying ? '⏸ 일시정지' : '▶ 재생'}
              </button>
              <button 
                type="button" 
                style={{ background: '#DC2626', borderColor: '#DC2626' }} 
                onClick={() => {
                  setIsFullscreen(false);
                  setIsRehearsal(false);
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlayingAudio(false);
                }}
              >
                ✕ 닫기
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
