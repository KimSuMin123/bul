import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenNextLecture, enrollmentConfirmation, APPROVAL_SCHEDULE, PAYMENT_ACCOUNT } from '../src/config/sitePolicy.js';
import { checkLecturesCompleted } from '../src/services/certService.js';

test('80 percent opens next lesson without accepting a false completion flag', () => {
  for (const [rate, allowed] of [[79.99, false], [80, true], [80.01, true], [100, true]]) {
    assert.equal(canOpenNextLecture({ progressRate: rate, completed: false }), allowed);
  }
  assert.equal(canOpenNextLecture({ progressRate: 20, completed: true }), false);
  assert.equal(canOpenNextLecture(undefined), false);
});

test('enrollment confirmation includes the preserved result, bank, price and exact schedule', () => {
  const text = enrollmentConfirmation({ title: '검증 강의', price: 50000 });
  for (const expected of ['검증 강의', '신청이 완료', PAYMENT_ACCOUNT, '50,000원', APPROVAL_SCHEDULE, '내 강의실']) assert.ok(text.includes(expected));
  assert.equal(text.includes('즉시 전환'), false);
});

test('opening at 80 percent does not grant completion or certificate eligibility', () => {
  const courses = [{ id: 'c1' }], lectures = [{ id: 'l1', courseId: 'c1' }];
  assert.equal(checkLecturesCompleted('s1', 'c1', courses, lectures, [{ userId: 's1', lectureId: 'l1', courseId: 'c1', progressRate: 80, completed: false }]), false);
});
