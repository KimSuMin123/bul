import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read .env
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://cxvavdxfcrprcbpnrimw.supabase.co';
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const lecturesData = [
  {
    orderIndex: 1,
    title: '1-1강. 의례란 무엇인가',
    description: '의례란 무엇인가',
    durationSeconds: 1269,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_01_1.mp4'
  },
  {
    orderIndex: 2,
    title: '1-2강. 한국불교 의례의 지도와 법사의 마음가짐',
    description: '한국불교 의례의 지도와 법사의 마음가짐',
    durationSeconds: 1320,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_01_2.mp4'
  },
  {
    orderIndex: 3,
    title: '2-1강. 절차의 큰 골격',
    description: '절차의 큰 골격',
    durationSeconds: 1073,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_02_1.mp4'
  },
  {
    orderIndex: 4,
    title: '2-2강. 거불, 절차의 운용, 사시마지',
    description: '거불, 절차의 운용, 사시마지',
    durationSeconds: 1838,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_02_2.mp4'
  },
  {
    orderIndex: 5,
    title: '3-1강. 법기와 채비, 사물, 목탁의 뜻',
    description: '법기와 채비, 사물, 목탁의 뜻',
    durationSeconds: 862,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_03_1.mp4'
  },
  {
    orderIndex: 6,
    title: '3-2강. 손으로 익히는 목탁과 요령',
    description: '손으로 익히는 목탁과 요령',
    durationSeconds: 1407,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_03_2.mp4'
  },
  {
    orderIndex: 7,
    title: '4-1강. 예경의 자리와 공통 원칙',
    description: '예경의 자리와 공통 원칙',
    durationSeconds: 897,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_04_1.mp4'
  },
  {
    orderIndex: 8,
    title: '4-2강. 예석가불 실수',
    description: '예석가불 실수',
    durationSeconds: 1165,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_04_2.mp4'
  },
  {
    orderIndex: 9,
    title: '5-1강. 단(壇)의 자리와 예신중단',
    description: '단(壇)의 자리와 예신중단',
    durationSeconds: 1141,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_05_1.mp4'
  },
  {
    orderIndex: 10,
    title: '5-2강. 시왕·산왕·칠성, 그리고 혼령법문',
    description: '시왕·산왕·칠성, 그리고 혼령법문',
    durationSeconds: 1509,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_05_2.mp4'
  },
  {
    orderIndex: 11,
    title: '6-1강. 도량엄정과 진언권공',
    description: '도량엄정과 진언권공',
    durationSeconds: 1663,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_06_1.mp4'
  },
  {
    orderIndex: 12,
    title: '6-2강. 불전권공의, 재일의 본격 권공',
    description: '불전권공의, 재일의 본격 권공',
    durationSeconds: 2022,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_06_2.mp4'
  },
  {
    orderIndex: 13,
    title: '7-1강. 마지를 물려 올리는 공양',
    description: '마지를 물려 올리는 공양',
    durationSeconds: 762,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_07_1.mp4'
  },
  {
    orderIndex: 14,
    title: '7-2강. 예공·발원·축원, 그리고 분별',
    description: '예공·발원·축원, 그리고 분별',
    durationSeconds: 1114,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_07_2.mp4'
  },
  {
    orderIndex: 15,
    title: '8-1강. 관음시식',
    description: '관음시식',
    durationSeconds: 2276,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_08_1.mp4'
  },
  {
    orderIndex: 16,
    title: '8-2강. 세 가지 보시와 왕생, 상용영반과 헌식규',
    description: '세 가지 보시와 왕생, 상용영반과 헌식규',
    durationSeconds: 2293,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_08_2.mp4'
  },
  {
    orderIndex: 17,
    title: '9-1강. 약례',
    description: '약례',
    durationSeconds: 1402,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_09_1.mp4'
  },
  {
    orderIndex: 18,
    title: '9-2강. 광례',
    description: '광례',
    durationSeconds: 2401,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_09_2.mp4'
  },
  {
    orderIndex: 19,
    title: '10-1강. 설법독경, 그리고 명부의 증명 삼성',
    description: '설법독경, 그리고 명부의 증명 삼성',
    durationSeconds: 1195,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_10_1.mp4'
  },
  {
    orderIndex: 20,
    title: '10-2강. 시왕을 청해 권공하다, 그리고 화청',
    description: '시왕을 청해 권공하다, 그리고 화청',
    durationSeconds: 1736,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_10_2.mp4'
  },
  {
    orderIndex: 21,
    title: '11-1강. 영반의 자리, 그리고 칭양성호',
    description: '영반의 자리, 그리고 칭양성호',
    durationSeconds: 1022,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_11_1.mp4'
  },
  {
    orderIndex: 22,
    title: '11-2강. 변공과 장엄염불, 그리고 봉안',
    description: '변공과 장엄염불, 그리고 봉안',
    durationSeconds: 1233,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_11_2.mp4'
  },
  {
    orderIndex: 23,
    title: '12-1강. 막재의 틀과 신중작법, 그리고 배송게',
    description: '막재의 틀과 신중작법, 그리고 배송게',
    durationSeconds: 1144,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_12_1.mp4'
  },
  {
    orderIndex: 24,
    title: '12-2강. 봉송의, 소대로 가는 길',
    description: '봉송의, 소대로 가는 길',
    durationSeconds: 1284,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_12_2.mp4'
  },
  {
    orderIndex: 25,
    title: '13-1강. 포살의 뜻과 운영, 바웃다오선계',
    description: '포살의 뜻과 운영, 바웃다오선계',
    durationSeconds: 895,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_13_1.mp4'
  },
  {
    orderIndex: 26,
    title: '13-2강. 포살의식의 차서, 처음부터 끝까지',
    description: '포살의식의 차서, 처음부터 끝까지',
    durationSeconds: 1499,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_13_2.mp4'
  },
  {
    orderIndex: 27,
    title: '14-1강. 미리 닦는 재, 시왕을 모시다',
    description: '미리 닦는 재, 시왕을 모시다',
    durationSeconds: 1141,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_14_1.mp4'
  },
  {
    orderIndex: 28,
    title: '14-2강. 금강경 독송과 회향, 시왕봉송',
    description: '금강경 독송과 회향, 시왕봉송',
    durationSeconds: 1066,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_14_2.mp4'
  },
  {
    orderIndex: 29,
    title: '15-1강. 세 재를 꿰는 틀, 영산재와 수륙재',
    description: '세 재를 꿰는 틀, 영산재와 수륙재',
    durationSeconds: 961,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_15_1.mp4'
  },
  {
    orderIndex: 30,
    title: '15-2강. 예수재, 세 재의 같고 다름',
    description: '예수재, 세 재의 같고 다름',
    durationSeconds: 860,
    videoUrl: 'https://cxvavdxfcrprcbpnrimw.supabase.co/storage/v1/object/public/lectures/lecture_15_2.mp4'
  }
];

