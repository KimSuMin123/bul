// Storage Service: Persistent State with LocalStorage and Seed Data

const STORAGE_KEYS = {
  USERS: 'buddha_lms_users',
  COURSES: 'buddha_lms_courses',
  LECTURES: 'buddha_lms_lectures',
  ENROLLMENTS: 'buddha_lms_enrollments',
  PAYMENTS: 'buddha_lms_payments',
  PROGRESS: 'buddha_lms_progress',
  CERTIFICATES: 'buddha_lms_certificates',
  CURRENT_USER: 'buddha_lms_current_user',
  NEXT_MEMBER_SEQ: 'buddha_lms_next_member_seq',
  NEXT_CERT_SEQ: 'buddha_lms_next_cert_seq',
  QA_POSTS: 'buddha_lms_qa_posts',
  EXAM_ATTEMPTS: 'buddha_lms_exam_attempts'
};

const SEED_COURSES = [
  {
    id: 'course-ritual-8-11',
    title: '불교의례법사 과정 I (8강~11강)',
    subtitle: '하단 시식, 칠칠재 영혼식, 각 칠재 의례 및 영반 실수를 체계적으로 익히는 전문 의례 과정',
    category: '불교의례법사',
    thumbnail: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=800&q=80',
    defaultPeriodDays: 90,
    sequentialUnlock: true,
    price: 50000,
    instructor: '불교의례 전문 법사',
    lectureIds: [
      'lec-ritual-08-1', 'lec-ritual-08-2', 'lec-ritual-09-1', 'lec-ritual-09-2',
      'lec-ritual-10-1', 'lec-ritual-10-2', 'lec-ritual-11-1', 'lec-ritual-11-2'
    ]
  },
  {
    id: 'course-ritual-12-15',
    title: '불교의례법사 과정 II (12강~15강)',
    subtitle: '칠칠재 막재, 세불원 포살의식, 생일권공의식 실수 및 영산수륙예수 작법 소개',
    category: '불교의례법사',
    thumbnail: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    defaultPeriodDays: 90,
    sequentialUnlock: true,
    price: 50000,
    instructor: '불교의례 전문 법사',
    lectureIds: [
      'lec-ritual-12-1', 'lec-ritual-12-2', 'lec-ritual-13-1', 'lec-ritual-13-2',
      'lec-ritual-14-1', 'lec-ritual-14-2', 'lec-ritual-15-1', 'lec-ritual-15-2'
    ]
  }
];

