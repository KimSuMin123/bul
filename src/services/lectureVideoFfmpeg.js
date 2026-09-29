// 브라우저 내장 인코더가 읽지 못하는 영상(AVI 등, 예: MJPEG+PCM 녹화본)을 브라우저 안의 ffmpeg(wasm)로 변환한다.
// 설정은 PC 변환 도구(tools/video-converter, video_compat.py)와 같다. 원본은 메모리에 복사하지 않고 WORKERFS로 연결해 수 GB 파일도 처리한다.
// ffmpeg 엔진(약 30MB)은 이 경로를 쓸 때만 내려받는다.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_BASE = import.meta.env.VITE_FFMPEG_CORE_BASE || 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
let loading = null;

function loadFFmpeg() {
  loading ??= (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
    });
    return ffmpeg;
  })().catch(error => { loading = null; throw error; });
  return loading;
}

function buildArgs(input, output, height, crf) {
  const width = height === 1080 ? 1920 : 1280;
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos:out_range=tv:out_color_matrix=bt709,`
    + `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;
  return ['-hide_banner', '-y', '-i', input, '-vf', vf,
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-crf', String(crf), '-preset', 'veryfast', '-g', '150',
    '-c:a', 'aac', '-b:a', '64k', '-ac', '2', '-ar', '44100', '-movflags', '+faststart', output];
}

/**
 * @returns {Promise<{ buffer: Uint8Array, height: number, duration: number }>}
 */
export async function convertWithFfmpeg(file, limitBytes, onRatio, onPhase) {
  onPhase?.('변환 엔진 준비 (처음 한 번 약 30MB 내려받기)');
  const ffmpeg = await loadFFmpeg();
  const dir = `/in_${Date.now()}`;
  const ext = (file.name.match(/\.[^.]+$/) || ['.avi'])[0].toLowerCase();
  // 한글·공백 없는 이름으로 연결(내용은 복사하지 않음)
  const source = new File([file], `input${ext}`, { type: file.type });
  const input = `${dir}/input${ext}`;
  const output = 'lecture-output.mp4';
  const logs = [];
  const onLog = ({ message }) => { if (logs.length < 400) logs.push(message); };
  const onProgress = ({ progress }) => onRatio(Math.max(0, Math.min(1, progress || 0)));
  await ffmpeg.createDir(dir);
  await ffmpeg.mount('WORKERFS', { files: [source] }, dir);
  ffmpeg.on('log', onLog);
  try {
    await ffmpeg.exec(['-hide_banner', '-i', input]); // 정보만 읽음(종료 코드는 무시)
    const text = logs.join('\n');
    const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
    const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
    const size = /Video: [^\n]*?(\d{3,5})x(\d{3,5})/.exec(text);
    if (!size) throw new Error('영상 정보를 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.');
    // 1080p(Level 4.0)로 먼저 만들고, 45MB를 넘으면 720p(Level 4.0)로 다시 만든다
    const attempts = [[1080, 28], [720, 28], [720, 31]];
    ffmpeg.on('progress', onProgress);
    let last = null;
    for (const [index, [height, crf]] of attempts.entries()) {
      onPhase?.(`${height}p 변환${index ? ' (재시도)' : ''}`);
      onRatio(0);
      const code = await ffmpeg.exec(buildArgs(input, output, height, crf));
      if (code !== 0) throw new Error('영상 변환에 실패했습니다. 업로드 창의 [변환 도구 내려받기]로 PC에서 변환한 mp4 파일을 올려 주세요.');
      const buffer = await ffmpeg.readFile(output);
      await ffmpeg.deleteFile(output);
      last = { buffer, height, duration };
      if (buffer.byteLength <= limitBytes) return last;
    }
    return last;
  } finally {
    ffmpeg.off('log', onLog);
    ffmpeg.off('progress', onProgress);
    await ffmpeg.unmount(dir).catch(() => {});
    await ffmpeg.deleteDir(dir).catch(() => {});
  }
}
