import nodemailer from 'nodemailer';

const emailPattern = /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/;
export function smtpOptions(env) {
  const port = Number(env.SMTP_PORT || 465);
  if (!env.SMTP_HOST || /[\s/\r\n]/.test(env.SMTP_HOST) || ![465, 587].includes(port) ||
      !emailPattern.test(env.SMTP_FROM || '') || !emailPattern.test(env.BACKUP_EMAIL_TO || '') ||
      !env.SMTP_USER || !env.SMTP_PASSWORD) throw new Error('SMTP_CONFIGURATION');
  return {
    host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 4000, greetingTimeout: 4000, socketTimeout: 6000,
    logger: false, debug: false, pool: false,
    disableFileAccess: true, disableUrlAccess: true
  };
}

export function createBackupMailer(env, createTransport = nodemailer.createTransport, budget = { remaining: () => 8000 }) {
  const send = async (message) => {
    const transport = createTransport(smtpOptions(env));
    let timer;
    try {
      const info = await Promise.race([
        transport.sendMail({ from: env.SMTP_FROM, to: env.BACKUP_EMAIL_TO,
          disableFileAccess: true, disableUrlAccess: true, ...message }),
        new Promise((_, reject) => { timer = setTimeout(() => { transport.close(); reject(new Error('SMTP_UNCERTAIN')); }, Math.max(1, Math.min(8000, budget.remaining() - 5000))); })
      ]);
      if (!info.accepted?.some(value => String(value).toLowerCase() === env.BACKUP_EMAIL_TO.toLowerCase()) || info.rejected?.length) throw new Error('SMTP_REJECTED');
      return 'sent'; // SMTP acceptance, not proof of inbox receipt.
    } catch (error) {
      if (error.responseCode === 535) throw new Error('SMTP_AUTHENTICATION');
      if (['SMTP_CONFIGURATION', 'SMTP_REJECTED'].includes(error.message)) throw error;
      throw new Error('SMTP_UNCERTAIN');
    } finally { clearTimeout(timer); transport.close(); }
  };
  return {
    backup: ({ serialized, filename, day, sha256 }) => send({
      subject: `LMS SELECT backup ${day}`,
      text: `Requested plaintext public-table SELECT snapshot. Credential columns are omitted. This is not a full Auth/Storage/database backup. Internal cloud storage follows this SMTP attempt. SHA-256: ${sha256}`,
      attachments: [{ filename, content: Buffer.from(serialized), contentType: 'application/json' }]
    }),
    failure: ({ day, code }) => send({
      subject: `LMS SELECT backup FAILED ${day}`,
      text: `Cloud SELECT backup did not fully complete. Code: ${code}. Existing good backups are preserved. Check the private Netlify backup store and function result logs. No database records or credentials are included in this message.`
    })
  };
}
