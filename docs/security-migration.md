# LMS 인증·권한 전환

2026-09-23 기준 운영 DB에 001→002→003을 하나의 트랜잭션으로 적용했고, `lms-auth`와 `lms-sms` Edge Function을 배포했습니다. 실제 SQL 조회에서 대상 20개 테이블 모두 RLS가 활성화되었으며 기존 회원 5명·관리자 1명·수강권 8개·강의 60개가 유지되었습니다. `lectures` 버킷은 비공개입니다. 배포 후 읽기 전용 보안 검사 10건과 비공개 버킷의 공개 환영 음원 서명·재생 검증을 통과했습니다.

프런트엔드는 Netlify 배포 파일 URL 접근 권한을 기다리고 있으며, 관리자 Auth 연결·새 비밀번호 설정은 로컬 일회성 입력 창(`http://127.0.0.1:1777`)에서 사용자의 직접 입력을 기다리고 있습니다. 따라서 전체 사용자 흐름의 전환 완료를 의미하지 않습니다. SMS는 `solapi` 공급자·관리자 수신 번호·사이트 URL만 설정되었고 API 자격 증명이 없어 스케줄을 활성화하지 않았습니다. 실제 문자 발송은 검증하지 않았습니다.

## 배포 순서

1. 운영 DB와 Storage 메타데이터를 백업하고 복원 가능한 별도 프로젝트에서 먼저 실행합니다. SELECT 행 백업과 행 복원 성공은 DDL·인덱스·함수·RLS·역할·Auth 계정/비밀·Storage 실제 파일까지 복원했다는 의미가 아닙니다. 특히 비밀번호를 제외한 조회본으로 레거시 인증 데이터를 완전히 복원할 수 없습니다. 전환 전 정책·함수·뷰 정의와 버킷 설정 및 별도 파일 백업 범위도 확인합니다. 자세한 범위는 [운영 백업 안내](operations-enhancements.md)를 따릅니다. 기존 `database_setup.sql`은 DROP 기반 초기화 파일이므로 운영 업그레이드에 실행하지 않습니다.
2. 기존 사용자 대소문자 중복, 정규화 전화번호 중복, `(user_id, course_id)` 수강권·수료증 중복을 조사합니다. 기존 5회원의 ID·역할과 수강·진도 연결을 대조할 기준도 확보합니다. 새 UNIQUE 제약에 걸리면 현재 트랜잭션 전체가 롤백됩니다. 운영 적용은 세 migration을 하나의 트랜잭션으로 묶어 수행했습니다. 원본을 자동 삭제하거나 임의 병합하지 않습니다. 001은 대상 public 테이블 10개와 private 테이블 6개에 RLS를 명시적으로 활성화합니다. 003도 신규 private 테이블 3개와 공지 테이블에 RLS를 활성화합니다. 적용 후 `relrowsecurity`를 직접 확인합니다. `donation_receipts`와 별도 추가한 Storage 정책은 001의 일괄 권한 정리 범위 밖이므로 별도로 점검합니다.
3. 새 환경에는 `supabase/migrations/202609230001_security.sql` → `202609230002_course_writes.sql` → `202609230003_enhancements.sql`을 순서대로 한 번 적용합니다. 현재 운영에는 이미 적용했으므로 다시 실행하지 않습니다. 기존 문자열 ID·역할·참조 관계는 유지합니다. 001은 `auth_user_id`를 추가하고 레거시 비밀번호를 서버 전용 열로 제한합니다. 성공적인 Auth 연결 후에만 비밀번호가 NULL로 지워집니다. 002는 `lectures.thumbnail`과 강좌 저장 RPC를, 003은 로그인 별칭·동의 기록·80% 다음 차시 권한·공지·SMS 대기열을 추가합니다. 최신 `lms-auth`는 003 컬럼에 의존하므로 세 migration 모두 필요합니다. 003은 재실행용 스크립트가 아니며 응답 유실 시 완료 상태부터 확인합니다.
4. `lms_private.course_exams`의 변환 결과를 확인합니다. 기존 문제·정답 형식은 엄격한 SQL parser로 이전합니다. 정답이나 선택지가 누락된 자료는 추측하지 않고 `lms_private.legacy_exam_text`에 보존합니다. 해당 코스는 관리자가 원문을 확인하고 문제은행을 저장할 때까지 시험 시작을 거절합니다. 원문 없는 코스는 서버에 포함된 기존 기본 20문제가 적용됩니다.
5. Edge Function `lms-auth`의 `index.ts`와 `handler.js`를 함께 배포합니다. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge 런타임 환경변수입니다. **서비스 키를 VITE 환경변수나 브라우저 파일에 넣지 않습니다.** `LMS_ALLOWED_ORIGINS`에는 실제 배포 페이지의 `location.origin`과 필요한 미리보기 origin만 쉼표로 구분하여 설정합니다. 경로나 끝 슬래시는 넣지 않고 `www` 유무·프로토콜·포트를 정확히 맞춥니다. 예시 도메인을 실제 값처럼 사용하지 않습니다. `supabase/config.toml`의 `verify_jwt=false`가 실제 함수 설정에도 적용됐는지 확인합니다. 관리 UI 배포에서는 로컬 설정 파일이 자동 반영된다고 가정하지 않습니다.
6. 001은 기존 로그인 RPC를 제거하고 익명 DB 권한 및 공개 영상 접근을 즉시 제한합니다. 따라서 DB → 최신 Edge → 새 프론트엔드를 같은 점검 시간에 전환할 준비를 먼저 마칩니다. 관리자 최초 로그인과 저장된 관리자 역할을 우선 확인한 뒤 기존 회원 로그인, 최신 동의 가입, 수납, 진도, 시험, 수료증, 영상 서명 URL을 확인합니다. 기존 클라이언트를 새 정책 아래 정상 작동한다고 가정하지 않습니다. `lms-sms` 배포·실발송 설정은 [SMS 운영 안내](../supabase/functions/lms-sms/README.md)를 따르며, 실제 알림을 mock 처리로 소모하지 않도록 준비 전 cron을 활성화하지 않습니다.

