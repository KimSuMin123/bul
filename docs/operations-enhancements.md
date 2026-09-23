# 운영 변경과 확인 결과

2026-09-23 기준 Netlify(`netlify.toml`)와 Vercel(`vercel.json`) 설정은 둘 다 `npm run build` → `dist` 정적 배포입니다. 실제 호스팅 공급자·자동 배포 연결은 확인하지 못했습니다. Git 원격 호스트는 github.com이며 `.github/workflows`는 없습니다. lockfile 기반 `npm ci` 후 빌드하고, 배포 캐시는 lockfile을 키로 구분합니다. 서비스 키는 절대 VITE 변수로 노출하지 않습니다.

## 현재 요청: 평문 SELECT 백업, 매일 03:00 KST, 7일 보관

`scripts/db_backup_select.mjs`는 Supabase REST OpenAPI에서 GET 가능한 공개 테이블을 찾아 컬럼을 명시한 SELECT를 수행합니다. 페이지별 정확한 행 수와 최종 개수를 확인하며 암호·토큰·비밀 관련 열을 제외합니다. JSON 파일을 암호화하지 않는 것은 운영자의 명시 요청입니다. 개인 정보가 들어 있으므로 저장 경로 ACL은 현재 실행 계정과 SYSTEM(Windows), 0700/0600(POSIX)으로 제한합니다.

수신자 기본값은 `tntn211@naver.com`이며 승인된 수신자 변경은 `BACKUP_EMAIL_TO`로 설정합니다. SELECT 생성이 실패하면 데이터 없는 실패 알림을 발송하도록 구성했습니다. SMTP TLS 연결로 메모리의 JSON을 첨부 발송한 후 같은 바이트를 내부 저장소에 보관합니다. 발송이 실패하거나 SMTP가 없더라도 데이터 유실을 막기 위해 내부에 저장하고 종료 코드 1을 반환합니다. 결과는 `select-results.jsonl`에 남습니다. stdout에는 행 내용·키·비밀번호를 출력하지 않습니다. 부분 파일은 확정 전 삭제하고, 기존 정상 백업은 SELECT 실패 시 삭제하지 않습니다. 성공한 새 파일은 7일 정리 대상에서 항상 제외합니다. 최근 파일 하나만 있다는 이유로 정상이라고 판단하지 말고 결과 로그와 이메일 상태를 함께 봅니다.

