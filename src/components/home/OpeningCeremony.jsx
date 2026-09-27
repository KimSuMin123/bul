import React, { useEffect, useState, useRef } from 'react';

// Traditional 5-Azure Silk (오청색, 五靑色) W-Shape Ribbon Half
function WRibbonHalfSvg({ isLeft }) {
  const filterId = isLeft ? 'w-shadow-left' : 'w-shadow-right';
  return (
    <svg 
      viewBox="0 0 500 145" 
      preserveAspectRatio="none" 
      style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
    >
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>
      <g transform={isLeft ? undefined : 'translate(500, 0) scale(-1, 1)'} filter={`url(#${filterId})`}>
        {/* 1. 감청 (Dark Indigo / 紺靑) - 깊고 고요한 지혜를 상징하는 짙은 남청 비단 */}
        <path d="M 0 18 Q 125 90, 250 20 Q 375 90, 500 26" fill="none" stroke="#0F2042" strokeWidth="11" strokeLinecap="round" />
        <path d="M 0 18 Q 125 90, 250 20 Q 375 90, 500 26" fill="none" stroke="#1E3A8A" strokeWidth="2.5" strokeLinecap="round" />

        {/* 2. 군청 (Deep Royal Navy / 群靑) - 맑고 깊은 전통 군청 비단 */}
        <path d="M 0 30 Q 125 102, 250 32 Q 375 102, 500 38" fill="none" stroke="#1D4ED8" strokeWidth="11" strokeLinecap="round" />
        <path d="M 0 30 Q 125 102, 250 32 Q 375 102, 500 38" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />

        {/* 3. 벽청 (Vivid Azure / 碧靑) - 청아하고 맑은 푸른빛 비단 */}
        <path d="M 0 42 Q 125 114, 250 44 Q 375 114, 500 50" fill="none" stroke="#0284C7" strokeWidth="11" strokeLinecap="round" />
        <path d="M 0 42 Q 125 114, 250 44 Q 375 114, 500 50" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />

        {/* 4. 청록/비취 (Jade Teal / 靑綠) - 만물의 소생과 정토의 자비를 담은 비취청 비단 */}
        <path d="M 0 54 Q 125 126, 250 56 Q 375 126, 500 62" fill="none" stroke="#0D9488" strokeWidth="11" strokeLinecap="round" />
        <path d="M 0 54 Q 125 126, 250 56 Q 375 126, 500 62" fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeLinecap="round" />

        {/* 5. 천청/담청 (Celestial Silk Blue / 天靑·淡靑) - 청정한 하늘과 부처님의 광명을 담은 밝은 청백 비단 */}
        <path d="M 0 66 Q 125 138, 250 68 Q 375 138, 500 74" fill="none" stroke="#BAE6FD" strokeWidth="11" strokeLinecap="round" />
        <path d="M 0 66 Q 125 138, 250 68 Q 375 138, 500 74" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// 범종(梵鐘) 실루엣 - 용뉴(龍鈕)·음통, 상대·하대 문양띠, 당좌(撞座)를 단순화한 아이콘
function BeomjongSvg({ size = 28 }) {
  return (
    <svg viewBox="0 0 64 72" width={size} height={size * 1.125} aria-hidden="true">
      <defs>
        <linearGradient id="beomjong-bronze" x1="0" x2="1">
          <stop offset="0" stopColor="#7C4A12" />
          <stop offset="0.45" stopColor="#E7B45A" />
          <stop offset="1" stopColor="#6B3E0E" />
        </linearGradient>
      </defs>
      <path d="M26 4 Q32 0 38 4 L38 10 L26 10 Z" fill="url(#beomjong-bronze)" />
      <rect x="40" y="2" width="4" height="9" rx="2" fill="url(#beomjong-bronze)" />
      <path d="M18 12 Q32 8 46 12 L50 60 Q32 64 14 60 Z" fill="url(#beomjong-bronze)" stroke="#4A2A08" strokeWidth="1" />
      <path d="M17.5 18 Q32 14.5 46.5 18" fill="none" stroke="#FDE68A" strokeWidth="2" opacity="0.8" />
      <path d="M14.8 54 Q32 57.5 49.2 54" fill="none" stroke="#FDE68A" strokeWidth="2" opacity="0.8" />
      <circle cx="32" cy="40" r="5" fill="none" stroke="#FDE68A" strokeWidth="1.6" />
      <circle cx="32" cy="40" r="1.8" fill="#FDE68A" />
      <path d="M12 60 Q32 66 52 60 L52 64 Q32 70 12 64 Z" fill="#5A3309" />
    </svg>
  );
}

// Web Audio로 합성한 범종 소리: 비조화 배음 + 미세하게 어긋난 두 기음이 만드는 맥놀이(beat)
function strikeTempleBell() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    const base = 98;
    const partials = [
      { ratio: 0.5, gain: 0.5, decay: 9 },
      { ratio: 1, gain: 0.7, decay: 8 },
      { ratio: 1.016, gain: 0.55, decay: 8 },
      { ratio: 2.02, gain: 0.35, decay: 5 },
      { ratio: 2.76, gain: 0.22, decay: 3.5 },
      { ratio: 5.4, gain: 0.1, decay: 1.6 },
      { ratio: 8.93, gain: 0.05, decay: 0.8 }
    ];
    partials.forEach(({ ratio, gain, decay }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + decay + 0.1);
    });
    setTimeout(() => ctx.close().catch(() => { }), 10000);
  } catch {
    // 오디오 재생 불가 환경에서는 무음으로 진행
  }
}

