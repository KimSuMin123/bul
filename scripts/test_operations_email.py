"""Tests use a fake SMTP transport only; never send email."""
import importlib.util
import io
import os
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup_email', Path(__file__).with_name('db_backup_email.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FakeSMTP:
    messages = []
    def __init__(self, *args, **kwargs): pass
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def ehlo(self): pass
    def starttls(self, **kwargs): self.tls = True
    def login(self, user, password): assert user == 'fixture-user' and password == 'fixture-secret'
    def send_message(self, message): self.messages.append(message)

class Input:
    def __init__(self): self.buffer = io.BytesIO(b'{"fixture":true}')

base = {'SMTP_FROM':'backup@example.invalid','SMTP_HOST':'smtp.example.invalid','SMTP_USER':'fixture-user','SMTP_PASSWORD':'fixture-secret','BACKUP_ATTACHMENT_NAME':'fixture.json'}
with patch.object(module.smtplib, 'SMTP_SSL', FakeSMTP), patch.object(module.smtplib, 'SMTP', FakeSMTP):
    for kind, port in [('attachment','465'),('attachment','587'),('failure','465')]:
        with patch.dict(os.environ, {**base,'SMTP_PORT':port,'BACKUP_EMAIL_KIND':kind,'BACKUP_EMAIL_TO':'tntn211@naver.com'}), patch.object(module.sys, 'stdin', Input()):
            module.main()
            message = FakeSMTP.messages[-1]
            assert message['To'] == 'tntn211@naver.com'
            attachments = list(message.iter_attachments())
            assert len(attachments) == (0 if kind == 'failure' else 1)
            if attachments: assert attachments[0].get_payload(decode=True) == b'{"fixture":true}'
            assert 'fixture-secret' not in message.as_string()
print('3 SMTP composition/transport checks passed; no email sent')