필요 변수: `SUPABASE_URL`(기존 `VITE_SUPABASE_URL` 사용 가능), `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`(기본7), `SMTP_HOST`, `SMTP_PORT`(기본465; 다른 포트는 STARTTLS 필수), `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, 필요 시 `PYTHON_BIN`. SMTP 비밀번호를 명령행·작업 정의·스크립트에 넣지 않습니다. 이미 존재하는 `.env`는 `node --env-file=.env`로 읽을 수 있으며, 새 비밀 파일은 생성하지 않습니다. 예약 실행 계정의 잠금 해제된 SecretManagement vault 또는 호스트의 비밀 주입 기능을 사용합니다.

Windows 예약 작업 미리보기:

```powershell
powershell -NoProfile -File scripts/db_backup_schedule.ps1 -At 03:00 -RetentionDays 7
# SMTP 및 실행 계정 환경 설정 후, 동일 명령에 -Install을 추가하여 등록합니다.
Get-ScheduledTaskInfo -TaskName LMS-Daily-SELECT-Backup
```

이 Windows 예제는 한국 시간대, PC 켜짐, 사용자 로그인 상태가 필요합니다. 2026-09-23 `LMS-Daily-SELECT-Backup` 작업을 03:00 KST·7일 보관으로 실제 등록했습니다. 등록된 작업은 동시에 중복 실행되지 않으며 누락된 실행을 다음 가능 시점에 시작합니다. 서버 상시 실행에는 서비스 계정과 비밀 주입이 구성된 systemd를 권장합니다. 아래 timer와 별도 oneshot service에서 같은 Node 스크립트를 호출합니다. service의 `WorkingDirectory`를 저장소에 두고 비밀은 기존 secret manager로 주입하며 자격 증명을 unit 파일에 기록하지 않습니다.

```ini
[Timer]
OnCalendar=*-*-* 03:00:00 Asia/Seoul
Persistent=true
[Install]
WantedBy=timers.target
```

cron을 쓸 때는 CRON_TZ 지원을 확인한 뒤 `CRON_TZ=Asia/Seoul`, `0 3 * * *`로 동일 runner를 실행합니다. SMTP 연결은 실행하지 않았습니다. SMTP 구성 후 시험 발송의 실제 수신과 작업 결과를 확인해야 합니다. 이 PC의 기본 Python 명령은 Windows Store 별칭이므로 예약 runner가 설치된 Codex Python 경로를 자동 사용합니다. 다른 호스트에서는 `PYTHON_BIN`에 실제 Python 실행 경로를 지정합니다. 이메일 첨부 용량이 서버 한도를 넘으면 발송 실패로 기록됩니다. 보관 기간은 내부 파일에만 적용되고 수신 메일은 자동 삭제하지 않습니다.

### 실제 확보된 운영 SELECT

2026-09-23 18:46 KST, `test_artifacts/backups/select-2026-09-23T09-46-13.217Z-4b05d4cd-3a76-4bd1-8dc9-264e4008cd83.json`에 10테이블 77행을 저장했습니다. users5, courses2, lectures60, enrollments6, payments4이며 나머지5테이블은0행입니다. users.password는 제외했습니다. 파일은 Git 제외 경로이고 ACL도 확인했습니다. SMTP 정보가 없어 이메일은 발송되지 않았습니다.

이 파일은 데이터 조회본입니다. 동시 변경에 대해 단일 트랜잭션 일관성을 보장하지 않으며 DDL·인덱스·함수·RLS·역할·Auth 비밀·Storage 실제 파일은 포함하지 않습니다. 비밀번호 제외로 레거시 인증 데이터 전체 복원도 불가능합니다. 이 파일을 완전한 DB 복구 백업이라고 부르지 않습니다. 운영 수정 전 요구한 백업 범위와 이 차이를 확인해야 합니다.

`node scripts/db_backup_restore_select.mjs <snapshot.json>`으로 독립 in-memory PGlite에 공개 테이블을 FK 순서대로 넣고, PostgreSQL 타입으로 정규화한 모든 선택 열과 행 수를 비교했습니다. 10테이블77행 일치가 확인되었습니다. 기존 `database_setup.sql`은 이 임시 DB에서만 사용했으며 운영에 적용하지 않았습니다. 암호가 제외되었으므로 격리 DB에서만 users.password NOT NULL을 완화했습니다. 암호를 임의 생성하거나 복원하지 않았습니다. 결과 `<snapshot.json>.restore-report.json`에 원본 SHA-256과 검증 범위를 기록했습니다.

## 추가 선택: 암호화 PostgreSQL 백업

`scripts/db_backup.mjs`는 AES-256-GCM 스트리밍 암호화, 무결성 검사, 원자적 확정, 보관 기간 정리, 결과 JSONL와 선택 HTTPS 결과 알림을 제공합니다. 현재 평문 SELECT 요청과 별도의 선택 도구입니다. 키를 파일에 쓰지 않고 `BACKUP_ENCRYPTION_KEY`에 base64 32바이트를 주입합니다. DB 접속 문자열은 `BACKUP_DATABASE_URL`, 저장 경로는 전용 `BACKUP_DIR`, 도구 경로는 `PG_DUMP_BIN`/`PG_RESTORE_BIN`으로 지정합니다. DB 연결 값은 pg 프로세스 환경으로만 넘기고 인자·stderr에는 남기지 않습니다. 원격 DB TLS는 기본 verify-full이며 인증서 경로는 `PGSSLROOTCERT`입니다. 통신 방식을 약화하기보다 공식 연결 설정을 확인합니다.

```text
node scripts/db_backup.mjs backup
node scripts/db_backup.mjs verify <encrypted-file>
node scripts/db_backup.mjs restore <encrypted-file>
```

복원은 `RESTORE_CONFIRM=ISOLATED_LOCAL_DATABASE`, `RESTORE_DATABASE_URL`이 localhost의 `lms_restore_` 접두 DB일 때만 허용합니다. 전체 인증을 먼저 통과한 데이터만 pg_restore에 전달하고 단일 트랜잭션 실패 시 중단합니다. 실제 복원 후 예상 테이블·행 수·역할·RLS와 애플리케이션 조회를 따로 검증해야 합니다. Supabase 관리 스키마와 역할은 빈 일반 PostgreSQL에 그대로 복원되지 않을 수 있으므로 호환되는 로컬 Supabase 환경이 필요합니다. Storage 객체는 별도 백업 대상입니다. [Supabase 백업 범위](https://supabase.com/docs/guides/platform/backups), [공식 백업·복원 절차](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html).

현재 pg_dump/pg_restore/psql, DB 접속 비밀번호, Supabase 관리 토큰은 확인되지 않았고 Docker 엔진도 실행되지 않았습니다. 실제 pg_dump와 pg_restore 기반 전체 DB 복원 테스트는 수행하지 못했습니다. service_role 키는 DB 접속 비밀번호를 대신하지 않습니다. 암호화 검증은 복원 검증을 대신하지 않습니다.

## 관리자 로그인 별칭 변경

`scripts/admin_account_rotate.mjs`는 기본적으로 읽기 전용 사전 확인만 합니다. `--apply`에서만 변경하고 `ADMIN_ROTATION_APPROVED_HOST`와 대상 호스트가 일치해야 합니다. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ACCESS_TOKEN`, `ADMIN_CANONICAL_ID`, `NEW_ADMIN_LOGIN`(기본adsba)이 필요합니다. `NEW_ADMIN_PASSWORD` 또는 숨김 TTY 입력으로 새 암호를 받으며 값을 저장하지 않습니다.