async function updateLectures() {
  console.log('================================================================');
  console.log('  강의 차시 30개 정밀 등록 및 동기화 (course-ritual-master-2)');
  console.log('================================================================');

  // Delete existing lectures for this course to ensure clean order & IDs
  console.log('기존 차시 목록 정리 중...');
  await fetch(`${SUPABASE_URL}/rest/v1/lectures?course_id=eq.course-ritual-master-2`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  console.log('30개 정식 강의 차시 등록 중...');
  let successCount = 0;

  for (const lec of lecturesData) {
    const lectureId = `lec-ritual-${String(lec.orderIndex).padStart(2, '0')}`;
    const payload = {
      id: lectureId,
      course_id: 'course-ritual-master-2',
      order_index: lec.orderIndex,
      title: lec.title,
      description: lec.description,
      duration_seconds: lec.durationSeconds,
      video_url: lec.videoUrl
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/lectures`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const min = Math.floor(lec.durationSeconds / 60);
      const sec = lec.durationSeconds % 60;
      console.log(`✔ [차시 ${String(lec.orderIndex).padStart(2, '0')}] ${lec.title} (${min}분 ${sec}초) 등록 성공`);
      successCount++;
    } else {
      console.error(`✖ [차시 ${lec.orderIndex}] 등록 실패:`, await res.text());
    }
  }

  console.log(`\n총 ${successCount}/${lecturesData.length}개 차시 등록이 완료되었습니다!`);
}

updateLectures().catch(console.error);
