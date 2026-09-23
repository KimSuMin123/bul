# LMS 인증·권한 전환

이 변경은 저장소에서 검증한 배포 준비물입니다. 운영 데이터베이스나 Supabase 프로젝트에는 적용하지 않았습니다.

## 배포 순서

1. 운영 DB와 Storage 메타데이터를 백업하고 복원 가능한 별도 프로젝트에서 먼저 실행합니다. 기존 `database_setup.sql`은 DROP 기반 초기화 파일이므로 운영 업그레이드에 실행하지 않습니다.
2. 기존 사용자 대소문자 중복, 정규화 전화번호 중복, `(user_id, course_id)` 수강권·수료증 중복을 조사합니다. 새 UNIQUE 제약에 걸리면 migration 전체가 롤백됩니다. 원본을 자동 삭제하거나 임의 병합하지 않습니다.
3. `supabase/migrations/202609230001_security.sql`과 `202609230002_course_writes.sql`을 순서대로 한 번 적용합니다. 사용자 기존 문자열 ID는 유지하고 `auth_user_id`만 추가합니다. 기존 비밀번호는 로그인 이관 전까지 서버 전용 열에 남고, 성공적인 Auth 연결 후 NULL로 지워집니다. 두 번째 마이그레이션은 CMS 차시 썸네일 저장을 위한 `lectures.thumbnail` 열도 추가합니다.
4. `lms_private.course_exams`의 변환 결과를 확인합니다. 기존 문제·정답 형식은 엄격한 SQL parser로 이전합니다. 정답이나 선택지가 누락된 자료는 추측하지 않고 `lms_private.legacy_exam_text`에 보존합니다. 해당 코스는 관리자가 원문을 확인하고 문제은행을 저장할 때까지 시험 시작을 거절합니다. 원문 없는 코스는 서버에 포함된 기존 기본 20문제가 적용됩니다.
5. Edge Function `lms-auth`를 배포합니다. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge 런타임 환경변수입니다. **서비스 키를 VITE 환경변수나 브라우저 파일에 넣지 않습니다.** `LMS_ALLOWED_ORIGINS`에는 실제 웹 origin을 쉼표로 구분하여 설정합니다. 예: `https://example.org,http://127.0.0.1:3000`.
6. 새 프론트엔드를 배포하고 관리자 최초 로그인, 회원 신규 가입, 기존 회원 로그인, 수납, 진도, 시험, 수료증을 스테이징에서 확인합니다. 운영 전환 동안 기존 클라이언트는 새로운 정책으로 요청이 거절될 수 있으므로 점검 시간을 잡습니다.

## 인증 계약

`POST /functions/v1/lms-auth`의 JSON body에는 `action`과 아래 필드를 보냅니다.

| action | 필드 | 결과 |
|---|---|---|
| login | id, password | `{session,user}` |
| register | id, password, name, birthDate, phone | `{user}`; 역할은 student 강제 |
| availability | id 또는 phone | `{idAvailable,phoneAvailable}` |
| admin-register | 등록 필드 및 role | `{user}` |
| admin-reset | userId, newPassword | `{success:true}` |
| admin-delete | userId | `{success:true}` |

관리자 요청은 `Authorization: Bearer <access_token>`이 필요합니다. 함수는 토큰을 `/auth/v1/user`에서 검증한 뒤 DB의 관리자 역할을 확인합니다. `verify_jwt=false`는 익명 로그인·가입을 허용하기 위한 설정이며 관리자 인증 검사를 생략하지 않습니다. 이름·전화번호만 아는 사람에게 비밀번호를 재설정해 주는 API는 없습니다.

아이디는 대소문자 구분 없이 조회하며 신규 아이디는 소문자로 저장합니다. 기존 회원 로그인은 서버에서 기존 평문 또는 SHA-256을 검증한 뒤 Supabase Auth 사용자와 연결합니다. Auth email은 정규화된 아이디 SHA-256과 `@lms.invalid`로 구성된 내부 식별자이며 실제 이메일 발송 주소가 아닙니다. 이메일 복구는 지원하지 않으며 관리자 지원을 사용합니다. 기존 짧은 비밀번호가 Auth 프로젝트 정책에 거절되는 경우 관리자가 새 정책에 맞는 비밀번호로 재설정해야 합니다. 기존 관리자도 정책을 충족하지 못하면 프로젝트 운영자가 서버 측에서 Auth 사용자를 생성·연결해야 합니다.

