export const OPENING_START_AT = '2026-10-01T18:30:00+09:00';
export const OPENING_DURATION = 180;
export const OPENING_VISIBLE_LEAD = 60;
export const OPENING_CUT_AT = 90;

export const OPENING_PHASES = [
  { end: 15, title: '🔔 개원의 종소리', description: '세화붓다아카데미 개원을 알리는 장엄한 범종 소리와 함께 마음을 모읍니다.' },
  { end: 35, title: '🙏 인연의 서막', description: '온 누리에 지혜와 자비의 등불을 밝히는 첫걸음을 함께해 주셔서 감사합니다.' },
  { end: 55, title: '📜 법음의 향기', description: '정통 불교 의례와 실천을 잇는 불교의례해설사·법사 배움의 전당이 열립니다.' },
  { end: 75, title: '🪷 함께 모은 원력', description: '전국 각지에서 동시 접속하신 모든 학인분들과 함께 합장하며 축원을 올립니다.' },
  { end: 85, title: '🎗️ 황금 리본 등장', description: '곧 리본 커팅식이 거행됩니다. 화면 앞에서 다섯부터 함께 카운트다운을 외쳐주세요!' },
  { end: 90, title: '✂️ 리본 커팅 카운트다운', description: '다섯부터 함께 세어 주세요. 새로운 배움의 문을 엽니다!' },
  { end: 115, title: '🎉 개원을 축하합니다!', description: '황금 리본이 열렸습니다! 지혜와 자비가 깃든 세화불학원의 역사적인 출범을 축하합니다!' },
  { end: 140, title: '🌸 축하 연등 향연', description: '온 누리에 향기로운 연꽃이 만개합니다. 화면 아래 축하 연꽃을 함께 피워주세요.' },
  { end: 165, title: '🎓 배움의 도량 안내', description: '체계적인 커리큘럼과 함께하는 정통 불교 교육! 첫 수업이 준비되어 있습니다.' },
  { end: 180, title: '앞으로의 배움', description: '아래 개설 강좌에서 첫 수업을 살펴보세요. 함께해 주셔서 감사합니다.' }
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
    celebrating: elapsed >= OPENING_CUT_AT && elapsed < OPENING_CUT_AT + 10,
    phase: OPENING_PHASES.find(item => elapsed < item.end) || OPENING_PHASES.at(-1)
  };
}
