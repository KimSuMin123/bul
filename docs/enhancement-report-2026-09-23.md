# 교육 사이트 개선 구현·검증 보고

## 범위와 현재 환경

React 18 / Vite 6 SPA, native fetch 기반 Supabase REST, PostgreSQL 및 Storage 구조입니다. 실제 운영 호스팅은 GitHub 저장소와 연결된 Netlify이며 Vercel 설정도 저장소에 남아 있습니다. 작업 시작 당시 운영 DB는 레거시 스키마였고, 이번 작업에서 Supabase Auth 전환과 개선 마이그레이션001/002/003을 적용했습니다. 서비스 키는 서버 전용으로 유지합니다.

백엔드(Astra/high), 프런트엔드(Sol/medium), 운영·성능(Astra/high)을 분담하고 총괄이 공통 API·Context·페이지 연결과 통합 검증을 수행했습니다. 파일 소유권을 분리하고 기존 미추적 문서와 output 산출물은 보존했습니다. 후속 독립 검토에서 공지 업로드 경합, 외부 승인 갱신, 질문 링크 필터 충돌, PDF 하단 잘림을 확인하여 수정·검증했습니다.

운영 변경은 사용자가 허용했으며 선행 조건인 SELECT 백업과 격리 복원을 수행했습니다. 사용자가 Supabase와 Netlify에 로그인한 뒤, 대상 프로젝트 `buddha-academy`와 기존 Netlify 프로젝트 `sehwa-buddha-academy`를 확인했습니다. 운영 사이트는 `https://xn--2j1bkkm2t5tbj2hx7go2ry0o.com/`입니다. 세 SQL 마이그레이션을 한 트랜잭션으로 적용했고 lms-auth/lms-sms Edge Function을 배포했습니다. Windows 일일 백업 작업도 실제 설치했습니다. 마지막으로 운영 게시를 확인한 문서 커밋 `d61fd69`는 2026-09-23 21:16 KST에 운영 게시되었으며 기능 번들은 기존과 동일합니다. 관리자 변경은 완료했습니다. 최신21:41 KST SELECT 백업은 내부 저장·SMTP 인증·발송 접수에 성공했고 같은11테이블79행 파일의 격리 복원도 PASS입니다. 메일 SMTP535 문제는 해결됐으며 받은편지함 실수신은 사용자 확인이 필요합니다. 문자 HTTP401 오류는 별개로 미해결입니다. 후속 문서 커밋 `1e624af`는 push했지만 그 Netlify 게시 상태는 확인하지 않았습니다. 상세 상태는 아래 배포 기록을 따릅니다.

## 기능별 상태