먼저 security·login_id migration과 Auth 연결을 적용하고 기존 관리자 토큰을 받아야 합니다. 도구는 `/auth/v1/user`와 `current_lms_user`로 동일 관리자인지 확인하고 기존 `users.id` 및 `auth_user_id`는 유지합니다. 별칭 변경 뒤 Supabase Auth 비밀번호를 변경하고 새 아이디로 로그인하여 `current_lms_user`의 관리자 역할과 원래 ID를 다시 검증합니다. 성공 응답 유실은 실패로 보고하며 별칭을 가능한 한 이전 값으로 복원합니다. 비밀번호 변경 요청 이후 오류는 새 비밀번호가 적용되었을 수 있으므로 맹목 재시도하지 말고 기존 canonical ID와 새 암호로 확인하거나 서버 관리자 재설정으로 복구합니다. 기존 비밀번호는 복원할 수 없습니다.

`--apply`에는 `ADMIN_BACKUP_MANIFEST_FILE`로 최근24시간 안의 SELECT 백업 경로도 필요합니다. 같은 호스트·대상 관리자 포함·10개 필수 테이블·행 수·복원 결과와 원본 SHA-256이 일치하지 않으면 API 변경 전에 거절합니다. 이는 현재 요청한 SELECT 범위의 선행 백업 검증이며 완전한 Auth 복구 가능성을 뜻하지 않습니다.

Supabase Auth와 프로필 변경은 원자 트랜잭션이 아니므로 `requires-recovery` 결과를 반드시 처리합니다. 프로필의 데이터·수강권 FK·역할을 변경하지 않습니다. 기존 canonical ID도 로그인할 수 있는 호환 별칭 체계입니다. 이 도구는 아직 실제 운영에 실행하지 않았습니다.

## 성능 재현과 검증