## 인증 계약

`POST /functions/v1/lms-auth`의 JSON body에는 `action`과 아래 필드를 보냅니다.

| action | 필드 | 결과 |
|---|---|---|
| login | id, password | `{session,user}` |
| register | id, password, name, birthDate, phone, privacyConsent, privacyPolicyVersion | `{user}`; 역할은 student 강제 |
| availability | id 또는 phone | `{idAvailable,phoneAvailable}` |
| admin-register | 동의를 포함한 등록 필드 및 role | `{user}` |
| admin-reset | userId, newPassword | `{success:true}` |
| admin-delete | userId | `{success:true}` |

관리자 요청은 `Authorization: Bearer <access_token>`이 필요합니다. 함수는 토큰을 `/auth/v1/user`에서 검증한 뒤 DB의 관리자 역할을 확인합니다. `verify_jwt=false`는 익명 로그인·가입을 허용하기 위한 설정이며 관리자 인증 검사를 생략하지 않습니다. 이름·전화번호만 아는 사람에게 비밀번호를 재설정해 주는 API는 없습니다.

가입과 관리자 회원 등록은 `privacyConsent: true`라는 실제 boolean과 `privacyPolicyVersion: '2026-09-23'`을 모두 요구합니다. DB가 동의 시각을 기록하며 클라이언트가 제공한 시각은 사용하지 않습니다. 신규 가입 출처는 `registration`, 관리자가 실제 동의를 확인한 등록은 `admin_attested`입니다. 기존 회원 일괄 기록은 `legacy_admin_backfill`로 구분하며 과거의 실제 동의 증거로 해석하지 않습니다.

아이디는 대소문자 구분 없이 조회하며 신규 아이디는 소문자로 저장합니다. 003 이후 로그인은 기존 `users.id` 또는 `login_id` 별칭으로 가능하지만 Auth email은 항상 정규화한 기존 `users.id`의 SHA-256과 `@lms.invalid`를 사용합니다. 별칭은 다른 회원 ID·별칭과 중복될 수 없습니다. 기존 회원 전체를 migration이 일괄 Auth 계정으로 바꾸지는 않습니다. 각 회원이 최초 로그인할 때 서버에서 기존 평문 또는 SHA-256을 검증한 뒤 Auth 사용자를 생성·연결하고 레거시 비밀번호를 NULL로 바꿉니다. 기존 ID와 역할은 바뀌지 않습니다.

