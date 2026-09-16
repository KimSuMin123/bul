import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = path.resolve('.');
const ASSETS_DIR = path.join(ROOT_DIR, 'manual_assets');
const OUT_HTML = path.join(ROOT_DIR, '세화붓다아카데미_매뉴얼_프레젠테이션.html');
const OUT_PDF = path.join(ROOT_DIR, '세화붓다아카데미_공식_사용자_매뉴얼.pdf');

function getBase64(relPath) {
  const full = path.join(ASSETS_DIR, relPath);
  if (!fs.existsSync(full)) {
    console.warn('File not found:', full);
    return '';
  }
  const ext = path.extname(relPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const data = fs.readFileSync(full).toString('base64');
  return `data:${mime};base64,${data}`;
}

console.log('Encoding captured assets to base64 for standalone HTML/PDF...');

const img = {
  // PC
  pcHero: getBase64('pc/01_home_hero.png'),
  pcCourses: getBase64('pc/02_home_courses.png'),
  pcFooter: getBase64('pc/04_home_footer.png'),
  pcRegister: getBase64('pc/05_register_page.png'),
  pcLogin: getBase64('pc/06_login_page.png'),
  pcFindPw: getBase64('pc/07_find_password_modal.png'),
  pcCourseDetail: getBase64('pc/08_course_detail.png'),
  pcVerify: getBase64('pc/09_certificate_verify_page.png'),
  pcDash: getBase64('pc/10_dashboard_page.png'),
  pcWatch: getBase64('pc/11_watch_video_player.png'),
  pcQa: getBase64('pc/12_watch_qa_board.png'),
  pcAdminStudents: getBase64('pc/13_admin_students_tab.png'),
  pcAdminPayments: getBase64('pc/14_admin_payment_ledger.png'),
  pcAdminQa: getBase64('pc/16_admin_qa_management.png'),
  pcAdminCerts: getBase64('pc/17_admin_certificates_tab.png'),

  // Mobile Large & Small
  mobLargeHero: getBase64('mobile_large/01_home_hero.png'),
  mobSmallHero: getBase64('mobile_small/01_home_hero.png'),
  mobLargeDash: getBase64('mobile_large/10_dashboard_page.png'),
  mobSmallDash: getBase64('mobile_small/10_dashboard_page.png'),

  // Modals
  modalApplySuccess: getBase64('modals/modal_01_success_apply.png'),
  modalLockWarning: getBase64('modals/modal_02_warning_lock.png'),
  modalDownloadInfo: getBase64('modals/modal_03_info_download.png'),
  modalAuthError: getBase64('modals/modal_04_error_alert.png'),
  modalPayConfirm: getBase64('modals/modal_05_confirm_payment.png'),
  modalDeleteConfirm: getBase64('modals/modal_06_confirm_delete.png'),
  modalCert: getBase64('modals/modal_07_certificate_preview.png'),
  modalExamIntro: getBase64('modals/modal_08_exam_intro.png'),
  modalExamTaking: getBase64('modals/modal_09_exam_taking.png'),
  modalExamResult: getBase64('modals/modal_10_exam_result_passed.png'),
  modalAdminResetPw: getBase64('modals/modal_11_admin_reset_password.png'),
  modalAdminExamConfig: getBase64('modals/modal_12_admin_exam_config.png')
};

const htmlTemplate = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>세화붓다아카데미 공식 사용자 및 관리자 매뉴얼 (PPT & PDF)</title>
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-sage: #2D4A3E;
      --color-gold: #C5A880;
      --color-gold-dark: #8C6D37;
      --color-bg: #FAF8F5;
      --color-card-bg: #FFFFFF;
      --color-charcoal: #1E293B;
      --color-muted: #64748B;
      --color-border: #E2E8F0;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Pretendard', sans-serif;
      background-color: #1E293B;
      color: var(--color-charcoal);
      line-height: 1.6;
    }

    /* Top Mode Switcher Bar (Hidden in Print) */
    .top-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 54px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      color: #FFFFFF;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .toolbar-title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.2px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toolbar-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .tool-btn {
      background: #334155;
      color: #FFFFFF;
      border: 1px solid #475569;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tool-btn:hover { background: #475569; }
    .tool-btn.active {
      background: var(--color-gold);
      color: #0F172A;
      border-color: var(--color-gold);
    }

    /* Slides Container */
    .presentation-container {
      max-width: 1280px;
      margin: 70px auto 40px auto;
      padding: 20px;
    }

    .slide-page {
      background: #FFFFFF;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      margin-bottom: 40px;
      padding: 46px 50px;
      position: relative;
      page-break-after: always;
    }

    .slide-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #F1F5F9;
      padding-bottom: 18px;
      margin-bottom: 26px;
    }
    .slide-title-area {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .slide-num {
      font-family: 'Noto Serif KR', serif;
      font-size: 22px;
      font-weight: 900;
      color: var(--color-gold-dark);
    }
    .slide-title {
      font-family: 'Noto Serif KR', serif;
      font-size: 24px;
      font-weight: 700;
      color: var(--color-sage);
      letter-spacing: -0.5px;
    }
    .slide-category {
      font-size: 12.5px;
      font-weight: 600;
      color: #64748B;
      background: #F8FAFC;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid #E2E8F0;
    }

    .slide-body {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 28px;
      align-items: start;
    }
    .slide-body.single-col {
      grid-template-columns: 1fr;
    }

    .slide-text {
      font-size: 14.5px;
      color: #334155;
      line-height: 1.7;
    }
    .slide-text p {
      margin-bottom: 12px;
    }
    .highlight-box {
      background: #FAF8F5;
      border-left: 4px solid var(--color-gold);
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
      font-size: 13.5px;
    }
    .spec-list {
      list-style: none;
      margin: 14px 0;
    }
    .spec-list li {
      position: relative;
      padding-left: 18px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .spec-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: var(--color-gold-dark);
      font-weight: bold;
      font-size: 18px;
      line-height: 1;
    }

    .image-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .image-card img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }
    .image-caption {
      padding: 10px 14px;
      font-size: 12px;
      color: #64748B;
      background: #FFFFFF;
      border-top: 1px solid #F1F5F9;
      text-align: center;
      font-weight: 500;
    }

    .responsive-compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
    }

    .modal-grid-2x2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    /* Print / PDF Mode Styling */
    @media print {
      body {
        background: #FFFFFF !important;
        color: #000000 !important;
      }
      .top-toolbar { display: none !important; }
      .presentation-container {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      .slide-page {
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 10mm 12mm !important;
        margin-bottom: 0 !important;
        page-break-after: always !important;
      }
      @page {
        size: A4 portrait;
        margin: 10mm 10mm 10mm 10mm;
      }
    }
  </style>
</head>
<body>

  <!-- Top Controls -->
  <div class="top-toolbar">
    <div class="toolbar-title">
      <span>🪷</span>
      <span>세화붓다아카데미 공식 사용자 및 관리자 통합 매뉴얼</span>
    </div>
    <div class="toolbar-controls">
      <button class="tool-btn" onclick="window.print()">🖨️ PDF / 인쇄 저장 (Ctrl+P)</button>
    </div>
  </div>

  <div class="presentation-container">

    <!-- Slide 1: Cover -->
    <section class="slide-page" style="text-align: center; padding: 90px 40px;">
      <div style="font-size: 40px; margin-bottom: 16px;">🪷</div>
      <div style="color: var(--color-gold-dark); font-weight: 700; letter-spacing: 2px; font-size: 15px; margin-bottom: 12px;">사단법인 세화붓다아카데미 공식 발간</div>
      <h1 style="font-family: 'Noto Serif KR', serif; font-size: 36px; color: var(--color-sage); margin-bottom: 18px; line-height: 1.3;">
        온라인 교육 플랫폼<br>사용자 및 교학처 관리자 종합 매뉴얼
      </h1>
      <p style="color: #64748B; font-size: 16px; max-width: 600px; margin: 0 auto 36px auto;">
        불교 인문학 및 전통 승가 의례 전문 VOD 원격 학습, 3종 디바이스 반응형 환경, 자격 검정 온라인 시험 및 정품 공인 수료증 발급 학사 가이드
      </p>
      <div style="display: inline-block; background: #FAF8F5; border: 1px solid #E2E8F0; padding: 14px 28px; border-radius: 12px; font-size: 14px; text-align: left;">
        <div><strong>공식 서비스 주소</strong>: https://sehwa-buddha-academy.netlify.app</div>
        <div><strong>시스템 구성</strong>: Pure Cloud DB 연동, 1080p 고화질 스트리밍, 대면 수납 전자 장부</div>
        <div><strong>인증 체계</strong>: 20문항 무작위 출제 시험 및 고유 시리얼 번호 정품 인증 (#verify)</div>
      </div>
    </section>

    <!-- Slide 2: Platform Overview & Multi-device -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">01</span>
          <h2 class="slide-title">플랫폼 개요 및 3대 디바이스 반응형 환경</h2>
        </div>
        <span class="slide-category">시스템 아키텍처</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>사단법인 세화붓다아카데미</strong>는 시공간의 제약 없이 정통 불교 승가 의례의 법식과 교학을 배우는 전문 온라인 배움터입니다.</p>
          <div class="highlight-box">
            <strong>반응형 3대 뷰포트 완벽 대응</strong>:
            <ul class="spec-list">
              <li><strong>PC 데스크톱 (1440×900)</strong>: 와이드 시네마틱 VOD 플레이어와 종합 관리자 CMS에 최적화</li>
              <li><strong>대형 스마트폰 (430×932 / iPhone 14 Pro Max)</strong>: 유연한 단일 컬럼 및 제스처 터치 레이아웃</li>
              <li><strong>소형 스마트폰 (375×667 / iPhone SE)</strong>: 한 손 조작과 핵심 버튼 가독성에 최적화된 콤팩트 뷰</li>
            </ul>
          </div>
          <p>모든 브라우저의 기본 alert 경고창을 제거하고, 세련된 그린/골드 톤의 <strong>커스텀 모달 알림창</strong>으로 100% 통합 적용되었습니다.</p>
        </div>
        <div class="image-card">
          <img src="${img.pcHero}" alt="PC 메인 홈 화면">
          <div class="image-caption">데스크톱 와이드 해상도 메인 홈 화면 및 헤더 GNB</div>
        </div>
      </div>
    </section>

    <!-- Slide 3: Multi-Device Responsive Comparison -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">02</span>
          <h2 class="slide-title">디바이스별 최적화 화면 (대형폰 / 소형폰)</h2>
        </div>
        <span class="slide-category">모바일 인터페이스</span>
      </div>
      <div class="slide-body single-col">
        <div class="responsive-compare-grid">
          <div class="image-card">
            <img src="${img.mobLargeHero}" alt="대형 모바일 홈">
            <div class="image-caption">대형 스마트폰 (430×932)<br>히어로 및 원터치 수강 신청</div>
          </div>
          <div class="image-card">
            <img src="${img.mobSmallHero}" alt="소형 모바일 홈">
            <div class="image-caption">소형 스마트폰 (375×667)<br>한 손 조작 맞춤 콤팩트 레이아웃</div>
          </div>
          <div class="image-card">
            <img src="${img.mobLargeDash}" alt="모바일 강의실">
            <div class="image-caption">모바일 내 강의실<br>진도율 및 잔여 수강일 D-Day 확인</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 4: Register & Login -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">03</span>
          <h2 class="slide-title">회원가입, 로그인 및 비밀번호 재설정</h2>
        </div>
        <span class="slide-category">계정 및 보안 관리</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>3.1 엄격한 계정 보안 규칙</strong></p>
          <ul class="spec-list">
            <li><strong>비밀번호 규칙</strong>: 영문, 숫자, 특수문자 중 2가지 이상 조합하여 8자 이상 설정 (실시간 유효성 피드백)</li>
            <li><strong>실명/법명 기재</strong>: 수료증에 정식 날인되므로 본인의 법명 또는 실명을 정확히 입력</li>
            <li><strong>학번 자동 부여</strong>: 가입 완료 즉시 <code>BUDDHA-2026-XXXXX</code> 형태의 평생 식별 번호가 부여됩니다.</li>
          </ul>
          <div class="highlight-box">
            <strong>비밀번호 분실 시</strong>: 로그인 창의 [비밀번호 찾기]를 통해 아이디, 성명, 연락처 3중 검증 후 본인이 직접 새 비밀번호로 안전하게 재설정할 수 있습니다.
          </div>
        </div>
        <div>
          <div class="image-card" style="margin-bottom: 12px;">
            <img src="${img.pcRegister}" alt="회원가입 화면">
            <div class="image-caption">회원가입 양식 및 실시간 보안 검증</div>
          </div>
          <div class="image-card">
            <img src="${img.pcFindPw}" alt="비밀번호 찾기 모달">
            <div class="image-caption">비밀번호 찾기 및 즉시 재설정 모달</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 5: Course Detail & Enrollment (50,000 KRW) -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">04</span>
          <h2 class="slide-title">강좌 안내 및 수강 신청 (대면 수납 접수)</h2>
        </div>
        <span class="slide-category">수강 등록 절차</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>4.1 과목당 50,000원 대면 수납 체계</strong></p>
          <ul class="spec-list">
            <li><strong>강좌 상세 페이지</strong>: 커리큘럼, 교수진 프로필, 차시 목록(1강~4강), 90일 수강 인정 기간 확인</li>
            <li><strong>수강 신청 버튼 클릭</strong>: 누르면 세화붓다아카데미 전용 [수강 신청 접수 완료] 모달이 팝업됩니다.</li>
            <li><strong>대기상태 (pending)</strong>: 온라인에서는 대기상태로 우선 접수되며, 교학처(02-2260-8888)에 방문하여 수납을 완료하면 관리자 승인을 통해 즉시 [수강 중]으로 전환됩니다.</li>
          </ul>
        </div>
        <div>
          <div class="image-card" style="margin-bottom: 12px;">
            <img src="${img.pcCourseDetail}" alt="강좌 상세 페이지">
            <div class="image-caption">강좌 상세 안내 및 차시 목록</div>
          </div>
          <div class="image-card">
            <img src="${img.modalApplySuccess}" alt="수강 신청 완료 모달">
            <div class="image-caption">수강 신청 접수 완료 모달 알림창</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 6: Student Dashboard -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">05</span>
          <h2 class="slide-title">나의 강의실 (학습 대시보드)</h2>
        </div>
        <span class="slide-category">학습 진도 관리</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>5.1 개인 맞춤형 학사 대시보드</strong></p>
          <ul class="spec-list">
            <li><strong>수강 중인 강좌</strong>: 전체 차시 대비 현재 달성 진도율(%) 프로그레스 바와 잔여 수강일 D-Day 안내</li>
            <li><strong>학습 이어하기</strong>: [강의실 입장 ▶] 버튼을 누르면 이전에 시청하던 마지막 초 단위 지점부터 자동 재생</li>
            <li><strong>자격 시험 응시 버튼</strong>: 모든 차시를 100% 완강하면 [📝 자격 검정 시험 응시하기] 버튼이 활성화됩니다.</li>
          </ul>
        </div>
        <div class="image-card">
          <img src="${img.pcDash}" alt="나의 강의실">
          <div class="image-caption">학인 전용 배움터 (진도율, D-Day, 시험 응시 연동)</div>
        </div>
      </div>
    </section>

    <!-- Slide 7: Video Player & Sequential Lock -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">06</span>
          <h2 class="slide-title">스마트 VOD 플레이어 및 순차 학습 시스템</h2>
        </div>
        <span class="slide-category">동영상 강의실</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>6.1 1080p 고화질 스트리밍 및 순차 잠금</strong></p>
          <ul class="spec-list">
            <li><strong>초 단위 이어보기</strong>: 학습 진도가 실시간 동기화되어 중단된 지점부터 끊김 없이 학습</li>
            <li><strong>교안 자료 다운로드</strong>: 차시별 실무 의례 교안 PDF 원클릭 다운로드</li>
            <li><strong>단계별 순차 학습 제한</strong>: 이전 차시를 100% 완강하기 전에는 다음 차시가 자동으로 잠기며, 클릭 시 [순차 학습 제한] 모달이 안내됩니다.</li>
          </ul>
        </div>
        <div>
          <div class="image-card" style="margin-bottom: 12px;">
            <img src="${img.pcWatch}" alt="동영상 플레이어">
            <div class="image-caption">1080p 고화질 스트리밍 플레이어 및 차시 목록</div>
          </div>
          <div class="image-card">
            <img src="${img.modalLockWarning}" alt="순차 학습 잠금 모달">
            <div class="image-caption">순차 학습 제한 모달 알림창</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 8: Q&A Board with Timestamp -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">07</span>
          <h2 class="slide-title">학습 질의응답 (Q&A 타임스탬프 연동)</h2>
        </div>
        <span class="slide-category">지도 스님 법문 답변</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>7.1 영상 연동 스마트 Q&A</strong></p>
          <ul class="spec-list">
            <li><strong>비디오 타임스탬프 자동 태그</strong>: 질문 작성 시 현재 시청 중인 시간(예: 15:42)이 질문과 함께 등록되며, 클릭 시 해당 장면으로 즉시 이동합니다.</li>
            <li><strong>스님 명의의 공식 답변</strong>: 담당 교수 스님 및 원장 스님의 인증 배지가 부착된 정갈한 답변이 제공됩니다.</li>
            <li><strong>비밀글 옵션</strong>: 개인적인 질문은 본인과 관리자만 열람할 수 있습니다.</li>
          </ul>
        </div>
        <div class="image-card">
          <img src="${img.pcQa}" alt="Q&A 게시판">
          <div class="image-caption">타임스탬프 연동 Q&A 및 스님 공식 답변 화면</div>
        </div>
      </div>
    </section>

    <!-- Slide 9: Online Examination -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">08</span>
          <h2 class="slide-title">자격 검정 온라인 시험 (20문항 실시간 응시)</h2>
        </div>
        <span class="slide-category">자격 검정 평가</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>8.1 엄정한 온라인 검정 시스템</strong></p>
          <ul class="spec-list">
            <li><strong>출제 방식</strong>: 강좌별 문제 은행에서 <strong>20문항이 무작위(Random)로 추출</strong>되어 출제</li>
            <li><strong>합격 기준</strong>: 100점 만점 중 <strong>60점 이상 (12문항 이상 정답)</strong> 취득 시 최종 합격</li>
            <li><strong>실시간 자동 채점</strong>: 답안 제출 즉시 채점 결과와 점수가 투명하게 공개됩니다.</li>
          </ul>
        </div>
        <div>
          <div class="image-card" style="margin-bottom: 12px;">
            <img src="${img.modalExamTaking}" alt="시험 응시 화면">
            <div class="image-caption">20문항 실시간 온라인 시험 응시 화면</div>
          </div>
          <div class="image-card">
            <img src="${img.modalExamResult}" alt="시험 합격 모달">
            <div class="image-caption">시험 채점 결과 및 합격 축하 모달</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 10: Certificate Issuance & Verification -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">09</span>
          <h2 class="slide-title">공인 자격증 발급 및 진위 확인 포털</h2>
        </div>
        <span class="slide-category">정품 자격증 검증</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>9.1 A4 단일 규격 정품 자격증</strong></p>
          <ul class="spec-list">
            <li><strong>위조 방지 시리얼</strong>: 모든 자격증에는 고유 인증 시리얼 번호와 실시간 QR코드가 인쇄됩니다.</li>
            <li><strong>PDF 인쇄 지원</strong>: [A4 규격 인쇄 / PDF 저장] 버튼으로 고해상도 출력 가능</li>
            <li><strong>정품 인증 포털 (#verify)</strong>: 자격증 번호를 입력하면 문체부 등록 정보와 정품 여부가 즉시 공인 조회됩니다.</li>
          </ul>
        </div>
        <div>
          <div class="image-card" style="margin-bottom: 12px;">
            <img src="${img.modalCert}" alt="공인 수료증">
            <div class="image-caption">세화붓다아카데미 정식 공인 자격증 A4 규격</div>
          </div>
          <div class="image-card">
            <img src="${img.pcVerify}" alt="자격증 진위 확인">
            <div class="image-caption">자격증 진위 확인 및 정품 인증 포털 (#verify)</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 11: Admin CMS Overview -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">10</span>
          <h2 class="slide-title">교학처 관리자 통합 시스템 (수강생 & 수납 장부)</h2>
        </div>
        <span class="slide-category">교학처 관리자 패널</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>10.1 수강생 관리 및 대면 수납 승인</strong></p>
          <ul class="spec-list">
            <li><strong>수강생 관리</strong>: 회원 명부 조회, 학번 검색, 임시 비밀번호 원클릭 초기화, 수강 권한 수동 부여</li>
            <li><strong>대면 수납 승인 장부</strong>: 교학처 방문 수납 대기자(pending) 목록을 확인하고, 클릭 한 번으로 수납을 승인하여 장부에 기록하고 수강을 개시합니다.</li>
          </ul>
        </div>
        <div>
          <div class="image-card" style="margin-bottom: 12px;">
            <img src="${img.pcAdminStudents}" alt="수강생 관리">
            <div class="image-caption">수강생 명부 및 계정 관리</div>
          </div>
          <div class="image-card">
            <img src="${img.pcAdminPayments}" alt="대면 수납 장부">
            <div class="image-caption">대면 수납 대기 승인 및 공식 수납 장부</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Slide 12: Admin CMS Course & Exam Configuration -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">11</span>
          <h2 class="slide-title">교학처 관리자 CMS (강좌 개설 & 시험 문제 설정)</h2>
        </div>
        <span class="slide-category">콘텐츠 관리 시스템</span>
      </div>
      <div class="slide-body">
        <div class="slide-text">
          <p><strong>11.1 강좌 개설, 1080p 영상 업로드 및 시험 문제 등록</strong></p>
          <ul class="spec-list">
            <li><strong>새 코스 개설</strong>: 강좌 기본 정보, 수강료 50,000원, 자격증 번호 양식 및 문항 텍스트 입력 시 자동 파싱</li>
            <li><strong>영상 원클릭 최적화</strong>: 1080p 고화질 동영상 파일을 선택하면 브라우저에서 자동 압축 후 클라우드 스토리지로 직접 업로드</li>
            <li><strong>순차 학습 토글</strong>: 관리자가 코스별 순차 학습 온/오프를 원클릭으로 제어 가능</li>
          </ul>
        </div>
        <div class="image-card">
          <img src="${img.modalAdminExamConfig}" alt="코스 및 시험 설정 모달">
          <div class="image-caption">자격증 종목 및 시험 20문항 파싱 설정 화면</div>
        </div>
      </div>
    </section>

    <!-- Slide 13: Full Modal Catalog -->
    <section class="slide-page">
      <div class="slide-header">
        <div class="slide-title-area">
          <span class="slide-num">12</span>
          <h2 class="slide-title">시스템 전수 모달 알림창(Modal Alert) 도감</h2>
        </div>
        <span class="slide-category">UI 컴포넌트 도감</span>
      </div>
      <div class="slide-body single-col">
        <div class="modal-grid-2x2">
          <div class="image-card">
            <img src="${img.modalApplySuccess}" alt="성공 모달">
            <div class="image-caption">[성공] 수강 신청 접수 완료 모달</div>
          </div>
          <div class="image-card">
            <img src="${img.modalLockWarning}" alt="경고 모달">
            <div class="image-caption">[경고] 순차 학습 잠금 안내 모달</div>
          </div>
          <div class="image-card">
            <img src="${img.modalPayConfirm}" alt="컨펌 모달">
            <div class="image-caption">[컨펌] 대면 수납 승인 확인 모달</div>
          </div>
          <div class="image-card">
            <img src="${img.modalAdminResetPw}" alt="비번 초기화 모달">
            <div class="image-caption">[알림] 관리자 비밀번호 초기화 완료 모달</div>
          </div>
        </div>
      </div>
    </section>

  </div>

</body>
</html>
`;

console.log('Writing comprehensive HTML presentation manual...');
fs.writeFileSync(OUT_HTML, htmlTemplate, 'utf-8');
console.log('HTML manual written to:', OUT_HTML);

async function generatePdf() {
  console.log('Launching headless Chrome to render final PDF manual...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    const fileUrl = 'file:///' + OUT_HTML.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Generating A4 vector PDF...');
    await page.pdf({
      path: OUT_PDF,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    console.log('🎉 PDF successfully generated at:', OUT_PDF);
  } finally {
    await browser.close();
  }
}

generatePdf().catch(console.error);