`PERF_LABEL=before`의 고정 프로덕션 빌드와 동일 API fixture에서 9페이지 × 데스크톱·모바일 × 3회(54회)를 측정했습니다. `scripts/measure_loading.config.mjs`로 실행하며 `PERF_BUILD=1`, `PERF_LABEL=after`로 변경 후 빌드를 생성합니다. 결과는 `test_artifacts/performance/{before,after}.json`입니다. DCL, 처음 보이는 요소까지 시간, 따뜻한 hash 이동 시간, JS 요청 수·decoded 크기를 기록합니다. 외부 요청 차단, local API, CPU/네트워크 throttle 없음 조건이므로 운영 CDN 성능이나 Web Vitals 합격을 뜻하지 않습니다. 느린 실제 네트워크·모바일 CPU·실제 데이터에서 추가 확인해야 합니다.

`node scripts/test_operations.mjs`는 암호화·변조 감지·잘못된 키·백업 실패 보존·잠금·로컬 복원 제한·모의 관리자 성공/실패/불확실 응답을 검증합니다. 전체 PostgreSQL/Supabase 복원, 실제 이메일 수신, 실제 관리자 변경은 수행된 것으로 표시하지 않습니다.


예약 작업 시험 실행(2026-09-23 18:53:58 KST)도 실제 수행했습니다. 다음 실행은2026-09-24 03:00 KST입니다. 결과는 내부 저장 성공10테이블79행, 이메일 미설정으로 LastTaskResult=1이며 새 파일은 `test_artifacts/backups/select-2026-09-23T09-54-00.041Z-7857fe0e-ec67-41f1-98ce-27143c1fe76e.json`입니다. 이 최신79행도 PGlite 복원·모든 선택 열 일치·SHA-256 검증을 완료했습니다. 두 스냅샷 사이 행 수 변화는 운영 동시 변경 가능성을 보여주며 원자적 시점 백업을 의미하지 않습니다.

운영 테스트17항목과 모의 SMTP TLS/STARTTLS·실패알림3항목을 통과했습니다. SMTP 테스트는 실제 메일을 발송하지 않았습니다.



## 최종 성능 결과

`test_artifacts/performance/comparison.md`와 `comparison.json`에 전체표를 저장했습니다. 전후 일반환경 각54샘플, 제한모바일 각9샘플이 모두 완료되었습니다. 메인 JS557,346→268,523bytes(51.8%감소), gzip131,079→84,597bytes(35.5%감소)입니다. 일반모바일 표시 중앙값은138~219ms였고 일부 데스크톱home/dashboard는 오히려 변동 증가가 있어 모든 페이지가 빨라졌다고 단정하지 않습니다.

모바일150ms RTT·1.6Mbps·CPU4배 단회 비교에서 홈2,038→1,566ms, 관리자2,912→1,813ms, 기타페이지1,362~1,663ms였습니다. **느린 모바일 첫 방문1초 목표는 충족하지 못했습니다.** warm화면이동은 제한조건에서도최대52ms였지만 최초로딩과는 다른 지표입니다. 실제운영CDN·실제Supabase응답·실기기검증은 남아 있습니다.

재현예: PowerShell에서 `PERF_LABEL`/`PERF_BUILD` 환경변수를 설정한 뒤 `npx playwright test --config scripts/measure_loading.config.mjs`를 실행합니다. 제한모바일은 `PERF_THROTTLED=1`, `PERF_SAMPLES=1`로 실행하고 `node scripts/measure_loading_report.mjs`로 완전한 비교표를 생성합니다. 비교를 재현하려면 변경전보관빌드 `test_artifacts/performance/before-dist`를 보존해야 합니다.


## Netlify 수동 배포 준비(2026-09-23 추가 확인)

