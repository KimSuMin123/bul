import { hasPassedCourseExam } from './examService.js';

/**
 * 과정별 민간 자격증 종목, 등급, 직무역량 및 등록정보 매핑
 */
export function getCourseQualificationDetails(courseId, courseTitle = '', courseObj = null) {
  let course = courseObj;

  // 1. If course has custom certificate configuration, respect it directly!
  if (course && (course.certType || course.certTypeFull || course.certRegNo)) {
    const certType = course.certType || (course.certTypeFull ? course.certTypeFull.split(' ')[0] : '불교의례해설사');
    const certGrade = course.certGrade || (course.certTypeFull ? course.certTypeFull.split(' ').slice(1).join(' ') : '2급') || '2급';
    const certTypeFull = course.certTypeFull || `${certType} ${certGrade}`.trim();
    const certGradeCode = certGrade.replace(/\s+/g, '') || '해설사2급';

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

  if (cid === 'course-ritual-12-15' || title.includes('ii') || title.includes('2') || title.includes('심화')) {
    return {
      certType: '불교의례해설사',
      certGrade: '1급',
      certTypeFull: '불교의례해설사 1급',
      certGradeCode: '해설사1급',
      certEnTitle: 'Buddhist Ritual Interpreter (Level 1)',
      regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: '민간자격 등록번호 제 2026- 00183호',
      competency: '심화 불교의례(칠칠재 막재, 포살의식, 생일권공의식, 영산수륙예수 작법) 집행 및 의식 해설/지도'
    };
  } else if (cid === 'bundle-all' || title.includes('통합') || title.includes('지도사')) {
    return {
      certType: '불교의례해설사',
      certGrade: '전문과정',
      certTypeFull: '불교의례해설사 (전문과정)',
      certGradeCode: '해설지도사',
      certEnTitle: 'Buddhist Ritual Master Instructor',
      regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: '민간자격 등록번호 제 2026- 00183호',
      competency: '불교 전통 의례 및 종교 법요식 총괄 지도·해설'
    };
  } else {
    // Default: Course I (8~11강)
    return {
      certType: '불교의례해설사',
      certGrade: '2급',
      certTypeFull: '불교의례해설사 2급',
      certGradeCode: '해설사2급',
      certEnTitle: 'Buddhist Ritual Interpreter (Level 2)',
      regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
      customCertRegNo: '민간자격 등록번호 제 2026- 00183호',
      competency: '영가천도 및 사찰 기본 불교의례(하단시식, 칠칠재 영혼식, 각 칠재의례) 해설 및 집행'
    };
  }
}

/**
 * 수료증/자격증 객체 정규화 및 민간 자격증 필수 메타데이터 보강
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
    certEnTitle: cert.certEnTitle || qual.certEnTitle,
    regOffice: cert.regOffice || qual.regOffice,
    issuingOrg: cert.issuingOrg || '사단법인 세화불학원',
    representative: cert.representative || '이사장',
    competency: cert.competency || qual.competency
  };
}

export function generateCertNumber(seqCount = 0) {
  const currentYear = new Date().getFullYear();
  const nextSeq = (seqCount || 0) + 1;
  return `CERT-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
}

export function generateMemberNumber(seqCount = 0) {
  const currentYear = new Date().getFullYear();
  const nextSeq = (seqCount || 30) + 1;
  return `BUDDHA-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Check if a student has completed all lectures in a course (100% progress)
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
    return p && (p.completed || p.progressRate >= 99);
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
 * Issue or retrieve existing certificate for user and course (100% Supabase / Pure state)
 */
export function issueCertificate(user, course, certsList = [], certCount = 0) {
  // Check if already issued
  const existing = certsList.find(c => c.userId === user.id && c.courseId === course.id);
  if (existing) {
    return enrichCertificate(existing, course);
  }

  const qual = getCourseQualificationDetails(course.id, course.title, course);
  const currentYear = new Date().getFullYear();
  const nextSeq = (certCount || certsList.length || 0) + 1;
  const seqStr = String(nextSeq).padStart(4, '0');
  const certNo = `CERT-${currentYear}-${seqStr}`;

  let certRegNo = '';
  if (qual.customCertRegNo) {
    certRegNo = qual.customCertRegNo.includes('00')
      ? qual.customCertRegNo.replace(/(\d{4,5})(?=[^\d]*$)/, seqStr)
      : (qual.customCertRegNo.includes('호') ? qual.customCertRegNo : `제 ${currentYear}-${qual.customCertRegNo}-${seqStr} 호`);
  } else {
    certRegNo = `제 ${currentYear}-${qual.certGradeCode}-${seqStr} 호`;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${String(today.getMonth() + 1).padStart(2, '0')}월 ${String(today.getDate()).padStart(2, '0')}일`;
  const isoDate = today.toISOString().split('T')[0];

  const newCert = {
    certNo,
    certRegNo,
    userId: user.id,
    courseId: course.id,
    memberNo: user.memberNo,
    studentName: user.name,
    birthDate: user.birthDate || '1980-01-01',
    courseTitle: course.title,
    certType: qual.certType,
    certGrade: qual.certGrade,
    certTypeFull: qual.certTypeFull,
    certEnTitle: qual.certEnTitle,
    regOffice: qual.regOffice,
    issuingOrg: '사단법인 세화불학원',
    representative: '이사장',
    competency: qual.competency,
    period: `2026년 01월 10일 ~ ${todayStr}`,
    issuedAt: isoDate,
    status: 'valid'
  };

  return newCert;
}

// Predefined verified demonstration qualifications (e.g. for demo / search)
const DEMO_CERTIFICATES = [
  {
    certNo: 'CERT-2026-0001',
    certRegNo: '민간자격 등록번호 제 2026- 00183호',
    userId: 'user-bodhi',
    courseId: 'course-ritual-8-11',
    memberNo: 'BUDDHA-2026-00001',
    studentName: '이보디',
    birthDate: '1982-05-14',
    courseTitle: '불교의례법사 과정 I (8강~11강)',
    certType: '불교의례해설사',
    certGrade: '2급',
    certTypeFull: '불교의례해설사 2급',
    certEnTitle: 'Buddhist Ritual Interpreter (Level 2)',
    regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
    issuingOrg: '사단법인 세화불학원',
    representative: '이사장',
    competency: '전통 불교의례(하단시식, 칠칠재 영혼식, 각 칠재의례 및 영반 실수) 해설 및 집행',
    period: '2026년 01월 10일 ~ 2026년 03월 15일',
    issuedAt: '2026-03-15',
    status: 'valid'
  },
  {
    certNo: 'CERT-2026-0002',
    certRegNo: '민간자격 등록번호 제 2026- 00183호',
    userId: 'user-wonhyo',
    courseId: 'course-ritual-12-15',
    memberNo: 'BUDDHA-2026-00089',
    studentName: '김원효',
    birthDate: '1979-11-20',
    courseTitle: '불교의례법사 과정 II (12강~15강)',
    certType: '불교의례해설사',
    certGrade: '1급',
    certTypeFull: '불교의례해설사 1급',
    certEnTitle: 'Buddhist Ritual Interpreter (Level 1)',
    regOffice: '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
    issuingOrg: '사단법인 세화불학원',
    representative: '이사장',
    competency: '심화 불교의례(칠칠재 막재, 포살의식, 생일권공의식, 영산수륙예수 작법) 집행 및 의식 해설/지도',
    period: '2026년 01월 10일 ~ 2026년 03월 15일',
    issuedAt: '2026-03-15',
    status: 'valid'
  }
];

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
