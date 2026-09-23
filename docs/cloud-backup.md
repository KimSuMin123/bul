# Netlify 일일 SELECT 백업

## 실행 구조와 범위

`daily-db-backup` Scheduled Function을 매일 UTC18:00, 즉 다음 날 **한국 시간03:00**에 실행합니다. 현재 프로젝트의 Starter Legacy 요금제는 Background Functions를 지원하지 않아 단일 예약 함수를 사용합니다. 공개 HTTP 실행·다운로드 경로는 만들지 않았습니다. 관리자가 Netlify의 **Cloud compute → Functions → daily-db-backup → Run now**로 수동 실행합니다. 예약은 게시된 배포에서만 동작합니다. [예약 함수](https://docs.netlify.com/build/functions/scheduled-functions/), [Legacy 플랜 기능표](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/).

`lib/cloud-backup/select-snapshot.mjs`는 기존 Windows runner와 같은 공개 테이블 SELECT JSON 형식을 만듭니다. 암호·토큰 등 자격증명 열을 제외하고 정확한 행 수·페이지 완료 여부를 확인합니다. 네 테이블씩 병렬 조회하되 페이지는 순서대로 읽습니다. 전체 DB 덤프가 아니며 Auth 비밀·세션, DDL/RLS/함수, Storage 파일을 포함하지 않습니다. 읽기 중 동시 변경의 트랜잭션 일관성도 보장하지 않습니다. 파일은 사용자 요청대로 애플리케이션 암호화 없이 JSON 첨부로 전송합니다.

SMTP 첨부 시도를 먼저 하고 **같은 바이트**를 site-wide Netlify Blobs store `lms-private-select-backups`에 저장합니다. SMTP가 실패해도 만들어진 스냅샷을 보존합니다. 새 파일을 다시 읽어 SHA-256 일치를 확인한 뒤에만 저장 성공으로 기록합니다. store는 배포가 바뀌어도 유지되며 이 구현은 브라우저에 파일·키·토큰을 제공하지 않습니다. Netlify 프로젝트 권한을 가진 관리자는 Blobs에서 파일에 접근할 수 있습니다. 같은 사이트의 다른 배포·함수·빌드 플러그인도 접근 가능하므로 프로젝트와 배포 권한을 관리해야 합니다. [Blobs API·접근 모델](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## 설정

Netlify `sehwa-buddha-academy` 환경 변수에 아래 값을 **Production 컨텍스트**로 설정합니다. 다른 컨텍스트에는 실제 비밀을 주지 않고 `CLOUD_BACKUP_ENABLED`를 켜지 않습니다. Functions scope를 선택할 수 있는 플랜이면 그 범위만 사용합니다. 현재 Starter Legacy에서 개별 scope 선택이 없으면 All scopes를 쓰되 변수 이름에 `VITE_`를 붙이지 않습니다. 프런트가 서버 전용 라이브러리를 import하지 않으며, 함수 환경 변수는 `netlify.toml`에 값을 쓰지 않습니다. 변경한 함수 환경 변수는 재배포해야 적용됩니다. [함수 환경 변수](https://docs.netlify.com/build/functions/environment-variables/).

| 변수 | 값 또는 설정 방법 |
|---|---|
| `CLOUD_BACKUP_ENABLED` | 활성화할 때만 `true`; 미설정은 아무 작업도 하지 않음 |
| `SUPABASE_URL` | 기존 프로젝트 HTTPS URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 기존 서버 전용 키를 Netlify 비밀 환경에 직접 입력 |
| `SMTP_HOST` | `smtp.naver.com` |
| `SMTP_PORT` | `465`(TLS); `587`을 쓰면 STARTTLS 필수 |
| `SMTP_FROM` | `tntn211@naver.com` |
| `SMTP_USER` | `tntn211@naver.com` |
| `SMTP_PASSWORD` | 네이버에서 발급한 앱 비밀번호를 비밀 환경에 직접 입력 |
| `BACKUP_EMAIL_TO` | `tntn211@naver.com` |
| `BACKUP_RETENTION_DAYS` | `7`(기본값);1~365 정수로 변경 가능, 잘못된 값이면 실행 중단 |

Blobs 연결은 Netlify 함수의 자동 인증 문맥을 사용하므로 별도 Blobs 토큰이나 호출용 비밀은 필요하지 않습니다. `netlify.toml`은 Node22를 사용하며 설치된 `@netlify/blobs`의 최소 Node22.12 조건을 충족해야 합니다. 함수 런타임은 기본적으로 빌드 Node 버전을 따릅니다. [런타임 설정](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime).

SMTP는 인증서 검증을 유지하고 연결·대기 시간을 제한합니다. 파일 경로나 URL을 첨부로 읽지 않고 메모리의 JSON만 사용하며 SMTP debug 로그를 켜지 않습니다. SMTP `sent`는 서버의 수신자 접수 결과이며 받은편지함 도착 증명이 아닙니다. [Nodemailer SMTP](https://nodemailer.com/smtp), [네이버 SMTP 설정](https://help.naver.com/service/30029/contents/21341?lang=ko&osType=PC).

## 시간 제한, 보존과 중복 방지

예약 함수의 플랫폼 제한은30초입니다. 함수는27초 예산, SELECT8초, SMTP최대8초를 사용하고 저장·결과 기록 시간을 남깁니다. Blobs 개별 요청은 최대4초이며 SDK가 실패를5초 간격으로 재시도하지 않도록 오류를 즉시 처리합니다. 내보낸 원시 행은8MiB·100,000행, 포맷된 JSON은12MiB로 제한합니다. 현재11테이블79행 규모의 운영 성공 여부는 배포 후 Run now로 확인해야 하며 미래 데이터 증가나 느린 네트워크에서30초 내 완료를 보장하지 않습니다. [실행 제한](https://docs.netlify.com/build/functions/configuration/#default-values).

- `control/worker-lock.json`: strong consistency와 `onlyIfNew`/ETag 조건부 쓰기로2분 잠금을 얻습니다. 플랫폼의30초 실행 한도보다 길며 만료 뒤 새 실행이 회수합니다. 잠금 해제도 자신의 ETag가 일치할 때만 수행합니다.
- `runs/YYYY-MM-DD.json`: 한국 날짜 기준 실행 상태입니다. SMTP 시도 전에 영구 표식을 저장하므로 같은 날 재실행은 자동으로 메일을 재전송하지 않습니다. SMTP 시간초과는 `uncertain`으로 기록합니다. 실패 알림도 영구 시도 표식이 있으면 하루 한 번으로 제한합니다.
- `snapshots/YYYY-MM-DD/<uuid>.json`: 백업 본문입니다. 새 저장·SHA 확인과 SMTP 접수가 성공한 실행에서만 보관 기간(기본7일)보다 오래된 정확한 snapshot prefix·형식·메타데이터의 파일을 삭제합니다. 현재 파일과 무관한 키는 삭제하지 않습니다. 실패하거나 시간 예산이 부족하면 삭제를 하지 않거나 미루므로 설정 기간을 초과해 보존될 수 있습니다.
- `results/YYYY-MM-DD/<uuid>.json`: 성공·실패·SHA·행 수 같은 비밀 없는 결과입니다. 본문·비밀번호·원시 예외는 로그에 넣지 않습니다. 실행·결과 기록은 중복 방지와 감사용으로 유지하고 snapshot7일 보관과 구분합니다.

메일 발송 후 저장만 실패했으면 다음 **Run now**는 메일 없이 SELECT를 다시 읽어 내부 저장만 복구합니다. `email=not-attempted-recovery`, `recoveryOf`, `previousAttachmentSha256`로 구분합니다. 이 복구본은 재조회 시점의 데이터이며 앞서 이메일로 보낸 파일과 같다고 주장하지 않습니다. 저장까지 끝난 날의 재실행은 `already-attempted-today`로 종료합니다.

SMTP535 같은 확정 오류를 고친 뒤 같은 날 메일 재발송이 필요하면 관리자가 기존 결과와 실제 SMTP 이력을 먼저 확인합니다. **불확실한 전송을 확인 없이 재시도하지 않습니다.** 실제 재발송을 결정한 경우에만 해당 날짜의 `runs/YYYY-MM-DD.json`을 관리자 Blobs 화면에서 제거하고 Run now를 사용합니다. snapshot·results는 보존합니다. 날짜별 기록 제거는 같은 날 중복 방지를 해제하므로 일상적인 성공 확인 방법이 아닙니다.

SELECT·저장 실패 시 가능하면 데이터 없는 실패 알림을 보냅니다. SMTP 자체가 실패했거나 시간 여유가 없으면 메일 알림이 불가능하며 결과와 함수 로그로 확인합니다. Blobs 자체가 사용 불가일 때는 중복 표식을 남길 수 없어 최상위 실패 알림이 best effort이며 반복 실행 시 중복될 수 있습니다. 플랫폼 강제 종료는 마지막 결과 기록·실패 알림을 보장할 수 없습니다. 특히 '이메일 먼저, 내부 저장 나중' 순서상 메일 접수 직후 강제 종료되면 내부 파일이 없을 수 있으며 저장만 복구 절차를 사용해야 합니다.

## 배포·확인·복구

1. 소스·의존성을 배포하고 위 Production 함수 환경 변수를 설정한 뒤 재배포합니다. 비용 플랜은 변경하지 않습니다.
2. Functions 목록에서 `daily-db-backup`의 Scheduled 표시와 다음03:00 KST를 확인합니다. 공개 URL GET/POST가 작업을 실행하지 않는지도 확인합니다.
3. Run now를 **한 번** 눌러 `cloud-backup-result` 로그의 `status=saved`, `email=sent`, `storageVerified=true`와 SHA·행 수를 확인합니다. 예외가 발생하면 안전한 오류 코드만 보입니다.
4. 관리자 Blobs 화면에서 snapshot을 다운로드하고 `node scripts/db_backup_restore_select.mjs <다운로드한 JSON 경로>`로 격리 복원을 검증합니다. 운영 DB에는 가져오지 않습니다. 메일 받은편지함의 첨부·SHA도 별도로 확인합니다.
5. 클라우드 백업의 저장·발송·복원까지 확인한 뒤 기존 Windows `LMS-Daily-SELECT-Backup`을 비활성화해 중복 백업 메일을 막습니다. 아직 검증하지 않은 클라우드 코드를 로컬 예약 대체 완료로 표시하지 않습니다.

중지하려면 `CLOUD_BACKUP_ENABLED=false` 후 재배포하고 다음 실행이 disabled인지 확인합니다. 기존 Blobs 파일은 삭제하지 않습니다. 이전 코드로 롤백해 함수가 사라지면 예약도 멈추므로 확인된 로컬 예약을 임시 재활성화할 수 있습니다. 저장소 이름 변경은 기존 데이터를 옮기지 않으므로 복구 목적으로 임의 변경하지 않습니다.

## 로컬 검증

`npm run test:cloud-backup`은 가짜 SELECT·SMTP·Blobs와 실제 SDK의 가짜 fetch를 사용합니다. 성공 순서·동일 바이트·SHA, 동시 잠금, 같은 날 중복 방지, SMTP 실패 보존, 저장만 복구, 하루 한 번 실패 알림,7일 경계·무관한 키 보호, 시간 예산, TLS·오류 마스킹을 검사합니다. 이 명령은 실제 데이터나 이메일을 사용하지 않습니다. 로컬 exporter 회귀는 `node scripts/test_operations.mjs`로 확인합니다.

이 문서의 구현·모의 검증과 실제 Netlify 환경 설정·배포·발송 접수·복원 검증은 별도입니다. 최종 운영 확인 결과를 보고서에 남겨야 합니다.