Auth 및 DB는 하나의 트랜잭션을 공유하지 않습니다. 첫 로그인 중 연결 응답이 유실되면 같은 Auth 비밀번호를 증명하여 재시도합니다. 신규 가입 중 프로필 응답이 유실되면 연결된 프로필을 재조회합니다. 상태를 확인할 수 없을 때 계정을 성공으로 표시하거나 Auth 사용자를 무조건 삭제하지 않습니다. 운영자는 연결되지 않은 Auth 계정을 정기 점검해야 합니다.

## DB RPC

기존 한글·공백 포함 아이디는 로그인·관리자 지원·중복 확인에서 유지합니다. 영문·숫자 형식 제한은 신규 가입에만 적용합니다.

학생의 수강 재신청은 본인 소유의 미결제(`pending`/`applied`) 또는 만료된 수강권에서만 가능합니다. 재신청 결과는 미결제 상태이고 `paid_at`은 NULL이어야 합니다. 유효한 수강권의 상태를 직접 바꾸거나 스스로 활성화할 수 없습니다.

완강과 합격이 모두 충족되면 시험 제출·최종 진도·수료증 발급 RPC에서 서버가 수강 상태를 `completed`로 동기화합니다. 신규 강좌에 문제은행을 지정하지 않으면 서버 전용 기본 20문제를 복사합니다. 기존 강좌의 누락된 문제은행을 기본 문제로 임의 교체하지 않습니다.

- `current_lms_user()`는 검증된 `auth.uid()`의 공개 프로필을 camelCase로 반환합니다.
- `update_lecture_progress(p_lecture_id,p_position)`은 본인의 유효한 수강권을 검사하고 DB 강의 길이·서버 heartbeat 경과시간으로 진도를 기록합니다. 첫 호출에는 시청 시간을 부여하지 않습니다. 이후 요청당 최대 15초 × 1.5배속에 0.25초 전송 오차를 더한 범위 내의 양의 위치 변화만 인정합니다. 인정 구간을 numeric multirange의 합집합으로 저장하여 같은 구간을 반복 재생해도 진도가 중복 증가하지 않습니다. 위치가 과도하게 뛰면 해당 구간은 인정하지 않습니다. 영상 길이를 정수 초로 저장하는 오차는 실제 끝 위치에서 최대 1초 또는 영상 길이의 1% 중 작은 값만 허용하며 완료 결과는 100%로 표시합니다. 직접 progress INSERT/UPDATE는 허용하지 않습니다. 반환값은 기존 progress 행의 snake_case 형식입니다.
- `start_course_exam(p_course_id)`는 완강·유효 수강을 검사하고 정답 없는 세션을 반환합니다. `submit_course_exam(p_attempt_id,p_answers)`만 서버 채점 결과를 기록합니다. 동일 세션 재제출은 최초 결과를 반환합니다.
- `get_course_exam(p_course_id)`는 관리자에게 `{questions,rawExamText}`를 반환합니다. `save_course_exam(p_course_id,p_questions)`는 관리자만 호출하며 정답·선택지·문항 ID를 검증합니다.
- `save_course_record(p_course,p_questions)`는 강좌 메타데이터와 문제은행을 한 트랜잭션으로 저장합니다. 문제은행 검증 실패 시 강좌 생성·수정도 롤백됩니다. 음수·NULL 가격 및 수강기간, 빈 제목은 거절합니다.
- `issue_course_certificate(p_course_id)`는 완강·합격을 서버에서 검사하고 한 사용자·코스당 한 증서만 발급합니다.
- `process_course_payment(...,p_request_id uuid,p_paid_at date)`는 관리자 전용이며 같은 요청 ID의 재시도를 한 번만 기록합니다. 응답이 불명확할 때 새 요청 ID를 만들지 않고 같은 ID로 재확인해야 합니다. 관리자 표시명은 서버 프로필에서 정합니다.
- `verify_course_certificate(p_cert_no)`는 공개 확인에 필요한 이름·강좌·발급일·상태만 반환합니다. 생년월일·회원번호는 공개하지 않습니다.

