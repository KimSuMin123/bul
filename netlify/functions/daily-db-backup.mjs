import { handleScheduledBackup } from '../../lib/cloud-backup/handlers.mjs';

// The schedule in netlify.toml is UTC18:00 = KST03:00.
// Only Netlify invokes this scheduled function; there is no public Run URL.
export default async function dailyDbBackup() {
  const result = await handleScheduledBackup();
  if (result.status === 'failed' || result.error || result.resultPersistence === 'failed') throw new Error('CLOUD_BACKUP_FAILED');
}