내부 Auth email은 실제 이메일 발송 주소가 아니므로 이메일 복구는 지원하지 않으며 관리자 지원을 사용합니다. Auth 이메일/비밀번호 로그인이 활성화되어 있어야 합니다. 기존 짧은 비밀번호가 프로젝트 정책에 거절되면 관리자가 새 정책에 맞게 재설정해야 합니다. 최초 관리자 연결에는 `scripts/admin_bootstrap_local.mjs`를 사용합니다. 최근 24시간 내 동일 호스트의 백업·해시·복원 증거와 기존 단일 관리자를 확인한 뒤, 사용자가 로컬 폼에 직접 입력한 비밀번호로 Auth 계정을 생성하거나 검증된 기존 연결의 비밀번호를 갱신합니다. 기존 관리자 행의 ID·역할·참조 관계를 유지하면서 `auth_user_id`와 `login_id=adsba`를 연결하고 레거시 비밀번호를 NULL로 바꿉니다. 마지막으로 새 로그인과 `current_lms_user()`를 검증합니다. 비밀번호는 파일·명령행·로그에 남기지 않습니다. 기존 회원을 `admin-register`로 재가입시키거나 ID·수강 참조를 옮기지 않습니다. 결과가 불확실하면 자동 삭제·반복 변경하지 않고 운영자가 연결 상태를 확인합니다.

Auth 및 DB는 하나의 트랜잭션을 공유하지 않습니다. 첫 로그인 중 연결 응답이 유실되면 같은 Auth 비밀번호를 증명하여 재시도합니다. 신규 가입 중 프로필 응답이 유실되면 연결된 프로필을 재조회합니다. 상태를 확인할 수 없을 때 계정을 성공으로 표시하거나 Auth 사용자를 무조건 삭제하지 않습니다. 운영자는 연결되지 않은 Auth 계정을 정기 점검해야 합니다.

## DB RPC

기존 한글·공백 포함 아이디는 로그인·관리자 지원·중복 확인에서 유지합니다. 영문·숫자 형식 제한은 신규 가입에만 적용합니다.

학생의 수강 재신청은 본인 소유의 미결제(`pending`/`applied`) 또는 만료된 수강권에서만 가능합니다. 재신청 결과는 미결제 상태이고 `paid_at`은 NULL이어야 합니다. 유효한 수강권의 상태를 직접 바꾸거나 스스로 활성화할 수 없습니다.

완강과 합격이 모두 충족되면 시험 제출·최종 진도·수료증 발급 RPC에서 서버가 수강 상태를 `completed`로 동기화합니다. 신규 강좌에 문제은행을 지정하지 않으면 서버 전용 기본 20문제를 복사합니다. 기존 강좌의 누락된 문제은행을 기본 문제로 임의 교체하지 않습니다.

