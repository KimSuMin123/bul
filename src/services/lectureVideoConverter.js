// 관리자가 올리는 강의 영상을 브라우저에서 모든 기기 호환 형식으로 자동 변환한다.
// 기준은 원본 일괄 재압축(video_compat.py)과 같다: H.264(High) · 1080p Level 4.0(초과 시 720p) ·
// yuv420 표준 색 범위 · 정사각 픽셀 · 고정 30fps · AAC 64kbps 스테레오 · faststart · 45MB 이하.
// 브라우저 내장 하드웨어 인코더(WebCodecs)를 쓰므로 변환하는 동안 탭을 열어 두어야 한다.
import {
  ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, UnsupportedInputFormatError
} from 'mediabunny';

const MB = 1024 * 1024;
export const LECTURE_VIDEO_LIMIT_BYTES = 45 * MB;
const AUDIO_BITRATE = 64000;
// 브라우저 인코더는 목표 비트레이트를 거의 다 채우므로, 45MB 한도가 아니라 슬라이드 강의에 충분한 값을 목표로 둔다
const TARGET_VIDEO_BITRATE = { 1080: 250000, 720: 180000 };

// 브라우저 내장 인코더가 못 읽는 형식은 ffmpeg(wasm) 경로로 넘긴다
class NeedsFfmpegError extends Error {}
const FFMPEG_EXTENSIONS = /\.(avi|wmv|flv|mpe?g|ts|m2ts|3gp|asf|vob)$/i;

export function supportsBrowserVideoConversion() {
  return typeof window !== 'undefined' && typeof window.VideoEncoder === 'function' && typeof window.AudioEncoder === 'function';
}

function openInput(file) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

// 이미 호환 형식인지 확인하고 영상 길이를 함께 돌려준다.
async function inspect(file) {
  const input = openInput(file);
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error('영상 트랙을 찾을 수 없습니다. 다른 파일을 선택해 주세요.');
    const codec = (await video.getCodecParameterString()) || '';
    const avc = /^avc1\.([0-9a-f]{2})[0-9a-f]{2}([0-9a-f]{2})$/i.exec(codec);
    const profile = avc ? parseInt(avc[1], 16) : 0;
    const level = avc ? parseInt(avc[2], 16) : 0xff;
    let fullRange = false;
    try { fullRange = (await video.getColorSpace())?.fullRange === true; } catch { /* 색 정보 없음 = 표준으로 간주 */ }
    const audio = await input.getPrimaryAudioTrack();
    const size = `${video.displayWidth}x${video.displayHeight}`;
    const duration = await input.computeDuration();
    const compatible = Boolean(avc) && [0x42, 0x4d, 0x64].includes(profile) && level <= 0x28
      && (size === '1920x1080' || size === '1280x720') && !fullRange
      && (!audio || audio.codec === 'aac')
      && file.size <= LECTURE_VIDEO_LIMIT_BYTES && /mp4/i.test(file.type || file.name);
    return { compatible, duration, height: video.displayHeight };
  } catch (error) {
    if (error instanceof UnsupportedInputFormatError) throw new NeedsFfmpegError('unsupported');
    throw error;
  } finally {
    input.dispose();
  }
}

async function convertOnce(file, height, videoBitrate, onRatio) {
  const input = openInput(file);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  try {
    const conversion = await Conversion.init({
      input, output, tracks: 'primary', showWarnings: false,
      video: {
        width: height === 1080 ? 1920 : 1280, height, fit: 'contain', frameRate: 30,
        codec: 'avc', bitrate: videoBitrate, keyFrameInterval: 5, forceTranscode: true
      },
      // 원본 오디오가 AAC면 다시 인코딩하지 않고 그대로 복사(AAC 인코더가 없는 브라우저에서도 소리 보존)
      audio: { codec: 'aac' }
    });
    const inputHasAudio = Boolean(await input.getPrimaryAudioTrack());
    const audioDropped = conversion.discardedTracks.some(item => item.track?.type === 'audio');
    // 소리를 못 옮기거나 영상을 못 읽으면 ffmpeg 경로로 넘긴다(소리 없는 강의 방지)
    if ((inputHasAudio && audioDropped) || !conversion.isValid) throw new NeedsFfmpegError('decode');
    conversion.onProgress = ratio => onRatio(ratio);
    await conversion.execute();
    return output.target.buffer;
  } catch (error) {
    if (error instanceof UnsupportedInputFormatError) throw new NeedsFfmpegError('unsupported');
    throw error;
  } finally {
    input.dispose();
  }
}

