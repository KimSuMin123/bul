import React, { useEffect, useState, useRef } from 'react';

// Traditional 5-Color Dancheong W-Shape Ribbon Half
function WRibbonHalfSvg({ isLeft }) {
  const filterId = isLeft ? 'w-shadow-left' : 'w-shadow-right';
  return (
    <svg 
      viewBox="0 0 500 135" 
      preserveAspectRatio="none" 
      style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
    >
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>
      <g transform={isLeft ? undefined : 'translate(500, 0) scale(-1, 1)'} filter={`url(#${filterId})`}>
        {/* 상단 팽팽한 가이드 레드 테이프 라인 */}
        <path d="M 0 16 L 500 16" stroke="#DC2626" strokeWidth="6" strokeLinecap="round" />
        <path d="M 0 16 L 500 16" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" />

        {/* 1. 청색 (Royal Blue) W자 띠 */}
        <path d="M 0 24 Q 125 96, 250 26 Q 375 96, 500 32" fill="none" stroke="#1D4ED8" strokeWidth="12" strokeLinecap="round" />
        <path d="M 0 24 Q 125 96, 250 26 Q 375 96, 500 32" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />

        {/* 2. 녹색 (Emerald Green) W자 띠 */}
        <path d="M 0 35 Q 125 107, 250 37 Q 375 107, 500 43" fill="none" stroke="#047857" strokeWidth="12" strokeLinecap="round" />
        <path d="M 0 35 Q 125 107, 250 37 Q 375 107, 500 43" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />

        {/* 3. 황색 (Golden Yellow) W자 띠 */}
        <path d="M 0 46 Q 125 118, 250 48 Q 375 118, 500 54" fill="none" stroke="#D97706" strokeWidth="12" strokeLinecap="round" />
        <path d="M 0 46 Q 125 118, 250 48 Q 375 118, 500 54" fill="none" stroke="#FDE68A" strokeWidth="3.5" strokeLinecap="round" />

        {/* 4. 백색 (Silk White) W자 띠 */}
        <path d="M 0 57 Q 125 129, 250 59 Q 375 129, 500 65" fill="none" stroke="#CBD5E1" strokeWidth="12" strokeLinecap="round" />
        <path d="M 0 57 Q 125 129, 250 59 Q 375 129, 500 65" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

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

  // Perform Ribbon Cutting & Open Curtains
  const handleCutRibbon = () => {
    if (isCutting || isCutDone) return;
    setIsCutting(true);

    // Play celebration audio automatically if permitted
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/namo_buddhaya_song.mp3');
    }
    audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => { });

    // 0.45s: Scissor snips and ribbon splits
    setTimeout(() => {
      setIsCutDone(true);
      setCurtainsOpened(true);
    }, 450);

    // 3.6s: Curtains fully open slowly and smoothly, dismiss overlay and reveal real homepage
    setTimeout(() => {
      setIsActive(false);
      setIsCutting(false);
      setIsCutDone(false);
      setCurtainsOpened(false);
    }, 3600);
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
                [D-30초 카운트다운 ➔ 전통 오색 단청 리본 커팅 ➔ 좌우 장막 걷기] 시네마틱 오프닝을 체험해 보세요.
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
              <span>✂️ 리본 커팅 바로가기</span>
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

          {/* Top Controls: Audio & Exit */}
          <div className="ceremony-top-controls">
            <button
              type="button"
              className="btn-ceremony-tool"
              onClick={toggleAudio}
              aria-label="배경음악 토글"
            >
              <span>{isPlayingAudio ? '🔊 소리 끄기' : '🔈 배경음악/타종 듣기'}</span>
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

            {/* Confetti Explosion on Cut */}
            {isCutDone && (
              <div className="opening-celebration" aria-hidden="true">
                {Array.from({ length: 60 }, (_, index) => (
                  <i key={index} style={{ '--spark-index': index }} />
                ))}
              </div>
            )}

            {/* Sacred Lotus Icon */}
            <div style={{ fontSize: '42px', marginBottom: '8px', filter: 'drop-shadow(0 0 16px rgba(251, 191, 36, 0.8))' }}>
              🪷
            </div>

            {/* Main Title */}
            <h1 className="ceremony-main-title">
              세화붓다아카데미, 나모붓다야
            </h1>
            <p className="ceremony-sub-title">
              Namo Buddhaya · 부처님의 지혜와 자비가 온 누리에 가득하길 발원합니다
            </p>

            {/* [D-30초전] Countdown Display */}
            {countdown > 0 ? (
              <div className="ceremony-countdown-box">
                <span className="ceremony-countdown-label">개원식 시작까지</span>
                <span className="ceremony-countdown-time">
                  00:{String(countdown).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                  잠시 후 0초가 되면 전통 단청 리본 커팅식이 거행됩니다
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
                  🎉 개원의 시간이 도래했습니다!
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

              {/* Scissor Cutting Icon Animation */}
              {isCutting && !isCutDone && (
                <div className="scissor-cut-anim">✂️</div>
              )}
            </div>

            {/* [고유 커팅식 애니메이션] 디지털 가위질 버튼 */}
            {countdown === 0 && !isCutDone && (
              <button
                type="button"
                className="btn-dancheong-cut"
                onClick={handleCutRibbon}
                disabled={isCutting}
              >
                <span>✂️</span>
                <span>사이트 오픈</span>
              </button>
            )}

            {countdown > 0 && (
              <p style={{ fontSize: '13.5px', color: '#94A3B8', marginTop: '12px' }}>
                사찰의 깊은 새벽을 밝히는 장엄한 개원식에 함께해 주셔서 감사합니다.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