- `current_lms_user()`는 검증된 `auth.uid()`의 공개 프로필을 camelCase로 반환합니다.
- `lms_can_watch_lecture(p_lecture_id)`는 순차 강좌의 바로 이전 차시를 `(order_index, id)` 순으로 정해 진도 80% 이상인지 검사합니다. 003의 진도 RPC와 영상 Storage 정책이 같은 검사를 적용합니다. 80%는 다음 차시 진입 조건이며 완강·시험·수료증의 100% 조건을 낮추지 않습니다.
- `update_lecture_progress(p_lecture_id,p_position)`은 본인의 유효한 수강권을 검사하고 DB 강의 길이·서버 heartbeat 경과시간으로 진도를 기록합니다. 첫 호출에는 시청 시간을 부여하지 않습니다. 이후 요청당 최대 15초 × 1.5배속에 0.25초 전송 오차를 더한 범위 내의 양의 위치 변화만 인정합니다. 인정 구간을 numeric multirange의 합집합으로 저장하여 같은 구간을 반복 재생해도 진도가 중복 증가하지 않습니다. 위치가 과도하게 뛰면 해당 구간은 인정하지 않습니다. 영상 길이를 정수 초로 저장하는 오차는 실제 끝 위치에서 최대 1초 또는 영상 길이의 1% 중 작은 값만 허용하며 완료 결과는 100%로 표시합니다. 직접 progress INSERT/UPDATE는 허용하지 않습니다. 반환값은 기존 progress 행의 snake_case 형식입니다.
- `start_course_exam(p_course_id)`는 완강·유효 수강을 검사하고 정답 없는 세션을 반환합니다. `submit_course_exam(p_attempt_id,p_answers)`만 서버 채점 결과를 기록합니다. 동일 세션 재제출은 최초 결과를 반환합니다.
- `get_course_exam(p_course_id)`는 관리자에게 `{questions,rawExamText}`를 반환합니다. `save_course_exam(p_course_id,p_questions)`는 관리자만 호출하며 정답·선택지·문항 ID를 검증합니다.
- `save_course_record(p_course,p_questions)`는 강좌 메타데이터와 문제은행을 한 트랜잭션으로 저장합니다. 문제은행 검증 실패 시 강좌 생성·수정도 롤백됩니다. 음수·NULL 가격 및 수강기간, 빈 제목은 거절합니다.
- `issue_course_certificate(p_course_id)`는 완강·합격을 서버에서 검사하고 한 사용자·코스당 한 증서만 발급합니다.
- `process_course_payment(...,p_request_id uuid,p_paid_at date)`는 관리자 전용이며 같은 요청 ID의 재시도를 한 번만 기록합니다. 응답이 불명확할 때 새 요청 ID를 만들지 않고 같은 ID로 재확인해야 합니다. 관리자 표시명은 서버 프로필에서 정합니다.
- `verify_course_certificate(p_cert_no)`는 공개 확인에 필요한 이름·강좌·발급일·상태만 반환합니다. 생년월일·회원번호는 공개하지 않습니다.

## Storage와 제한

강의 영상 접근은 URL에서 정확히 추출하여 한 번 디코딩한 객체 경로와 Storage 객체 이름의 동등 비교로 확인합니다. 파일명 접미사나 SQL LIKE 와일드카드로 다른 영상의 권한을 얻을 수 없습니다.

`lectures` 버킷은 운영에서 비공개로 전환되었습니다. 이전 public 영상 URL은 그대로 재생되지 않습니다. 클라이언트는 유효한 JWT로 단기 signed URL을 받아야 합니다. 영상 조회는 유효한 수강권과 순차 강좌의 이전 차시 80% 조건, 또는 관리자 권한이 필요하며 업로드·삭제는 관리자만 가능합니다. 새 썸네일은 별도 공개 `thumbnails` 버킷에 저장합니다. 기존 `lectures/thumbs/` 파일은 이미지 확장자와 이미지 MIME 메타데이터를 모두 만족할 때만 익명 signed URL 발급을 허용합니다. `getThumbnailUrl`이 기존 이미지 URL을 변환합니다. 다른 목적으로 추가한 Storage 정책이 있다면 `lectures` 접근을 우회 허용하지 않는지 별도로 검토합니다.

기본 나모붓다야 음성은 제공된 원본을 변환한 로컬 `public/audio/namo_buddhaya_song.mp3`이며 클릭 전 다운로드하지 않습니다. 선택적 cloud 모드에만 003의 정확한 `lectures/audio/namo_buddhaya_song.mp3`·`audio/mpeg` 공개 읽기 예외가 필요합니다. cloud 모드는 mount 시 서명 URL 메타데이터를 준비하고 실제 MP3는 클릭 후 요청합니다. 공지 이미지는 별도 공개 `announcement-images` 버킷이며 관리자만 쓸 수 있습니다. 공개 기간이 지난 공지 이미지도 URL을 알면 접근할 수 있으므로 비공개 자료를 올리지 않습니다.

운영 정적 사이트는 인증된 사용자 JWT로 48MB 이하 영상을 Storage에 직접 업로드합니다. 로컬 FFmpeg 변환이 필요하면 개발 환경에만 `VITE_VIDEO_UPLOAD_MODE=local`을 지정하고 `npm run dev`로 실행합니다. 로컬 미들웨어도 실제 Auth 토큰과 관리자 역할을 검사합니다. 입력 1GB, 변환 10분, 동시 1개 작업, 결과 48MB 제한을 적용하며 중단·실패 시 임시 파일을 정리합니다. `.env`에 `FFMPEG_PATH`를 넣는 대신 실행 프로세스 환경변수로 지정하거나 PATH에 FFmpeg를 등록합니다. 정적 호스팅에서 `/api/upload-video`의 404/HTML 응답을 추측해 다른 업로드 방식으로 자동 전환하지 않습니다.