/**
 * 업로드 직전에 호출한다. 이미 호환 형식이면 원본을, 아니면 변환한 mp4 파일을 돌려준다.
 * onProgress 는 관리자 화면의 기존 진행률 표시와 같은 모양({ step: 'processing', percent, compressSec })으로 불린다.
 */
export async function prepareLectureVideo(file, onProgress) {
  const started = Date.now();
  let phase = '영상 확인 중';
  const report = (ratio, attemptLabel = phase) => onProgress?.({
    step: 'processing', percent: Math.min(99, Math.round(ratio * 100)), loaded: 0, total: file.size,
    compressSec: Math.round((Date.now() - started) / 1000), speed: attemptLabel
  });
  const originalMb = +(file.size / MB).toFixed(1);
  const name = `${(file.name || 'lecture').replace(/\.[^.]+$/, '')}.mp4`;
  const done = (buffer, height, duration) => ({
    file: new File([buffer], name, { type: 'video/mp4' }), converted: true, height, duration,
    originalMb, resultMb: +(buffer.byteLength / MB).toFixed(1)
  });
  const tooBig = bytes => new Error(`변환 후에도 ${(bytes / MB).toFixed(1)}MB로 45MB를 넘습니다. 영상을 나눠서 올려 주세요.`);

  const viaFfmpeg = async () => {
    const { convertWithFfmpeg } = await import('./lectureVideoFfmpeg.js');
    const result = await convertWithFfmpeg(file, LECTURE_VIDEO_LIMIT_BYTES, ratio => report(ratio), label => { phase = label; report(0); });
    if (result.buffer.byteLength > LECTURE_VIDEO_LIMIT_BYTES) throw tooBig(result.buffer.byteLength);
    return done(result.buffer, result.height, result.duration);
  };

  report(0);
  if (FFMPEG_EXTENSIONS.test(file.name || '')) return viaFfmpeg();
  let info;
  try {
    info = await inspect(file);
  } catch (error) {
    if (error instanceof NeedsFfmpegError) return viaFfmpeg();
    throw error;
  }
  const { compatible, duration, height: sourceHeight } = info;
  if (compatible) return { file, converted: false, duration, originalMb, resultMb: originalMb };
  if (!supportsBrowserVideoConversion()) return viaFfmpeg();

  // 45MB 안에 들어가도록 길이에 맞춰 비트레이트를 정한다(컨테이너 여유분 10% 확보).
  const seconds = Math.max(1, duration);
  const videoBudget = Math.floor((LECTURE_VIDEO_LIMIT_BYTES * 8 * 0.9) / seconds) - AUDIO_BITRATE;
  // 1080p로 먼저 만들고, 45MB를 넘으면 720p로 다시 만든다. 원본이 720p 이하면 1080p로 키우지 않는다.
  const attempts = [
    [720, Math.max(60000, Math.min(Math.floor(videoBudget * 0.8), TARGET_VIDEO_BITRATE[720]))],
    [720, Math.max(60000, Math.floor(videoBudget * 0.6))]
  ];
  if (!(sourceHeight <= 720)) attempts.unshift([1080, Math.max(120000, Math.min(videoBudget, TARGET_VIDEO_BITRATE[1080]))]);

  let last;
  for (const [index, [height, bitrate]] of attempts.entries()) {
    const label = `${height}p 변환${index ? ' (재시도)' : ''}`;
    let buffer;
    try {
      buffer = await convertOnce(file, height, bitrate, ratio => report(ratio, label));
    } catch (error) {
      if (error instanceof NeedsFfmpegError) return viaFfmpeg();
      throw error;
    }
    last = buffer;
    if (buffer.byteLength <= LECTURE_VIDEO_LIMIT_BYTES) return done(buffer, height, duration);
  }
  throw tooBig(last.byteLength);
}
