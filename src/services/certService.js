import { hasPassedCourseExam } from './examService.js';
import { COURSE_COMPLETE_PROGRESS } from '../config/sitePolicy.js';

const CURRENT_COURSE_CERTS = {
  course_rit_02: {
    title: '불교의례법사 양성 과정 (2급)', certType: '불교의례법사', certGrade: '2급', certGradeCode: '법사2급',
    certEnTitle: 'Buddhist Ritual Officiant (Level 2)', regNo: '제 2026-001837호'
  },
  course_rit_exp_02: {
    title: '불교의례해설사 양성 과정 (2급)', certType: '불교의례해설사', certGrade: '2급', certGradeCode: '해설사2급',
    certEnTitle: 'Buddhist Ritual Interpreter (Level 2)', regNo: '제 2026-001836호'
  }
};

/**
 * 과정별 민간 자격증 종목, 등급, 직무역량 및 등록정보 매핑
 */
export function getCourseQualificationDetails(courseId, courseTitle = '', courseObj = null) {
  let course = courseObj;

  // 1. If course has custom certificate configuration, respect it directly!
  if (course && (course.certType || course.certTypeFull || course.certRegNo)) {
    const certType = course.certType || (course.certTypeFull ? course.certTypeFull.split(' ')[0] : '불교의례법사');
    const certGrade = course.certGrade || (course.certTypeFull ? course.certTypeFull.split(' ').slice(1).join(' ') : '2급') || '2급';
    const certTypeFull = course.certTypeFull || `${certType} ${certGrade}`.trim();
    const certGradeCode = certGrade.replace(/\s+/g, '') || '법사2급';

    return {
      certType,
      certGrade,
      certTypeFull,
      certGradeCode,
      certEnTitle: course.certEnTitle || 'Certificate of Qualification',
      regOffice: course.certRegOffice || '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: course.certRegNo || '민간자격 등록번호 제 2026- 00183호',
      competency: course.competency || `${course.title || certTypeFull} 전문 교육과정 이수 및 자격 검정 통과`
    };
  }

  // 2. Default fallback mapping by course ID or Title
  const cid = (courseId || '').toLowerCase();
  const title = (courseTitle || '').toLowerCase();

  // 현재 운영 과정: 강좌 정보 없이(최초 발급 직후, 진위 확인) 그려도 DB 설정과 같은 종목·등급·등록번호가 나오도록 고정
  const current = CURRENT_COURSE_CERTS[cid]
    || Object.values(CURRENT_COURSE_CERTS).find(c => title && title === c.title.toLowerCase());
  if (current) {
    return {
      certType: current.certType,
      certGrade: current.certGrade,
      certTypeFull: `${current.certType} ${current.certGrade}`,
      certGradeCode: current.certGradeCode,
      certEnTitle: current.certEnTitle,
      regOffice: `문화체육관광부 (민간자격 등록번호: ${current.regNo})`,
      customCertRegNo: `민간자격 등록번호 ${current.regNo}`,
      competency: `${current.title} 전문 교육과정 이수 및 자격 검정 통과`
    };
  }

  if (cid === 'course-ritual-12-15' || title.includes('ii') || title.includes('2') || title.includes('심화')) {
    return {
      certType: '불교의례법사',
      certGrade: '1급',
      certTypeFull: '불교의례법사 1급',
      certGradeCode: '법사1급',
      certEnTitle: 'Buddhist Ritual Interpreter (Level 1)',
      regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: '민간자격 등록번호 제 2026- 00183호',
      competency: '심화 불교의례(칠칠재 막재, 포살의식, 생일권공의식, 영산수륙예수 작법) 집행 및 의식 해설/지도'
    };
  } else if (cid === 'bundle-all' || title.includes('통합') || title.includes('지도사')) {
    return {
      certType: '불교의례법사',
      certGrade: '전문과정',
      certTypeFull: '불교의례법사 (전문과정)',
      certGradeCode: '법사지도사',
      certEnTitle: 'Buddhist Ritual Master Instructor',
      regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: '민간자격 등록번호 제 2026- 00183호',
      competency: '불교 전통 의례 및 종교 법요식 총괄 지도·해설'
    };
  } else {
    // Default: Course I (8~11강)
    return {
      certType: '불교의례법사',
      certGrade: '2급',
      certTypeFull: '불교의례법사 2급',
      certGradeCode: '법사2급',
      certEnTitle: 'Buddhist Ritual Interpreter (Level 2)',
      regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: '민간자격 등록번호 제 2026- 00183호',
      competency: '영가천도 및 사찰 기본 불교의례(하단시식, 칠칠재 영혼식, 각 칠재의례) 해설 및 집행'
    };
  }
}

/**
 * 자격증 객체 정규화 및 민간 자격증 필수 메타데이터 보강
 */
export function enrichCertificate(cert, courseObj = null) {
  if (!cert) return null;
  const qual = getCourseQualificationDetails(cert.courseId, cert.courseTitle, courseObj);

  return {
    ...qual,
    ...cert,
    certType: cert.certType || qual.certType,
    certGrade: cert.certGrade || qual.certGrade,
    certTypeFull: cert.certTypeFull || qual.certTypeFull,
    certRegNo: cert.certRegNo || qual.customCertRegNo,
    certEnTitle: cert.certEnTitle || qual.certEnTitle,
    regOffice: cert.regOffice || qual.regOffice,
    issuingOrg: cert.issuingOrg || '[사] 세화불학원',
    representative: cert.representative || '이사장',
    competency: cert.competency || qual.competency
  };
}

/**
 * Check if a student has completed all lectures in a course (each lecture >= COURSE_COMPLETE_PROGRESS)
 */
export function checkLecturesCompleted(userId, courseId, courses = [], lectures = [], progressList = []) {
  const course = courses.find(c => c.id === courseId);
  if (!course) return false;

  let targetLectureIds = [];
  if (courseId === 'bundle-all') {
    targetLectureIds = lectures.map(l => l.id);
  } else {
    targetLectureIds = lectures.filter(l => l.courseId === courseId).map(l => l.id);
  }

  if (targetLectureIds.length === 0) return false;

  return targetLectureIds.every(lecId => {
    const p = progressList.find(prog => prog.userId === userId && prog.lectureId === lecId);
    return p && (p.completed || Number(p.progressRate) >= COURSE_COMPLETE_PROGRESS);
  });
}

/**
 * Check if a student has completed all lectures in a course AND passed the exam (>= 60점)
 */
export function checkCourseCompletion(userId, courseId, courses = [], lectures = [], progressList = [], attemptsList = []) {
  const lecturesDone = checkLecturesCompleted(userId, courseId, courses, lectures, progressList);
  const examPassed = hasPassedCourseExam(userId, courseId, attemptsList);

  return Boolean(lecturesDone && examPassed);
}

/**
 * Public Verification function: exact match on certNo or memberNo
 */
export function verifyCertificate(query, certificatesList = []) {
  if (!query || !query.trim()) return null;
  const certificates = Array.isArray(certificatesList) ? certificatesList : [];
  const clean = query.trim().toUpperCase().replace(/\s+/g, '');

  const found = certificates.find(c => {
    const certNoClean = (c.certNo || c.cert_no || '').toUpperCase().replace(/\s+/g, '');
    const memberNoClean = (c.memberNo || c.member_no || '').toUpperCase().replace(/\s+/g, '');
    return certNoClean === clean || memberNoClean === clean;
  });

  return found ? enrichCertificate(found) : null;
}