서버 heartbeat는 즉시 seek나 제출값 조작으로 완강하는 것을 막지만 사용자가 화면을 실제로 봤는지 증명하지는 못합니다. 기존 진도·합격·수료증 기록은 비파괴 이전을 위해 유지합니다. 과거의 진위가 의심되는 기록은 별도 운영 감사 대상으로 남습니다.

공개 인증 요청은 계정·action별 15분당 20회로 제한합니다. 대규모 분산 가입 공격에는 배포 인프라의 IP 제한이나 CAPTCHA를 추가해야 합니다. Auth 비밀번호 변경 후 이미 발급된 JWT의 효력은 프로젝트의 JWT 만료 설정에 따릅니다.

## 검증

배포 전 실제 스키마의 93개 컬럼·79행을 복제한 환경에서 001→002→003 통합 적용을 확인했습니다. 이는 해당 SELECT 백업의 행 복원 및 migration 검증이며 Auth 계정·Storage 파일을 포함한 전체 프로젝트 복원을 뜻하지 않습니다. RLS 명시 활성화 변경 후 security/enhancement SQL 테스트도 통과했습니다.

2026-09-23 운영 읽기 전용 검사 `node --env-file=.env scripts/check_live_security.mjs`는 10/10 통과했습니다. 익명 `users`·`progress` 조회는 401, 공개 과정·공지 조회는 200, 비동의 가입은 400, 미인증 관리자 요청은 401, 미허용 CORS 출처는 403이었습니다. `lectures.public=false`를 조회했고 동일한 실제 영상의 서비스 서명은 200, 익명 서명은 400으로 거절되었습니다. 별도 허용된 운영 origin의 CORS 사전 요청은 204이며 두 Edge 함수의 legacy JWT 검증 설정은 비활성화되어 있습니다. 결과는 `test_artifacts/enhancements/live-security.json`에 상태만 기록합니다.

`node --env-file=.env scripts/check_live_audio.mjs`는 전환된 비공개 버킷에서 정확한 공개 환영 음원의 익명 서명 200과 실제 Chrome 데스크톱·모바일 재생을 확인했습니다. 두 화면 모두 재생 위치가 증가했고 2초 이내 일시정지했으며 미디어 오류가 없었습니다. `test_artifacts/enhancements/live-audio.json`에는 서명 URL이나 자격 증명을 저장하지 않습니다. 이는 선택적 cloud 음원 경로의 검증이며 대기 중인 새 프런트엔드 배포나 실제 SMS 수신 검증을 대신하지 않습니다.

`node scripts/test_security_sql.mjs`는 PGlite의 실제 PostgreSQL 엔진에 기존 스키마와 migration을 적용하고 anon/student/admin RLS, 권한 거부, heartbeat, 서버 채점, 수납 멱등성, 수료증 중복 방지를 확인합니다. `node scripts/test_security_auth.mjs`는 외부 fetch를 완전히 모의하여 기존 계정 이관, 토큰 검증, 역할 위조 거절, 가입 실패 및 비밀번호 재설정 경계를 검증합니다. 기존 회원의 실제 로그인·관리자 연결과 프런트엔드 전체 사용자 흐름은 남은 전환 단계에서 확인해야 합니다.

`node scripts/test_enhancement_sql.mjs`는 001→002→003을 실제 PostgreSQL 엔진에서 실행하여 동의 시각·출처, 별칭 충돌, 79.99/80/80.01% 권한 경계, 공지 RLS, SMS 대기열·재시도와 특정 음성 파일 예외를 확인합니다. `node scripts/test_sms.mjs`의 공급자 요청은 모의이며 실제 문자 수신 증거가 아닙니다. 단일 프로세스 PGlite 통과가 운영 다중 세션 동시성·Auth 정책·Edge CORS·실제 Storage 서명 발급을 대신하지 않습니다.

참고: [Supabase Edge 인증](https://supabase.com/docs/guides/functions/auth), [서버에서 사용자 검증](https://supabase.com/docs/reference/javascript/auth-getuser).