const SEED_LECTURES = [
  // 불교의례법사 과정 I (8~11강)
  {
    id: 'lec-ritual-08-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 1,
    title: '8-1강. 하단 시식 실수(1)',
    description: '영가천도를 위한 하단 시식(下壇施食)의 기본 절차와 염불 의례 실수를 학습합니다.',
    durationSeconds: 2277,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-08-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-08-2',
    courseId: 'course-ritual-8-11',
    orderIndex: 2,
    title: '8-2강. 하단 시식 실수(2)',
    description: '하단 시식의 심화 작법과 요잡, 시식문의 정확한 독경 요령을 익힙니다.',
    durationSeconds: 2294,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-08-2.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-09-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 3,
    title: '9-1강. 칠칠재 영혼식(1)',
    description: '사후 49일간 봉행되는 칠칠재(49재) 영혼식의 의의와 영단 설행 원리를 배웁니다.',
    durationSeconds: 1403,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-09-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-09-2',
    courseId: 'course-ritual-8-11',
    orderIndex: 4,
    title: '9-2강. 칠칠재 영혼식(2)',
    description: '칠칠재 영혼식의 법요 순서와 의식 봉행 시 주의해야 할 법식들을 익힙니다.',
    durationSeconds: 2401,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-09-2.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-10-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 5,
    title: '10-1강. 각 칠재 의례 실수(1)',
    description: '초재부터 6재까지 각 재(齋)마다 거행되는 고유한 불공 의례 절차를 실습합니다.',
    durationSeconds: 1196,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-10-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-10-2',
    courseId: 'course-ritual-8-11',
    orderIndex: 6,
    title: '10-2강. 각 칠재 의례 실수(2)',
    description: '각 칠재 진행 중 행해지는 대령, 관욕, 헌향 및 진공 절차를 집중 학습합니다.',
    durationSeconds: 1737,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-10-2.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-11-1',
    courseId: 'course-ritual-8-11',
    orderIndex: 7,
    title: '11-1강. 각 칠재 영반 실수(1)',
    description: '각 칠재에서 영가에게 공양을 올리는 영반(靈飯) 의례의 기본 구성을 익힙니다.',
    durationSeconds: 1022,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-11-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-11-2',
    courseId: 'course-ritual-8-11',
    orderIndex: 8,
    title: '11-2강. 각 칠재 영반 실수(2)',
    description: '영반 진설법, 수설 진언, 축원 및 회향 절차의 실무를 완성합니다.',
    durationSeconds: 1234,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-11-2.mp4',
    attachments: []
  },

  // 불교의례법사 과정 II (12~15강)
  {
    id: 'lec-ritual-12-1',
    courseId: 'course-ritual-12-15',
    orderIndex: 1,
    title: '12-1강. 칠칠재 막재 실수(1)',
    description: '49재의 회향인 막재(49일째 마지막 재)의 종합적 의식 절차를 익힙니다.',
    durationSeconds: 1145,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-12-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-12-2',
    courseId: 'course-ritual-12-15',
    orderIndex: 2,
    title: '12-2강. 칠칠재 막재 실수(2)',
    description: '막재 상단불공, 중단퇴공, 관음시식 및 봉송 소전의 실무를 완벽히 숙지합니다.',
    durationSeconds: 1284,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-12-2.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-13-1',
    courseId: 'course-ritual-12-15',
    orderIndex: 3,
    title: '13-1강. 세불원 포살의식 실수(1)',
    description: '계율을 되새기고 청정한 승가 공동체를 이루는 포살(布薩) 의식의 역사와 기본 규범을 배웁니다.',
    durationSeconds: 896,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-13-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-13-2',
    courseId: 'course-ritual-12-15',
    orderIndex: 4,
    title: '13-2강. 세불원 포살의식 실수(2)',
    description: '세불원 포살의식의 계문 낭독, 참회 진언, 발원문 봉독의 현장 실습을 학습합니다.',
    durationSeconds: 1499,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-13-2.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-14-1',
    courseId: 'course-ritual-12-15',
    orderIndex: 5,
    title: '14-1강. 생일권공의식 실수(1)',
    description: '불자의 생일을 맞이하여 부처님께 공양을 권하고 축원하는 생일권공(生日勸供) 의례의 구성입니다.',
    durationSeconds: 1142,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-14-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-14-2',
    courseId: 'course-ritual-12-15',
    orderIndex: 6,
    title: '14-2강. 생일권공의식 실수(2)',
    description: '권공문 찬탄, 헌공 진언, 수복 축원문의 봉독 요령과 법요 실습을 익힙니다.',
    durationSeconds: 1066,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-14-2.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-15-1',
    courseId: 'course-ritual-12-15',
    orderIndex: 7,
    title: '15-1강. 영산수륙예수 작법 소개(1)',
    description: '한국 불교 의례의 정수인 영산재, 수륙재, 예수재의 종합 작법 체계와 법구 사용법을 소개합니다.',
    durationSeconds: 962,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-15-1.mp4',
    attachments: []
  },
  {
    id: 'lec-ritual-15-2',
    courseId: 'course-ritual-12-15',
    orderIndex: 8,
    title: '15-2강. 영산수륙예수 작법 소개(2)',
    description: '바라춤, 나비춤, 범패 등 불교 전통 의례 예술의 특징과 법식의 정통성을 정리합니다.',
    durationSeconds: 861,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lec-ritual-15-2.mp4',
    attachments: []
  }
];

const SEED_USERS = [
  {
    id: 'admin',
    password: 'Password123!',
    name: '최고관리자',
    birthDate: '1980-01-01',
    phone: '010-0000-0000',
    memberNo: 'BUDDHA-2026-00001',
    role: 'admin',
    createdAt: '2026-01-01'
  }
];

const SEED_ENROLLMENTS = [];

const SEED_PAYMENTS = [];

const SEED_PROGRESS = [];

