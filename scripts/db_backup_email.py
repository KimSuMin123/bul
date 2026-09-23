"""Email the operator-authorized plaintext SELECT attachment; never log payloads/secrets."""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

def main():
    message = EmailMessage()
    message['From'] = os.environ['SMTP_FROM']
    message['To'] = os.environ.get('BACKUP_EMAIL_TO', 'tntn211@naver.com')
    failure = os.environ.get('BACKUP_EMAIL_KIND') == 'failure'
    message['Subject'] = 'LMS SELECT backup FAILED' if failure else 'LMS daily SELECT backup'
    payload = sys.stdin.buffer.read()
    if failure:
        message.set_content('SELECT backup did not complete. Prior backups are preserved. Check the restricted local select-results.jsonl log. No database records are included in this failure notification.')
    else:
        message.set_content('Requested public-table SELECT snapshot. This is not a full database restore archive. Credential columns are omitted.')
        message.add_attachment(payload, maintype='application', subtype='json', filename=os.environ['BACKUP_ATTACHMENT_NAME'])
    host = os.environ['SMTP_HOST']
    port = int(os.environ.get('SMTP_PORT', '465'))
    context = ssl.create_default_context()
    if port == 465:
        smtp = smtplib.SMTP_SSL(host, port, timeout=30, context=context)
    else:
        smtp = smtplib.SMTP(host, port, timeout=30)
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
    with smtp:
        smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(message)

if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.exit(1)
