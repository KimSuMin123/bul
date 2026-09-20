// ==============================================================================
// Sehwa Buddha Academy - Dynamic SEO & Meta Manager for Single Page Application
// Dynamically updates document.title and meta tags as user navigates views
// ==============================================================================

const SEO_CONFIG = {
  home: {
    title: '사단법인 세화붓다아카데미 | 따라하는 불자에서 이끄는 불자로',
    description: '예경에서 영산재까지, 순서와 뜻을 함께 익히는 불교 의례 자격과정. 나모붓다야 - 사단법인 세화불학원 부설 세화붓다아카데미 공식 온라인 교육원.'
  },
  about: {
    title: 'About SBA (세화불학원 소개) | 세화붓다아카데미',
    description: '사단법인 세화불학원의 설립목적, 신행헌장, 학회연혁, 정관, 조직활동 및 글로벌 미션을 안내합니다.'
  },
  courseDetail: {
    title: '강좌 상세 안내 | 세화붓다아카데미',
    description: '체계적인 커리큘럼과 1080p Full HD 스트리밍으로 불교 의례와 작법을 학습하세요.'
  },
  dashboard: {
    title: '내 강의실 (대시보드) | 세화붓다아카데미',
    description: '수강 중인 강좌의 진도율 확인, 순차적 VOD 학습 및 자격 평가 시험 응시.'
  },
  watch: {
    title: '강의 시청 플레이어 | 세화붓다아카데미',
    description: '체계적인 40분 정통 불교 의례 실무 강의를 고화질로 시청하세요.'
  },
  verify: {
    title: '공식 수료증 진위 확인 | 세화붓다아카데미',
    description: '사단법인 세화불학원이 발급한 정식 수료증의 진위 여부를 실시간으로 대조 검증합니다.'
  },
  login: {
    title: '로그인 | 세화붓다아카데미',
    description: '세화붓다아카데미 회원 로그인. 안전한 단방향 암호화 보안 세션을 제공합니다.'
  },
  register: {
    title: '회원가입 | 세화붓다아카데미',
    description: '세화붓다아카데미 신규 학인 회원가입. 1인 1계정 보안 등록.'
  },
  admin: {
    title: '학사 및 콘텐츠 관리 시스템 (CMS) | 세화붓다아카데미',
    description: '교학처 관리자 전용 수강생 관리, 대면 수납 장부 및 VOD 콘텐츠 관리 센터.'
  }
};

const ABOUT_TAB_TITLES = {
  intro: '설립목적 | 세화불학원 소개 (About SBA)',
  charter: '신행헌장 | 세화불학원 소개 (About SBA)',
  history: '학회연혁 | 세화불학원 소개 (About SBA)',
  constitution: '학회정관 | 세화불학원 소개 (About SBA)',
  committed: '조직활동 | 세화불학원 소개 (About SBA)',
  sba: 'About SBA 총람 | 세화불학원 소개 (About SBA)'
};

export function updatePageSEO(view, extraData = {}) {
  if (typeof document === 'undefined') return;

  let pageConfig = SEO_CONFIG[view] || SEO_CONFIG.home;
  let title = pageConfig.title;
  let desc = pageConfig.description;

  if (view === 'about' && extraData.tab && ABOUT_TAB_TITLES[extraData.tab]) {
    title = `${ABOUT_TAB_TITLES[extraData.tab]} | 세화붓다아카데미`;
    desc = `사단법인 세화불학원(世花佛學院) ${ABOUT_TAB_TITLES[extraData.tab]} 안내. 불교의례의 정통성과 체계적인 현대 교육을 선도합니다.`;
  } else if (view === 'courseDetail' && extraData.courseTitle) {
    title = `${extraData.courseTitle} | 세화붓다아카데미`;
    if (extraData.courseSubtitle) desc = extraData.courseSubtitle;
  } else if (view === 'watch' && extraData.lectureTitle) {
    title = `${extraData.lectureTitle} | 세화붓다아카데미`;
  }

  // Update title
  document.title = title;

  // Update meta description
  let descMeta = document.querySelector('meta[name="description"]');
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.name = 'description';
    document.head.appendChild(descMeta);
  }
  descMeta.content = desc;

  // Update OpenGraph Title & Description
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = title;
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.content = desc;
}
