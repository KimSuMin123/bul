import React, { useSyncExternalStore } from 'react';
import { CheckCircle2, AlertCircle, Loader2, X, Film } from 'lucide-react';
import { dismissLectureUpload, getLectureUploads, subscribeLectureUploads } from '../../services/lectureUploadQueue';

const STAGE_LABEL = {
  waiting: '대기 중',
  converting: '호환 형식으로 변환 중',
  uploading: '업로드 중',
  saving: '차시에 적용 중',
  done: '적용 완료',
  error: '실패'
};

// 관리자 화면 왼쪽 아래에 떠 있는 백그라운드 영상 처리 현황 패널
export default function LectureUploadPanel() {
  const jobs = useSyncExternalStore(subscribeLectureUploads, getLectureUploads);
  if (!jobs.length) return null;
  const active = jobs.some(job => !['done', 'error'].includes(job.stage));

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: '16px', bottom: '16px', zIndex: 950, width: 'min(360px, calc(100vw - 32px))',
        background: '#FFFFFF', border: '1px solid var(--color-border)', borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)', overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--color-sage)', color: '#FFFFFF', fontSize: '13px', fontWeight: 700 }}>
        <Film size={15} />
        <span>영상 처리 ({jobs.filter(job => job.stage === 'done').length}/{jobs.length})</span>
        {active && <span style={{ marginLeft: 'auto', fontSize: '11.5px', fontWeight: 500, opacity: 0.9 }}>이 탭을 닫지 마세요</span>}
      </div>
      <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
        {jobs.map(job => {
          const finished = job.stage === 'done' || job.stage === 'error';
          const color = job.stage === 'error' ? '#B91C1C' : job.stage === 'done' ? 'var(--color-sage)' : 'var(--color-amber-dark)';
          return (
            <div key={job.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                {job.stage === 'done' ? <CheckCircle2 size={14} color={color} />
                  : job.stage === 'error' ? <AlertCircle size={14} color={color} />
                    : <Loader2 size={14} className="spin" color={color} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.fileName}>{job.label}</span>
                {finished && (
                  <button type="button" onClick={() => dismissLectureUpload(job.id)} aria-label="목록에서 지우기"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#64748B' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color, marginTop: '3px' }}>
                {STAGE_LABEL[job.stage]}{!finished && job.stage !== 'waiting' ? ` ${job.percent}%` : ''} · {job.error || job.detail}
              </div>
              {!finished && (
                <div style={{ height: '5px', background: 'var(--color-border)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${job.percent}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
