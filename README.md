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

Netlify 프로젝트 `sehwa-buddha-academy`는 GitHub `KimSuMin123/bul`의 `feat/minhyeok` 브랜치에 연결되어 있습니다. 빌드 명령은 `npm run build`, 게시 디렉터리는 `dist`입니다. 공개 Supabase URL·anon 환경 변수만 Netlify에 설정했습니다.

20:49 KST에 커밋 `b8edab0`가 Published 상태가 되었습니다(deploy ID `6ab3bca3cea2680008d15201`). 운영 `index-DOKtdqdE.js`·`index-CrzWf1ed.css`는 로컬 `dist`와 해시가 같으며 원형 로딩 표시 코드가 포함되어 있습니다. 개원식은 10월 1일 18:29부터 표시되고 18:30~18:35에 진행됩니다. 원형 로딩과 개원식 변경은 유지합니다.

문자 시험 경로는 사용자 승인 후 일시 적용했지만 함수 인증이 401로 거절됐습니다. 로컬 키의 REST 조회는 200이었고 프로젝트 현재 키의 관리 화면 시험도 401이었습니다. 정확한 인증 거절 원인은 미확정이며 합성 테스트 작업도 생성하지 않았고 실제 SMS 발송은 0건입니다. 사용자 요청에 따라 원래 DB claim 함수·ACL과 원본 LIVE Edge 코드를 복원했고 테스트 RPC와 `LMS_SMS_TEST_PHONE`을 제거한 것을 확인했습니다. 운영 outbox·발송 시도·테스트 작업은 모두 0건입니다. 발신번호와 SOLAPI 설정은 유지합니다. 근거는 `test_artifacts/deployment/sms-rollback/production-verification.json`입니다.

SMS 스케줄러는 가동하지 않았고 실제 수신도 미검증입니다. 기존 브라우저 알림(PWD)은 유지합니다. 관리자 비밀번호와 SMTP 앱 비밀번호는 15분 일회성 입력창을 다시 열고 사용자 입력을 기다리고 있으며 설정 완료로 표시하지 않습니다.

일일 SELECT 백업은 03:00 KST·7일 보관으로 Windows에 예약되어 있습니다. 20:43 KST 사전 백업은 공개 11테이블79행의 격리 복원 PASS이며 SMTP 미설정으로 이메일은 발송하지 못했습니다. SELECT 백업은 전체 Auth·Storage·DB 복원본이 아닙니다.

## 상세 문서

- [구현·검증·배포 보고](docs/enhancement-report-2026-09-23.md)
- [운영·백업 도구](docs/operations-enhancements.md)
- [보안 전환](docs/security-migration.md)
- [문자 worker](supabase/functions/lms-sms/README.md)

운영에 이미 적용한 SQL을 다시 실행하거나 `database_setup.sql`로 초기화하지 마세요. 변경 전 백업 범위와 복구 절차를 확인해야 합니다. 로컬 단위·모의 검증은 `npm test`, 개선 기능 검증은 `npm run test:enhancements`, 행사 경계 검증은 `node scripts/test_opening_ceremony.mjs`로 실행합니다. 모의 SMS/SMTP 결과는 실제 발송 성공을 뜻하지 않습니다.
