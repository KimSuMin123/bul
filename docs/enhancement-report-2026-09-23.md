# 교육 사이트 개선 구현·검증 보고

## 범위와 현재 환경

React 18 / Vite 6 SPA, native fetch 기반 Supabase REST, PostgreSQL 및 Storage 구조입니다. 실제 운영 호스팅은 Netlify Drop이며 Vercel 설정도 저장소에 남아 있습니다. 작업 시작 당시 운영 DB는 레거시 스키마였고, 이번 작업에서 Supabase Auth 전환과 개선 마이그레이션001/002/003을 적용했습니다. 서비스 키는 서버 전용으로 유지합니다.

백엔드(Astra/high), 프런트엔드(Sol/medium), 운영·성능(Astra/high)을 분담하고 총괄이 공통 API·Context·페이지 연결과 통합 검증을 수행했습니다. 파일 소유권을 분리하고 기존 미추적 문서와 output 산출물은 보존했습니다. 후속 독립 검토에서 공지 업로드 경합, 외부 승인 갱신, 질문 링크 필터 충돌, PDF 하단 잘림을 확인하여 수정·검증했습니다.

운영 변경은 사용자가 허용했으며 선행 조건인 SELECT 백업과 격리 복원을 수행했습니다. 사용자가 Supabase와 Netlify에 로그인한 뒤, 대상 프로젝트 `buddha-academy`와 기존 Netlify 프로젝트 `sehwa-buddha-academy`를 확인했습니다. 운영 사이트는 `https://xn--2j1bkkm2t5tbj2hx7go2ry0o.com/`입니다. 세 SQL 마이그레이션을 한 트랜잭션으로 적용했고 lms-auth/lms-sms Edge Function을 배포했습니다. Windows 일일 백업 작업도 실제 설치했습니다. 프런트 업로드와 관리자 설정의 최종 상태는 아래 배포 기록을 따릅니다.

## 기능별 상태

| 요구사항 | 구현 및 검증 | 운영에서 남은 단계 |
|---|---|---|
| 1 신청 완료 문구 | 강좌 상세·내 강의실 신청 팝업에 신청 결과, 농협 계좌, 금액, 매일 10~11시·18~19시 승인 안내. 기존 즉시 승인 문구 수정. 실제 UI 검증 | 프런트 배포 |
| 2 개인정보 동의 | 기본 해제, 펼침 안내, 프런트/서버 true·버전 검증, DB 서버 시각. 기존5명 backfill 실제 적용, 운영 비동의 가입400 확인 | 프런트 배포 |
| 3 관리자 변경 | adsba 별칭, immutable 회원 ID/FK·역할 유지, Supabase Auth 비밀번호 저장. 최근 백업 확인·변경·로그인·역할검증 도구 및 사용자 직접 입력 화면. 모의8개·실제 로컬 폼 검증 | 사용자 새 비밀번호 직접 입력·제출 대기 |
| 4 문자 | 신청 회원/관리자, 질문 관리자, 답변 작성회원의 4가지 이벤트. 질문 내용·확인 링크 포함, DB outbox·중복키·lease·결과기록·재처리 RPC. 기본 mock | SOLAPI 인증·등록 발신번호·worker 스케줄·실수신 검증 |
| 5 오픈식 | 2026-10-01 18:30 KST 기준 300초 타임라인, 커팅·단계 안내, 별도 리허설 조작, 동작 줄이기 | 사이트 배포 및 실제 행사 리허설. 기기 시계 기준, 진행자 방송 서버는 아님 |
| 6 캐릭터 음원 | 단일 Audio, preload none, 클릭 재생·정지·오류 상태. 첨부 원본 기반 public/audio 파일과 선택적 기존 클라우드 경로 | 최종 프런트 배포. 실제 모바일 기기/Safari는 별도 확인 |
| 7 자격증 | 승인된 logo.png, 세로 A4 자격증, 기존 정보·발급·인쇄/PDF 저장 경로 유지 | 실제 프린터 출력은 미실행 |
| 8 일일 백업 | 매일03:00 KST·7일 보관 예약 등록, 평문 SELECT·ACL·SMTP 첨부/결과, 실제 내부 저장·선택 열 복원 검증 | SMTP 환경 설정 및 실제 메일 수신. PC 켜짐·사용자 로그인 필요 |
| 9 다음 강의 | 이전 차시 진도>=80. 화면·진도 RPC·영상 Storage 권한 일치. 79.99/80/80.01 격리 검증, 운영 SQL 적용 | 프런트 배포. 수료·시험·자격증100% 기준 유지 |
| 10 로딩 | 경로별 코드 분리, 외부 폰트 비차단, 공개 페이지 인증 대기 제거, 30초 캐시·갱신으로 중복조회 감소 | 실제 CDN·운영 DB 환경 측정 필요. 아래 성능 보고 참조 |
| 11 공지 | 관리자 이미지/텍스트 CRUD·노출기간·공개여부·이미지 링크, KST 오늘 숨김·닫기·모바일, RLS·업로드 제한. 운영 테이블·버킷 정책 적용 | 프런트 배포 및 실제 관리자 공지 작성 검증 |