## Storage와 제한

강의 영상 접근은 URL에서 정확히 추출하여 한 번 디코딩한 객체 경로와 Storage 객체 이름의 동등 비교로 확인합니다. 파일명 접미사나 SQL LIKE 와일드카드로 다른 영상의 권한을 얻을 수 없습니다.

`lectures` 버킷은 비공개로 바뀝니다. 이전 public 영상 URL은 그대로 재생되지 않습니다. 클라이언트는 유효한 JWT로 단기 signed URL을 받아야 합니다. 영상 조회는 해당 코스의 활성 수강권 또는 관리자 권한이 필요하며 업로드·삭제는 관리자만 가능합니다. 새 썸네일은 별도 공개 `thumbnails` 버킷에 저장합니다. 기존 `lectures/thumbs/` 파일은 이미지 확장자와 이미지 MIME 메타데이터를 모두 만족할 때만 익명 signed URL 발급을 허용합니다. `getThumbnailUrl`이 기존 이미지 URL을 변환합니다. 다른 목적으로 추가한 Storage 정책이 있다면 `lectures` 접근을 우회 허용하지 않는지 적용 전에 별도 검토합니다.

운영 정적 사이트는 인증된 사용자 JWT로 48MB 이하 영상을 Storage에 직접 업로드합니다. 로컬 FFmpeg 변환이 필요하면 개발 환경에만 `VITE_VIDEO_UPLOAD_MODE=local`을 지정하고 `npm run dev`로 실행합니다. 로컬 미들웨어도 실제 Auth 토큰과 관리자 역할을 검사합니다. 입력 1GB, 변환 10분, 동시 1개 작업, 결과 48MB 제한을 적용하며 중단·실패 시 임시 파일을 정리합니다. `.env`에 `FFMPEG_PATH`를 넣는 대신 실행 프로세스 환경변수로 지정하거나 PATH에 FFmpeg를 등록합니다. 정적 호스팅에서 `/api/upload-video`의 404/HTML 응답을 추측해 다른 업로드 방식으로 자동 전환하지 않습니다.

서버 heartbeat는 즉시 seek나 제출값 조작으로 완강하는 것을 막지만 사용자가 화면을 실제로 봤는지 증명하지는 못합니다. 기존 진도·합격·수료증 기록은 비파괴 이전을 위해 유지합니다. 과거의 진위가 의심되는 기록은 별도 운영 감사 대상으로 남습니다.

공개 인증 요청은 계정·action별 15분당 20회로 제한합니다. 대규모 분산 가입 공격에는 배포 인프라의 IP 제한이나 CAPTCHA를 추가해야 합니다. Auth 비밀번호 변경 후 이미 발급된 JWT의 효력은 프로젝트의 JWT 만료 설정에 따릅니다.

## 검증

`node scripts/test_security_sql.mjs`는 PGlite의 실제 PostgreSQL 엔진에 기존 스키마와 migration을 적용하고 anon/student/admin RLS, 권한 거부, heartbeat, 서버 채점, 수납 멱등성, 수료증 중복 방지를 확인합니다. `node scripts/test_security_auth.mjs`는 외부 fetch를 완전히 모의하여 기존 계정 이관, 토큰 검증, 역할 위조 거절, 가입 실패 및 비밀번호 재설정 경계를 검증합니다. Supabase Gateway·Auth·Storage의 실제 연동은 스테이징 배포에서 추가 확인해야 합니다.

참고: [Supabase Edge 인증](https://supabase.com/docs/guides/functions/auth), [서버에서 사용자 검증](https://supabase.com/docs/reference/javascript/auth-getuser).
