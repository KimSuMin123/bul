import assert from 'node:assert/strict';
import { isAnnouncementActive, safeHttpUrl, validateAnnouncementImage } from '../src/services/announcementService.js';

assert.equal(safeHttpUrl('javascript:alert(1)'), '');
assert.equal(safeHttpUrl('https://example.org/path'), 'https://example.org/path');
assert.equal(isAnnouncementActive({ enabled: true, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-02T00:00:00Z' }, new Date('2026-10-01T12:00:00Z')), true);
assert.equal(isAnnouncementActive({ enabled: false }, new Date()), false);
assert.equal(isAnnouncementActive({ enabled: true, ends_at: '2026-10-01T00:00:00Z' }, new Date('2026-10-01T00:00:00Z')), false);
const makeFile = (bytes, type) => { const blob = new Blob([new Uint8Array(bytes)], { type }); return blob; };
await validateAnnouncementImage(makeFile([137,80,78,71,13,10,26,10,0], 'image/png'));
await assert.rejects(validateAnnouncementImage(makeFile([60,115,118,103], 'image/png')));
await assert.rejects(validateAnnouncementImage(makeFile([255,216,255], 'image/png')));
console.log('announcement helpers pass');