## DB 변경과 적용·복구

`supabase/migrations/202609230003_enhancements.sql`은 기존 001/002 다음에 적용합니다. 기존 ID·진도·수납·발급 기록을 삭제하지 않습니다.

- users: `login_id`, `privacy_consent`, `privacy_consent_at`, `privacy_policy_version`, `privacy_consent_source` 추가. 기존 회원은 요청대로 true와 실행 시각을 기록하지만 출처는 `legacy_admin_backfill`로 구분합니다. 실제 회원 동의 증거로 가장하지 않습니다. 신규는 registration/admin_attested입니다.
- 로그인 별칭 전용 private namespace는 기존 ID와 별칭 사이 충돌을 막습니다. 기존 ID도 호환 로그인 경로로 남습니다.
- `lms_can_watch_lecture`와 진도 RPC wrapper, Storage policy는 바로 이전 차시80%를 적용합니다. 원래 100% 수료 판정 함수는 유지합니다.
- `site_announcements`와 `announcement-images` 버킷, 공개 일정 정책과 관리자 변경 정책을 추가합니다.
- enrollments.application_version, private 문자 outbox·attempts 및 신청/질문/답변 trigger를 추가합니다. 네트워크 발송은 저장 트랜잭션 밖에서 수행합니다.
- 기존 클라우드 인사 음원 한 경로에만 익명 서명 URL 발급용 읽기 권한을 허용합니다. 강의 영상 전체 공개 권한이 아닙니다.

적용 순서: 현재 SELECT 백업 확인 → 가능하면 운영과 같은 스테이징에서 001/002/003 → lms-auth/lms-sms → 비밀환경 → 프런트 → 관리자 계정 변경 도구 → 로그인/회원/신청/영상/문자 실검증. `database_setup.sql`은 DROP 기반 초기화이므로 운영 업그레이드에 사용하면 안 됩니다.

각 migration은 트랜잭션 실패 시 해당 실행이 롤백됩니다. 실제 적용은 세 파일의 내부 BEGIN/COMMIT을 합친 단일 트랜잭션이었습니다. 처음 관리 화면에서 내부 테이블 RLS 경고가 나와 실행하지 않았고, 공개·비공개 전체 테이블의 RLS를 명시한 보완본을 다시 검증한 후 적용했습니다. 적용 후20개 테이블 모두 RLS가 활성화되어 있습니다. 이미 적용한 기능을 중지할 때는 문자 worker/예약을 우선 중지하고 기존 새 데이터·동의 기록·outbox를 보존합니다. DB 열을 무조건 삭제하거나 SELECT 파일을 운영에 덮어쓰지 않습니다. 구버전 프런트는 신규 동의 계약과 호환되지 않으므로 Auth·프런트 버전 조합을 맞추어 롤백해야 합니다. 관리자 암호는 이전 값을 복구할 수 없으므로 운영자가 Auth 재설정 절차를 사용합니다. 자세한 절차는 [기존 보안 전환](security-migration.md), [운영·백업·계정 도구](operations-enhancements.md), [문자 worker](../supabase/functions/lms-sms/README.md)를 따릅니다.