const SEED_CERTIFICATES = [];

const SEED_QA_POSTS = [];

// Initialize Storage with seed data and purge legacy dummy data
export function initStorage() {
  const dummyUserIds = ['student1', 'bodhi'];

  // Purge dummy users and ensure admin exists
  const existingUsers = getStored(STORAGE_KEYS.USERS) || [];
  const curUsers = existingUsers.filter(u => !dummyUserIds.includes(u.id));
  if (!curUsers.some(u => u.id === 'admin')) {
    curUsers.unshift(SEED_USERS[0]);
  }
  setStored(STORAGE_KEYS.USERS, curUsers);

  // If current session was one of the dummy users, clear it
  const curUser = getStored(STORAGE_KEYS.CURRENT_USER);
  if (curUser && dummyUserIds.includes(curUser.id)) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  const dummyCourseIds = ['course-1', 'course-2', 'bundle-all'];
  const dummyLecIds = ['lec-101', 'lec-102', 'lec-103', 'lec-201', 'lec-202', 'lec-203'];

  // Purge legacy courses and ensure real courses
  const curCourses = (getStored(STORAGE_KEYS.COURSES) || []).filter(c => !dummyCourseIds.includes(c.id));
  SEED_COURSES.forEach(sc => {
    const existing = curCourses.find(c => c.id === sc.id);
    if (!existing) {
      curCourses.push(sc);
    } else {
      existing.price = sc.price; // Update price to 50000
    }
  });
  setStored(STORAGE_KEYS.COURSES, curCourses);

  // Purge legacy lectures and ensure real lectures (also clear any legacy fake attachments)
  const curLecs = (getStored(STORAGE_KEYS.LECTURES) || [])
    .filter(l => !dummyLecIds.includes(l.id))
    .map(l => ({ ...l, attachments: [] }));
  SEED_LECTURES.forEach(sl => {
    if (!curLecs.some(l => l.id === sl.id)) {
      curLecs.push(sl);
    }
  });
  setStored(STORAGE_KEYS.LECTURES, curLecs);

  // Purge dummy enrollments, payments, progress, certificates, Q&A (including dummy users)
  const curEnrs = (getStored(STORAGE_KEYS.ENROLLMENTS) || []).filter(e => !dummyCourseIds.includes(e.courseId) && !dummyUserIds.includes(e.userId));
  setStored(STORAGE_KEYS.ENROLLMENTS, curEnrs);

  const curPays = (getStored(STORAGE_KEYS.PAYMENTS) || []).filter(p => !dummyCourseIds.includes(p.courseId) && !dummyUserIds.includes(p.userId));
  setStored(STORAGE_KEYS.PAYMENTS, curPays);

  const curProg = (getStored(STORAGE_KEYS.PROGRESS) || []).filter(p => !dummyLecIds.includes(p.lectureId) && !dummyUserIds.includes(p.userId));
  setStored(STORAGE_KEYS.PROGRESS, curProg);

  const curCerts = (getStored(STORAGE_KEYS.CERTIFICATES) || []).filter(c => !dummyCourseIds.includes(c.courseId) && !dummyUserIds.includes(c.userId));
  setStored(STORAGE_KEYS.CERTIFICATES, curCerts);

  const curQA = (getStored(STORAGE_KEYS.QA_POSTS) || []).filter(q => !dummyCourseIds.includes(q.courseId) && !dummyUserIds.includes(q.authorId));
  setStored(STORAGE_KEYS.QA_POSTS, curQA);

  if (!localStorage.getItem(STORAGE_KEYS.NEXT_MEMBER_SEQ)) {
    localStorage.setItem(STORAGE_KEYS.NEXT_MEMBER_SEQ, '30');
  }
  if (!localStorage.getItem(STORAGE_KEYS.NEXT_CERT_SEQ) || localStorage.getItem(STORAGE_KEYS.NEXT_CERT_SEQ) === '100') {
    localStorage.setItem(STORAGE_KEYS.NEXT_CERT_SEQ, '1');
  }
}

// Helpers to get and set
export function getStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Storage get error:', e);
    return null;
  }
}

export function setStored(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Storage set error:', e);
  }
}

export { STORAGE_KEYS };
