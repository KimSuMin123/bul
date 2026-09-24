export const OPENING_START_AT = '2026-10-01T18:30:00+09:00';
export const OPENING_DURATION = 10;
export const OPENING_VISIBLE_LEAD = 60;
export const OPENING_CUT_AT = 5;

export const OPENING_PHASES = [
  { end: 2, title: '나모붓다야 문구와 인사', description: '나모붓다야(Namo Buddhaya). 세화붓다아카데미 개원을 축하합니다. 부처님의 지혜와 자비가 함께합니다.' },
  { end: 5, title: '세레모니 종', description: '장엄한 범종이 울려 퍼지며 온 누리에 지혜의 등불을 밝힙니다.' },
  { end: 10, title: '부처가 승천', description: '부처님이 황금빛 광배와 함께 하늘로 승천하며 개원을 축복합니다.' },
  { end: 10, title: '앞으로의 배움', description: '아래 개설 강좌에서 첫 수업을 살펴보세요. 함께해 주셔서 감사합니다.' }
];

// A pure clock projection keeps late arrivals and background tabs on the same timeline.
// now is an epoch millisecond value; no URL or storage override is accepted.
export function getOpeningTimeline(now, startAt = Date.parse(OPENING_START_AT)) {
  const valid = Number.isFinite(now) && Number.isFinite(startAt);
  const elapsed = valid ? Math.max(0, Math.min(OPENING_DURATION, (now - startAt) / 1000)) : 0;
  const before = valid && now < startAt;
  const finished = valid && now >= startAt + OPENING_DURATION * 1000;
  return {
    visible: valid && now >= startAt - OPENING_VISIBLE_LEAD * 1000,
    before,
    finished,
    elapsed,
    countdown: valid ? Math.max(0, Math.ceil((startAt - now) / 1000)) : 0,
    cutCountdown: elapsed >= 4 && elapsed < 5 ? Math.ceil(5 - elapsed) : null,
    cut: elapsed >= 5,
    celebrating: !finished && elapsed >= 5 && elapsed < 10,
    phase: OPENING_PHASES.find(item => elapsed < item.end) || OPENING_PHASES.at(-1),
    isStep1: valid && !before && elapsed < 2,
    isStep2: valid && !before && elapsed >= 2 && elapsed < 5,
    isStep3: valid && !before && elapsed >= 5 && elapsed < 10,
    isDone: valid && finished
  };
}
