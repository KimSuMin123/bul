import { createHash, randomUUID } from 'node:crypto';
import { selectSnapshot } from './select-snapshot.mjs';

export const STORE_NAME = 'lms-private-select-backups';
export const RETENTION_DAYS = 7;
export const LEASE_MS = 2 * 60000; // Longer than Netlify's 30-second scheduled hard limit.
const LOCK_KEY = 'control/worker-lock.json';
const SNAPSHOT_KEY = /^snapshots\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.json$/;
export const koreaDay = timestamp => new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10);
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = timestamp => new Date(timestamp).toISOString();

async function lease(store, owner, now) {
  const value = { owner, expiresAt: now + LEASE_MS };
  const initial = await store.setJSON(LOCK_KEY, value, { onlyIfNew: true });
  if (initial.modified) return initial.etag;
  const current = await store.getWithMetadata(LOCK_KEY, { type: 'json', consistency: 'strong' });
  if (!current?.etag || !Number.isFinite(current.data?.expiresAt) || current.data.expiresAt > now) return null;
  const replaced = await store.setJSON(LOCK_KEY, value, { onlyIfMatch: current.etag });
  return replaced.modified ? replaced.etag : null;
}

export async function pruneBackups(store, protectedKey, now, budget = { remaining: () => Infinity }, retentionDays = RETENTION_DAYS) {
  let deleted = 0;
  for await (const page of store.list({ prefix: 'snapshots/', paginate: true })) {
    for (const { key } of page.blobs) {
      if (budget.remaining() < 3500) return { deleted, deferred: true };
      if (key === protectedKey || !SNAPSHOT_KEY.test(key)) continue;
      const entry = await store.getMetadata(key, { consistency: 'strong' });
      const date = Date.parse(entry?.metadata?.createdAt);
      if (entry?.metadata?.kind !== 'public-select-snapshot' || !Number.isFinite(date) || date >= now - retentionDays * 86400000) continue;
      await store.delete(key); deleted++;
    }
  }
  return { deleted, deferred: false };
}