| 요구사항 | 구현 및 검증 | 운영에서 남은 단계 |
|---|---|---|
| 1 신청 완료 문구 | 강좌 상세·내 강의실 신청 팝업에 신청 결과, 농협 계좌, 금액, 매일 10~11시·18~19시 승인 안내. 기존 즉시 승인 문구 수정. 실제 UI 검증·운영 프런트 게시 | 운영 사용자 신청 흐름 확인 |
| 2 개인정보 동의 | 기본 해제, 펼침 안내, 프런트/서버 true·버전 검증, DB 서버 시각. 기존5명 backfill 실제 적용, 운영 비동의 가입400 확인·프런트 게시 | 실제 가입 흐름 확인 |
| 3 관리자 변경 | adsba 별칭, immutable 회원 ID/FK·역할 유지, Supabase Auth 비밀번호 저장. 최근 백업 확인·변경·로그인·역할검증 도구 및 사용자 직접 입력 화면. 모의8개·실제 로컬 폼 검증 | 운영 변경·adsba 로그인·관리자 역할 확인 완료, 검증 세션 로그아웃 |
| 4 문자 | 신청 회원/관리자, 질문 관리자, 답변 작성회원의 4가지 이벤트. 질문 내용·확인 링크 포함, DB outbox·중복키·lease·결과기록·재처리 RPC. 기본 mock | SOLAPI 키 저장·발신번호 활성화 확인. 시험 경로 함수 인증401 미해결, 요청에 따라 원복 검증 완료. SMS 스케줄 미가동·실발송0건 |
| 5 오픈식 | 2026-10-01 18:29 KST부터 노출, 18:30 시작·300초. 1분 대기·커팅5초 카운트다운, 축하 효과·개인 화면 연꽃 반응. 시간 경계7개 및 모바일 실제 브라우저 검증 | 행사 당일 관계자 리허설 필요. 기기 시계 기준, 진행자 방송 서버는 아님 |
| 6 캐릭터 음원 | 단일 Audio, preload none, 클릭 재생·정지·오류 상태. 첨부 원본 기반 public/audio 파일과 선택적 기존 클라우드 경로 | 운영 게시·MP3 HEAD200 확인. 실제 모바일 기기/Safari는 별도 확인 |
| 7 자격증 | 승인된 logo.png, 세로 A4 자격증, 기존 정보·발급·인쇄/PDF 저장 경로 유지 | 실제 프린터 출력은 미실행 |
| 8 일일 백업 | 매일03:00 KST·7일 보관 예약 등록, 평문 SELECT·ACL·SMTP 첨부/결과, 실제 내부 저장·선택 열 복원 검증 | 21:41 내부 저장·SMTP 발송 접수·11테이블79행 격리 복원 PASS. 받은편지함 실수신은 사용자 확인 필요. PC 켜짐·사용자 로그인 필요 |
| 9 다음 강의 | 이전 차시 진도>=80. 화면·진도 RPC·영상 Storage 권한 일치. 79.99/80/80.01 격리 검증, 운영 SQL 적용 | 운영 프런트 게시 완료. 수료·시험·자격증100% 기준 유지 |
| 10 로딩 | 경로별 코드 분리, 외부 폰트 비차단, 공개 페이지 인증 대기 제거, 30초 캐시·갱신으로 중복조회 감소, 공통 원형 로딩 표시 운영 게시 | 실제 CDN·운영 DB 환경 측정 필요. 아래 성능 보고 참조 |
| 11 공지 | 관리자 이미지/텍스트 CRUD·노출기간·공개여부·이미지 링크, KST 오늘 숨김·닫기·모바일, RLS·업로드 제한. 운영 테이블·버킷 정책 적용 | 운영 프런트 게시 완료. 실제 관리자 공지 작성 검증 필요 |

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
- SMS: `LMS_SMS_PROVIDER=solapi`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `LMS_SMS_WORKER_SECRET`, `LMS_SMS_SENDER`, `LMS_SMS_ADMIN_PHONE=01047020283`, `LMS_SITE_URL`. 두 SOLAPI 키는 운영 Supabase Secrets에 저장했고 발신번호 `01080287565`의 활성화 상태를 확인했습니다. 관리자 수신번호는 `01047020283`을 유지합니다. 키 값은 코드·문서에 기록하지 않으며 SMS cron과 실발송은 아직 미완료입니다.
- Email: `SMTP_HOST=smtp.naver.com`, `SMTP_PORT=465`, 발신·수신·사용자명은 `tntn211@naver.com`으로 비밀 아닌 설정을 저장했습니다. `SMTP_PASSWORD`는 사용자 제출로 저장됐습니다. 초기 SMTP535 오류는 네이버 POP3/SMTP를 사용자가 켠 뒤 해결되어21:41 KST 실제 백업의 SMTP 인증·발송 접수가 성공했습니다. 받은편지함 실수신은 직접 확인하지 않아 사용자 확인이 별도로 필요합니다. 비밀은 호스트 환경/비밀 저장소에서 주입하고 예시에 남기지 않습니다.
- 사이트: Netlify에 GitHub `KimSuMin123/bul` 연결 완료, production branch `feat/minhyeok`, `npm run build` → `dist`. Netlify 환경 변수에는 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`만 설정했습니다. 승인된 행사 시각·기존 로고·첨부 음원 자료는 확보되었습니다.

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

**제한 모바일 첫 방문은 모든 측정 페이지에서1초 목표 미달입니다.** 남은 공통 비용은 SPA JavaScript 다운로드·실행과 초기 API 응답 대기입니다. 소개·관리자는 추가 코드도 큽니다. CDN 보안·캐시 헤더는 이번 운영 게시 후 확인했습니다. 다음 개선은 공개 페이지 사전 렌더링, 소개/관리자 내부 패널 추가 분할, 실제 Supabase 쿼리·응답 시간 측정입니다. 운영 배포 후 실제 네트워크에서 원인별 시간을 다시 확인해야 합니다. 상세 JS/API 횟수와 최초·이동 구분은 [전체 성능 비교표](../test_artifacts/performance/comparison.md)에 있습니다.

문자/이메일 실수신·실제 프린터 출력은 확인하지 못했습니다. Windows 예약은 설치되어 있고, 21:23 KST에 같은 PowerShell runner를 한 번 실행하여 내부 저장·격리 복원은 성공했지만 이메일은 실패했습니다. 별도 로그인만 진단한 결과 SMTP535 인증 오류였으며 추가 메일은 보내지 않았습니다. 이는 당시 실패 기록이며21:41 KST에는 SMTP 인증·발송 접수가 성공했습니다. 다음 예약 시각은2026-09-24 03:00 KST이며 받은편지함 실수신은 사용자 확인이 필요합니다.

### 운영 적용 기록

- DB 적용 후 실제 SQL 확인: 회원5명, 관리자1명, 수강권8개, 강의60개 유지. 기존5명 동의 backfill 기록,20개 테이블 RLS 활성, 문자 대기0개, 강의 버킷 비공개 전환 확인.
- lms-auth 실제 CORS: 운영 origin OPTIONS204, 미허용 origin403. Edge 자체 토큰 검증 방식으로 배포했습니다.
- lms-sms는 SOLAPI 모드, 관리자 수신번호 `01047020283`, 발신번호 `01080287565`, 사이트 URL을 설정했습니다. SOLAPI API 키·비밀의 운영 Supabase Secrets 저장과 사업자 측 발신번호 활성화 상태를 확인했습니다. SOLAPI 화면에서 잔액300원·일일 잔여50건을 확인했으나 실제 API 인증·문자 실수신은 미검증이며 SMS 스케줄은 활성화하지 않았습니다. 운영 SQL 조회에서 발송 대기열0건과 pg_cron/pg_net 미설치 상태를 확인했습니다. 설정 부족 시 큐를 소비하기 전에503으로 중단하도록 구현돼 있습니다.
- 수동 배포 준비 단계의 Netlify ZIP은 `output/netlify/sehwa-buddha-academy-20260923T102104Z.zip`입니다. 서버 비밀 미포함·필수 파일·ZIP CRC 검증을 통과했습니다. 당시 수동 준비 빌드 main JS는269,613bytes(gzip85,032)로, 앞의 fixture 성능 측정 빌드와 환경값·최종 자격증 수정 차이가 있습니다.
- 수동 ZIP 업로드는 브라우저 확장 파일 접근 제한으로 완료하지 않았으나, 이후 GitHub `KimSuMin123/bul` 연결로 운영 배포를 완료했습니다. 2026-09-23 20:28 KST에 커밋 `289bb05`가 Published 상태가 되었고 deploy ID는 `6ab3b7f933e4b1d280146acf`입니다. 운영 HTTP200, OG v4 이미지 SHA-256 원본 일치, MP3 HEAD200(29,141,829bytes), 보안·캐시 헤더를 `test_artifacts/netlify/http-verification.json`에서 확인했습니다. 이는 정적 배포 검증이며 관리자 로그인·전체 운영 사용자 흐름 검증을 대체하지 않습니다.
- 관리자 변경은 사용자 직접 입력 후 완료했습니다. `scripts/admin_bootstrap_local.mjs` 결과는 `status=verified`, `changesApplied=true`, `verificationSession=signed-out`입니다. 추가 REST 검사로 유일한 관리자의 canonical ID와 admin 역할 유지, Auth 연결 및 `adsba` 별칭을 확인했습니다. 근거는 `test_artifacts/deployment/admin-verified.json`입니다. 검증 세션은 로그아웃했으며 관리자 비밀번호를 파일·로그에 기록하지 않았습니다.
- 20:18 KST SELECT 백업: `test_artifacts/backups/select-2026-09-23T11-18-26.278Z-275adf37-4102-4819-b9a4-60a69ed1e229.json`, 11테이블79행 내부 저장·격리 복원 PASS, `email=not-configured`. 다음 예약은 2026-09-24 03:00 KST, 보관 기간7일입니다. 전체 Auth/Storage/DB 복원본을 의미하지 않습니다.


### 20:28 KST 연결 설정 보정 및 운영 검증

첫 Git 빌드의 공개 연결값 누락을 실제 화면에서 발견하여 Netlify 환경변수를 생성하고 재배포했습니다. 이후 운영 main JS가 정상 로컬 빌드와 SHA-256까지 같음을 확인했습니다(`test_artifacts/netlify/env-redeploy-verification.json`). 강좌·공지 연결, 음원 재생/일시정지, 가입 동의 기본 해제/내용 펼침/가입 버튼 비활성을 운영 Chrome에서 확인했고, 서버 접근권한10개도 다시 통과했습니다. 전체 회원·신청·Q&A 저장과 실제 SMS/SMTP 발송을 검증한 것은 아닙니다.


### 후속 행사·테스트 수신번호 변경

사용자 요청으로 개원식은 한국 시간 2026-10-01 18:29 이전에는 전체가 숨겨지며 공개 미리보기 버튼도 노출하지 않습니다. 18:29부터 1분 카운트다운, 18:30~18:35 기존 5분 진행, 18:32:55부터 커팅5초 카운트다운, 18:33 리본 커팅·축하 효과를 보여 줍니다. 축하 연꽃은 각 방문자의 화면 내 반응이며 다른 방문자에게 전송하지 않습니다.

`node scripts/test_opening_ceremony.mjs`의 정책·React SSR7개를 통과했습니다. CUA Chrome에서 390×844 모바일 화면, 각 시간 경계, 열린 화면의 자동 노출, 반복 클릭 시 연꽃1개, 종료 안내와 반응 보존을 확인했습니다. 가로 폭375px에서 scrollWidth도375px입니다. 근거는 `test_artifacts/ceremony-fixture/cua-verification.json`이며 로컬 시각 제어 fixture 검증입니다. 운영 기기 시계는 변경하지 않았습니다. 동작 줄이기 CSS는 검토했으며 OS 설정 전환은 수행하지 않았습니다.

시험 경로의 수신자는 사용자 지정 **010-8028-7565 한 번호로 제한**하도록 준비했으며 운영 관리자 수신번호010-4702-0283과 구분했습니다. 이 경로는 승인 후 일시 적용했지만 인증401로 실제 작업 생성·발송에 이르지 못했고, 사용자의 요청으로 원복을 진행했습니다. 아래 원복 상태를 따릅니다.


### 최신 원형 로딩 배포와 SMS 시험 경로 원복

일반·관리자 페이지의 Suspense 대기 화면을 공통 원형 로딩 표시로 변경했습니다. 44px 원형 회전과 스크린리더 전용 상태 문구를 실제 CUA 화면에서 확인했고 production build도 통과했습니다. 고정 지연은 추가하지 않았습니다. 모션 감소 설정에서는 회전을 중지합니다. 행사 변경 커밋28ec5aa는20:42 KST에 Netlify Published(deploy6ab3bb1ba8f45c0008f13bb6) 되었으며 운영 홈에서 행사 영역이 숨겨진 것을 확인했습니다.

기능 변경 커밋 `b8edab0`는 20:49 KST에 Netlify Published 상태가 되었습니다(deploy ID `6ab3bca3cea2680008d15201`). 운영 JS `index-DOKtdqdE.js`와 CSS `index-CrzWf1ed.css`의 해시가 로컬 `dist`와 일치하고 원형 로딩 코드가 포함된 것을 확인했습니다. 원형 로딩과 개원식 변경은 유지합니다.

시험 문자 경로는 지정 UUID 1개·service-role 인증·지정 수신번호 검사로 일반 큐와 분리했고 모의·PGlite 검사10개를 통과했습니다. 이후 사용자 승인으로 DB004와 새 Edge test handler를 운영에 일시 적용했습니다. 그러나 함수 인증이401로 거절됐습니다. 같은 로컬 키의 REST 조회는200이었으며 프로젝트 현재 키를 사용한 관리 화면 시험도401이었습니다. 정확한 인증 거절 원인은 미확정이며 인증 오류는 해결하지 못했습니다. 합성 테스트 작업은 생성하지 않았고 실제 SMS 발송은0건입니다.

사용자 원복 요청에 따라 원래 claim 함수(MD5 `e501b908a0d088ade576191322cffc46`)와 원래 ACL `{postgres=X/postgres,service_role=X/postgres}`을 복원하고 테스트 RPC를 DROP한 뒤 운영 SQL로 확인했습니다. `test_rpc_absent=true`, `outbox_count=0`, `attempt_count=0`, `test_job_count=0`이었습니다.

원본 LIVE Edge 코드를 복원 배포한 뒤 다시 로드한 운영 Code 편집기의 전체 복사본을 사전 확보본과 비교했습니다. 문자열 전체가 동일하며 6,943characters·FNV `0f4c84ba`이고 `operator_test` 경로는 없었습니다. 기준 파일은 `test_artifacts/deployment/sms-rollback/live-before-index.ts`입니다. 새로 읽은 Secrets 목록에서 `LMS_SMS_TEST_PHONE` 제거와 기존 발신번호·SOLAPI 설정 유지를 확인했습니다. 이 원복 검증 근거는 `test_artifacts/deployment/sms-rollback/production-verification.json`입니다. SMS 스케줄러는 미가동이며 실제 수신은 미검증입니다. 기존 브라우저 알림(PWD)은 유지합니다.

이번 문자 변경 전 20:43 KST SELECT 백업은 `test_artifacts/backups/select-2026-09-23T11-43-05.893Z-2881c779-e210-46f4-a8a3-d0434bef585f.json`입니다. 11테이블79행 저장·격리 복원 PASS이며 SMTP 미설정으로 이메일은 발송되지 않았습니다. 이는 SMTP 설정 전의 기록이며 현재 상태는 아래21:41 KST 후속 검증을 따릅니다.


### 21:23 KST 관리자 완료·백업·당시 메일 인증 오류

마지막으로 운영 게시를 확인한 문서 커밋 `d61fd69`는 21:16 KST에 Netlify Published 상태가 되었습니다(deploy ID `6ab3c30271289d0008db263c`). 기능 번들은 앞서 검증한 원형 로딩·개원식 버전과 동일하며 이번 상태 갱신에서 제품 소스는 바꾸지 않았습니다.

관리자 helper의 변경·로그인·권한 검증은 완료됐고 검증 세션도 로그아웃했습니다. 후속 REST 확인에서 유일한 관리자 canonical ID 유지, admin 역할, Auth 연결, `adsba` 별칭이 모두 확인됐습니다. 사용자 관리자 입력 대기는 해소됐습니다.

SMTP helper는 `status=saved`, `mailSent=false`를 반환하여 입력한 앱 비밀번호를 기존 ignored `.env`에 저장했습니다. 이후 예약 작업과 같은 PowerShell runner를 한 번 실행했습니다. 당시 파일 `test_artifacts/backups/select-2026-09-23T12-23-53.387Z-464c397e-b8df-468d-9db0-6867fc1bd52f.json`의 공개11테이블79행 내부 저장과 격리 복원은 PASS였지만 이메일 결과는 `failed`였습니다. 별도 SMTP 로그인만 진단한 결과 `SMTPAuthenticationError 535`였으며 그 진단에서 추가 메일은 보내지 않았습니다. 당시 문제는 설정 누락(`not-configured`)이 아닌 메일 인증 거절이었습니다. 이후21:41 KST에는 아래와 같이 SMTP 인증 문제가 해결됐습니다. 문자 함수 HTTP401은 여전히 미해결입니다.

Windows 예약을 별도로 읽기 검증했습니다. 정확한 이름은 `LMS-Daily-SELECT-Backup`, 활성화·Ready, 매일03:00 KST·7일 보관, 다음 실행은2026-09-24 03:00 KST입니다. 작업은 `powershell.exe`로 `C:\dev\bul\scripts\db_backup_run.ps1`을 실행하며 작업 폴더는 `C:\dev\bul`입니다. runner는 `C:\dev\bul\.env`를 읽어 Node의 `scripts/db_backup_select.mjs`를 실행하고 `test_artifacts/backups`에 저장합니다. SMTP 필수 설정 존재 여부는 true이고 실제 인증 성공을 뜻하지 않습니다. 실행 계정 SID가 현재 사용자와 일치하며 Interactive 로그인 조건, 절전 자동 깨우기 꺼짐, 실행 가능 시 누락분 시작, 중복 실행 무시, 최대1시간으로 설정돼 있습니다. PC가 켜져 있고 해당 사용자가 로그인해 있어야 합니다. 예약 검사의 이전 LastTaskResult1은18:53 시험 실행 기록이며 이번21:23 직접 runner 실행 결과와 구분합니다. 근거는 `test_artifacts/scheduled-task-verification.json`입니다.


### 21:41 KST SMTP 인증 해결·백업 발송 접수 성공

새 앱 비밀번호를 저장한 뒤21:38 KST에도 SMTP535가 발생했습니다. CUA에서 네이버 앱 비밀번호 발급 계정이 `tntn211`과 일치하고 POP3/SMTP 및 IMAP/SMTP가 모두 꺼져 있음을 확인했습니다. 사용자가 직접 POP3/SMTP를 '사용함'으로 저장했고 다시 로드한 화면의 접근성 트리에서 사용함=1을 확인했습니다.

그 후 예약 작업과 같은 PowerShell runner를 한 번 더 실행하여21:41 KST에 `exit0`, `status=saved`, `email=sent`를 확인했습니다. 최신 백업은 `test_artifacts/backups/select-2026-09-23T12-41-51.263Z-52c4735d-2b84-440a-b7e7-1987c205c5ea.json`, 공개11테이블79행입니다. 동일 파일의 격리 복원도11테이블79행 PASS이며 파일 옆 `.restore-report.json`에 결과를 보관했습니다. SMTP 인증과 발송 접수는 성공했고 메일535 문제는 해결됐습니다. 받은편지함의 실제 도착은 직접 확인하지 않았으므로 사용자 확인이 별도로 필요합니다.

관리자 `adsba` 변경 완료, 문자401 미해결·임시 설정 원복·SMS 스케줄 미가동 상태는 그대로입니다. 이 시점에는 일일 백업03:00 KST·7일 보관과 PC 켜짐·사용자 로그인 조건을 유지했습니다. 아래 후속 Netlify 이전이 현재 상태입니다. 메일 성공을 문자 성공으로 표시하지 않습니다.

### 22:23 KST Netlify 백업 이전·관리자 로그인 재검증

- 변경 전21:58 KST 최신 SELECT 백업11테이블79행과 격리 복원을 확인했습니다. 파일은 `test_artifacts/backups/select-2026-09-23T12-58-04.826Z-ebb59835-4b9f-4db1-89e9-733b5dba70cb.json`입니다.
- 사용자가 `adsba` 로그인 오류를 보고하여 운영 연결을 다시 확인했습니다. `users.id=admin`, `login_id=adsba`, admin 역할과 Auth 연결은 정상입니다. 기존 회원 ID는 관계 보존을 위해 유지하며 `password=NULL`은 Supabase Auth 전환 후 정상입니다. 사용자가 일회성 폼에서 새 비밀번호를 직접 제출했고 anon 인증 경로 로그인·관리자 RPC 검증을 통과했습니다.22:02 KST 후속 REST 확인도 모두 true였고 이후 실제 브라우저의 `#admin` CMS 진입을 확인했습니다. 과거 입력과의 비밀번호 불일치 원인 자체는 추정하지 않습니다.
- 관리자 회원목록 API에 `loginId`를 추가하고 화면·검색·모달에 로그인 별칭을 표시했습니다. 숫자가 없는 검색어가 전화번호의 빈 문자열과 일치해 모든 회원을 보여 주던 문제도 수정했습니다. 삭제·권한·비밀번호 변경 API는 기존 불변 ID를 유지합니다.
- 기능 커밋 `319798b`, 운영 배포 `6ab3d082625ba6a0acfe815c`를 확인했습니다. 운영 메인·관리자 JS 해시가 로컬 빌드와 같습니다. 최초 배포는 공개 설정을 secret으로 함께 등록해 비밀 검사 오탐으로 중단됐습니다. 공개 주소·메일 설정5개만 검사 예외로 지정한 후 재배포에서 비밀 검사 통과를 확인했습니다. 서버 키·SMTP 앱 비밀번호와 전체 비밀 검사는 유지합니다.
- `daily-db-backup`은 운영 Scheduled 표시, cron `0 18 * * *`, 다음2026-09-24 03:00 GMT+9를 확인했습니다. 공개 URL GET·POST는 모두403으로 실행이 차단됐습니다.
- 22:16 KST Netlify **Run now** 실제 실행:7,372.27ms, `status=saved`, `email=sent`, `storageVerified=true`,11테이블79행. 수신처는 `tntn211@naver.com`, 저장소는 private site-wide Blobs `lms-private-select-backups`, 보관 기간7일입니다. SMTP 접수 성공이며 받은편지함 도착은 직접 열어 확인하지 않았습니다.
- 실제 저장 파일 `snapshots/2026-09-23/5185e880-a00e-4212-9e09-c80350579ae7.json`을 관리자 Blobs 화면에서 열어 로컬로 전달했습니다. SHA-256 `a768269fc458b13837ec1706b214e9624cc77ab04dfe9489b7d7c3056b73b027` 일치를 확인하고 격리 복원11테이블79행 PASS를 확인했습니다. 로컬 파일은 `test_artifacts/backups/netlify-2026-09-23-5185e880-a00e-4212-9e09-c80350579ae7.json`입니다.
- 검증 완료 후22:22 KST Windows `LMS-Daily-SELECT-Backup`을 Disabled로 전환했습니다. 복구용 기존 설정은 `test_artifacts/deployment/windows-backup-task-before-cloud.xml`에 보관했습니다. PC가 꺼져 있어도 Netlify 예약은 동작하도록 설정됐으며 첫03:00 자동 실행은 아직 관찰하지 않았습니다.
- 22:24 KST 같은 날짜의 **Run now**를 다시 실행하여 `status=skipped`, `reason=already-attempted-today`,492.46ms를 확인했습니다. 실제 운영에서도 같은 날 중복 백업 메일 발송을 건너뛰었습니다.
- 최종 로컬 검증: 클라우드 백업 모의21개, 기존 운영 회귀19개, Auth13개·SQL/RLS15개, API88개, 관리자 화면 회귀40개 통과, production build 성공. 실제 백업 복원·공개 함수 접근 차단은 위와 별도로 운영에서 검증했습니다.

이번 작업은 DB 스키마를 변경하지 않았습니다. 백업 중단·재처리·로컬 예약 복구는 [Netlify 백업 안내](cloud-backup.md)를 따릅니다. 요청한 SELECT 결과 형식이므로 Auth 자격증명·Storage 객체·DDL을 포함하는 전체 복구본은 아닙니다. SMTP 장애나 시간 부족으로 오래된 파일 정리가 미뤄질 수 있습니다. SMS 인증401·시험 원복 상태는 이번 작업에서 변경하지 않았습니다.
