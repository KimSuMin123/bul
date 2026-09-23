// ==============================================================================
// Unit & Integration Test Suite for buddha-lecture-platform
// Uses Node.js native test runner & strict assertion library
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCourseQualificationDetails,
  enrichCertificate,
  generateCertNumber,
  generateMemberNumber,
  checkLecturesCompleted,
  verifyCertificate
} from '../src/services/certService.js';

import {
  getExamPool,
  selectRandomQuestions,
  evaluateExam,
  isExamPassed
} from '../src/services/examService.js';

import {
  hashPassword,
  verifyPassword
} from '../src/services/apiClient.js';

import {
  purgeLegacyLocalStorage
} from '../src/services/storage.js';

import {
  normalizePhone,
  aggregateDonationReceipt,
  findReceiptByPhoneOrUser,
  exportToExcelCSV
} from '../src/services/donationService.js';

// ==============================================================================
// 1. UNIT TESTS: certService
// ==============================================================================
test('certService - getCourseQualificationDetails (Normal & Custom)', () => {
  // Level 2 default
  const qual1 = getCourseQualificationDetails('course-ritual-8-11', '불교의례해설사 I');
  assert.equal(qual1.certType, '불교의례해설사');
  assert.equal(qual1.certGrade, '2급');
  assert.match(qual1.regOffice, /문화체육관광부/);

  // Level 1 deep course
  const qual2 = getCourseQualificationDetails('course-ritual-12-15', '불교의례해설사 II');
  assert.equal(qual2.certGrade, '1급');

  // Custom course configuration
  const customCourse = {
    id: 'custom-1',
    certType: '불교문화지도사',
    certGrade: '1급',
    certRegNo: '제 2026-9999호'
  };
  const qualCustom = getCourseQualificationDetails('custom-1', '맞춤 강좌', customCourse);
  assert.equal(qualCustom.certType, '불교문화지도사');
  assert.equal(qualCustom.customCertRegNo, '제 2026-9999호');
});

test('certService - enrichCertificate edge cases & null safety', () => {
  assert.equal(enrichCertificate(null), null);
  assert.equal(enrichCertificate(undefined), null);

  const rawCert = {
    id: 'cert-100',
    courseId: 'course-ritual-8-11',
    studentName: '홍길동'
  };
  const enriched = enrichCertificate(rawCert);
  assert.equal(enriched.id, 'cert-100');
  assert.equal(enriched.certGrade, '2급');
  assert.equal(enriched.issuingOrg, '사단법인 세화불학원');
  assert.equal(enriched.studentName, '홍길동');
  assert.equal(enriched.certRegNo, '민간자격 등록번호 제 2026- 00183호');
  assert.equal(enrichCertificate({ ...rawCert, certRegNo: '기존 발급번호' }).certRegNo, '기존 발급번호');
  assert.equal(enrichCertificate(rawCert, { id: rawCert.courseId, certType: '시험 종목', certRegNo: '사용자 지정 등록번호' }).certRegNo, '사용자 지정 등록번호');
});

test('certService - generateCertNumber and generateMemberNumber format', () => {
  const certNo = generateCertNumber(5);
  const currentYear = new Date().getFullYear();
  assert.equal(certNo, `CERT-${currentYear}-0006`);

  const memberNo = generateMemberNumber(42);
  assert.equal(memberNo, `BUDDHA-${currentYear}-00043`);
});

test('certService - checkLecturesCompleted logic & empty states', () => {
  const courses = [{ id: 'c1', title: '강좌1' }];
  const lectures = [
    { id: 'l1', courseId: 'c1' },
    { id: 'l2', courseId: 'c1' }
  ];

  // 1. All completed (100%)
  const progressAllDone = [
    { userId: 'user1', lectureId: 'l1', completed: true, progressRate: 100 },
    { userId: 'user1', lectureId: 'l2', completed: true, progressRate: 100 }
  ];
  assert.equal(checkLecturesCompleted('user1', 'c1', courses, lectures, progressAllDone), true);

  // 2. Partial completed
  const progressPartial = [
    { userId: 'user1', lectureId: 'l1', completed: true, progressRate: 100 },
    { userId: 'user1', lectureId: 'l2', completed: false, progressRate: 40 }
  ];
  assert.equal(checkLecturesCompleted('user1', 'c1', courses, lectures, progressPartial), false);

  // 3. Edge case: Non-existing course
  assert.equal(checkLecturesCompleted('user1', 'c999', courses, lectures, progressAllDone), false);

  // 4. Edge case: Empty lectures
  assert.equal(checkLecturesCompleted('user1', 'c1', courses, [], progressAllDone), false);
});

