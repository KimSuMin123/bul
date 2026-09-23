import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runCloudBackup, koreaDay, pruneBackups, LEASE_MS } from '../lib/cloud-backup/runner.mjs';
import { selectSnapshot } from '../lib/cloud-backup/select-snapshot.mjs';
import { handleScheduledBackup } from '../lib/cloud-backup/handlers.mjs';
import { createBackupMailer, smtpOptions } from '../lib/cloud-backup/smtp.mjs';
import { boundedBlobFetch } from '../lib/cloud-backup/blobs.mjs';
import { getStore } from '@netlify/blobs';

const instant = Date.parse('2026-09-23T18:00:00Z');
const day = '2026-09-24';
const oldKey = 'snapshots/2026-09-01/00000000-0000-4000-8000-000000000000.json';
const sample = () => ({ version: 1, kind: 'public-select-snapshot', jobId: 'fixture', startedAt: new Date(instant).toISOString(), tables: { users: { columns: ['id'], rowCount: 1, rows: [{ id: 'fixture-member' }] } } });
class FakeStore {
  data = new Map(); calls = []; counter = 0;
  async set(key, data, options = {}) {
    this.calls.push(['set', key]); const current = this.data.get(key);
    if (options.onlyIfNew && current || options.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
    const etag = String(++this.counter); this.data.set(key, { data, etag, metadata: options.metadata || {} }); return { modified: true, etag };
  }
  async setJSON(key, value, options) { return this.set(key, JSON.stringify(value), options); }
  async get(key, options = {}) { const item = this.data.get(key); return item ? options.type === 'json' ? JSON.parse(item.data) : item.data : null; }
  async getWithMetadata(key, options) { const item = this.data.get(key); return item ? { ...item, data: await this.get(key, options) } : null; }
  async getMetadata(key) { return this.data.get(key) || null; }
  async *list({ prefix }) { yield { blobs: [...this.data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; }
  async delete(key) { this.calls.push(['delete', key]); this.data.delete(key); }
}
function fixture(overrides = {}) {
  const store = new FakeStore(), messages = [];
  return { store, messages, args: { store, env: {}, day, now: () => instant,
    exportSnapshot: async () => sample(),
    mailer: { backup: async value => { store.calls.push(['mail']); messages.push(value); return 'sent'; }, failure: async value => { messages.push(value); return 'sent'; } }, ...overrides } };
}
test('Korea03:00 uses UTC18:00 and the next calendar day', async () => {
  assert.equal(koreaDay(instant), day);
  assert.equal(koreaDay(Date.parse('2026-09-23T14:59:59.999Z')), '2026-09-23');
  assert.match(await readFile('netlify.toml', 'utf8'), /schedule = "0 18 \* \* \*"/);
});
test('success emails attachment first, stores identical verified bytes, and records durable result', async () => {
  const f = fixture(), result = await runCloudBackup(f.args);
  assert.equal(result.status, 'saved'); assert.equal(result.email, 'sent'); assert.equal(result.storageVerified, true);
  const stored = await f.store.get(result.snapshotKey);
  assert.equal(stored, f.messages[0].serialized);
  assert.equal(result.sha256, createHash('sha256').update(stored).digest('hex'));
  assert.ok(f.store.calls.findIndex(c => c[0] === 'mail') < f.store.calls.findIndex(c => c[1] === result.snapshotKey));
  assert.equal((await f.store.get(`runs/${day}.json`, { type: 'json' })).email, 'sent');
});
test('repeat Run now after mail attempt sends nothing and cannot overwrite daily result', async () => {
  const f = fixture(); const first = await runCloudBackup(f.args); const record = await f.store.get(`runs/${day}.json`);
  const second = await runCloudBackup(f.args);
  assert.equal(second.reason, 'already-attempted-today'); assert.equal(f.messages.length, 1);
  assert.equal(await f.store.get(`runs/${day}.json`), record); assert.ok(f.store.data.has(first.snapshotKey));
});
test('concurrent invocations acquire only one atomic worker lease', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({ exportSnapshot: async () => { await gate; return sample(); } });
  const first = runCloudBackup(f.args); await new Promise(resolve => setImmediate(resolve));
  const second = await runCloudBackup(f.args); assert.equal(second.reason, 'worker-busy');
  release(); await first; assert.equal(f.messages.length, 1);
});
test('expired lease can be reclaimed but live lease cannot', async () => {
  const f = fixture(); await f.store.setJSON('control/worker-lock.json', { owner: 'old', expiresAt: instant - 1 });
  assert.equal((await runCloudBackup(f.args)).status, 'saved'); assert.ok(LEASE_MS > 30000);
});
test('mail rejection retains snapshot and all prior backups without automatic resend', async () => {
  const f = fixture(); await f.store.set(oldKey, 'prior', { metadata: { kind: 'public-select-snapshot', createdAt: '2026-09-01T00:00:00Z' } });
  f.args.mailer.backup = async () => { throw new Error('SMTP_AUTHENTICATION'); };
  const result = await runCloudBackup(f.args);
  assert.equal(result.status, 'saved'); assert.equal(result.email, 'failed'); assert.equal(result.error, 'SMTP_AUTHENTICATION');
  assert.ok(f.store.data.has(oldKey)); assert.ok(f.store.data.has(result.snapshotKey));
  assert.equal((await runCloudBackup(f.args)).reason, 'already-attempted-today');
});
test('uncertain SMTP acceptance is never automatically retried', async () => {
  const f = fixture(); let attempts = 0;
  f.args.mailer.backup = async () => { attempts++; throw new Error('SMTP_UNCERTAIN'); };
  assert.equal((await runCloudBackup(f.args)).email, 'uncertain'); await runCloudBackup(f.args); assert.equal(attempts, 1);
});
test('export failure sends only safe failure result, with no retention or raw error', async () => {
  const f = fixture({ exportSnapshot: async () => { throw new Error('raw password PRIVATE_DATA'); } });
  await f.store.set(oldKey, 'prior'); const result = await runCloudBackup(f.args);
  assert.equal(result.error, 'EXPORT_FAILED'); assert.equal(f.messages[0].code, 'EXPORT_FAILED');
  assert.ok(f.store.data.has(oldKey)); assert.doesNotMatch(JSON.stringify(result), /password|PRIVATE_DATA/);
});
test('storage failure does not delete good backups and reports failed internal retention', async () => {
  const f = fixture(); await f.store.set(oldKey, 'prior'); const original = f.store.set.bind(f.store);
  f.store.set = async (key, data, options) => { if (key.startsWith(`snapshots/${day}/`)) throw new Error('private storage error'); return original(key, data, options); };
  const result = await runCloudBackup(f.args);
  assert.equal(result.error, 'STORAGE_FAILED'); assert.equal(result.status, 'failed'); assert.ok(f.store.data.has(oldKey));
  assert.equal(result.failureNotification, 'sent'); assert.doesNotMatch(JSON.stringify(result), /private storage/);
});
test('SMTP attempt followed by storage failure can recover storage without resending mail', async () => {
  const f = fixture(); const original = f.store.set.bind(f.store); let broken = true;
  f.store.set = async (key, data, options) => { if (broken && key.startsWith('snapshots/')) throw new Error('offline'); return original(key, data, options); };
  const first = await runCloudBackup(f.args); assert.equal(first.status, 'failed');
  broken = false; const mailCount = f.messages.length; const recovered = await runCloudBackup(f.args);
  assert.equal(recovered.status, 'saved'); assert.equal(recovered.email, 'not-attempted-recovery');
  assert.equal(recovered.recoveryOf, first.jobId); assert.equal(f.messages.length, mailCount); assert.ok(f.store.data.has(recovered.snapshotKey));
  assert.equal((await runCloudBackup(f.args)).reason, 'already-attempted-today');
});
test('repeated export failure sends at most one daily failure notification', async () => {
  const f = fixture({ exportSnapshot: async () => { throw new Error('offline'); } });
  await runCloudBackup(f.args); await runCloudBackup(f.args);
  assert.equal(f.messages.length, 1); assert.equal((await f.store.get(`runs/${day}.json`, { type: 'json' })).failureNotificationAttempted, true);
});
test('actual Netlify SDK does not retry an aborted network operation past schedule budget', async () => {
  let calls = 0; const started = performance.now();
  const store = getStore({ name: 'fixture', siteID: 'fixture-site', token: 'fixture-token',
    edgeURL: 'https://blobs.example.invalid', uncachedEdgeURL: 'https://blobs.example.invalid', consistency: 'strong',
    fetch: boundedBlobFetch({ remaining: () => 200 }, AbortSignal.timeout(200), async () => { calls++; throw new DOMException('private network message', 'AbortError'); }) });
  await assert.rejects(() => store.set('key', 'value'));
  assert.equal(calls, 1); assert.ok(performance.now() - started < 1000, 'SDK retry sleep must be suppressed');
});
test('Blobs retryable HTTP errors become non-retryable safe errors', async () => {
  for (const status of [403, 429, 500, 503]) {
    const response = await boundedBlobFetch({ remaining: () => 200 }, AbortSignal.timeout(200), async () => new Response('secret upstream body', { status }))('https://example.invalid');
    assert.equal(response.status, 408); assert.equal(await response.text(), '');
  }
});
test('retention deletes only strict snapshot keys older than seven days after new success', async () => {
  const f = fixture(); const meta = { kind: 'public-select-snapshot', createdAt: '2026-09-01T00:00:00Z' };
  await f.store.set(oldKey, 'old', { metadata: meta });
  const unrelated = 'snapshots/manual-admin-export.json'; await f.store.set(unrelated, 'keep', { metadata: meta });
  const boundary = 'snapshots/2026-09-16/00000000-0000-4000-8000-000000000001.json';
  await f.store.set(boundary, 'keep', { metadata: { ...meta, createdAt: new Date(instant - 7 * 86400000).toISOString() } });
  const result = await runCloudBackup(f.args);
  assert.equal(result.deleted, 1); assert.ok(!f.store.data.has(oldKey)); assert.ok(f.store.data.has(unrelated)); assert.ok(f.store.data.has(boundary));
});
test('configured retention is honored and invalid retention never deletes or exports', async () => {
  const f = fixture({ env: { BACKUP_RETENTION_DAYS: '30' } });
  await f.store.set(oldKey, 'keep', { metadata: { kind: 'public-select-snapshot', createdAt: '2026-09-01T00:00:00Z' } });
  const result = await runCloudBackup(f.args); assert.equal(result.retentionDays, 30); assert.ok(f.store.data.has(oldKey));
  for (const value of ['0', '366', 'bad', '1.5']) {
    await assert.rejects(() => runCloudBackup({ ...f.args, env: { BACKUP_RETENTION_DAYS: value } }), /INVALID_RETENTION_DAYS/);
  }
});
test('low deadline stops export early and defers retention without deleting previous backups', async () => {
  const f = fixture({ budget: { remaining: () => 9000 }, exportSnapshot: async () => { throw new Error('must not start'); } });
  const result = await runCloudBackup(f.args); assert.equal(result.error, 'EXPORT_FAILED'); assert.equal(result.failureNotification, 'sent');
  await f.store.set(oldKey, 'old'); assert.deepEqual(await pruneBackups(f.store, 'new', instant, { remaining: () => 3000 }), { deleted: 0, deferred: true }); assert.ok(f.store.data.has(oldKey));
});
test('disabled deployment never opens Blobs or sends mail', async () => {
  assert.deepEqual(await handleScheduledBackup({ env: {}, storeFactory: () => { throw new Error('must not open'); }, mailerFactory: () => { throw new Error('must not send'); } }), { status: 'disabled' });
});
test('handler uses strong store and logs sanitized failure if storage unavailable', async () => {
  const logs = [], emails = [];
  const result = await handleScheduledBackup({ env: { CLOUD_BACKUP_ENABLED: 'true' }, now: () => instant,
    storeFactory: options => { assert.equal(options.consistency, 'strong'); throw new Error('secret-key records'); },
    mailerFactory: () => ({ failure: async value => { emails.push(value); return 'sent'; } }), log: value => logs.push(value) });
  assert.equal(result.error, 'CLOUD_BACKUP_UNAVAILABLE'); assert.equal(emails.length, 1); assert.doesNotMatch(logs.join(), /secret-key|records/);
});
const smtpEnv = { SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '465', SMTP_USER: 'user@example.invalid', SMTP_PASSWORD: 'fixture-only', SMTP_FROM: 'user@example.invalid', BACKUP_EMAIL_TO: 'user@example.invalid' };
test('SMTP transport uses TLS, bounded timeouts, no logging and only memory attachments', async () => {
  let options, mail;
  const smtp = createBackupMailer(smtpEnv, opts => { options = opts; return { close() {}, async sendMail(value) { mail = value; return { accepted: [smtpEnv.BACKUP_EMAIL_TO], rejected: [] }; } }; });
  assert.equal(await smtp.backup({ serialized: '{"fixture":true}', filename: 'select-test.json', day, sha256: 'abc' }), 'sent');
  assert.equal(options.secure, true); assert.equal(options.tls.rejectUnauthorized, true); assert.equal(options.logger, false);
  assert.equal(mail.disableFileAccess, true); assert.equal(mail.disableUrlAccess, true); assert.equal(mail.attachments[0].content.toString(), '{"fixture":true}');
  assert.equal(smtpOptions({ ...smtpEnv, SMTP_PORT: '587' }).requireTLS, true);
  assert.throws(() => smtpOptions({ ...smtpEnv, BACKUP_EMAIL_TO: 'a@example.invalid,b@example.invalid' }), /SMTP_CONFIGURATION/);
});
test('SMTP535 and transport errors are reduced to fixed safe codes', async () => {
  const mailer = createBackupMailer(smtpEnv, () => ({ close() {}, async sendMail() { throw Object.assign(new Error('PASSWORD private server reply'), { responseCode: 535 }); } }));
  await assert.rejects(() => mailer.failure({ day, code: 'EXPORT_FAILED' }), { message: 'SMTP_AUTHENTICATION' });
});
test('shared exporter preserves SELECT format and omits credential columns even in returned payload', async () => {
  const calls = [];
  const fake = async (url, options) => { calls.push([url, options]); const path = new URL(url).pathname;
    if (path.endsWith('/rest/v1/')) return Response.json({ definitions: { users: { properties: { id: { description: '<pk/>' }, password: {}, name: {} } } }, paths: { '/users': { get: {} } } });
    return new Response(JSON.stringify([{ id: 'fixture', name: 'safe', password: 'MUST_OMIT' }]), { headers: { 'content-range': '0-0/1' } });
  };
  const snapshot = await selectSnapshot({ SUPABASE_URL: 'https://project.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture' }, fake, { concurrency: 4 });
  assert.equal(snapshot.kind, 'public-select-snapshot'); assert.equal(snapshot.tables.users.rowCount, 1);
  assert.deepEqual(snapshot.tables.users.omittedColumns, ['password']); assert.doesNotMatch(JSON.stringify(snapshot.tables.users.rows), /MUST_OMIT|password/);
  assert.equal(new URL(calls[1][0]).searchParams.get('select'), 'id,name'); assert.equal(calls[1][1].redirect, 'error');
  await assert.rejects(() => selectSnapshot({ SUPABASE_URL: 'https://project.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture' }, fake, { maxRows: 0 }), /export limit/);
});
