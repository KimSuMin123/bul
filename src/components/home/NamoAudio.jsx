import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getNamoAudioUrl } from '../../services/mediaStorage.js';

const env = import.meta.env || {};
const override = (env.VITE_NAMO_AUDIO_URL || '').trim();
const cloudMode = !override && env.VITE_NAMO_AUDIO_SOURCE === 'cloud';
const canSign = cloudMode && Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
const initialSource = override || (cloudMode ? '' : '/audio/namo_buddhaya_song.mp3');

export default function NamoAudio() {
  const audio = useRef(null);
  const [state, setState] = useState(initialSource ? 'idle' : canSign ? 'preparing' : 'unavailable');
  const [error, setError] = useState('');
  const [source, setSource] = useState(initialSource);
  const prepare = useCallback(async () => {
    if (!canSign) return;
    setState('preparing'); setError('');
    try { setSource(await getNamoAudioUrl()); setState('idle'); }
    catch { setError('음성 주소를 준비하지 못했습니다. 다시 시도해 주세요.'); setState('unavailable'); }
  }, []);
  useEffect(() => {
    const element = new Audio();
    element.preload = 'none';
    audio.current = element;
    const ended = () => setState('idle');
    const failed = () => { setState('idle'); setError('음성을 재생할 수 없습니다. 주소를 새로 준비해 주세요.'); };
    element.addEventListener('ended', ended);
    element.addEventListener('error', failed);
    if (canSign) prepare();
    return () => { element.pause(); element.removeAttribute('src'); element.load(); element.removeEventListener('ended', ended); element.removeEventListener('error', failed); audio.current = null; };
  }, [prepare]);
  useEffect(() => { if (audio.current && source) audio.current.src = source; }, [source]);
  const toggle = async () => {
    const element = audio.current;
    if (!element || !source || state === 'loading') return;
    if (!element.paused) { element.pause(); setState('paused'); return; }
    setError(''); setState('loading');
    try { await element.play(); setState('playing'); }
    catch { setState('idle'); setError('음성 재생이 차단되었거나 주소가 만료되었습니다. 주소를 새로 준비한 뒤 다시 눌러 주세요.'); }
  };
  return <div className="namo-audio">
    <button type="button" className="namo-audio-button" onClick={toggle} disabled={!source || state === 'loading'} aria-label={source ? `나모붓다야 음성 ${state === 'playing' ? '일시정지' : '재생'}` : '나모붓다야 음성 준비 중'} aria-pressed={state === 'playing'}><img src="/images/namo_buddhaya.png" alt="" /></button>
    <p role="status">{state === 'preparing' ? '음성 주소를 준비하는 중…' : state === 'unavailable' ? '나모붓다야 음성을 준비하지 못했습니다.' : state === 'loading' ? '음성을 불러오는 중…' : state === 'playing' ? '음성 재생 중 · 그림을 누르면 일시정지' : state === 'paused' ? '음성 일시정지 · 그림을 누르면 이어 듣기' : '그림을 눌러 나모붓다야 듣기'}</p>
    {error && <p role="alert" className="announcement-error">{error}</p>}
    {canSign && state !== 'preparing' && (error || state === 'unavailable') && <button type="button" className="btn btn-secondary btn-sm" onClick={prepare}>음성 주소 다시 준비</button>}
  </div>;
}