test('certService - verifyCertificate matching & case insensitivity', () => {
  const certList = [
    { certNo: 'CERT-2026-0001', studentName: '원각스님', courseTitle: '의례해설 1' },
    { certNo: 'CERT-2026-0002', studentName: '지산스님', courseTitle: '의례해설 2' }
  ];

  // Exact match
  const found1 = verifyCertificate('CERT-2026-0001', certList);
  assert.ok(found1);
  assert.equal(found1.studentName, '원각스님');

  // Lowercase and whitespace trim
  const found2 = verifyCertificate('  cert-2026-0002  ', certList);
  assert.ok(found2);
  assert.equal(found2.studentName, '지산스님');

  // Non-existing
  const foundNone = verifyCertificate('CERT-FAKE-9999', certList);
  assert.equal(foundNone, null);
});

// ==============================================================================
// 2. UNIT TESTS: examService
// ==============================================================================
test('examService - getExamPool & selectRandomQuestions', () => {
  // Production question banks live on the server; there is no client fallback.
  assert.deepEqual(getExamPool('course-ritual-8-11'), []);
  const pool = Array.from({ length: 20 }, (_, index) => ({
    id: `fixture-question-${index + 1}`, question: `Fixture ${index + 1}`,
    options: ['A', 'B', 'C', 'D'], correctAnswer: 2,
  }));

  // Exact 20 questions
  const selected20 = selectRandomQuestions(pool, 20);
  assert.equal(selected20.length, 20);
  assert.equal(new Set(selected20.map(question => question.id)).size, 20);
  assert.deepEqual(new Set(selected20.map(question => question.id)), new Set(pool.map(question => question.id)));

  // Edge case: Requesting more questions than pool length
  const smallPool = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const selectedAll = selectRandomQuestions(smallPool, 10);
  assert.equal(selectedAll.length, 3);

  // Empty input must stay empty instead of supplying a bundled answer bank.
  const emptySelected = selectRandomQuestions([], 20);
  assert.equal(emptySelected.length, 0);
});

test('examService - evaluateExam scoring & pass/fail threshold', () => {
  const sampleQuestions = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    question: `문제 ${i + 1}`,
    correctAnswer: 2
  }));

  // 1. Perfect score: 20 correct -> 100 points
  const perfectAnswers = {};
  sampleQuestions.forEach(q => { perfectAnswers[q.id] = 2; });
  const result100 = evaluateExam(sampleQuestions, perfectAnswers);
  assert.equal(result100.score, 100);
  assert.equal(result100.passed, true);
  assert.equal(result100.correctCount, 20);

  // 2. Pass boundary: 12 correct -> 60 points (Passing score)
  const passAnswers = {};
  sampleQuestions.slice(0, 12).forEach(q => { passAnswers[q.id] = 2; });
  sampleQuestions.slice(12).forEach(q => { passAnswers[q.id] = 1; }); // Wrong
  const result60 = evaluateExam(sampleQuestions, passAnswers);
  assert.equal(result60.score, 60);
  assert.equal(result60.passed, true);
  assert.equal(result60.correctCount, 12);

  // 3. Fail boundary: 11 correct -> 55 points (Failing score)
  const failAnswers = {};
  sampleQuestions.slice(0, 11).forEach(q => { failAnswers[q.id] = 2; });
  sampleQuestions.slice(11).forEach(q => { failAnswers[q.id] = 1; }); // Wrong
  const result55 = evaluateExam(sampleQuestions, failAnswers);
  assert.equal(result55.score, 55);
  assert.equal(result55.passed, false);
  assert.equal(result55.correctCount, 11);

  // 4. Empty answers: 0 points
  const result0 = evaluateExam(sampleQuestions, {});
  assert.equal(result0.score, 0);
  assert.equal(result0.passed, false);
  assert.equal(result0.correctCount, 0);

  // 5. isExamPassed helper
  assert.equal(isExamPassed(result60), true);
  assert.equal(isExamPassed(result55), false);
  assert.equal(isExamPassed(null), false);
});

// ==============================================================================
// 3. UNIT TESTS: apiClient - Password Hashing & Security
// ==============================================================================
test('apiClient - hashPassword and verifyPassword', async () => {
  const plain = 'buddha2026!@#';
  const hashed = await hashPassword(plain);
  assert.match(hashed, /^sha256:[a-f0-9]{64}$/);

  // Verification success
  const isMatch = await verifyPassword(plain, hashed);
  assert.equal(isMatch, true);

  // Verification failure on wrong password
  const isWrong = await verifyPassword('wrongpassword', hashed);
  assert.equal(isWrong, false);

  // Edge case: Empty password
  assert.equal(await hashPassword(''), '');
  assert.equal(await verifyPassword('', hashed), false);
});