const LANTERN_COLORS = ['#E11D48', '#F472B6', '#F59E0B', '#FBCFE8', '#E11D48', '#F59E0B', '#F472B6'];

const OPENING_START_AT = '2026-10-01T18:30:00+09:00';
const startAt = Date.parse(import.meta.env?.VITE_OPENING_START_AT || OPENING_START_AT);

export default function OpeningCeremony() {
  // Ceremony overlay active state
  const [isActive, setIsActive] = useState(false);

  // Remaining seconds for countdown (default 30 seconds for simulation)
  const [countdown, setCountdown] = useState(30);

  // Cutting animation state
  const [isCutting, setIsCutting] = useState(false);
  const [isCutDone, setIsCutDone] = useState(false);
  const [curtainsOpened, setCurtainsOpened] = useState(false);

  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);

  // Check if current live time is around opening time (30 seconds lead)
  useEffect(() => {
    const checkLiveTime = () => {
      const now = Date.now();
      // If within 30 seconds before start time up to 5 minutes after start time
      if (now >= startAt - 30000 && now < startAt + 300000) {
        const remaining = Math.max(0, Math.ceil((startAt - now) / 1000));
        setCountdown(remaining);
        setIsActive(true);
      }
    };
    checkLiveTime();
    const interval = setInterval(checkLiveTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer when active
  useEffect(() => {
    if (!isActive || isCutDone) return;
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, countdown, isCutDone]);

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Toggle BGM / Bell sound
  const toggleAudio = () => {
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

  // 범종 타종 → 매듭이 풀리며 장막이 걷힘
  const handleStrikeBell = () => {
    if (isCutting || isCutDone) return;
    setIsCutting(true);
    strikeTempleBell();

    // 종소리가 한 번 퍼진 뒤 나모붓다야 노래 시작
    setTimeout(() => {
      if (!audioRef.current) {
        audioRef.current = new Audio('/audio/namo_buddhaya_song.mp3');
      }
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => { });
    }, 1400);

    // 0.9s: 종소리 파문이 퍼지고 연꽃 매듭이 풀림
    setTimeout(() => {
      setIsCutDone(true);
      setCurtainsOpened(true);
    }, 900);

    // 5.2s: 꽃비가 내린 뒤 오버레이 해제
    setTimeout(() => {
      setIsActive(false);
      setIsCutting(false);
      setIsCutDone(false);
      setCurtainsOpened(false);
    }, 5200);
  };

  // Start Simulation Rehearsal
  const startRehearsal = (seconds = 30) => {
    setCountdown(seconds);
    setIsCutting(false);
    setIsCutDone(false);
    setCurtainsOpened(false);
    setIsActive(true);
  };

  return (
    <>
      {/* Homepage Rehearsal Banner (When overlay is not active) */}
      {!isActive && (
        <section className="rehearsal-replay-banner" aria-label="개원식 세레머니 안내">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '32px' }}>🪷</span>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#FCD34D' }}>
                10월 1일 18:30 세화붓다아카데미 개원 세레머니
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '13.5px', color: '#CBD5E1' }}>
                [D-30초 카운트다운 ➔ 범종 타종 ➔ 연꽃 매듭 풀기 ➔ 꽃비와 함께 장막 걷기] 개원 법회를 미리 체험해 보세요.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #B8860B 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: 800,
                padding: '10px 22px',
                borderRadius: '50px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onClick={() => startRehearsal(30)}
            >
              <span>✨ D-30초 세레머니 입장 ▶</span>
            </button>
            <button
              type="button"
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#F8FAFC',
                fontWeight: 700,
                padding: '10px 18px',
                borderRadius: '50px',
                cursor: 'pointer',
                fontSize: '13.5px'
              }}
              onClick={() => startRehearsal(0)}
            >
              <span>🔔 타종 바로가기</span>
            </button>
          </div>
        </section>
      )}

      {/* Fullscreen Cinematic Curtain Overlay */}
      {isActive && (
        <div className="ceremony-curtain-overlay" role="dialog" aria-modal="true">
          {/* Left Curtain Panel (Midnight Navy) */}
          <div className={`curtain-panel curtain-left ${curtainsOpened ? 'open' : ''}`} />

          {/* Right Curtain Panel (Midnight Navy) */}
          <div className={`curtain-panel curtain-right ${curtainsOpened ? 'open' : ''}`} />

          {/* 처마 끝에 걸린 연등 행렬 */}
          <div className={`yeondeung-row ${curtainsOpened ? 'lift' : ''}`} aria-hidden="true">
            {LANTERN_COLORS.map((color, index) => (
              <span key={index} className="yeondeung" style={{ '--i': index, '--lantern-color': color }}>
                <i className="yeondeung-tassel" />
              </span>
            ))}
          </div>

          {/* 꽃비(天雨妙華) - 타종 후 화면 전체에 연꽃잎이 흩날림 */}
          {isCutDone && (
            <div className="flower-rain" aria-hidden="true">
              {Array.from({ length: 48 }, (_, index) => (
                <i key={index} style={{ '--p': index, '--x': `${(index * 37) % 100}%`, '--d': `${(index * 53) % 1600}ms` }} />
              ))}
            </div>
          )}

          {/* Top Controls: Audio & Exit */}
          <div className="ceremony-top-controls">
            <button
              type="button"
              className="btn-ceremony-tool"
              onClick={toggleAudio}
              aria-label="배경음악 토글"
            >
              <span>{isPlayingAudio ? '🔊 소리 끄기' : '🔈 나모붓다야 듣기'}</span>
            </button>
            {countdown > 0 && (
              <button
                type="button"
                className="btn-ceremony-tool"
                style={{ background: 'rgba(245, 158, 11, 0.35)', borderColor: '#F59E0B', color: '#FDE68A' }}
                onClick={() => setCountdown(0)}
              >
                ⏩ D-0분 즉시 이동
              </button>
            )}
            <button
              type="button"
              className="btn-ceremony-tool"
              style={{ background: 'rgba(239, 68, 68, 0.25)', borderColor: '#EF4444', color: '#FCA5A5' }}
              onClick={() => setIsActive(false)}
            >
              ✕ 닫기
            </button>
          </div>

          {/* Center Stage Content */}
          <div className={`curtain-center-stage ${curtainsOpened ? 'fade-out' : ''}`}>
            {/* Background Aura */}
            <div className="opening-stage-aura" style={{ opacity: 0.35 }} aria-hidden="true" />

            {/* 광배(光背)를 두른 연꽃 */}
            <div className="ceremony-halo-lotus" aria-hidden="true">
              <span className="ceremony-halo" />
              <span className="ceremony-halo ceremony-halo-outer" />
              <span className="ceremony-lotus-icon">🪷</span>
            </div>

            {/* Main Title */}
            <h1 className="ceremony-main-title">
              세화붓다아카데미, 나모붓다야
            </h1>
            

            {/* [D-30초전] Countdown Display */}
            {countdown > 0 ? (
              <div className="ceremony-countdown-box">
                <span className="ceremony-countdown-label">개원 법회 타종까지</span>
                <span className="ceremony-countdown-time">
                  00:{String(countdown).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0' }}>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.25)',
                  border: '1px solid #F59E0B',
                  color: '#FCD34D',
                  padding: '4px 16px',
                  borderRadius: '50px',
                  fontSize: '14px',
                  fontWeight: 800,
                  marginBottom: '10px',
                  animation: 'pulse-dot 1s infinite alternate'
                }}>
                  🙏 개원 시간이 되었습니다.
                </span>
              </div>
            )}

            {/* Traditional Dancheong W-Shape 5-Color Ribbon (오색 비단 W자 드레이프) */}
            <div className={`dancheong-ribbon-wrapper ${isCutDone ? 'cut' : ''}`}>
              <div className="dancheong-w-half dancheong-w-left">
                <WRibbonHalfSvg isLeft={true} />
              </div>
              <div className="dancheong-ribbon-knot">🪷</div>
              <div className="dancheong-w-half dancheong-w-right">
                <WRibbonHalfSvg isLeft={false} />
              </div>

              {/* 범종 소리 파문(波紋) */}
              {isCutting && (
                <div className="bell-ripples" aria-hidden="true">
                  <i /><i /><i />
                </div>
              )}
            </div>

            {/* 범종 타종 버튼 */}
            {countdown === 0 && !isCutDone && (
              <button
                type="button"
                className={`btn-dancheong-cut ${isCutting ? 'striking' : ''}`}
                onClick={handleStrikeBell}
                disabled={isCutting}
              >
                <span className="beomjong-icon"><BeomjongSvg /></span>
                <span>세화붓다아카데미 개원하기</span>
              </button>
            )}

            {countdown > 0 }
          </div>
        </div>
      )}
    </>
  );
}
