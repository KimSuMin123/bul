import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const IMG_DIR = 'c:\\Users\\sehyeon\\OneDrive - kyonggi.ac.kr\\문서\\불교\\이미지';
const OUT_PDF = 'c:\\Users\\sehyeon\\OneDrive - kyonggi.ac.kr\\문서\\불교\\원각_불교_아카데미_공식_사용자_매뉴얼.pdf';
const OUT_HTML = 'c:\\Users\\sehyeon\\OneDrive - kyonggi.ac.kr\\문서\\불교\\사용자_매뉴얼.html';

function getImgBase64(fileName) {
  const filePath = path.join(IMG_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn('Image not found:', filePath);
    return '';
  }
  const ext = path.extname(fileName).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

console.log('Loading all images as base64 data URLs...');
const imgs = {
  main1: getImgBase64('main1.png'),
  main2: getImgBase64('main2.png'),
  main3: getImgBase64('main3.png'),
  register: getImgBase64('회원가입.png'),
  registerDone: getImgBase64('가입 완료.png'),
  login: getImgBase64('로그인.png'),
  resetPw: getImgBase64('비밀번호 재설정.png'),
  loginPreDash: getImgBase64('로그인 전  내 강의실.png'),
  courseDetail: getImgBase64('수강하지 않는 강의 상세 보기 클릭시.png'),
  dashFirst: getImgBase64('로그인 완료시 가의실.png'),
  classroom3State: getImgBase64('강의실.png'),
  player: getImgBase64('강의 화면.png'),
  cert: getImgBase64('수료증 발급.png'),
  qna: getImgBase64('QNA.png'),
  adminUsers: getImgBase64('수강생 관리.png'),
  adminNewUser: getImgBase64('관리자 학생 등록.png'),
  adminNewUserDone: getImgBase64('회원 계정 등록 성공시.png'),
  adminResetPw: getImgBase64('관리자가 비번 초기화.png'),
  adminPaymentLedger: getImgBase64('대면 납부관리.png'),
  adminPaymentConfirm: getImgBase64('대면 납부관리 확인.png'),
  adminCms: getImgBase64('컨텐츠 관리.png'),
  adminNewCourse: getImgBase64('새 코스 추가.png'),
  adminNewLecture: getImgBase64('새 영상 추가.png'),
  adminCerts: getImgBase64('수료증 발급 관리.png')
};

console.log('Building consolidated HTML manual with strict page-break control...');

const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>원각 불교 아카데미 온라인 교육 플랫폼 공식 사용자 매뉴얼</title>
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Pretendard', sans-serif;
        font-size: 8.5pt;
        color: #888888;
      }
      @bottom-left {
        content: "대한불교 원각학술원 원각 불교 아카데미 공식 매뉴얼";
        font-family: 'Pretendard', sans-serif;
        font-size: 8pt;
        color: #888888;
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
      color: #1E2022;
      background: #FFFFFF;
      line-height: 1.55;
      font-size: 9.5pt;
      word-break: keep-all;
    }

    .font-serif {
      font-family: 'Noto Serif KR', serif;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    /* Cover Page */
    .cover-page {
      height: 255mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      padding: 15mm 8mm;
      background: linear-gradient(180deg, #F9FAF8 0%, #FFFFFF 60%, #F5F7F5 100%);
      border: 1px solid #E2E8F0;
      border-radius: 8px;
    }

    .cover-badge {
      display: inline-block;
      padding: 5px 14px;
      background: #3B5249;
      color: #FFFFFF;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      border-radius: 20px;
      margin-bottom: 8mm;
    }

    .cover-emblem {
      width: 60px;
      height: 60px;
      margin: 0 auto 6mm auto;
    }

    .cover-title {
      font-size: 26pt;
      font-weight: 900;
      color: #3B5249;
      line-height: 1.25;
      letter-spacing: -0.02em;
      margin-bottom: 4mm;
    }

    .cover-subtitle {
      font-size: 12pt;
      color: #D49B4B;
      font-weight: 700;
      margin-bottom: 8mm;
    }

    .cover-desc {
      font-size: 10pt;
      color: #555555;
      line-height: 1.7;
      max-width: 140mm;
      margin: 0 auto;
    }

    .cover-divider {
      width: 70mm;
      height: 2px;
      background: linear-gradient(90deg, transparent, #D49B4B, transparent);
      margin: 10mm auto;
    }

    .cover-meta {
      font-size: 9pt;
      color: #777777;
      line-height: 1.7;
    }

    .cover-meta strong {
      color: #3B5249;
    }

    /* Section Headers */
    .part-divider {
      background: #3B5249;
      color: #FFFFFF;
      padding: 14px 18px;
      border-radius: 8px;
      margin: 6mm 0 4mm 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      page-break-after: avoid;
      break-after: avoid;
    }

    .part-divider h1 {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .part-divider .tag {
      background: #D49B4B;
      color: #1E2022;
      font-size: 9pt;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 16px;
    }

    .chapter-title {
      font-size: 13pt;
      font-weight: 800;
      color: #3B5249;
      border-left: 5px solid #D49B4B;
      padding-left: 9px;
      margin: 5mm 0 3mm 0;
      line-height: 1.3;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* =========================================================
       CRITICAL: STRICT AVOID-BREAK CARD COMPONENT
       Ensures image and explanation are ALWAYS on the same page
       ========================================================= */
    .manual-card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 4mm;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }

    .card-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1E2022;
      margin-bottom: 2mm;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px dashed #E2E8F0;
      padding-bottom: 1.5mm;
    }

    .card-title .num {
      background: #3B5249;
      color: #FFFFFF;
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    p {
      margin-bottom: 2mm;
      font-size: 9.2pt;
      color: #333333;
    }

    /* Screenshot Container inside Card */
    .figure-box {
      margin: 2mm 0;
      text-align: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 6px;
    }

    .figure-box img {
      max-width: 100%;
      max-height: 82mm;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid #CBD5E1;
      display: block;
      margin: 0 auto;
    }

    .figure-caption {
      margin-top: 4px;
      font-size: 8pt;
      font-weight: 600;
      color: #64748B;
    }

    /* Tip / Alert Boxes */
    .tip-box {
      background-color: #F8FAF9;
      border-left: 3px solid #3B5249;
      padding: 6px 10px;
      border-radius: 0 4px 4px 0;
      margin: 2mm 0;
      font-size: 8.8pt;
      color: #2C3E35;
    }

    .tip-box.amber {
      background-color: #FFFBEB;
      border-left-color: #D49B4B;
      color: #92400E;
    }

    .tip-box strong {
      color: #1E2022;
      display: inline-block;
      margin-right: 4px;
    }

    /* Step List */
    .step-list {
      list-style: none;
      margin: 2mm 0;
      padding: 0;
    }

    .step-item {
      display: flex;
      gap: 6px;
      margin-bottom: 1.5mm;
      font-size: 9pt;
    }

    .step-badge {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #3B5249;
      color: #FFFFFF;
      font-size: 7.5pt;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2mm 0;
      font-size: 8.6pt;
    }

    th {
      background: #F1F5F9;
      color: #1E2022;
      font-weight: 700;
      padding: 6px 8px;
      border: 1px solid #CBD5E1;
      text-align: left;
    }

    td {
      padding: 6px 8px;
      border: 1px solid #E2E8F0;
      vertical-align: middle;
      color: #334155;
    }

    tr:nth-child(even) td {
      background: #F8FAFC;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .badge-amber { background: #FEF3C7; color: #92400E; border: 1px solid #F59E0B; }
    .badge-sage { background: #E8EDE9; color: #3B5249; border: 1px solid #3B5249; }
    .badge-gold { background: #FEF9C3; color: #854D0E; border: 1px solid #CA8A04; }

    /* TOC */
    .toc-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 5mm 0;
    }

    .toc-part {
      font-size: 10.5pt;
      font-weight: 800;
      color: #3B5249;
      margin-top: 6px;
      border-bottom: 1px solid #CBD5E1;
      padding-bottom: 3px;
    }

    .toc-list {
      list-style: none;
      padding-left: 8px;
      margin-top: 5px;
      margin-bottom: 10px;
    }

    .toc-list li {
      margin-bottom: 4px;
      font-size: 9pt;
      display: flex;
      justify-content: space-between;
    }

    .toc-list li span.pg {
      color: #94A3B8;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <div class="cover-page">
    <div>
      <span class="cover-badge">대한불교 원각학술원 온라인 평생교육 플랫폼</span>
      <div class="cover-emblem">
        <svg viewBox="0 0 100 100" fill="none" style="width: 100%; height: 100%;">
          <circle cx="50" cy="50" r="46" stroke="#3B5249" stroke-width="3"/>
          <circle cx="50" cy="50" r="36" stroke="#D49B4B" stroke-width="1.5" stroke-dasharray="4 4"/>
          <path d="M50 16 L60 40 L84 50 L60 60 L50 84 L40 60 L16 50 L40 40 Z" fill="#3B5249"/>
          <circle cx="50" cy="50" r="9" fill="#D49B4B"/>
        </svg>
      </div>
      <h1 class="cover-title font-serif">원각 불교 아카데미<br>공식 사용자 매뉴얼</h1>
      <div class="cover-subtitle">수강생 학습 안내서 & 교학처 관리자 전산 운영 지침서</div>
      <div class="cover-divider"></div>
      <p class="cover-desc">
        불교 인문학 및 전통 승가 의례의 체계적인 온라인 동영상 원격 학습부터<br>
        실시간 진도율 관리, 대면 수납 승인, A4 공인 수료증 발급까지<br>
        처음 접속하는 초보자도 한눈에 알 수 있는 완벽 가이드북
      </p>
    </div>

    <div class="cover-meta">
      <p><strong>공식 접속 웹사이트</strong>: https://buddha-academy.netlify.app</p>
      <p><strong>발행처</strong>: 대한불교 원각학술원 교학행정처 | <strong>문의전화</strong>: 02-2260-8888</p>
      <p><strong>판본</strong>: 2026년도 정기 최신 통합 개정판</p>
    </div>
  </div>

  <!-- ==================== TOC PAGE ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">📑 전체 목차 (Table of Contents)</h2>
  <p>본 매뉴얼은 일반 수강생을 위한 학습 지침서(제1부)와 교학처 직원을 위한 학사 행정 지침서(제2부)로 명확히 분리되어 구성되어 있습니다.</p>

  <div class="toc-box">
    <div class="toc-part">제1부: [수강생 매뉴얼] 온라인 학습 완벽 가이드</div>
    <ul class="toc-list">
      <li><span>1. 처음 오신 분을 위한 회원가입 및 계정 관리</span> <span class="pg">제1부</span></li>
      <li><span>2. 개설 강좌 둘러보기 및 수강 신청 (대면 수납 접수)</span> <span class="pg">제1부</span></li>
      <li><span>3. [내 강의실] 강좌별 3가지 상태 완전 정복 (대기 / 수강중 / 수료완료)</span> <span class="pg">제1부</span></li>
      <li><span>4. 스마트 동영상 플레이어 학습 및 순차 잠금 해제</span> <span class="pg">제1부</span></li>
      <li><span>5. 공인 수료증 발급 및 단일 1장(A4) PDF 인쇄</span> <span class="pg">제1부</span></li>
      <li><span>6. 학습 Q&A (지도 스님께 질문하기)</span> <span class="pg">제1부</span></li>
    </ul>

    <div class="toc-part" style="color: #92400E; border-color: #F59E0B;">제2부: [교학처 관리자 매뉴얼] 학사 및 콘텐츠 운영 가이드</div>
    <ul class="toc-list">
      <li><span>7. 관리자 모드 접속 및 수강생 명부 권한 관리</span> <span class="pg">제2부</span></li>
      <li><span>8. 신규 학인 직접 등록 및 수납 동시 등재</span> <span class="pg">제2부</span></li>
      <li><span>9. [교학처 대면 수납 내역 장부] 1클릭 수납 확인 및 승인</span> <span class="pg">제2부</span></li>
      <li><span>10. 코스 개설 및 온라인 동영상 강의 콘텐츠 관리</span> <span class="pg">제2부</span></li>
      <li><span>11. 공인 수료증 발급 대장 및 진위 검증 시스템</span> <span class="pg">제2부</span></li>
    </ul>
  </div>

  <div class="tip-box amber">
    <strong>💡 초보자를 위한 빠른 시작 안내:</strong>
    처음 방문하신 학인은 우측 상단 <strong>[회원가입]</strong>으로 계정을 만드신 후, <strong>[강의 과정]</strong>에서 원하는 강좌를 신청하시면 [내 강의실]에 자동 등록됩니다.
  </div>

  <!-- ==================== PART 1: 수강생 매뉴얼 ==================== -->
  <div class="page-break"></div>

  <div class="part-divider">
    <h1>제1부: [수강생 매뉴얼] 온라인 학습 완벽 가이드</h1>
    <span class="tag">수강생 / 학인 전용</span>
  </div>

  <h2 class="chapter-title font-serif">제1장. 처음 오신 분을 위한 회원가입 및 계정 관리</h2>

  <!-- CARD 1-1: 메인 화면 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">1.1</span> 메인 화면 접속 및 메뉴 구성 둘러보기</div>
    <p>인터넷 창(크롬, 엣지, 사파리 등)을 열고 <strong>https://buddha-academy.netlify.app</strong>에 접속합니다. 상단 메뉴에서 학술원 소개, 강의 과정, 내 강의실을 한눈에 확인할 수 있습니다.</p>
    <div class="figure-box">
      <img src="${imgs.main1}" alt="메인 상단 화면">
      <div class="figure-caption">[그림 1-1] 원각 불교 아카데미 메인 화면 및 상단 네비게이션</div>
    </div>
    <div class="tip-box">
      <strong>화면 안내:</strong> 우측 상단의 <code>[로그인]</code>과 <code>[회원가입]</code> 버튼을 통해 언제든 손쉽게 계정으로 들어갈 수 있습니다.
    </div>
  </div>

  <!-- CARD 1-2: 회원가입 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">1.2</span> 신규 수강생 회원가입 방법</div>
    <p>아카데미에 처음 오신 분은 우측 상단의 <strong>[회원가입]</strong> 버튼을 누르고 아래의 5가지 항목을 입력합니다.</p>
    <ul class="step-list">
      <li class="step-item"><div class="step-badge">1</div><div><strong>아이디</strong>: 영문 소문자와 숫자를 조합하여 입력합니다. (중복 자동 확인)</div></li>
      <li class="step-item"><div class="step-badge">2</div><div><strong>비밀번호</strong>: 보안을 위해 영문, 숫자, 특수문자 조합 8자 이상 입력합니다.</div></li>
      <li class="step-item"><div class="step-badge">3</div><div><strong>성명/법명</strong>: 본인의 실명 또는 스님 법명을 입력합니다. (수료증에 공식 인쇄)</div></li>
      <li class="step-item"><div class="step-badge">4</div><div><strong>생년월일</strong>: 수료증 본인 확인용 8자리 생년월일을 선택합니다.</div></li>
      <li class="step-item"><div class="step-badge">5</div><div><strong>휴대전화 번호</strong>: 학사 안내를 받을 본인 휴대전화 번호를 입력합니다.</div></li>
    </ul>
    <div class="figure-box">
      <img src="${imgs.register}" alt="회원가입 화면">
      <div class="figure-caption">[그림 1-2] 수강생 신규 회원가입 입력 화면</div>
    </div>
  </div>

  <!-- CARD 1-3: 가입 완료 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">1.3</span> 가입 완료 및 고유 학번 자동 발급</div>
    <p>모든 입력을 마치고 <strong>[회원가입 완료]</strong>를 누르면 즉시 고유한 평생 <strong>학번(BUDDHA-2026-XXXXX)</strong>이 자동 발급됩니다.</p>
    <div class="figure-box">
      <img src="${imgs.registerDone}" alt="가입 완료 화면">
      <div class="figure-caption">[그림 1-3] 회원가입 완료 및 고유 학번 발급 안내 화면</div>
    </div>
    <p>화면의 <strong>[로그인 하러가기 →]</strong> 버튼을 누르면 즉시 로그인 화면으로 편리하게 이동합니다.</p>
  </div>

  <!-- CARD 1-4: 로그인 & 비밀번호 재설정 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">1.4</span> 로그인 및 비밀번호 분실 시 재설정</div>
    <p>발급받은 아이디와 비밀번호를 입력하고 <strong>[로그인 →]</strong>을 클릭합니다. 비밀번호를 잊으셨다면 아래의 <strong>[비밀번호 찾기]</strong>를 누릅니다.</p>
    <div class="figure-box">
      <img src="${imgs.login}" alt="로그인 화면">
      <div class="figure-caption">[그림 1-4] 수강생 로그인 화면</div>
    </div>
    <div class="figure-box" style="margin-top: 2mm;">
      <img src="${imgs.resetPw}" alt="비밀번호 재설정 모달">
      <div class="figure-caption">[그림 1-5] 성명·연락처 본인 확인 후 비밀번호 직접 재설정 화면</div>
    </div>
    <div class="tip-box">
      <strong>안심 보안:</strong> 아이디, 성명, 생년월일, 전화번호가 일치하면 본인이 즉시 새 비밀번호를 설정할 수 있습니다.
    </div>
  </div>

  <!-- ==================== CHAPTER 2 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제2장. 개설 강좌 둘러보기 및 수강 신청 (대면 수납 접수)</h2>

  <!-- CARD 2-1: 강좌 상세 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">2.1</span> 교육과정 커리큘럼 및 상세 내용 확인</div>
    <p>상단 메뉴의 <strong>[강의 과정]</strong>에서 원하는 강좌 카드를 클릭하면 상세한 커리큘럼과 교수진 정보를 볼 수 있습니다.</p>
    <div class="figure-box">
      <img src="${imgs.courseDetail}" alt="강좌 상세 보기 화면">
      <div class="figure-caption">[그림 2-1] 교육과정 소개, 담당 교수진 및 전 차시 커리큘럼 화면</div>
    </div>
    <p>수강 신청 전에는 각 차시 오른쪽에 <strong>[🔒 잠김]</strong> 표시가 나타나며, 수강 승인 후 순차적으로 열립니다.</p>
  </div>

  <!-- CARD 2-2: 수강 신청 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">2.2</span> 수강 신청 접수 (대면 수납 연동)</div>
    <p>강좌 상세 화면 하단의 <strong>[수강 신청 접수 (대면 수납 안내) ▶]</strong> 버튼을 누르면 대면 수납 대기 상태로 내 강의실에 즉시 등록됩니다.</p>
    <div class="tip-box amber">
      <strong>💡 대면 수납 승인 원칙 안내:</strong>
      원각 불교 아카데미는 승가 학사의 엄정한 관리를 위해 온라인 신청 후 교학처 현장 방문 또는 유선 확인을 거쳐 정식 승인됩니다.
    </div>
  </div>

  <!-- ==================== CHAPTER 3 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제3장. [내 강의실] 강좌별 3가지 상태 완전 정복</h2>

  <!-- CARD 3-1: 3가지 상태 테이블 & 화면 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">3.1</span> 내 강의실의 3가지 강좌 상태 비교</div>
    <p><strong>[내 강의실]</strong>에서는 내가 신청한 모든 강좌가 <strong>3가지 명확한 상태</strong>로 구분되어 표시됩니다. 새로고침해도 영구히 보존됩니다.</p>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">상태 단계</th>
          <th style="width: 25%;">표시 뱃지</th>
          <th style="width: 32%;">카드 안내 메시지</th>
          <th style="width: 23%;">실행 버튼</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>① 납부 전</strong></td>
          <td><span class="badge badge-amber">⏳ 대기상태</span></td>
          <td>"교학처 대면 수납 승인 대기 중"</td>
          <td><code>[대면 수납 위치안내]</code></td>
        </tr>
        <tr>
          <td><strong>② 납부 후</strong></td>
          <td><span class="badge badge-sage">▶ 수강 중</span></td>
          <td>진도율 바 (0%~99%) & D-90일</td>
          <td><code>[강의실 입장 ▶]</code></td>
        </tr>
        <tr>
          <td><strong>③ 수료 완료</strong></td>
          <td><span class="badge badge-gold">🏆 수료 완료</span></td>
          <td>"전 강좌 이수 완료 (진도율 100%)"</td>
          <td><code>[🎓 수료증 발급/출력]</code></td>
        </tr>
      </tbody>
    </table>
    <div class="figure-box">
      <img src="${imgs.classroom3State}" alt="내 강의실 3가지 강좌 상태">
      <div class="figure-caption">[그림 3-1] 내 강의실에 표시되는 3가지 핵심 강좌 상태 화면</div>
    </div>
  </div>

  <!-- CARD 3-2: 각 상태 상세 설명 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">3.2</span> 단계별 상세 진행 안내</div>
    <ul class="step-list">
      <li class="step-item">
        <div class="step-badge">1</div>
        <div><strong>① ⏳ 대기상태 (대면 수납 대기)</strong>: 카드 내의 <strong>[대면 수납 절차 및 위치 안내]</strong>를 누르면 교학처 위치(2층 교학행정실), 연락처(02-2260-8888), 수납 방법 팝업이 뜹니다.</div>
      </li>
      <li class="step-item">
        <div class="step-badge">2</div>
        <div><strong>② ▶ 수강 중</strong>: 교학처 수납 확인 즉시 열리며, <strong>[강의실 입장 (학습 이어하기) ▶]</strong>을 눌러 동영상 강의를 시청합니다. 90일간 자유롭게 시청 가능합니다.</div>
      </li>
      <li class="step-item">
        <div class="step-badge">3</div>
        <div><strong>③ 🏆 수료 완료</strong>: 모든 강의를 100% 시청 완료하면 나타나며, <strong>[🎓 수료증 발급 및 출력]</strong> 버튼을 눌러 정식 공인 수료증을 인쇄할 수 있습니다.</div>
      </li>
    </ul>
  </div>

  <!-- ==================== CHAPTER 4 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제4장. 스마트 동영상 플레이어 학습 및 순차 잠금 해제</h2>

  <!-- CARD 4-1: 플레이어 기능 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">4.1</span> 동영상 플레이어 화면 조작법</div>
    <p>강의실에 입장하면 전용 플레이어와 우측 차시 목차가 나타납니다. 초보자도 손쉽게 배속과 이어보기를 제어할 수 있습니다.</p>
    <div class="figure-box">
      <img src="${imgs.player}" alt="스마트 동영상 플레이어 학습 화면">
      <div class="figure-caption">[그림 4-1] 고화질 스마트 동영상 플레이어 및 차시별 강의 목차 화면</div>
    </div>
    <ul class="step-list">
      <li class="step-item"><div class="step-badge">1</div><div><strong>초 단위 자동 이어보기</strong>: 영상을 보다가 창을 닫아도 시청하던 위치가 자동 저장되어 다음 접속 시 바로 이어봅니다.</div></li>
      <li class="step-item"><div class="step-badge">2</div><div><strong>10초 전/후 이동 & 배속 제어</strong>: <code>◀ 10초</code> / <code>10초 ▶</code> 버튼과 0.75x~2.0x 배속 버튼으로 편리하게 복습합니다.</div></li>
      <li class="step-item"><div class="step-badge">3</div><div><strong>순차 학습 잠금 시스템</strong>: 앞선 차시 강의를 끝까지 시청(100% 완강)해야 다음 차시의 자물쇠가 자동으로 풀립니다.</div></li>
    </ul>
  </div>

  <!-- ==================== CHAPTER 5 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제5장. 공인 수료증 발급 및 단일 1장(A4) PDF 인쇄</h2>

  <!-- CARD 5-1: 수료증 모달 및 단일 페이지 인쇄 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">5.1</span> 직인 날인 공인 수료증 발급 및 단 1장(A4) 인쇄</div>
    <p>진도율 100% 달성 시 <strong>[🎓 수료증 발급 및 출력]</strong>을 클릭하면 원각학술원 관인 직인이 선명하게 날인된 정식 공인 수료증이 열립니다.</p>
    <div class="figure-box">
      <img src="${imgs.cert}" alt="공인 수료증 발급 모달">
      <div class="figure-caption">[그림 5-1] 원각학술원 관인 직인 날인 정식 공인 수료증 모달 화면</div>
    </div>
    <div class="tip-box">
      <strong>🖨️ 단 1장의 완벽한 A4 가로 인쇄 보장:</strong>
      상단의 <strong>[수료증 인쇄 / PDF 저장]</strong>을 클릭하면 브라우저 인쇄 창이 자동으로 A4 가로 규격(여백 없음)으로 호출되어, 여러 장으로 잘리지 않고 <strong>정확히 단 1장의 깔끔한 완성본 수료증</strong>으로 출력 및 PDF 저장됩니다.
    </div>
  </div>

  <!-- ==================== CHAPTER 6 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제6장. 학습 Q&A (지도 스님께 질문하기)</h2>

  <!-- CARD 6-1: Q&A 질의응답 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">6.1</span> 1:1 학습 질문 등록 및 지도교수 스님 법문 답변</div>
    <p>강의를 시청하다가 교리나 의례에 관해 궁금한 점이 생기면 플레이어 하단의 <strong>[학습 Q&A 질의응답]</strong> 탭에서 질문을 등록합니다.</p>
    <div class="figure-box">
      <img src="${imgs.qna}" alt="학습 Q&A 질의응답 게시판">
      <div class="figure-caption">[그림 6-1] 학습 질문 등록 및 지도교수 지산 스님 공식 답변 화면</div>
    </div>
    <p>질문 등록 시 현재 시청 중인 영상 시점이 자동 기록되며, 담당 지도교수 스님(지산 스님 / 원명 스님)의 전문적인 지도를 직접 받으실 수 있습니다. 개인 상담은 <code>[비밀글]</code>을 체크합니다.</p>
  </div>

  <!-- ==================== PART 2: 교학처 관리자 매뉴얼 ==================== -->
  <div class="page-break"></div>

  <div class="part-divider" style="background: #92400E;">
    <h1>제2부: [교학처 관리자 매뉴얼] 학사 및 콘텐츠 운영 가이드</h1>
    <span class="tag" style="background: #FEF3C7; color: #92400E;">교학교직원 / 관리자 전용</span>
  </div>

  <h2 class="chapter-title font-serif">제7장. 관리자 모드 접속 및 수강생 명부 권한 관리</h2>

  <!-- CARD 7-1: 관리자 수강생 명부 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">7.1</span> 관리자 로그인 및 수강생 명부 조회</div>
    <p>최고관리자(<code>admin</code>) 계정으로 로그인하면 상단에 <strong>[관리자 모드]</strong> 버튼이 활성화됩니다. 클릭 시 수강생 명부와 현 권한이 실시간 표시됩니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminUsers}" alt="수강생 및 권한 관리 탭">
      <div class="figure-caption">[그림 7-1] 관리자 모드: 수강생 명부 검색 및 권한 관리 화면</div>
    </div>
    <p>상단 배지에 현재 로그인한 최고관리자의 권한 정보가 실시간 안내되며, 학인의 성명, 학번, 연락처로 빠르게 검색할 수 있습니다.</p>
  </div>

  <!-- CARD 7-2: 비밀번호 재설정 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">7.2</span> 관리자 전용 학인 비밀번호 직접 재설정</div>
    <p>학인이 비밀번호를 분실하여 교학처로 문의한 경우, 목록 우측의 <strong>[비번 초기화]</strong> 버튼을 눌러 관리자가 직접 새 임시 비밀번호를 지정해 줄 수 있습니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminResetPw}" alt="관리자 비번 초기화 모달">
      <div class="figure-caption">[그림 7-2] 관리자 전용 학인 임시 비밀번호 직접 지정 화면</div>
    </div>
  </div>

  <!-- ==================== CHAPTER 8 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제8장. 신규 학인 직접 등록 및 수납 동시 등재</h2>

  <!-- CARD 8-1: 신규 학인 등록 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">8.1</span> 교학처 방문 학인 원스톱 직접 등록</div>
    <p>교학처에 직접 방문하여 원서를 작성하고 수강료를 납부하신 학인을 관리자가 원스톱으로 시스템에 등재합니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminNewUser}" alt="관리자 학생 직접 등록 모달">
      <div class="figure-caption">[그림 8-1] [+ 신규 사용자 직접 등록] 모달 화면</div>
    </div>
    <ul class="step-list">
      <li class="step-item"><div class="step-badge">1</div><div>우측 상단의 <strong>[+ 신규 사용자 직접 등록]</strong>을 클릭합니다.</div></li>
      <li class="step-item"><div class="step-badge">2</div><div>성명, 생년월일, 연락처를 입력하고 <strong>[아이디 자동추천]</strong>을 누릅니다.</div></li>
      <li class="step-item"><div class="step-badge">3</div><div><strong>강좌 권한 배정</strong>: 수강할 과정을 선택하고 상태를 <code>active (수강중)</code>으로 설정합니다.</div></li>
      <li class="step-item"><div class="step-badge">4</div><div><strong>대면 수납 장부 등재</strong>: 결제 금액(180,000원)과 수납 방식을 입력하여 장부에 동시 반영합니다.</div></li>
    </ul>
  </div>

  <!-- CARD 8-2: 등록 완료 및 안내 카드 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">8.2</span> 학인 전달용 계정 안내 요약 카드 복사</div>
    <p>등록 완료 즉시 학인의 아이디, 초기 비밀번호, 학번이 적힌 요약 카드가 생성됩니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminNewUserDone}" alt="등록 완료 안내 카드">
      <div class="figure-caption">[그림 8-2] 학인 전달용 계정 안내 요약 카드 및 1클릭 복사 화면</div>
    </div>
    <p>하단의 <strong>[안내 정보 전체 복사]</strong> 버튼을 누르면 문자 메시지나 카카오톡으로 학인에게 즉시 접속 안내를 전송할 수 있습니다.</p>
  </div>

  <!-- ==================== CHAPTER 9 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제9장. [교학처 대면 수납 내역 장부] 1클릭 수납 확인 및 승인</h2>

  <!-- CARD 9-1: 대면 수납 장부 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">9.1</span> 온라인 대기자 명부 및 공식 수납 장부 관리</div>
    <p>학인이 온라인으로 신청한 대기 내역과 교학처 방문 수납 내역을 투명한 공식 전자 장부로 통합 관리합니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminPaymentLedger}" alt="대면 수납 내역 장부 화면">
      <div class="figure-caption">[그림 9-1] 교학처 대면 수납 내역 장부 및 대기자 관리 화면</div>
    </div>
  </div>

  <!-- CARD 9-2: 1클릭 승인 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">9.2</span> 1클릭 대면 수납 확인 및 즉시 수강 승인</div>
    <p>학인이 수강료를 결제하면 대기 목록 우측의 <strong>[💳 대면 수납 확인 및 승인]</strong> 버튼을 누릅니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminPaymentConfirm}" alt="대면 수납 확인 모달">
      <div class="figure-caption">[그림 9-2] 1클릭 수납 승인 및 즉시 수강 전환 확인 창</div>
    </div>
    <div class="tip-box">
      <strong>실시간 자동 반영:</strong> 관리자가 승인 버튼을 누르는 즉시 공식 장부에 등재되며, 학인의 [내 강의실] 상태가 <code>⏳ 대기상태</code>에서 즉시 <code>▶ 수강 중</code>으로 자동 전환됩니다.
    </div>
  </div>

  <!-- ==================== CHAPTER 10 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제10장. 코스 개설 및 온라인 동영상 강의 콘텐츠 관리</h2>

  <!-- CARD 10-1: CMS 메인 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">10.1</span> 강좌 코스 및 차시 동영상 관리 탭</div>
    <p><strong>[콘텐츠 관리]</strong> 탭에서는 신규 교육과정을 개설하거나 동영상 차시를 직접 등록하고 수정할 수 있습니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminCms}" alt="코스 및 영상 관리 화면">
      <div class="figure-caption">[그림 10-1] 코스 및 동영상 콘텐츠 관리 화면</div>
    </div>
  </div>

  <!-- CARD 10-2: 신규 코스 및 차시 등록 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">10.2</span> 신규 교육과정 개설 및 동영상 차시 업로드</div>
    <p>새 코스를 추가하거나 동영상 차시 파일을 등록하여 온라인 강좌를 손쉽게 확충합니다.</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 2mm 0;">
      <div class="figure-box" style="margin: 0;">
        <img src="${imgs.adminNewCourse}" alt="새 코스 개설">
        <div class="figure-caption">[그림 10-2] 신규 교육과정 개설 모달</div>
      </div>
      <div class="figure-box" style="margin: 0;">
        <img src="${imgs.adminNewLecture}" alt="새 영상 등록">
        <div class="figure-caption">[그림 10-3] 동영상 차시 등록 모달</div>
      </div>
    </div>
    <p>동영상 파일을 선택하여 등록하면 고화질 최적화 스트리밍이 즉시 적용되어 학인들이 원활하게 시청할 수 있습니다.</p>
  </div>

  <!-- ==================== CHAPTER 11 ==================== -->
  <div class="page-break"></div>

  <h2 class="chapter-title font-serif">제11장. 공인 수료증 발급 대장 및 진위 검증 시스템</h2>

  <!-- CARD 11-1: 수료증 대장 -->
  <div class="manual-card">
    <div class="card-title"><span class="num">11.1</span> 공인 수료증 발급 대장 이력 영구 보관</div>
    <p>학인들에게 발급된 모든 수료증의 인가 번호, 성명, 학번, 이수 과정, 발행일자가 위변조 없이 대장에 영구 보관됩니다.</p>
    <div class="figure-box">
      <img src="${imgs.adminCerts}" alt="수료증 발급 대장 화면">
      <div class="figure-caption">[그림 11-1] 관리자 모드: 수료증 발급 대장 및 진위 검증 화면</div>
    </div>
    <p>우측의 <strong>[수료증 보기]</strong> 버튼을 누르면 학인이 열람하는 정식 관인 직인 수료증 원본을 관리자 화면에서도 즉시 확인하고 재인쇄할 수 있습니다.</p>
  </div>

</body>
</html>`;

console.log('Writing updated HTML file to:', OUT_HTML);
fs.writeFileSync(OUT_HTML, htmlContent, 'utf8');

async function renderPdf() {
  console.log('Launching Headless Chrome for PDF export...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  console.log('Loading updated HTML in browser...');
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Rendering high-resolution PDF (with strict avoid-break cards)...');
  await page.pdf({
    path: OUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '14mm',
      bottom: '14mm',
      left: '12mm',
      right: '12mm'
    }
  });

  await browser.close();
  console.log('\n>>> SUCCESS! PDF User Manual recreated at:', OUT_PDF);
  const stats = fs.statSync(OUT_PDF);
  console.log('PDF File Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
}

renderPdf();