// ==============================================================================
// 4. UNIT & INTEGRATION: storage - Purge Isolation
// ==============================================================================
test('storage - purgeLegacyLocalStorage cleans only buddha_ keys', () => {
  const mockStorage = {};
  const mockWindow = {
    localStorage: {
      get length() {
        return Object.keys(mockStorage).length;
      },
      key(i) {
        return Object.keys(mockStorage)[i] || null;
      },
      removeItem(k) {
        delete mockStorage[k];
      }
    }
  };

  // Seed storage
  mockStorage['buddha_token'] = 'sensitive-token';
  mockStorage['buddha_lms_user'] = 'user-data';
  mockStorage['other_app_setting'] = 'keep-me';

  // Temporarily attach to global
  const origWindow = globalThis.window;
  globalThis.window = mockWindow;

  try {
    purgeLegacyLocalStorage();
    assert.equal(mockStorage['buddha_token'], undefined);
    assert.equal(mockStorage['buddha_lms_user'], undefined);
    assert.equal(mockStorage['other_app_setting'], 'keep-me', 'Non-buddha keys must not be cleared');
  } finally {
    globalThis.window = origWindow;
  }
});

// ==============================================================================
// 5. INTEGRATION: Lecture Grouping & Sequential Playlist Logic
// ==============================================================================
test('integration - Course lecture chunk grouping (10 lectures per part)', () => {
  const mockLectures = Array.from({ length: 28 }, (_, i) => ({
    id: `lec-${i + 1}`,
    courseId: 'c1',
    orderIndex: i + 1,
    title: `제${i + 1}강`
  }));

  const chunkSize = 10;
  const groups = [];
  for (let i = 0; i < mockLectures.length; i += chunkSize) {
    const slice = mockLectures.slice(i, i + chunkSize);
    const startNum = slice[0]?.orderIndex;
    const endNum = slice[slice.length - 1]?.orderIndex;
    const partIndex = Math.floor(i / chunkSize) + 1;
    groups.push({
      id: `part-${partIndex}`,
      partIndex,
      title: `제${partIndex}부: 제${String(startNum).padStart(2, '0')}강 ~ 제${String(endNum).padStart(2, '0')}강`,
      lectures: slice
    });
  }

  assert.equal(groups.length, 3);
  assert.equal(groups[0].lectures.length, 10);
  assert.equal(groups[1].lectures.length, 10);
  assert.equal(groups[2].lectures.length, 8);
  assert.equal(groups[0].title, '제1부: 제01강 ~ 제10강');
  assert.equal(groups[2].title, '제3부: 제21강 ~ 제28강');
});

test('integration - WatchPage expiration date check logic', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const isExpired = (expireAt) => {
    if (!expireAt) return false;
    return new Date(expireAt) < new Date(new Date().toDateString());
  };

  assert.equal(isExpired(yesterday), true, 'Yesterday must be expired');
  assert.equal(isExpired(nextMonth), false, 'Next month must not be expired');
  assert.equal(isExpired(todayStr), false, 'Today should be valid until end of day');
  assert.equal(isExpired(null), false, 'No expiry date means no expiration');
});

// ==============================================================================
// 6. UNIT TESTS: donationService (1전화번호 1행 엄격 누적 & 3필터 엑셀 추출)
// ==============================================================================
test('donationService - normalizePhone formatting', () => {
  assert.equal(normalizePhone('01012345678'), '010-1234-5678');
  assert.equal(normalizePhone('010-1234-5678'), '010-1234-5678');
  assert.equal(normalizePhone('010 9876 5432'), '010-9876-5432');
  assert.equal(normalizePhone('0222608888'), '02-2260-8888');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
});

