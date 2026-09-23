import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { enrollmentConfirmation, PRIVACY_POLICY_VERSION } from '../src/config/sitePolicy.js';

// Execute the actual event handlers with isolated UI/API dependencies.
// No browser, network, or application data is used.
function handler(file, name, context, indent = '  ') {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const start = source.indexOf(`const ${name} = `);
  assert.notEqual(start, -1, `${name} exists`);
  const end = source.indexOf(`\n${indent}};`, start);
  assert.notEqual(end, -1, `${name} end exists`);
  return vm.runInNewContext(`${source.slice(start, end + indent.length + 4)}\n${name}`, context);
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('Enter on cancel retains native button activation and never confirms globally', () => {
  let confirmed = 0;
  let prevented = false;
  const onKey = handler('src/context/ModalAlertContext.jsx', 'handleKeyDown', {
    modalState: { isConfirm: true },
    handleConfirm: () => confirmed++, handleCancel: () => {},
    dialogRef: { current: null },
  }, '    ');
  onKey({ key: 'Enter', preventDefault() { prevented = true; } });
  assert.equal(confirmed, 0);
  assert.equal(prevented, false);
});

test('Escape cancels a confirmation', () => {
  let cancelled = 0;
  const onKey = handler('src/context/ModalAlertContext.jsx', 'handleKeyDown', {
    modalState: { isConfirm: true },
    handleConfirm: () => assert.fail('must not confirm'), handleCancel: () => cancelled++,
    dialogRef: { current: null },
  }, '    ');
  onKey({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  assert.equal(cancelled, 1);
});

function applyContext(overrides = {}) {
  return {
    currentUser: { id: 'test-user' }, course: { id: 'test-course', title: 'Test' },
    courses: [{ id: 'test-course', title: 'Test', price: 50000 }], enrollmentConfirmation,
    applyingRef: { current: false }, setApplying() {},
    enrollStudent: async () => ({}), showAlert: async () => {},
    showConfirm: async () => true, onNavigate() {}, ...overrides,
  };
}

test('application failure reports an error without success or navigation', async () => {
  const alerts = [];
  const ctx = applyContext({
    enrollStudent: async () => { throw new Error('offline'); },
    showAlert: async (message, options) => alerts.push(options.type),
    onNavigate: () => assert.fail('must remain on application page'),
  });
  await handler('src/pages/CourseDetailPage.jsx', 'handleApplyCourse', ctx)();
  assert.deepEqual(alerts, ['error']);
  assert.equal(ctx.applyingRef.current, false);
});

test('simultaneous application clicks perform one save and unlock after success', async () => {
  let saves = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const ctx = applyContext({ enrollStudent: async () => { saves++; await pending; } });
  const apply = handler('src/pages/CourseDetailPage.jsx', 'handleApplyCourse', ctx);
  const calls = [apply(), apply()];
  assert.equal(saves, 1);
  release();
  await Promise.all(calls);
  assert.equal(ctx.applyingRef.current, false);
});

function examContext(overrides = {}) {
  return {
    currentUser: { id: 'test-user' }, course: { id: 'test-course' },
    submittingRef: { current: false }, setSubmitting() {},
    totalQuestions: 20, answeredCount: 20, examQuestions: [], userAnswers: {},
    attemptId: 'server-attempt', startingRef: { current: false }, setStarting() {},
    submitExam: async () => ({ score: 80 }),
    showConfirm: async () => true, showAlert: async () => {},
    setEvaluationResult() {}, setViewState() {}, ...overrides,
  };
}

test('exam save failure preserves answers without displaying a result', async () => {
  const alerts = [];
  const ctx = examContext({
    submitExam: async () => { throw new Error('offline'); },
    showAlert: async (message, options) => alerts.push(options.type),
    setEvaluationResult: () => assert.fail('must not show a result'),
    setViewState: () => assert.fail('must remain in exam'),
  });
  await handler('src/components/exam/CourseExamModal.jsx', 'handleSubmitExam', ctx)();
  assert.deepEqual(alerts, ['error']);
  assert.equal(ctx.submittingRef.current, false);
});

test('simultaneous exam submissions perform one save', async () => {
  let saves = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const ctx = examContext({ submitExam: async () => { saves++; await pending; return { score: 80 }; } });
  const submit = handler('src/components/exam/CourseExamModal.jsx', 'handleSubmitExam', ctx);
  const calls = [submit(), submit()];
  assert.equal(saves, 1);
  release();
  await Promise.all(calls);
  assert.equal(ctx.submittingRef.current, false);
});

test('cancelled incomplete exam confirmation unlocks without saving', async () => {
  const ctx = examContext({
    answeredCount: 10, showConfirm: async () => false,
    submitExam: () => assert.fail('cancel must not submit'),
  });
  await handler('src/components/exam/CourseExamModal.jsx', 'handleSubmitExam', ctx)();
  assert.equal(ctx.submittingRef.current, false);
});

test('Tab and Shift+Tab cycle inside the alert dialog', () => {
  let focused;
  const first = { getClientRects: () => [1], focus: () => { focused = first; } };
  const last = { getClientRects: () => [1], focus: () => { focused = last; } };
  const document = { activeElement: last };
  const onKey = handler('src/context/ModalAlertContext.jsx', 'handleKeyDown', {
    modalState: { isConfirm: true }, document,
    dialogRef: { current: { querySelectorAll: () => [first, last], contains: () => true } },
  }, '    ');
  onKey({ key: 'Tab', preventDefault() {} });
  assert.equal(focused, first);
  document.activeElement = first;
  onKey({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(focused, last);
});

test('dashboard application failure reports failure and remains retryable', async () => {
  const alerts = [];
  const ctx = applyContext({
    enrollStudent: async () => { throw new Error('offline'); },
    showAlert: async (message, options) => alerts.push(options.type),
    refreshData: () => assert.fail('must not refresh after failed save'),
  });
  await handler('src/pages/DashboardPage.jsx', 'handleApplyCourseFromDashboard', ctx)('test-course');
  assert.deepEqual(alerts, ['error']);
  assert.equal(ctx.applyingRef.current, false);
});

function adminContext(overrides = {}) {
  return {
    enrollmentSaveRef: { current: false }, setSavingEnrollment() {},
    selectedUser: { id: 'test-user', name: 'Test' },
    currentUser: { name: 'Admin' }, courses: [{ id: 'test-course', title: 'Test', price: 100 }],
    allUsers: [{ id: 'test-user', name: 'Test' }],
    grantCourseId: 'test-course', grantStatus: 'active',
    payUserId: 'test-user', payCourseId: 'test-course', payManager: 'Admin',
    payAmount: '100', payMethodMemo: 'Test', payDate: '2026-09-23',
    payWithDonationReceipt: false, setPayWithDonationReceipt() {},
    enrollStudent: async () => { throw new Error('offline'); },
    recordPayment: async () => { throw new Error('offline'); },
    showAlert: async () => {}, showConfirm: async () => true,
    setShowGrantModal: () => assert.fail('must keep form on failed save'),
    setShowPaymentModal: () => assert.fail('must keep form on failed save'),
    refreshData: async () => {}, ...overrides,
  };
}

for (const name of ['handleGrantEnrollment', 'handleRecordPayment', 'handleApprovePendingPayment']) {
  test(`${name} catches rejected saves without success`, async () => {
    const alerts = [];
    const ctx = adminContext({ showAlert: async (message, options) => alerts.push(options.type) });
    await handler('src/pages/AdminDashboardPage.jsx', name, ctx)({
      preventDefault() {}, userId: 'test-user', courseId: 'test-course',
    });
    assert.deepEqual(alerts, ['error']);
    assert.equal(ctx.enrollmentSaveRef.current, false);
  });
}

test('new member account success and payment failure are reported separately', async () => {
  const alerts = [];
  let selectedUser;
  let modalOpen = true;
  let registeredCount = 0;
  const ctx = adminContext({
    registeringUserRef: { current: false }, setIsSubmittingUser() {},
    setUserModalError(message) { assert.equal(message, ''); },
    newUserForm: {
      privacyConsent: true, privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      id: 'new-test-user', name: 'Test', password: 'FixtureOnly123!', phone: '000',
      birthDate: '2000-01-01', role: 'student', memberNo: 'test',
      assignCourse: true, courseId: 'test-course', status: 'active',
      recordPayment: true, paymentAmount: '100', paymentMethodMemo: 'Test',
    },
    adminRegisterUser: async () => { registeredCount++; return { id: 'new-test-user' }; },
    PRIVACY_POLICY_VERSION,
    enrollStudent: () => assert.fail('paid enrollment must use the payment transaction'),
    recordPayment: async data => {
      assert.equal(data.userId, 'new-test-user');
      throw new Error('payment failed');
    },
    setUsersVersion() {}, setCopiedInfo() {},
    setCreatedUserInfo: () => assert.fail('must not show full registration success'),
    setShowNewUserModal(value) { modalOpen = value; },
    setSelectedUser(value) { selectedUser = value; },
    showAlert: async (message, options) => alerts.push([message, options.title]),
  });
  const submit = handler('src/pages/AdminDashboardPage.jsx', 'handleCreateUserSubmit', ctx);
  await Promise.all([submit({ preventDefault() {} }), submit({ preventDefault() {} })]);
  assert.equal(registeredCount, 1);
  assert.equal(modalOpen, false);
  assert.equal(selectedUser.id, 'new-test-user');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][1], '회원 등록 완료, 후속 등록 실패');
  assert.match(alerts[0][0], /payment failed/);
  assert.equal(ctx.registeringUserRef.current, false);
});

for (const name of ['handleGrantEnrollment', 'handleRecordPayment', 'handleApprovePendingPayment']) {
  test(`${name} serializes concurrent save requests`, async () => {
    let saves = 0;
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const save = async () => { saves++; await pending; };
    const ctx = adminContext({
      enrollStudent: save, recordPayment: save,
      setShowGrantModal() {}, setShowPaymentModal() {},
    });
    const submit = handler('src/pages/AdminDashboardPage.jsx', name, ctx);
    const event = { preventDefault() {}, userId: 'test-user', courseId: 'test-course' };
    const calls = [submit(event), submit(event)];
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(saves, 1);
    release();
    await Promise.all(calls);
    assert.equal(ctx.enrollmentSaveRef.current, false);
  });
}

test('exam starts from a server-issued attempt without a local answer pool', async () => {
  const questions = [{ id: 'server-question', question: 'Test?', options: ['A', 'B'] }];
  let calls = 0;
  let attempt;
  let shownQuestions;
  let state;
  const ctx = examContext({
    beginExam: async courseId => { calls++; assert.equal(courseId, 'test-course'); return { attemptId: 'issued-attempt', questions }; },
    setAttemptId: value => { attempt = value; },
    setExamQuestions: value => { shownQuestions = value; },
    setCurrentIndex() {}, setUserAnswers() {},
    setViewState: value => { state = value; },
  });
  const start = handler('src/components/exam/CourseExamModal.jsx', 'handleStartExam', ctx);
  await Promise.all([start(), start()]);
  assert.equal(calls, 1);
  assert.equal(attempt, 'issued-attempt');
  assert.equal(shownQuestions, questions);
  assert.equal(state, 'testing');
  assert.equal(ctx.startingRef.current, false);
});

test('exam start failure stays on the intro and unlocks retry', async () => {
  const alerts = [];
  const ctx = examContext({
    beginExam: async () => { throw new Error('start denied'); },
    setViewState: () => assert.fail('must not enter an exam after failed start'),
    showAlert: async (message, options) => alerts.push(options.type),
  });
  await handler('src/components/exam/CourseExamModal.jsx', 'handleStartExam', ctx)();
  assert.deepEqual(alerts, ['error']);
  assert.equal(ctx.startingRef.current, false);
});

test('exam submission sends the server attempt id and answer map only', async () => {
  let argumentsSent;
  const answers = { 'server-question': 2 };
  const ctx = examContext({
    userAnswers: answers,
    submitExam: async (...args) => { argumentsSent = args; return { score: 80 }; },
  });
  await handler('src/components/exam/CourseExamModal.jsx', 'handleSubmitExam', ctx)();
  assert.deepEqual(argumentsSent, ['test-user', 'test-course', 'server-attempt', answers]);
});

function cmsContext(overrides = {}) {
  const ctx = {
    cmsSavingRef: { current: false }, setCmsSaving() {},
    metadataBusyRef: { current: false },
    showAlert: async () => {}, showConfirm: async () => true, refreshData: async () => {},
    parseExamText: () => [], courseForm: { title: 'Test course', rawExamText: '' },
    setShowNewCourseModal() {}, setCourseForm() {}, DEFAULT_RAW_EXAM_TEXT: '',
    ...overrides,
  };
  const source = readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');
  if (source.includes('const runCmsAction = ')) ctx.runCmsAction = handler('src/pages/AdminDashboardPage.jsx', 'runCmsAction', ctx);
  return ctx;
}

test('CMS course creation waits for persistence before success UI', async () => {
  const alerts = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const ctx = cmsContext({
    addCourse: async () => { await pending; return { title: 'Saved course' }; },
    showAlert: async (message, options) => alerts.push(options.type),
  });
  const call = handler('src/pages/AdminDashboardPage.jsx', 'handleCreateCourse', ctx)({ preventDefault() {} });
  try { assert.deepEqual(alerts, []); }
  finally { release(); await call; }
  assert.deepEqual(alerts, ['success']);
});

const cmsFailureCases = [
  ['handleCreateCourse', {}, 'addCourse'],
  ['handleSaveAdminAnswer', { replyModalPost: { id: 'qa' }, replyContent: 'answer', replyMonkName: 'teacher', replyBadgeTitle: 'teacher' }, 'addQAAnswer'],
  ['handleDeleteQA', {}, 'deleteQAPost', ['qa']],
  ['handleSaveCertEdit', { certEditCourse: { id: 'course' }, certEditForm: { certType: '', certGrade: '', certTypeFull: '', certRegNo: '', certRegOffice: '', rawExamText: '' } }, 'updateCourseSettings'],
  ['handleDeleteCourse', {}, 'deleteCourse', ['course', 'Course']],
  ['handleDeleteLecture', {}, 'deleteLecture', ['lecture', 'Lecture']],
  ['handleSaveCourseThumbnail', { thumbModalCourse: { id: 'course' }, thumbPreviewUrl: 'https://example.invalid/image.png', thumbUrlInput: '' }, 'updateCourseSettings'],
  ['handleSaveLecThumbnail', { thumbModalLec: { id: 'lecture' }, thumbLecPreviewUrl: 'https://example.invalid/image.png', thumbLecUrlInput: '' }, 'updateLecture'],
  ['handleToggleSequential', {}, 'updateCourseSettings', ['course', false]],
  ['handleCreateLecture', { lecForm: { title: 'Lecture', videoUrl: 'https://example.invalid/video.mp4' }, uploadMode: 'url', setUploadSuccessMsg() {}, setUploadErrorMsg() {} }, 'addLecture'],
  ['handleExecuteResetPassword', { resetPwUser: { id: 'user' }, newTempPassword: 'FixtureOnly123!', setIsResettingPw() {} }, 'adminResetPassword'],
  ['handleDeleteUser', { currentUser: { id: 'admin' } }, 'adminDeleteUser', [{ id: 'user', name: 'User' }]],
  ['handleReplaceVideoSubmit', {
    replaceModalLec: { id: 'lecture' }, replaceVideoFile: { name: 'fixture.mp4' },
    extractVideoMetadata: async () => ({ duration: 10 }),
    uploadLectureVideo: async () => ({ publicUrl: 'https://example.invalid/video.mp4' }),
    setIsReplacing() {}, setReplaceErrorMsg() {}, setReplaceProgress() {},
    setReplaceSuccessMsg(value) { assert.equal(value, ''); },
  }, 'updateLecture'],
];
for (const [name, dependencies, mutation, args = [{ preventDefault() {} }]] of cmsFailureCases) {
  test(`${name} reports a rejected mutation without claiming success`, async () => {
    const alerts = [];
    const ctx = cmsContext({
      ...dependencies,
      [mutation]: async () => { throw new Error('save rejected'); },
      showAlert: async (message, options) => alerts.push(options.type),
    });
    await handler('src/pages/AdminDashboardPage.jsx', name, ctx)(...args);
    assert.deepEqual(alerts, ['error']);
    assert.equal(ctx.cmsSavingRef.current, false);
  });
}

test('CMS shared lock prevents overlapping mutations and releases on failure', async () => {
  let calls = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const ctx = cmsContext();
  const mutation = async () => { calls++; await pending; throw new Error('save rejected'); };
  const work = [ctx.runCmsAction(mutation), ctx.runCmsAction(mutation)];
  assert.equal(calls, 1);
  release();
  await Promise.all(work);
  assert.equal(ctx.cmsSavingRef.current, false);
  await ctx.runCmsAction(async () => calls++);
  assert.equal(calls, 2);
});

function qaContext(overrides = {}) {
  const ctx = {
    qaBusyRef: { current: false }, setQaBusy() {},
    newTitle: 'Question', newContent: 'Content', currentCrsId: 'course', currentLecId: 'lecture',
    attachTimestamp: false, timestampSecs: 0, isPrivate: false,
    setSubmitting() {}, setFormError() {},
    answerForms: { qa: { content: 'Answer', monkName: 'Teacher', badgeTitle: 'Teacher' } },
    showConfirm: async () => true, showAlert: async () => {}, ...overrides,
  };
  ctx.runQAAction = handler('src/components/qa/LectureQABoard.jsx', 'runQAAction', ctx);
  return ctx;
}

test('failed QA question save retains the draft and unlocks retry', async () => {
  let message;
  const ctx = qaContext({
    addQAPost: async () => { throw new Error('question rejected'); },
    setFormError: value => { message = value; },
    setNewTitle: () => assert.fail('must retain title'),
    setNewContent: () => assert.fail('must retain content'),
  });
  await handler('src/components/qa/LectureQABoard.jsx', 'handleSubmitQuestion', ctx)({ preventDefault() {} });
  assert.equal(message, 'question rejected');
  assert.equal(ctx.qaBusyRef.current, false);
});

for (const [name, mutation] of [['handleSubmitAnswer', 'addQAAnswer'], ['handleDelete', 'deleteQAPost']]) {
  test(`${name} keeps QA failures visible without a success response`, async () => {
    const alerts = [];
    const ctx = qaContext({
      [mutation]: async () => { throw new Error('qa rejected'); },
      setAnswerForms: () => assert.fail('must preserve answer draft'),
      showAlert: async (message, options) => alerts.push(options.type),
    });
    await handler('src/components/qa/LectureQABoard.jsx', name, ctx)('qa');
    assert.deepEqual(alerts, ['error']);
    assert.equal(ctx.qaBusyRef.current, false);
  });
}

test('QA shared lock prevents simultaneous mutations', async () => {
  let calls = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const ctx = qaContext();
  const save = async () => { calls++; await pending; };
  const work = [ctx.runQAAction(save), ctx.runQAAction(save)];
  assert.equal(calls, 1);
  release();
  await Promise.all(work);
  assert.equal(ctx.qaBusyRef.current, false);
});

test('login has no unauthenticated password reset operation', () => {
  const source = readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /resetPassword|handleResetPassword|forgotPhone|newPassword/);
  assert.match(source, /교학처에서 본인 확인/);
  assert.doesNotMatch(source, /\?{3,}/);
});

test('login waits for committed auth state before navigating', async () => {
  const navigation = [];
  let targetId;
  const context = {
    id: 'fixture-admin', password: 'fixture-only',
    login: async () => ({ id: 'fixture-admin', role: 'admin' }),
    setError() {}, setIsSubmitting() {},
    setLoginTargetUserId: value => { targetId = value; },
    onNavigate: view => navigation.push(view),
  };
  await handler('src/pages/LoginPage.jsx', 'handleSubmit', context)({ preventDefault() {} });
  assert.deepEqual(navigation, []);
  assert.equal(targetId, 'fixture-admin');

  const source = readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
  const from = source.indexOf('useEffect(() => {') + 'useEffect('.length;
  const to = source.indexOf(', [currentUser', from);
  assert.ok(from > 0 && to > from);
  const effectSource = source.slice(from, to);
  const effectContext = { ...context, loginTargetUserId: targetId, currentUser: null };
  vm.runInNewContext(`(${effectSource})()`, effectContext);
  assert.deepEqual(navigation, []);
  effectContext.currentUser = { id: 'fixture-admin', role: 'admin' };
  vm.runInNewContext(`(${effectSource})()`, effectContext);
  assert.deepEqual(navigation, ['admin']);
  assert.equal(targetId, null);

  navigation.length = 0;
  effectContext.currentUser = { id: 'fixture-admin', role: 'student' };
  vm.runInNewContext(`(${effectSource})()`, effectContext);
  assert.deepEqual(navigation, ['dashboard']);
});

let failed = 0;
for (const [name, run] of tests) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
process.exitCode = failed ? 1 : 0;
