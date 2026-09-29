// 관리자 강의 영상의 백그라운드 처리 대기열.
// 등록/교체를 누르면 창은 바로 닫히고, 여기서 차례대로 [호환 형식 변환 → 업로드 → 차시 적용]을 진행한다.
// 페이지를 옮겨 다녀도 같은 탭 안에서는 계속 진행되며, 탭을 닫으려 하면 경고한다.
import { uploadLectureVideo } from './mediaStorage.js';

// 변환 라이브러리는 무거우므로 실제로 영상을 처리할 때만 불러온다(일반 방문자 화면 로딩에 영향 없음)
const loadConverter = async () => (await import('./lectureVideoConverter.js')).prepareLectureVideo;

let jobs = [];
const tasks = new Map();
const listeners = new Set();
let running = false;

const notify = () => listeners.forEach(listener => listener());
const update = (id, patch) => { jobs = jobs.map(job => (job.id === id ? { ...job, ...patch } : job)); notify(); };

export const subscribeLectureUploads = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getLectureUploads = () => jobs;
export const hasActiveLectureUploads = () => jobs.some(job => !['done', 'error'].includes(job.stage));

export function dismissLectureUpload(id) {
  jobs = jobs.filter(job => job.id !== id || !['done', 'error'].includes(job.stage));
  notify();
}

/**
 * @param {object} options
 * @param {File} options.file 관리자가 고른 원본 영상
 * @param {string} options.label 패널에 보일 이름 (예: "12강 · 제6강 상단 권공 실수")
 * @param {(result: {publicUrl: string, converted: boolean, originalMb: number, resultMb: number}) => Promise<void>} options.apply
 *        업로드가 끝난 뒤 차시를 등록/교체하는 함수
 * @param {(message: string) => void} [options.onDone] 완료 알림
 * @param {(message: string) => void} [options.onError] 실패 알림
 */
export function enqueueLectureUpload({ file, label, apply, onDone, onError, prepare, upload = uploadLectureVideo }) {
  const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  jobs = [...jobs, { id, label, fileName: file.name, stage: 'waiting', percent: 0, detail: '대기 중', error: '' }];
  tasks.set(id, { file, apply, onDone, onError, prepare, upload });
  notify();
  void run();
  return id;
}

async function run() {
  if (running) return;
  running = true;
  try {
    for (let job = jobs.find(item => item.stage === 'waiting'); job; job = jobs.find(item => item.stage === 'waiting')) {
      const task = tasks.get(job.id);
      try {
        update(job.id, { stage: 'converting', percent: 0, detail: '영상 확인 중' });
        const prepare = task.prepare || await loadConverter();
        const prepared = await prepare(task.file, prog => update(job.id, {
          stage: 'converting', percent: prog.percent || 0,
          detail: `${prog.speed || '호환 형식으로 변환'} · ${prog.compressSec || 0}초 경과`
        }));
        update(job.id, { stage: 'uploading', percent: 0, detail: `${prepared.resultMb}MB 업로드 준비` });
        const uploaded = await task.upload(prepared.file, prog => update(job.id, {
          stage: 'uploading', percent: prog.percent || 0, detail: prog.speed ? `업로드 ${prog.speed}` : '업로드 중'
        }));
        update(job.id, { stage: 'saving', percent: 100, detail: '차시에 적용 중' });
        await task.apply({ ...uploaded, converted: prepared.converted, duration: prepared.duration, originalMb: prepared.originalMb, resultMb: prepared.resultMb });
        const summary = prepared.converted ? `${prepared.originalMb}MB → ${prepared.resultMb}MB 호환 변환` : '이미 호환 형식이라 그대로 업로드';
        update(job.id, { stage: 'done', percent: 100, detail: summary });
        task.onDone?.(`[${job.label}] 영상 처리가 끝나 차시에 적용되었습니다. (${summary})`);
      } catch (error) {
        const message = error?.message || '영상 처리 중 오류가 발생했습니다.';
        update(job.id, { stage: 'error', detail: '실패', error: message });
        task.onError?.(`[${job.label}] ${message}`);
      } finally {
        tasks.delete(job.id);
      }
    }
  } finally {
    running = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if (!hasActiveLectureUploads()) return;
    event.preventDefault();
    event.returnValue = '영상 처리가 진행 중입니다. 탭을 닫으면 처리가 중단됩니다.';
  });
}