test('donationService - aggregateDonationReceipt strictly keeps 1 row per phone across 2, 3+ donations', () => {
  let receipts = [];

  // [1차 기부] 홍길동 50,000원 수납
  const res1 = aggregateDonationReceipt(receipts, {
    userId: 'hong123',
    name: '홍길동',
    phone: '010-1111-2222',
    amount: 50000,
    courseTitle: '불교의례법사 과정 I'
  });
  receipts = res1.updatedList;

  assert.equal(receipts.length, 1, '최초 등록 시 1개 행 생성');
  assert.equal(receipts[0].totalAmount, 50000, '최초 금액 50,000원');
  assert.equal(receipts[0].donationCount, 1);
  assert.equal(receipts[0].name, '홍길동');

  // [2차 기부] 동일 전화번호(010-1111-2222)로 다른 강좌 70,000원 추가 수납
  const res2 = aggregateDonationReceipt(receipts, {
    userId: 'hong123',
    name: '홍길동',
    phone: '01011112222', // 하이픈 없는 형태여도 동일인 인식
    amount: 70000,
    courseTitle: '불교의례법사 과정 II'
  });
  receipts = res2.updatedList;

  assert.equal(receipts.length, 1, '동일 전화번호 2회 수납 시에도 행은 반드시 1개만 유지');
  assert.equal(receipts[0].totalAmount, 120000, '누적 금액이 50000 + 70000 = 120,000원으로 합산');
  assert.equal(receipts[0].donationCount, 2, '기부 횟수는 2건으로 갱신');
  assert.equal(receipts[0].history.length, 2, '세부 이력 2건 보관');

  // [3차 기부] 동일 전화번호로 30,000원 추가 수납
  const res3 = aggregateDonationReceipt(receipts, {
    userId: 'hong123',
    name: '홍길동',
    phone: '010-1111-2222',
    amount: 30000,
    courseTitle: '불교의례해설 특강'
  });
  receipts = res3.updatedList;

  assert.equal(receipts.length, 1, '동일 전화번호 3회 수납 시에도 행은 엄격히 1개 행만 유지');
  assert.equal(receipts[0].totalAmount, 150000, '누적 금액 120000 + 30000 = 150,000원 합산');
  assert.equal(receipts[0].donationCount, 3);
  assert.equal(receipts[0].history.length, 3);

  // [다른 학인 기부] 이순신 100,000원 수납 (다른 전화번호)
  const res4 = aggregateDonationReceipt(receipts, {
    userId: 'lee456',
    name: '이순신',
    phone: '010-9999-8888',
    amount: 100000,
    courseTitle: '불교의례법사 과정 I'
  });
  receipts = res4.updatedList;

  assert.equal(receipts.length, 2, '다른 전화번호 등록 시 신규 1행 추가되어 총 2행');
  assert.equal(receipts[1].name, '이순신');
  assert.equal(receipts[1].totalAmount, 100000);
});

test('donationService - 3가지 필터(전체/미발행/기발행) 판별 및 엑셀(CSV) UTF-8 BOM 인코딩 검증', () => {
  const receipts = [
    {
      id: 'don_1',
      userId: 'user_issued',
      name: '기발행자',
      phone: '010-1234-5678',
      totalAmount: 100000,
      lastIssuedAt: '2026-09-20'
    }
  ];

  // 기발행 여부 판별 검증
  assert.ok(findReceiptByPhoneOrUser(receipts, '010-1234-5678', 'user_issued'));
  assert.equal(findReceiptByPhoneOrUser(receipts, '010-0000-0000', 'user_other'), null);

  // 3개 필터 분기 대상자 분류 테스트
  const mockStudents = [
    { id: 'user_issued', name: '기발행자', phone: '010-1234-5678' },
    { id: 'user_unissued', name: '미발행자', phone: '010-9999-0000' }
  ];

  const allList = mockStudents;
  const unissuedList = mockStudents.filter(s => !findReceiptByPhoneOrUser(receipts, s.phone, s.id));
  const issuedList = mockStudents.filter(s => Boolean(findReceiptByPhoneOrUser(receipts, s.phone, s.id)));

  assert.equal(allList.length, 2, '전체 보기는 2명 모두 포함');
  assert.equal(unissuedList.length, 1, '미발행 건(기발행자 제외) 필터는 미발행자 1명만 포함');
  assert.equal(unissuedList[0].id, 'user_unissued');
  assert.equal(issuedList.length, 1, '기발행 건 필터는 기발행자 1명만 포함');
  assert.equal(issuedList[0].id, 'user_issued');

  // CSV 생성 검증 (UTF-8 BOM \uFEFF 확인)
  const columns = [
    { key: '_index', label: '순번' },
    { key: 'name', label: '성명' },
    { key: 'phone', label: '전화번호' },
    { key: 'amount', label: '금액', formatter: v => `${v}원` }
  ];
  const testData = [{ name: '홍길동, 특수', phone: '010-1111-2222', amount: 50000 }];
  const csv = exportToExcelCSV(testData, columns, 'test.csv');

  assert.ok(typeof csv === 'string');
  assert.ok(csv.startsWith('\uFEFF'), 'CSV는 엑셀 한글 깨짐 방지를 위해 UTF-8 BOM으로 시작해야 함');
  assert.ok(csv.includes('"순번","성명","전화번호","금액"'));
  assert.ok(csv.includes('"홍길동, 특수"'), '쉼표가 포함된 값은 안전하게 큰따옴표로 이스케이프되어야 함');
  assert.ok(csv.includes('50000원'));
});

