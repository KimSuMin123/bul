import { getStore } from '@netlify/blobs';
import { createBackupMailer } from './smtp.mjs';
import { koreaDay, runCloudBackup, STORE_NAME } from './runner.mjs';
import { boundedBlobFetch } from './blobs.mjs';

// Scheduled Functions have no public URL. Manual invocation is Netlify UI Run now.
export async function handleScheduledBackup({
  env = process.env, now = Date.now, storeFactory = getStore,
  mailerFactory = createBackupMailer, run = runCloudBackup, log = console.log
} = {}) {
  if (env.CLOUD_BACKUP_ENABLED !== 'true') return { status: 'disabled' };
  const started = now();
  const budget = { remaining: () => Math.max(0, 27000 - (now() - started)) };
  const signal = AbortSignal.timeout(27000);
  const mailer = mailerFactory(env, undefined, budget);
  try {
    const store = storeFactory({ name: STORE_NAME, consistency: 'strong',
      fetch: boundedBlobFetch(budget, signal) });
    const result = await run({ env, day: koreaDay(now()), now, budget, store, mailer });
    log(JSON.stringify({ event: 'cloud-backup-result', ...result }));
    return result;
  } catch {
    const result = { event: 'cloud-backup-result', status: 'failed', error: 'CLOUD_BACKUP_UNAVAILABLE' };
    if (budget.remaining() >= 8000) {
      try { result.failureNotification = await mailer.failure({ day: koreaDay(now()), code: result.error }); }
      catch { result.failureNotification = 'failed'; }
    }
    log(JSON.stringify(result));
    return result;
  }
}