현재 요청한 백업은 자격증명 열을 제외한 공개 테이블 SELECT입니다. DDL·RLS·함수·Auth 비밀·Storage 원본 파일은 포함하지 않으며 전체 서비스 복원본은 아닙니다. 격리된 PGlite에서 선택한 모든 행·열만 복원 비교했습니다. 운영 데이터가 동시에 바뀔 수 있어 시점 일관성은 보장하지 않습니다.

전환 직전19:21 KST 백업은10테이블79행이며, 별도로 기존93컬럼·30제약·28정책·권한·Storage 버킷 설정도 `test_artifacts/backups/pre-migration-schema-20260923.json`에 보존했습니다. 이 실제 정의와 데이터로 단일 트랜잭션 호환성을 추가 검증했습니다. Auth 비밀과 Storage 파일 전체는 여전히 포함하지 않습니다. 적용한 SQL의 SHA-256은 `9247f16f8c1a4ccde92159c41ee4922e39abcb7f237a1233d59320881d068bd4`입니다.

## 외부 설정과 남은 입력

비밀이 없는 설정 예제는 [config/enhancements.env.example](../config/enhancements.env.example)에 있습니다.

- Supabase: SQL/Edge 배포 가능한 관리 로그인 또는 `SUPABASE_ACCESS_TOKEN`, 서버 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `LMS_ALLOWED_ORIGINS`.
- SMS: `LMS_SMS_PROVIDER=solapi`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `LMS_SMS_WORKER_SECRET`, `LMS_SMS_SENDER`, `LMS_SMS_ADMIN_PHONE=01047020283`, `LMS_SITE_URL`. 발신번호 등록 여부는 미확인입니다. SOLAPI를 선택한 구현이며 사용 중인 업체는 발견되지 않았습니다.
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`; `BACKUP_EMAIL_TO` 기본 tntn211@naver.com. 비밀은 호스트 환경/비밀 저장소에서 주입합니다.
- 사이트: 운영 호스팅 배포 계정. 승인된 행사 시각·기존 로고·첨부 음원 자료는 확보되었습니다.

실제 문자 연동 전에는 기존 브라우저 알림을 유지합니다. 사용자가 말한 pwd는 알림 대체 목적임을 확인했습니다. 실제 SMS 수신·재시도 검증이 끝나면 notificationService의 알림 호출·폴링·권한 UI·SW 알림 이벤트 제거가 가능합니다. 앱 설치 기능(manifest)까지 삭제하는 범위는 이번 요청으로 확정하지 않았습니다.

문자 `accepted`는 사업자 접수이며 단말 도착을 뜻하지 않습니다. 불확실한 전송은 자동 재전송하지 않고 사업자 이력 확인 후 관리자 재처리로 중복을 피합니다. 모의발송은 실제 발송 성공으로 표시하지 않습니다.

## 행사와 산출물

[5분 행사 진행안](opening-event-2026-10-01.md), `test_artifacts/enhancements/`의 자격증 PDF·화면 캡처·음원 검증 결과, `test_artifacts/backups/`의 비공개 SELECT 백업·복원 결과를 생성했습니다. 백업 파일은 Git 제외 및 현재 사용자/SYSTEM 접근 권한으로 보관합니다. 파일 내용이나 비밀을 보고서에 싣지 않았습니다.

## 테스트와 성능

2026-09-23 로컬에서 다음 검증을 실행했습니다. 테스트의 모의 API 결과는 운영 서비스 성공을 뜻하지 않습니다.

|실행|결과와 범위|
|---|---|
|`npm test`|204개 통과: 단위14, API 실패 계약87, 세션11, 화면 저장40, 미디어11, 메타데이터13, Auth13, 기존 SQL15|
|`npm run test:enhancements`|정책3, 공지 헬퍼, 새 SQL9, SMS6, 운영 도구19 통과. SQL은 PGlite의 실제 RLS·trigger·RPC 실행, SMS 사업자는 mock|
|`npm run test:browser`|강의 Context·오래된 응답·캐시·외부 변경 갱신·실패 보존 등30개 통과|
|`npm run test:e2e`|23개 통과. 회원 동의, 신청 팝업, 80% 경계3조건, 질문 링크, 인증·저장 실패 회귀 포함|
|`scripts/test_operations_email.py`|SMTP 구성·TLS/STARTTLS·실패 알림3개 통과. 실제 메일 미발송|
|`scripts/check_local_audio.mjs`|실제 NamoAudio와 제공 MP3로 desktop/mobile 재생·정지·이어듣기 통과. 클릭 전 파일 요청0, 클릭 후1, Audio 객체1개, 제거 시 정지|
|`scripts/check_live_audio.mjs`|운영 비공개 버킷 전환 후 특정 환영 음원의 익명 서명200·실제 Chromium desktop/mobile 재생 통과|
|`scripts/check_live_security.mjs`|운영10개 검사 통과: 회원·진도 익명조회401, 공개 과정·공지200, 비동의가입400, 미인증 관리자401, 미허용 origin403, 강의 비공개 및 동일 실제 영상의 서비스서명200/익명서명400|
|`scripts/test_frontend_enhancements_browser.mjs`|실제 컴포넌트 공지 CRUD·오늘 숨김 재방문, 행사300초·리본 커팅, 장문 자격증 비겹침·A4 1페이지 확인. 최종 PDF를 Poppler로 렌더해 하단 정보·직인까지 시각 검토|
|`scripts/test_admin_bootstrap_local.mjs`|모의8개 통과. 실제 Chrome 로컬 비밀번호 폼은 모의 처리기로만 검증|
|실제 SELECT 복원|전환 전10테이블79행 및 전환 후11테이블79행을 격리 PGlite에 복원하고 선택 열 전체·행 수·원본 SHA-256 일치 확인. 향후 Auth UUID 참조, 동의 원래 시각·출처, 이미지 공지 날짜·신청 버전도 별도 모의 검증. 복원 중 생성된 SMS0개|

첨부 ZIP 원본은 변경하지 않았습니다. 30분21초 MP3를 웹 재생용128kbps·44.1kHz 스테레오로 준비했고, 전체 디코딩과 실제 재생을 확인했습니다. `public/audio/namo_buddhaya_song.mp3`는29,141,829bytes이며 페이지 첫 표시 때 다운로드하지 않습니다. 기존 클라우드 원본도 덮어쓰지 않았습니다.

### 페이지별 로딩

변경 전후 같은 로컬 프로덕션 빌드 서버·고정 API fixture·외부 요청 차단 조건에서9페이지를 측정했습니다. 일반 조건은 desktop/mobile 각각3회 중앙값(전54+후54샘플), 제한 모바일은150ms RTT·1.6Mbps 다운로드·750kbps 업로드·CPU4배 지연으로 페이지별1회(전9+후9샘플)입니다. 표시 시간은 Playwright가 핵심 요소를 관찰한 시점이며 실제 CDN·운영 DB·실기기 측정이나 Web Vitals 합격 판정은 아닙니다.

|페이지|일반 desktop 전→후 ms|일반 mobile 전→후 ms|제한 mobile 전→후 ms|
|---|---:|---:|---:|
|메인|227→284|186→185|2038→1566|
|소개|256→196|184→182|1866→1566|
|로그인|156→153|159→138|1666→1364|
|회원가입|152→149|170→146|1667→1464|
|강좌 상세|193→189|222→184|1897→1593|
|자격증 검증|160→142|154→142|1657→1362|
|내 강의실|182→222|169→219|1921→1626|
|강의 시청|261→235|240→219|1990→1663|
|관리자|219→216|187→208|2912→1813|

메인 JS는557,346→268,523bytes(51.8% 감소), gzip131,079→84,597bytes(35.5% 감소)입니다. 제한 모바일의 이미 방문한 화면 사이 이동은5~52ms였습니다. 일부 일반 조건 수치는 변동·새 기능 비용으로 증가했으므로 모든 페이지의 표시 속도가 개선됐다고 주장하지 않습니다.

**제한 모바일 첫 방문은 모든 측정 페이지에서1초 목표 미달입니다.** 남은 공통 비용은 SPA JavaScript 다운로드·실행과 초기 API 응답 대기입니다. 소개·관리자는 추가 코드도 큽니다. 다음 개선은 공개 페이지 사전 렌더링, 소개/관리자 내부 패널 추가 분할, CDN 압축·캐시 헤더 적용, 실제 Supabase 쿼리·응답 시간 측정 순서입니다. 운영 배포 후 실제 네트워크에서 원인별 시간을 다시 확인해야 합니다. 상세 JS/API 횟수와 최초·이동 구분은 [전체 성능 비교표](../test_artifacts/performance/comparison.md)에 있습니다.

문자/이메일 실수신·실제 프린터 출력은 수행하지 않았습니다. Windows 예약은 설치됐지만 SMTP 미설정으로 시험 실행은 내부 저장 성공과 함께 실패 코드1을 반환했습니다. 다음 예약 시각은2026-09-24 03:00 KST이며, 메일 환경 설정 뒤 재실행하여 수신 확인해야 합니다.

### 운영 적용 기록

- DB 적용 후 실제 SQL 확인: 회원5명, 관리자1명, 수강권8개, 강의60개 유지. 기존5명 동의 backfill 기록,20개 테이블 RLS 활성, 문자 대기0개, 강의 버킷 비공개 전환 확인.
- lms-auth 실제 CORS: 운영 origin OPTIONS204, 미허용 origin403. Edge 자체 토큰 검증 방식으로 배포했습니다.
- lms-sms는 SOLAPI 모드와 관리자 수신번호·사이트 URL까지 설정했습니다. API 인증/등록 발신번호가 없어 스케줄을 활성화하지 않았습니다. 설정 부족 시 큐를 소비하기 전에503으로 중단하도록 구현돼 있습니다.
- 최종 Netlify ZIP은 `output/netlify/sehwa-buddha-academy-20260923T102104Z.zip`입니다. 서버 비밀 미포함·필수 파일·ZIP CRC 검증을 통과했습니다. 최종 운영 빌드 main JS는269,613bytes(gzip85,032)로, 앞의 fixture 성능 측정 빌드와 환경값·최종 자격증 수정 차이가 있습니다.
- Netlify 파일 업로드는 브라우저 확장의 파일 접근 거절(`Not allowed`)로 미완료입니다. 확장 설정 페이지 자동 열기도 브라우저 URL 보안 정책에 차단됐습니다. 사용자에게 파일 URL 접근 허용 또는 위 ZIP 직접 업로드를 요청했습니다. 9월20일 기존 배포가 아직 게시 상태이므로 새 프런트 게시 전 기존 로그인·수강 화면은 제한될 수 있습니다.
- 관리자 변경은 사용자 직접 비밀번호 입력·제출을 기다리고 있으며 아직 완료로 표시하지 않습니다. `scripts/admin_bootstrap_local.mjs`는 최근 복원 검증 백업을 확인하고 원래 ID·역할을 보존한 채 Auth 연결과 adsba 로그인·관리자 RPC까지 검증합니다. 입력값을 파일·로그에 저장하지 않습니다. 일회성 입력 서버는15분 뒤 만료됩니다.
- 전환 후 새 백업: `test_artifacts/backups/select-2026-09-23T10-42-56.830Z-e63dbc2a-2ea8-441e-84bd-d7da80221bf0.json`, SHA-256 `b6f6e8a5749cf1c4e12b23831cd13e0bba9a35ee0ff6612f12557dcf0ad28cf9`. 전체 Auth/Storage 복원본을 의미하지 않습니다.
