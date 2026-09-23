# 세화붓다아카데미

React 18 / Vite 6 기반 교육 사이트입니다. 회원 인증·데이터·영상 저장은 Supabase를 사용하며, 운영 프런트는 Netlify에서 배포합니다.

## 로컬 실행과 빌드

```sh
npm ci
npm run dev
npm run build
```

프로덕션 빌드에는 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 필요하며 누락 시 빌드가 실패합니다. 설정 이름은 [환경 변수 예시](config/enhancements.env.example)를 참고하세요. service-role·SMS·SMTP 비밀은 `VITE_*` 또는 저장소에 넣지 않습니다. 빌드 산출물은 `dist`입니다.

## 운영 상태 — 2026-09-23

Netlify 프로젝트 `sehwa-buddha-academy`는 GitHub `KimSuMin123/bul`의 `feat/minhyeok` 브랜치에 연결되어 있습니다. 빌드 명령은 `npm run build`, 게시 디렉터리는 `dist`, Node 버전은22입니다. 프런트 공개 연결값과 별도로 백업용 서버 키·SMTP 앱 비밀번호를 Production 전용 비밀 환경변수에 저장했습니다.

운영 기능 커밋 `319798b`를 배포했습니다(deploy ID `6ab3d082625ba6a0acfe815c`). 운영 메인·관리자 JS의 SHA-256이 로컬 `dist`와 일치합니다. 관리자 목록·검색·관련 모달에 로그인 별칭을 표시하고 내부 데이터 연결용 회원 ID는 유지합니다. 개원식은10월1일18:29부터 표시되고18:30~18:35에 진행되며 원형 로딩도 유지합니다.

문자 시험 경로는 사용자 승인 후 일시 적용했지만 함수 인증이 401로 거절됐습니다. 로컬 키의 REST 조회는 200이었고 프로젝트 현재 키의 관리 화면 시험도 401이었습니다. 정확한 인증 거절 원인은 미확정이며 합성 테스트 작업도 생성하지 않았고 실제 SMS 발송은 0건입니다. 사용자 요청에 따라 원래 DB claim 함수·ACL과 원본 LIVE Edge 코드를 복원했고 테스트 RPC와 `LMS_SMS_TEST_PHONE`을 제거한 것을 확인했습니다. 운영 outbox·발송 시도·테스트 작업은 모두 0건입니다. 발신번호와 SOLAPI 설정은 유지합니다. 근거는 `test_artifacts/deployment/sms-rollback/production-verification.json`입니다.

관리자 `adsba`의 비밀번호를 사용자 직접 입력으로 다시 설정한 뒤 로그인·관리자 권한 검증을 통과했습니다. 사용자 브라우저가 실제 `#admin` CMS 화면에 진입한 것도 확인했습니다. 기존 `users.id=admin`과 관련 데이터는 유지하고 `login_id=adsba`로 로그인합니다. `users.password=NULL`은 비밀번호를 Supabase Auth에서 관리하는 정상 상태입니다. 비밀번호는 파일·로그에 저장하지 않았으며 근거는 `test_artifacts/deployment/admin-verified.json`입니다.

메일 SMTP535 인증 문제는 해결했습니다. 네이버 계정 일치를 확인하고 비활성화돼 있던 POP3/SMTP를 사용자가 직접 켠 뒤, 21:41 KST의 백업 실행이 `exit0`, `status=saved`, `email=sent`로 끝났습니다. SMTP 인증과 발송 접수는 성공했으며 받은편지함의 실수신은 직접 확인하지 않아 사용자 확인이 별도로 필요합니다. 문자 함수의 HTTP401 오류는 여전히 미해결이고 임시 시험 설정 원복·스케줄 미가동·실제 SMS0건 상태를 유지합니다. 기존 브라우저 알림(PWD)도 유지합니다.

일일 SELECT 백업은 Netlify `daily-db-backup` Scheduled Function으로 이전했습니다. 매일03:00 KST·7일 보관·`tntn211@naver.com` 첨부 전송 후 private Blobs에 저장하며 PC 전원과 무관합니다.22:16 KST 실제 클라우드 실행은7.37초, 공개11테이블79행, `email=sent`, `storageVerified=true`였습니다. Blobs의 동일 SHA-256 파일을 로컬에 가져와 격리 복원11테이블79행 PASS를 확인했습니다. 이후 기존 Windows `LMS-Daily-SELECT-Backup`은 설정 XML을 보관하고 Disabled로 전환했습니다. 다음 예약은2026-09-24 03:00 KST이며 그 야간 실행 자체는 아직 관찰하지 않았습니다. SELECT 백업은 전체 Auth·Storage·DB 복원본이 아닙니다. 운영·재처리·복구 절차는 [클라우드 백업 안내](docs/cloud-backup.md), 근거는 `test_artifacts/deployment/netlify-cloud-backup-verification.json`입니다.

## 상세 문서

- [구현·검증·배포 보고](docs/enhancement-report-2026-09-23.md)
- [운영·백업 도구](docs/operations-enhancements.md)
- [보안 전환](docs/security-migration.md)
- [문자 worker](supabase/functions/lms-sms/README.md)

운영에 이미 적용한 SQL을 다시 실행하거나 `database_setup.sql`로 초기화하지 마세요. 변경 전 백업 범위와 복구 절차를 확인해야 합니다. 로컬 단위·모의 검증은 `npm test`, 개선 기능 검증은 `npm run test:enhancements`, 행사 경계 검증은 `node scripts/test_opening_ceremony.mjs`로 실행합니다. 모의 SMS/SMTP 결과는 실제 발송 성공을 뜻하지 않습니다.