사용자가 지정한 운영 도메인과 Netlify 프로젝트는 `https://xn--2j1bkkm2t5tbj2hx7go2ry0o.com/`, `sehwa-buddha-academy`입니다. 공개 HTML 3회 GET은 모두200이었고 첫 요청942ms, 후속72ms·72ms였습니다. 이는 HTTP응답시간이며 화면표시나WebVitals가 아닙니다. 운영 응답은 Netlify·Brotli·HSTS·must-revalidate를 확인했고 CSP/X-Frame-Options/nosniff/Referrer-Policy는 없었습니다. 원자료는 `test_artifacts/netlify/live-http-before.json`입니다.

기존 `public/_redirects`의 SPA규칙을 유지했고 `public/_headers`를 추가하여 수동 ZIP에도 X-Frame-Options DENY, nosniff, Referrer-Policy 및 해시 assets 장기캐시를 포함합니다. 신규 CSP는 강제하지 않았습니다. 현재 inline이벤트와 React스타일·외부폰트 사용을 검토한 뒤 정책을 별도로 검증해야 합니다. [Netlify리디렉트문서](https://docs.netlify.com/manage/routing/redirects/overview/), [수동Drop문서](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/).

`npm run build`후 `scripts/package_netlify.py`를 실제 Python으로 실행하면 `output/netlify`에 업로드 ZIP과 SHA-256manifest를 만듭니다. archive루트의 index.html·_redirects·_headers·로컬음원 존재, ZIPCRC, 서버전용 비밀값 미포함을 검사합니다. ZIP에는 프론트엔드 정적파일만 들어갑니다. Supabase migration/EdgeFunction/서버비밀은 별도 배포 대상이므로 새 인증흐름과 서버상태가 일치해야 합니다. 이 도구는 외부 배포를 수행하지 않습니다.


최종프런트완료후 `npm run build` 성공, `output/netlify/sehwa-buddha-academy-20260923T102104Z.zip` 생성(33,066,184bytes·46files). SHA-256은 `c15d00141be2de200fe2bb0396f10a491c4baef05e9acc6da55377dcbd9ce8a9`이며 같은 basename의 manifest.json에 파일목록·검사결과를 저장했습니다. ZIP은 로컬준비물이고 이 운영담당작업에서 배포하지 않았습니다.

DB전환 직전19:21KST에 추가로 `test_artifacts/backups/select-2026-09-23T10-21-47.534Z-4564de57-0748-4e5d-ad3b-10b33cbe8d5d.json`을 확보했습니다.10테이블79행의 독립PGlite복원과 모든선택열일치 검증통과, SHA-256 `723c7c8dcbbd734e77479add98bf61aaec9cec7e90eeb6de0c94b423ec53edd7`. SMTP미설정으로미발송이며 동일한선택백업범위제한이적용됩니다.


## 스키마전환후SELECT복원지원

`db_backup_restore_select.mjs`는 레거시와001~003적용스키마를 구분합니다. 신규프로필은 공개테이블 `site_announcements`와 사용자동의·로그인별칭·Auth식별자컬럼을 검증합니다. 격리PGlite에만 최소플랫폼테이블을 만들고 FK검사용Auth UUID식별자행을 넣습니다. 이는Auth계정·암호·세션을복원하는것이아닙니다. 격리데이터삽입중 USER트리거만일시중단하고 다시활성화하여 동의시각·공지생성/수정/게시기간·신청버전을보존하고SMS작업생성을막습니다. 내부FK·CHECK·UNIQUE검사는유지합니다. private파생테이블이나실제Storage객체는복원범위가아닙니다.

2026-09-23 19:42KST 운영읽기전용백업 `test_artifacts/backups/select-2026-09-23T10-42-56.830Z-e63dbc2a-2ea8-441e-84bd-d7da80221bf0.json`의11테이블79행 전체선택열일치복원PASS, SHA-256 `b6f6e8a5749cf1c4e12b23831cd13e0bba9a35ee0ff6612f12557dcf0ad28cf9`. 기존10테이블79행백업도회귀복원PASS입니다. 운영테스트19항목에서AuthUUID·legacy동의·텍스트/이미지공지시각·신청version7보존·SMS작업0을확인했습니다. 이메일은SMTP미설정으로미발송입니다.
