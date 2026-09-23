export const OPENING_START_AT = '2026-10-01T18:30:00+09:00';
export const OPENING_DURATION = 300;
export const OPENING_VISIBLE_LEAD = 60;
export const OPENING_CUT_AT = 180;

export const OPENING_PHASES = [
  { end: 40, title: '환영합니다', description: '세화붓다아카데미의 첫걸음을 함께해 주셔서 감사합니다. 오늘의 인연을 떠올려 보세요.' },
  { end: 110, title: '개원 인사', description: '배움과 실천을 잇는 새로운 공간이 열립니다. 화면 앞에서 잠시 합장하며 축하해 주세요.' },
  { end: 165, title: '함께 준비하는 순간', description: '곧 리본을 엽니다. 함께하는 분들과 개원의 의미를 나눠 보세요.' },
  { end: 180, title: '리본 커팅 카운트다운', description: '잠시 후 다섯부터 함께 세어 주세요. 새로운 배움의 문을 엽니다!' },
  { end: 240, title: '개원을 축하합니다', description: '리본이 열렸습니다. 이 배움이 삶 속의 따뜻한 실천으로 이어지길 바랍니다.' },
  { end: 300, title: '앞으로의 배움', description: '아래 개설 강좌에서 첫 수업을 살펴보세요. 함께해 주셔서 감사합니다.' }
];

// A pure clock projection keeps late arrivals and background tabs on the same timeline.
// now is an epoch millisecond value; no URL or storage override is accepted.
export function getOpeningTimeline(now, startAt = Date.parse(OPENING_START_AT)) {
  const valid = Number.isFinite(now) && Number.isFinite(startAt);
  const elapsed = valid ? Math.max(0, Math.min(OPENING_DURATION, (now - startAt) / 1000)) : 0;
  return {
    visible: valid && now >= startAt - OPENING_VISIBLE_LEAD * 1000,
    before: valid && now < startAt,
    finished: valid && now >= startAt + OPENING_DURATION * 1000,
    elapsed,
    countdown: valid ? Math.max(0, Math.ceil((startAt - now) / 1000)) : 0,
    cutCountdown: elapsed >= OPENING_CUT_AT - 5 && elapsed < OPENING_CUT_AT ? Math.ceil(OPENING_CUT_AT - elapsed) : null,
    cut: elapsed >= OPENING_CUT_AT,
    celebrating: elapsed >= OPENING_CUT_AT && elapsed < OPENING_CUT_AT + 6,
    phase: OPENING_PHASES.find(item => elapsed < item.end) || OPENING_PHASES.at(-1)
  };
}
