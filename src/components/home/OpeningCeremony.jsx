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

const OPENING_START_AT = '2026-09-30T18:30:00+09:00';
const startAt = Date.parse(import.meta.env?.VITE_OPENING_START_AT || OPENING_START_AT);
// 숨김 트리거 노출 마감: 개원 시각 + 30분 유예(지각 대비). 이후로는 버튼이 렌더링되지 않음
const TRIGGER_GRACE_MS = 30 * 60 * 1000;
const triggerHideAt = startAt + TRIGGER_GRACE_MS;

export default function OpeningCeremony() {
  // Ceremony overlay active state
  const [isActive, setIsActive] = useState(false);

  // Remaining seconds for countdown (default 30 seconds for simulation)
  const [countdown, setCountdown] = useState(30);

  // Cutting animation state
  const [isCutting, setIsCutting] = useState(false);
  const [isCutDone, setIsCutDone] = useState(false);
  const [curtainsOpened, setCurtainsOpened] = useState(false);

  // 꽃비가 끝나면 장막 뒤에서 매뉴얼이 이어서 나타남 (타종 시점부터 미리 불러옴)
  const [showManual, setShowManual] = useState(false);
  const manualFrameRef = useRef(null);

  // 매뉴얼이 나타나면 키보드 초점을 매뉴얼로 옮겨 스페이스바로 바로 넘길 수 있게 함
  useEffect(() => {
    if (!showManual) return;
    const frame = manualFrameRef.current;
    frame?.focus();
    frame?.contentWindow?.focus();
    // 초점이 바깥(세레머니 화면)에 남아 있어도 넘김 키는 매뉴얼로 전달
    const forward = e => {
      const deck = manualFrameRef.current?.contentWindow?.sbaDeck;
      if (!deck) return;
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        if (e.key === ' ' && e.shiftKey) deck.prev(); else deck.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        deck.prev();
      }
    };
    window.addEventListener('keydown', forward);
    return () => window.removeEventListener('keydown', forward);
  }, [showManual]);

  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);
  const fadeTimerRef = useRef(null);

  // 숨김 트리거 노출 여부: 개원 시각(+유예) 이후엔 사라짐
  const [isTriggerAvailable, setIsTriggerAvailable] = useState(() => Date.now() < triggerHideAt);
  useEffect(() => {
    if (!isTriggerAvailable) return;
    const timer = setTimeout(() => setIsTriggerAvailable(false), Math.max(0, triggerHideAt - Date.now()));
    return () => clearTimeout(timer);
  }, [isTriggerAvailable]);

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
      clearInterval(fadeTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 나모붓다야 노래: 세레머니가 열리면 자동 재생, 진행자는 끄기만 가능 (다시 켜는 버튼 없음)
  const startSong = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/namo_buddhaya_song.mp3');
      audioRef.current.addEventListener('ended', () => setIsPlayingAudio(false));
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => setIsPlayingAudio(false));
  };

  const stopSong = () => {
    clearInterval(fadeTimerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
    }
    setIsPlayingAudio(false);
  };

  // 매뉴얼이 시작되면 노래를 약 1.5초 동안 서서히 줄이며 멈춤
  const fadeOutSong = () => {
    const audio = audioRef.current;
    if (!audio || audio.paused) { stopSong(); return; }
    clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = setInterval(() => {
      if (audio.volume <= 0.07) { stopSong(); return; }
      audio.volume = Math.max(0, audio.volume - 0.066);
    }, 100);
  };

  // 범종 타종 → 매듭이 풀리며 장막이 걷힘
  const handleStrikeBell = () => {
    if (isCutting || isCutDone) return;
    setIsCutting(true);
    strikeTempleBell();

    // 0.9s: 종소리 파문이 퍼지고 연꽃 매듭이 풀림
    setTimeout(() => {
      setIsCutDone(true);
      setCurtainsOpened(true);
    }, 900);

    // 5.2s: 꽃비가 내린 뒤 매뉴얼이 서서히 나타나고 노래는 서서히 멈춤 (닫기 버튼으로 홈으로 돌아감)
    setTimeout(() => {
      setShowManual(true);
      fadeOutSong();
    }, 5200);
  };

  const closeCeremony = () => {
    stopSong();
    setIsActive(false);
    setIsCutting(false);
    setIsCutDone(false);
    setCurtainsOpened(false);
    setShowManual(false);
  };

  // 세레머니 시작: 개원 시각까지 남은 시간(최대 30초)만큼 카운트다운 후 타종
  const startCeremony = () => {
    const remaining = Math.ceil((startAt - Date.now()) / 1000);
    setCountdown(Math.min(30, Math.max(0, remaining)));
    setIsCutting(false);
    setIsCutDone(false);
    setCurtainsOpened(false);
    setShowManual(false);
    setIsActive(true);
    // 더블클릭(사용자 조작) 직후라 브라우저 자동재생 제한 없이 바로 재생됨
    startSong();
  };

  return (
    <>
      {/* 개발자 전용 숨김 트리거: 히어로 섹션 우측 하단 모서리의 투명 버튼 (더블클릭) */}
      {!isActive && isTriggerAvailable && (
        <button
          type="button"
          className="ceremony-secret-trigger"
          onDoubleClick={startCeremony}
          tabIndex={-1}
          aria-hidden="true"
        />
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
              {/* 꽃잎 120장: 100장을 넘으면 같은 자리에 겹치지 않도록 가로 위치를 조금씩 어긋나게 둔다(떨어지는 시간대 0~1.6초는 그대로) */}
              {Array.from({ length: 120 }, (_, index) => (
                <i key={index} style={{ '--p': index, '--x': `${((index * 37) % 100) + Math.floor(index / 100) * 0.5}%`, '--d': `${(index * 53) % 1600}ms` }} />
              ))}
            </div>
          )}

          {/* 개원 후 매뉴얼: 타종 시점부터 미리 불러두고 꽃비가 끝나면 서서히 나타남 (사이트 다른 곳엔 진입 버튼 없음) */}
          {isCutting && (
            <div className={`ceremony-manual-stage ${showManual ? 'visible' : ''}`} aria-hidden={!showManual}>
              <iframe ref={manualFrameRef} src="/sba-manual.html?mode=slides" title="세화붓다아카데미 사용자 및 관리자 매뉴얼" />
            </div>
          )}

          {/* Top Controls: Audio & Exit */}
          <div className={`ceremony-top-controls ${showManual ? 'manual-mode' : ''}`}>
            {isPlayingAudio && (
              <button
                type="button"
                className="btn-ceremony-tool"
                onClick={stopSong}
                aria-label="나모붓다야 노래 끄기"
              >
                <span>🔊 소리 끄기</span>
              </button>
            )}
            <button
              type="button"
              className="btn-ceremony-tool"
              style={{ background: 'rgba(239, 68, 68, 0.25)', borderColor: '#EF4444', color: '#FCA5A5' }}
              onClick={closeCeremony}
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
              나모붓다야, 세화붓다아카데미
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
