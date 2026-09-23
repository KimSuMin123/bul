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
