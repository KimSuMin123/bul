import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw,
  CheckCircle2, FastForward, Clock, X
} from 'lucide-react';
import { useCourse } from '../../context/CourseContext';

const PLAYBACK_RATES = [0.8, 1.0, 1.2, 1.25, 1.5];

export default function VideoPlayer({
  lecture,
  userId,
  onEnded,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  seekTime,
  onCurrentTimeChange
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { getLectureProgress, updateProgress } = useCourse();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [resumeNotice, setResumeNotice] = useState(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  const controlsTimeoutRef = useRef(null);
  const dismissedResumeRef = useRef({});
  const lastSavedSecRef = useRef(0);
  const lastTimeRef = useRef(0);
  const cumulativeWatchedRef = useRef(0);

  // Sync fullscreen change events (native & webkit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      if (!isNativeFs && !isPseudoFullscreen) {
        setIsFullscreen(false);
      } else if (isNativeFs) {
        setIsFullscreen(true);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPseudoFullscreen]);

  // Lock body scroll during pseudo fullscreen
  useEffect(() => {
    if (isPseudoFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPseudoFullscreen]);

  // Clean up controls debounce timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Load saved progress on lecture change (once per lecture)
  useEffect(() => {
    if (!lecture?.id || !userId) return;

    lastSavedSecRef.current = 0;

    // Only prompt resume once per lecture session
    if (!dismissedResumeRef.current[lecture.id]) {
      const saved = getLectureProgress(userId, lecture.id);
      if (saved && saved.lastPlayedSeconds > 10 && !saved.completed) {
        setResumeNotice(saved.lastPlayedSeconds);
      } else {
        setResumeNotice(null);
      }
      setJustCompleted(saved?.completed || false);
    } else {
      setResumeNotice(null);
    }
    setIsPlaying(false);
  }, [lecture?.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // External seekTime trigger (e.g. from Q&A timestamp click)
  useEffect(() => {
    if (seekTime && typeof seekTime.time === 'number' && videoRef.current) {
      if (lecture?.id) dismissedResumeRef.current[lecture.id] = true;
      videoRef.current.currentTime = seekTime.time;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.log('Playback start notice:', err));
      setCurrentTime(seekTime.time);
      setResumeNotice(null);
    }
  }, [seekTime, lecture?.id]);

  // Handle Resume
  const handleResume = () => {
    if (lecture?.id) {
      dismissedResumeRef.current[lecture.id] = true;
    }
    if (videoRef.current && resumeNotice) {
      videoRef.current.currentTime = resumeNotice;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setResumeNotice(null);
    }
  };

  const handleDismissResume = () => {
    if (lecture?.id) {
      dismissedResumeRef.current[lecture.id] = true;
    }
    setResumeNotice(null);
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (lecture?.id) {
        dismissedResumeRef.current[lecture.id] = true;
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setResumeNotice(null);
    }
  };

  // Progress Update
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || lecture.durationSeconds;
    setCurrentTime(curr);
    setDuration(dur);

    // Save progress every ~5 seconds only when actively playing
    if (!videoRef.current.paused && Math.abs(curr - lastSavedSecRef.current) >= 5) {
      lastSavedSecRef.current = curr;
      updateProgress(userId, lecture.id, curr, dur);
    }

    if (onCurrentTimeChange) {
      onCurrentTimeChange(curr);
    }
  };

  // Video Loaded Metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Video Ended
  const handleEnded = () => {
    setIsPlaying(false);
    updateProgress(userId, lecture.id, duration || lecture.durationSeconds, duration || lecture.durationSeconds);
    setJustCompleted(true);
    if (onEnded) {
      onEnded();
    }
  };

  // Scrubber Click
  const handleScrubberClick = (e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Speed change
  const handleSpeedChange = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
    }
  };

  // Volume toggle
  const toggleMute = () => {
    if (!videoRef.current) return;
    const targetMute = !isMuted;
    videoRef.current.muted = targetMute;
    setIsMuted(targetMute);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  // Jump forward / backward
  const handleSkip = (seconds) => {
    if (!videoRef.current) return;
    const target = Math.min(Math.max(0, videoRef.current.currentTime + seconds), duration || lecture?.durationSeconds || 0);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  // Fullscreen - Universal Mobile & Desktop Support
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const isNativeFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    // 1. If currently in fullscreen (native or pseudo) -> Exit
    if (isFullscreen || isPseudoFullscreen || isNativeFs) {
      if (document.exitFullscreen) {
        try { await document.exitFullscreen(); } catch (e) {}
      } else if (document.webkitExitFullscreen) {
        try { document.webkitExitFullscreen(); } catch (e) {}
      } else if (document.mozCancelFullScreen) {
        try { document.mozCancelFullScreen(); } catch (e) {}
      } else if (document.msExitFullscreen) {
        try { document.msExitFullscreen(); } catch (e) {}
      }

      if (video && typeof video.webkitExitFullscreen === 'function') {
        try { video.webkitExitFullscreen(); } catch (e) {}
      }

      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      return;
    }

    // 2. Check for iOS Mobile Safari (iPhone)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && video && typeof video.webkitEnterFullscreen === 'function') {
      try {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('iOS video.webkitEnterFullscreen notice, falling back to pseudo fullscreen', err);
      }
    }

    // 3. Try standard container fullscreen (Android Chrome, iPads, Desktop)
    if (container.requestFullscreen) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('container.requestFullscreen failed, trying webkit/pseudo', err);
      }
    }

    if (container.webkitRequestFullscreen) {
      try {
        container.webkitRequestFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('container.webkitRequestFullscreen failed', err);
      }
    }

    if (container.mozRequestFullScreen) {
      try {
        container.mozRequestFullScreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('container.mozRequestFullScreen failed', err);
      }
    }

    if (container.msRequestFullscreen) {
      try {
        container.msRequestFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('container.msRequestFullscreen failed', err);
      }
    }

    // 4. Try video webkitEnterFullscreen if container failed
    if (video && typeof video.webkitEnterFullscreen === 'function') {
      try {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('video.webkitEnterFullscreen fallback failed', err);
      }
    }

    // 5. Universal bulletproof fallback: CSS Pseudo Fullscreen
    setIsPseudoFullscreen(true);
    setIsFullscreen(true);
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Show/hide controls with debounce
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`player-wrapper ${!showControls && isPlaying ? 'hide-controls' : ''} ${isPseudoFullscreen || isFullscreen ? 'is-fullscreen' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      onClick={() => { if (showSpeedMenu) setShowSpeedMenu(false); }}
    >
      {/* HTML5 Video */}
      <video
        ref={videoRef}
        className="player-video"
        src={lecture?.videoUrl || ''}
        poster={lecture?.thumbnail || undefined}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onClick={togglePlay}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
          setResumeNotice(null);
          if (lecture?.id) dismissedResumeRef.current[lecture.id] = true;
        }}
        onPause={() => setIsPlaying(false)}
        playsInline
      />

      {/* Buffering Indicator Overlay */}
      {isBuffering && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 15,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          padding: '14px 22px',
          borderRadius: '12px',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            border: '3px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: 'var(--color-amber)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <span style={{ color: '#FFFFFF', fontSize: '12.5px', fontWeight: 500, letterSpacing: '-0.2px' }}>영상 로딩 중...</span>
        </div>
      )}

      {/* Floating Exit Button when in Fullscreen */}
      {(isPseudoFullscreen || isFullscreen) && (
        <button
          className="player-exit-fs-float-btn"
          onClick={toggleFullscreen}
          title="전체화면 닫기 (ESC)"
        >
          <Minimize size={16} />
          <span>전체화면 종료</span>
        </button>
      )}

      {/* Resume Smart Alert */}
      {resumeNotice && !isPlaying && (
        <div className="player-resume-alert" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--color-amber)" />
            <span>이전 시청 위치 <strong>{formatTime(resumeNotice)}</strong>가 저장되어 있습니다.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-amber btn-sm" onClick={handleResume}>
              이어보기
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#CBD5E1' }} onClick={handleDismissResume}>
              처음부터
            </button>
          </div>
        </div>
      )}

      {/* Completion Banner (Responsive & Non-blocking) */}
      {justCompleted && (
        <div
          className="player-complete-banner"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="var(--color-amber)" />
            <span>본 차시 완강 완료 (진도율 100%) - 다음 차시가 열렸습니다.</span>
          </div>
          <button 
            onClick={() => setJustCompleted(false)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#CBD5E1', 
              cursor: 'pointer', 
              padding: '2px 4px', 
              display: 'flex', 
              alignItems: 'center' 
            }}
            title="배너 닫기"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Big Center Play Icon when paused */}
      {!isPlaying && (
        <div className="player-center-play" onClick={togglePlay}>
          <Play size={32} fill="#FFFFFF" style={{ marginLeft: '4px' }} />
        </div>
      )}

      {/* Bottom Controls Overlay */}
      <div className="player-controls-overlay" onClick={(e) => e.stopPropagation()}>
        {/* Scrubber */}
        <div className="player-scrubber-container" onClick={handleScrubberClick}>
          <div className="player-scrubber-fill" style={{ width: `${progressPercent}%` }}>
            <div className="player-scrubber-thumb"></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="player-toolbar">
          <div className="player-toolbar-left">
            <button className="player-btn" onClick={togglePlay} title={isPlaying ? '일시정지' : '재생'}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} fill="#FFFFFF" />}
            </button>

            <button className="player-btn" onClick={() => handleSkip(-10)} title="10초 뒤로">
              <RotateCcw size={17} />
            </button>

            <button className="player-btn" onClick={() => handleSkip(10)} title="10초 앞으로">
              <FastForward size={17} />
            </button>

            <button className="player-btn" onClick={toggleMute} title="음소거 토글">
              {isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>

            <div className="player-time">
              <span>{formatTime(currentTime)}</span>
              <span style={{ margin: '0 4px', opacity: 0.5 }}>/</span>
              <span>{formatTime(duration || lecture.durationSeconds)}</span>
            </div>
          </div>

          <div className="player-toolbar-right">
            {/* Speed Selector Popover */}
            <div className="speed-selector-wrapper">
              <button
                className="speed-badge-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(!showSpeedMenu);
                }}
                title="재생 속도"
              >
                {playbackRate.toFixed(1)}x
              </button>

              {showSpeedMenu && (
                <div className="speed-menu-popover">
                  <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', padding: '2px 0 4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
                    재생 속도
                  </div>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      className={`speed-menu-item ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => handleSpeedChange(rate)}
                    >
                      {rate.toFixed(rate % 1 === 0 ? 1 : 2)}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button 
              className="player-btn" 
              onClick={toggleFullscreen} 
              title={isFullscreen || isPseudoFullscreen ? '전체화면 종료' : '전체화면'}
            >
              {isFullscreen || isPseudoFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
