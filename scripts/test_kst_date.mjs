// 화면의 날짜 기록(수강·결제·만료·영수증·엑셀 파일명)은 한국 날짜를 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { kstDate } from '../src/utils/kstDate.js';

test('kstDate returns the Korean calendar date, not the UTC date', () => {
  assert.equal(kstDate(new Date('2026-09-29T22:30:00Z')), '2026-09-30', '한국 07:30 = UTC 전날 22:30');
  assert.equal(kstDate(new Date('2026-09-30T14:59:59Z')), '2026-09-30', '한국 23:59');
  assert.equal(kstDate(new Date('2026-09-30T15:00:00Z')), '2026-10-01', '한국 자정');
  assert.equal(kstDate('2026-12-31T15:30:00Z'), '2027-01-01', '연말');
  assert.match(kstDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('no screen code derives a calendar date from toISOString()', () => {
  const walk = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const offenders = walk('src').filter(f => /\.(js|jsx)$/.test(f))
    .filter(f => /toISOString\(\)\.(split\('T'\)\[0\]|slice\(0, ?10\)|substring\(0, ?10\))/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