export async function runCloudBackup({ store, mailer, env, day, now = Date.now, exportSnapshot = selectSnapshot, budget = { remaining: () => Infinity } }) {
  const started = now();
  const retentionDays = Number(env.BACKUP_RETENTION_DAYS ?? RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw new Error('INVALID_RETENTION_DAYS');
  if (day !== koreaDay(started)) throw new Error('INVALID_BACKUP_DAY');
  const jobId = randomUUID();
  const lockEtag = await lease(store, jobId, started);
  if (!lockEtag) return { status: 'skipped', reason: 'worker-busy', day };
  const runKey = `runs/${day}.json`;
  const result = { day, jobId, startedAt: iso(started), status: 'failed', email: 'not-attempted', retentionDays, fullDatabaseBackup: false };
  let serialized, snapshot, snapshotKey, stage = 'RUN_STATE';
  let suppressFailureMail = false, recordOpened = false, storageRecovery = false;
  try {
    const previous = await store.get(runKey, { type: 'json', consistency: 'strong' });
    if (previous?.emailAttempted && previous?.storageVerified) return { status: 'skipped', reason: 'already-attempted-today', day };
    storageRecovery = Boolean(previous?.emailAttempted);
    result.failureNotificationAttempted = Boolean(previous?.failureNotificationAttempted);
    result.emailAttempted = storageRecovery;
    if (storageRecovery) {
      Object.assign(result, { email: 'not-attempted-recovery', recoveryOf: previous.recoveryOf || previous.jobId,
        previousEmail: previous.previousEmail || previous.email, previousAttachmentSha256: previous.previousAttachmentSha256 || previous.sha256 });
      suppressFailureMail = true;
    }
    await store.setJSON(runKey, { ...result, status: 'running' });
    recordOpened = true;
    stage = 'EXPORT_FAILED';
    if (budget.remaining() < 16000) throw new Error('EXPORT_DEADLINE');
    snapshot = await exportSnapshot(env, fetch, { signal: AbortSignal.timeout(8000), concurrency: 4, maxBytes: 8 * 1024 * 1024, maxRows: 100000 });
    serialized = JSON.stringify(snapshot, null, 2);
    if (Buffer.byteLength(serialized) > 12 * 1024 * 1024) throw new Error('SNAPSHOT_TOO_LARGE');
    const sha256 = hash(serialized);
    snapshotKey = `snapshots/${day}/${jobId}.json`;
    Object.assign(result, { snapshotKey, sha256, tableCount: Object.keys(snapshot.tables).length,
      rowCount: Object.values(snapshot.tables).reduce((sum, table) => sum + table.rowCount, 0), credentialColumnsOmitted: true });
    // Persist intent before SMTP: retries cannot resend after a timeout/crash with uncertain acceptance.
    stage = 'RUN_STATE';
    if (!storageRecovery) {
      result.emailAttempted = true;
      if (budget.remaining() < 10000) { result.emailAttempted = false; throw new Error('SMTP_DEADLINE'); }
      await store.setJSON(runKey, { ...result, status: 'running' });
      try {
        result.email = await mailer.backup({ serialized, filename: `select-${day}-${jobId}.json`, day, sha256 });
      } catch (error) {
        result.email = error.message === 'SMTP_UNCERTAIN' ? 'uncertain' : 'failed';
        result.error = ['SMTP_AUTHENTICATION', 'SMTP_CONFIGURATION', 'SMTP_REJECTED', 'SMTP_UNCERTAIN'].includes(error.message) ? error.message : 'SMTP_UNCERTAIN';
        suppressFailureMail = true; // Reusing a failed/uncertain channel cannot reliably report delivery failure.
      }
    }
    stage = 'STORAGE_FAILED';
    // The same attachment bytes are retained after the SMTP attempt, even when SMTP failed.
    const saved = await store.set(snapshotKey, serialized, { onlyIfNew: true,
      metadata: { kind: snapshot.kind, createdAt: iso(started), sha256, day } });
    if (!saved.modified || hash(await store.get(snapshotKey, { type: 'text', consistency: 'strong' })) !== sha256) throw new Error('STORAGE_VERIFY_FAILED');
    result.status = 'saved';
    result.storageVerified = true;
    if (result.email === 'sent') {
      stage = 'RETENTION_FAILED';
      const cleanup = await pruneBackups(store, snapshotKey, now(), budget, retentionDays);
      result.deleted = cleanup.deleted;
      result.retentionDeferred = cleanup.deferred;
    }
  } catch {
    result.error = stage;
    // If SMTP intent could not be recorded, preserve an exported snapshot without sending it.
    if (serialized && snapshotKey && !result.storageVerified) {
      try {
        await store.set(snapshotKey, serialized, { onlyIfNew: true, metadata: { kind: 'public-select-snapshot', createdAt: iso(started), sha256: hash(serialized), day } });
        if (hash(await store.get(snapshotKey, { type: 'text', consistency: 'strong' })) === hash(serialized)) {
          result.status = 'saved'; result.storageVerified = true;
        }
      } catch { /* Prior good backups are untouched. Never log SDK errors or records. */ }
    }
    if (!suppressFailureMail && !result.failureNotificationAttempted && recordOpened && budget.remaining() >= 8000) {
      try {
        // Durable intent also covers result-only failure mail, preventing repeated failure alerts.
        result.failureNotificationAttempted = true;
        await store.setJSON(runKey, result);
        result.failureNotification = await mailer.failure({ day, code: result.error });
      }
      catch { result.failureNotification = 'failed'; }
    } else result.failureNotification = 'not-attempted';
  } finally {
    result.finishedAt = iso(now());
    // Store outcomes independently of invocation logs; never store raw exceptions.
    if (recordOpened) {
      try {
        await store.setJSON(`results/${day}/${jobId}.json`, result);
        await store.setJSON(runKey, result);
      } catch { result.resultPersistence = 'failed'; }
    }
    try { await store.setJSON(LOCK_KEY, { owner: jobId, expiresAt: 0 }, { onlyIfMatch: lockEtag }); }
    catch { result.lockRelease = 'failed'; }
  }
  return result;
}
