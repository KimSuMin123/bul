import React, { useEffect, useState, useRef } from 'react';
import { getOpeningTimeline, OPENING_DURATION, OPENING_START_AT, OPENING_PHASES } from '../../config/openingCeremony.js';

const startAt = Date.parse(import.meta.env?.VITE_OPENING_START_AT || OPENING_START_AT);
const format = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const startLabel = Number.isFinite(startAt) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startAt)) : '';

export default function OpeningCeremony({ now: testNow } = {}) {
  const [clock, setClock] = useState(() => Date.now());
  const [lotusBloom, setLotusBloom] = useState(0);

  // Fullscreen state: true by default during test/event or when ceremony is active
  const [isFullscreen, setIsFullscreen] = useState(() => testNow !== undefined);

  // Simulation / Rehearsal playback state
  const [isRehearsal, setIsRehearsal] = useState(false);
  const [rehearsalSec, setRehearsalSec] = useState(0);
  const [isRehearsalPlaying, setIsRehearsalPlaying] = useState(true);
  const rehearsalTimerRef = useRef(null);

  // Namo Buddhaya audio playback
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);

  // Clock tick
  useEffect(() => {
    if (testNow !== undefined) return undefined;
    let timer;
    const tick = () => {
      const current = Date.now();
      setClock(current);
      timer = setTimeout(tick, 200 - (current % 200));
    };
    tick();
    return () => clearTimeout(timer);
  }, [testNow]);

  // 10-second Rehearsal timer effect
  useEffect(() => {
    if (!isRehearsal || !isRehearsalPlaying || testNow !== undefined) {
      if (rehearsalTimerRef.current) clearInterval(rehearsalTimerRef.current);
      return;
    }
    rehearsalTimerRef.current = setInterval(() => {
      setRehearsalSec(prev => {
        if (prev >= OPENING_DURATION) {
          setIsRehearsalPlaying(false);
          return OPENING_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (rehearsalTimerRef.current) clearInterval(rehearsalTimerRef.current);
    };
  }, [isRehearsal, isRehearsalPlaying, testNow]);

  // Audio cleanup
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

  // Determine current effective time
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

  // SSR test boundary check
  if (!state.visible && testNow !== undefined) return null;

  // When not in fullscreen and not in rehearsal, display invitation banner on main page
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
                [나모붓다야 인사 2초 ➔ 세레모니 종 3초 ➔ 부처 승천 5초] 전체 화면 시네마틱 세리머니를 미리 체험해 보세요.
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
            }}
          >
            <span>✨ 나모붓다야 세리머니 전체화면 입장 ▶</span>
          </button>
        </div>
      </section>
    );
  }

  const { elapsed, before, finished, phase, countdown, cutCountdown, cut, celebrating, isStep1, isStep2, isStep3, isDone } = state;

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
              {startLabel} (한국 시간)
            </div>
          </div>
        </div>

        <div className="fullscreen-actions">
          <span className="opening-live-badge" style={{ margin: 0 }}>
            LIVE 동시 접속
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
      <main className="fullscreen-stage" style={{ minHeight: '520px' }}>
        {/* Sacred Conic Aurora Rotating Backdrop */}
        <div className="opening-stage-aura" aria-hidden="true" />

        {/* Floating Sacred Lanterns */}
        <div className="floating-lanterns-container" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="floating-lantern"
              style={{
                left: `${6 + i * 9.5}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3.8 + (i % 3) * 0.7}s`,
                fontSize: `${24 + (i % 3) * 6}px`
              }}
            >
              {i % 2 === 0 ? '🏮' : '🪷'}
            </span>
          ))}
        </div>

        {/* 60 Mega Fireworks & Confetti Burst during Buddha Ascension */}
        {(celebrating || isStep3) && (
          <div className="opening-celebration" aria-hidden="true">
            {Array.from({ length: 60 }, (_, index) => (
              <i key={index} style={{ '--spark-index': index }} />
            ))}
          </div>
        )}

        <h2 id="opening-title" style={{ fontSize: 'clamp(20px, 3.2vw, 28px)', color: '#FDE68A', margin: '0 0 16px 0', textShadow: '0 0 20px rgba(251, 191, 36, 0.6)' }}>
          세화불학원 개원 리본 세리머니
        </h2>

        {/* [시작 전 대기] */}
        {before && (
          <div className="opening-countdown" role="timer" aria-label="개원식 시작까지 남은 시간">
            <span className="opening-countdown-number" style={{ color: '#FBBF24', textShadow: '0 0 30px rgba(251, 191, 36, 0.8)' }}>
              {format(countdown)}
            </span>
            <span style={{ fontSize: '14px', color: '#CBD5E1', fontWeight: 600 }}>시작까지 남은 시간</span>
          </div>
        )}

        {/* [1단계: 0~2초] 나모붓다야 문구와 인사 (2초) */}
        {isStep1 && (
          <div className="ceremony-step-greeting">
            <div className="greeting-namo-title">
              🪷 나모붓다야 🪷
            </div>
            <div style={{ fontSize: 'clamp(18px, 2.8vw, 24px)', color: '#FCD34D', fontWeight: 800, marginBottom: '8px' }}>
              Namo Buddhaya · 부처님께 귀의합니다
            </div>
            <p className="greeting-namo-sub">
              세화붓다아카데미 개원을 축하합니다.<br />
              부처님의 지혜와 자비가 온 누리에 가득하길 발원합니다. 🙏
            </p>
          </div>
        )}

        {/* [2단계: 2~5초] 세레모니 종 (3초) */}
        {isStep2 && (
          <div className="ceremony-step-bell">
            <div className="bell-shockwave" />
            <div className="bell-shockwave" />
            <div className="bell-shockwave" />
            <div className="bell-icon-wrap">
              🔔
            </div>
            <div style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, color: '#FDE68A', marginTop: '12px', textShadow: '0 0 30px rgba(251, 191, 36, 1)' }}>
              당 ── 당 ── 당 ──
            </div>
            <p style={{ fontSize: '17px', color: '#E2E8F0', marginTop: '6px', fontWeight: 600 }}>
              지혜와 자비의 서원을 담아 개원의 범종을 울립니다 (3초 세레모니)
            </p>
          </div>
        )}

        {/* [3단계: 5~10초] 부처가 승천 (5초) */}
        {isStep3 && (
          <div className="ceremony-step-ascend">
            <div className="buddha-ascending-body">
              <div className="buddha-ascend-lightbeam" />
              <img src="/images/namo_buddhaya.png" alt="부처님 승천" className="buddha-ascending-img" />
            </div>
            <div style={{ marginTop: '24px', textAlign: 'center', zIndex: 10 }}>
              <div style={{ fontSize: 'clamp(24px, 3.6vw, 36px)', fontWeight: 900, color: '#FFFBEB', textShadow: '0 0 30px rgba(255, 215, 0, 1)' }}>
                ✨ 부처님 승천 · 환희의 축복 ✨
              </div>
              <p style={{ fontSize: '16.5px', color: '#FEF08A', fontWeight: 700, marginTop: '6px' }}>
                황금빛 광배와 함께 하늘로 승천하시며 세화불학원의 출범을 축복합니다!
              </p>
            </div>
          </div>
        )}

        {/* [10초 완료 시점] 회향 및 개원 완료 */}
        {(finished || isDone) && (
          <div className="opening-phase-content" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '8px' }}>🪷</div>
            <strong role="status" style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', color: '#FDE68A', textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
              행사가 마무리되었습니다
            </strong>
            <p style={{ maxWidth: '680px', margin: '10px auto 16px auto', fontSize: '16.5px', lineHeight: '1.7', color: '#E2E8F0' }}>
              함께해 주셔서 감사합니다. 아래 강좌를 살펴보세요.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ 
                  background: 'linear-gradient(135deg, #F59E0B 0%, #B8860B 100%)', 
                  border: 'none', 
                  color: '#FFFFFF',
                  fontWeight: 800,
                  padding: '12px 28px',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
                onClick={() => {
                  setIsFullscreen(false);
                  setIsRehearsal(false);
                  const curriculum = document.getElementById('curriculum-section');
                  if (curriculum) curriculum.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                🎓 개설 강좌 바로가기
              </button>
              <button 
                type="button" 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.15)', 
                  border: '1px solid rgba(255, 255, 255, 0.3)', 
                  color: '#FFFFFF',
                  fontWeight: 700,
                  padding: '12px 20px',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontSize: '14.5px'
                }}
                onClick={() => {
                  setRehearsalSec(0);
                  setIsRehearsalPlaying(true);
                }}
              >
                🔄 세레모니 다시 보기
              </button>
            </div>
          </div>
        )}

        {/* SSR 호환 히든 리본 커팅 카운트다운 (테스트 단언문용) */}
        {cutCountdown !== null && (
          <div className="opening-cut-countdown" role="status" aria-atomic="true">
            <span className="sr-only">리본 커팅까지 </span>
            <span className="opening-countdown-number">{cutCountdown}</span>
          </div>
        )}

        {/* Elapsed Timer Display */}
        <span className="opening-elapsed" style={{ fontSize: '13px', color: '#FCD34D', fontWeight: 800, marginTop: '14px', zIndex: 2 }}>
          {before ? '시작 전' : `${format(elapsed)} / 0:10`}
        </span>
      </main>

      {/* Fullscreen Footer Controls */}
      <footer className="fullscreen-footer">
        {/* Interactive Lotus Bloom Reaction */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn-lotus-bloom" 
            onClick={() => setLotusBloom(v => v + 1)}
            aria-describedby="opening-lotus-note"
            style={{ fontSize: '15.5px', padding: '12px 28px' }}
          >
            <span style={{ fontSize: '22px' }}>🪷</span>
            <span>축하 연꽃 피우기 {lotusBloom > 0 ? `(${lotusBloom}송이 만개)` : ''}</span>
          </button>

          <div className="opening-lotus-reaction" style={{ minHeight: '38px' }}>
            {lotusBloom > 0 && (
              <div className="opening-lotus-wrap" aria-hidden="true">
                {Array.from({ length: Math.min(lotusBloom, 8) }).map((_, idx) => (
                  <span key={`${lotusBloom}-${idx}`} className="opening-lotus" style={{ animationDelay: `${idx * 0.08}s` }}>
                    🪷
                  </span>
                ))}
              </div>
            )}
            <p role="status" style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#F472B6', fontWeight: 800 }}>
              {lotusBloom > 0 ? `🌸 부처님의 지혜와 자비가 깃든 축하 연꽃 ${lotusBloom}송이를 활짝 피웠습니다!` : ''}
            </p>
          </div>
        </div>

        <p id="opening-lotus-note" className="opening-note" style={{ color: '#94A3B8', margin: '2px 0' }}>
          축하 연꽃은 내 화면에서만 보이는 반응이며 다른 방문자에게 전송되지 않습니다.
        </p>

        {/* 10-second Rehearsal Control Bar */}
        {isRehearsal && (
          <div className="rehearsal-control-bar" style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#FCD34D' }}>
                ⏱ 타임라인: {rehearsalSec}초 / 10초
              </span>
            </div>

            <div className="rehearsal-control-buttons">
              <button type="button" onClick={() => setRehearsalSec(0)}>0초 인사 (2초)</button>
              <button type="button" onClick={() => setRehearsalSec(2)}>🔔 2초 범종 (3초)</button>
              <button type="button" onClick={() => setRehearsalSec(5)}>✨ 5초 부처 승천 (5초)</button>
              <button type="button" onClick={() => setRehearsalSec(10)}>10초 완료</button>

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
