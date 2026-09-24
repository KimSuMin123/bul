# 세화붓다아카데미 SEO 및 GEO 구축 현황 보고서

> **최종 개정일시**: 2026년 9월 24일 기준  
> **주관 기관**: [사] 세화불학원 부설 세화붓다아카데미 (Sehwa Buddha Academy - SBA)  
> **대상 도메인**: `https://세화붓다아카데미.com/` (퓨니코드: `https://xn--2j1bkkm2t5tbj2hx7go2ry0o.com/`)  
> **운영 호스팅**: Netlify Production (`sehwa-buddha-academy`, 브랜치: `feat/minhyeok`)

---

## 1. 개요 및 배경

본 문서는 **[사] 세화불학원 부설 세화붓다아카데미** 공식 온라인 이러닝 및 자격 검정 포털의 **검색엔진 최적화(SEO, Search Engine Optimization)**, **생성형 AI 검색 엔진 최적화(GEO, Generative Engine Optimization)**, 그리고 **지역/지리 기반 최적화(Local SEO & Geolocation)**의 구축 현황과 세부 설정 명세를 종합 정리한 공식 기술 문서입니다.

세화붓다아카데미 포털은 React 기반 Single Page Application(SPA, Hash Routing 방식)으로 개발되어 브라우저 내에서 부드러운 화면 전환을 제공합니다. SPA의 태생적 검색 크롤링 한계를 극복하고, 네이버(Naver), 구글(Google), 다음(Daum), 빙(Bing)뿐만 아니라 **ChatGPT(SearchGPT), Perplexity, Claude, Google Gemini, Apple Intelligence** 등 급변하는 최신 대화형·생성형 AI 검색 엔진에서 공식 교육기관의 정보가 정확하게 인용(Citation)될 수 있도록 고도화된 다계층 최적화 설계를 완료했습니다.

---

## 2. 도메인 및 인프라 프로필

| 항목 | 상세 내용 | 비고 |
|---|---|---|
| **한글 대표 도메인** | `https://세화붓다아카데미.com/` | 사용자 접근성 극대화 |
| **퓨니코드 도메인** | `https://xn--2j1bkkm2t5tbj2hx7go2ry0o.com/` | DNS 및 SSL/TLS 공식 인증 |
| **공식 본원 도메인** | `https://www.세화불학원.org` (`xn--wr3bl1e16firr29a.org`) | 재단법인 공식 본원 연계 |
| **운영 플랫폼** | Netlify Global Edge CDN (Single Origin SPA) | `dist` 정적 게시 |
| **인프라 헤더 설정** | `public/_headers` (HSTS, nosniff, frame-ancestors, 1년 캐싱) | 보안 및 크롤러 안정성 보장 |
| **SPA 라우팅 모드** | Hash Routing (`/#about`, `/#courseDetail`, `/#watch`, `/#verify` 등) | SPA 새로고침 404 원천 방지 |

---

## 3. SEO (검색엔진 최적화) 구축 현황

### 3.1. 정적 HTML 메타데이터 (`index.html`)

포털의 최상위 진입점인 `index.html`의 `<head>` 영역에 표준 검색엔진 가이드라인에 부합하는 모든 메타태그가 구현되어 있습니다.

```html
<!-- 문서 기본 및 검색 포털 인증 -->
<meta name="naver-site-verification" content="ff11a9b4b588d06b10f3a172f81082897b21b42f" />
<title>[사]세화붓다아카데미 | 따라하는 불자에서 이끄는 불자로</title>
<meta name="description" content="예경에서 영산재까지, 순서와 뜻을 함께 익히는 불교 의례 자격과정. 나모붓다야 - [사] 세화불학원 부설 세화붓다아카데미 공식 온라인 교육원." />
<meta name="keywords" content="세화붓다아카데미, 세화불학원, 불교의례, 불교 교육, 불교 온라인 강좌, 천도재, 하단시식, 상단불공, 중단권공, 수료증 발급, 의례 자격과정, 나모붓다야" />
<meta name="author" content="[사] 세화불학원" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<link rel="canonical" href="https://세화붓다아카데미.com/" />
```

- **네이버 서치어드바이저 인증**: `ff11a9b4b588d06b10f3a172f81082897b21b42f` 메타태그 적용으로 소유권 확인 완료.
- **Canonical URL**: 대표 도메인을 `https://세화붓다아카데미.com/`으로 지정하여 도메인 중복(Canonical Duplication) 방지.
- **Robots 메타 지시자**: `max-image-preview:large`, `max-snippet:-1`을 적용하여 검색엔진 결과에 고해상도 썸네일과 확장된 스니펫이 노출되도록 유도.

### 3.2. 소셜 공유 메타태그 (Open Graph & Twitter Card)

카카오톡, 네이버 블로그/카페, 페이스북, X(구 트위터) 공유 시 브랜드 신뢰도를 높이기 위한 전용 미리보기 규격을 충족합니다.

- **OG 이미지 규격**: `1784 x 882` px 고화질 이미지 (`/images/og-preview-v4.png`)
- **Open Graph 태그**:
  - `og:type`: `website`
  - `og:locale`: `ko_KR`
  - `og:site_name`: `세화붓다아카데미`
  - `og:title`: `[사]세화붓다아카데미 | 따라하는 불자에서 이끄는 불자로`
  - `og:description`: `예경에서 영산재까지, 순서와 뜻을 함께 익히는 불교 의례 자격과정. 나모붓다야 - [사] 세화불학원 공식 온라인 교육원`
  - `og:image:width`: `1784` / `og:image:height`: `882`
- **Twitter Card**: `summary_large_image` 포맷 적용.

### 3.3. 클라이언트 동적 메타 관리 시스템 (`src/services/seoService.js`)

Single Page Application의 특성상 화면 이동 시 정적 HTML의 `<title>`과 메타태그가 고정되는 문제를 해결하기 위해, 라우트 변경을 실시간 감지하여 동적으로 메타 정보를 치환하는 전용 모듈(`updatePageSEO`)을 운영하고 있습니다.

```javascript
// src/services/seoService.js 주요 동작 구조
export function updatePageSEO(view, extraData = {}) {
  // 1. 라우트(view)별 기본 타이틀 및 설명 추출 (home, about, courseDetail, dashboard, watch, verify, login, register, admin)
  // 2. 세화불학원 소개(#about) 서브탭별 동적 타이틀 지원 (설립목적, 신행헌장, 학회연혁, 학회정관, 조직활동, SBA총람)
  // 3. 강좌 상세(#courseDetail) 및 시청(#watch) 시 강좌명·강의명을 실시간 동적 주입
  // 4. document.title, meta[name="description"], meta[property="og:title"], meta[property="og:description"] 일괄 갱신
}
```

- **지원 뷰 및 동적 타이틀**:
  - `home`: `사단법인 세화붓다아카데미 | 따라하는 불자에서 이끄는 불자로`
  - `about`: 탭별(`intro` 설립목적, `charter` 신행헌장, `history` 학회연혁, `constitution` 학회정관, `committed` 조직활동, `sba` 총람) 분기 적용
  - `courseDetail`: 선택된 과정명(`불교의례해설사 2급 전문 자격과정` 등) 동적 적용
  - `watch`: 시청 중인 세부 차시명 동적 적용
  - `verify`: `공식 수료증 진위 확인 | 세화붓다아카데미`
  - `login` / `register`: 회원 포털 명칭 적용

### 3.4. 사이트맵 (`public/sitemap.xml`)

검색엔진 크롤러가 전체 웹 애플리케이션의 핵심 페이지 구조와 가중치를 인지할 수 있도록 `sitemap.xml`을 유지 관리합니다.

- **표준 네임스페이스**: `http://www.sitemaps.org/schemas/sitemap/0.9`, 이미지 확장 네임스페이스(`xmlns:image`) 포함
- **등록된 주요 엔드포인트**:
  1. `/` (Priority: 1.0, Daily, 대표 로고 이미지 스키마 포함)
  2. `/#about` (Priority: 0.9, Weekly, 세화불학원 소개)
  3. `/#courseDetail?id=course-ritual-master-2` (Priority: 0.9, Weekly, 해설사 2급 과정)
  4. `/#courseDetail?id=course-ritual-master-law` (Priority: 0.9, Weekly, 의례법사 과정)
  5. `/#dashboard` (Priority: 0.8, Daily, 내 강의실)
  6. `/#verify` (Priority: 0.8, Monthly, 공식 수료증 진위 검증 포털)
  7. `/#login`, `/#register` (Priority: 0.6, Monthly)
- **최신 갱신일자**: `2026-09-24`

---

## 4. GEO (Generative Engine Optimization - 생성형 AI 최적화) 구축 현황

생성형 AI 검색(GEO)은 전통적인 키워드 매칭을 넘어, LLM(대규모 언어 모델)이 웹을 크롤링하고 지식 베이스를 구축할 때 **기관의 공신력 있는 팩트, 커리큘럼, 자격 인가 내역, 검증 절차**를 명확하고 구조화된 형태로 이해하여 사용자 질문에 정확히 인용하도록 만드는 최신 기술입니다.

### 4.1. AI 크롤러 허용 및 정책 제어 (`public/robots.txt`)

최신 검색 AI 봇이 공개 학습 및 검색 인용 목적으로 사이트에 접근할 때 차단되지 않도록 전용 크롤러 화이트리스트 규칙을 선제적으로 구현했습니다.

```text
# ==============================================================================
# Sehwa Buddha Academy - Robots.txt (Search Engine & Generative AI Optimization)
# ==============================================================================

User-agent: *
Allow: /
Disallow: /admin
Disallow: /#admin
Disallow: /api/
Disallow: /scratch/

# OpenAI ChatGPT & SearchGPT
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /

# Perplexity AI Search Engine
User-agent: PerplexityBot
Allow: /

# Anthropic Claude Search & AI
User-agent: ClaudeBot
Allow: /
User-agent: anthropic-ai
Allow: /

# Google Gemini / Extended Crawlers
User-agent: Google-Extended
Allow: /

# Apple Intelligence
User-agent: Applebot-Extended
Allow: /

# Naver Yeti & Daum / Bing
User-agent: Yeti
Allow: /
User-agent: Daumoa
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: https://세화붓다아카데미.com/sitemap.xml
```

- **보안 격리**: `/admin`, `/#admin`, `/api/` 등 내부 관리 및 백엔드 영역은 모든 봇에 대해 엄격히 차단(`Disallow`).
- **AI 크롤러 개방**: 교육 콘텐츠와 공식 안내 페이지는 모든 메이저 AI 봇에 대해 `Allow: /` 부여.

### 4.2. LLM 전용 표준 문서 (`public/llms.txt`)

LLM 크롤러가 웹사이트에 진입했을 때 가장 먼저 탐색하도록 설계된 최신 오픈 웹 표준 `llms.txt`를 구축하여 배포하고 있습니다. 본 문서는 자연어 모델이 환각(Hallucination) 없이 답변할 수 있도록 세화불학원의 핵심 팩트를 완벽히 요약하여 제공합니다.

- **반영된 핵심 데이터**:
  1. **기관 및 법인 정보**:
     - 기관명: `[사] 세화불학원 부설 세화붓다아카데미 (SBA)`
     - 법인 고유번호: `777-82-00464`
     - 소재지: `서울특별시 종로구 삼봉로 81, 613호 (수송동, 두산위브파빌리온)`
     - 대표전화: `010-4702-0283`, 대표 이메일: `sehwaba@gmail.com`
     - 공식 본원: `https://www.세화불학원.org` 및 네이버 밴드 연계
  2. **공인 민간자격 등록 현황**:
     - 자격 종목: **불교의례해설사 2급**
     - 주무부처: **문화체육관광부**
     - 민간자격 등록번호: **제 2026-00183호**
     - 검정 기관: `[사] 세화불학원`
  3. **상세 커리큘럼 명세**:
     - `불교의례해설사 2급` (총 30개 차시, 제1강~제15강 상·중·하단 종합 작법)
     - `불교의례법사 과정` (총 30개 차시, 칠칠재 영혼식, 포살의식, 영산수륙예수 작법)
  4. **평가 및 수료증 발급 기준**:
     - 진도율 100% 완강 조건
     - 온라인 객관식 평가 10문항 중 60점 이상 합격 시 즉시 자동 발급
     - 공식 발급번호 부여 및 온라인 진위 확인 포털(`/#verify`) 대조 검증

### 4.3. Schema.org JSON-LD 구조화 데이터 (`index.html`)

Google SGE(Search Generative Experience), 네이버 AI 검색, Perplexity 등의 지식 그래프(Knowledge Graph) 구축에 직결되는 JSON-LD 스키마를 `@graph` 복합 구조로 내장했습니다.

1. **`EducationalOrganization` (교육기관 스키마)**:
   - 기관 정식 명칭, 다국어 및 약칭(`세화불학원`, `세화붓다아카데미`, `Sehwa Buddha Academy`, `SBA`)
   - 법인 고유번호(`taxID`: `777-82-00464`)
   - 전문 분야 엔티티(`knowsAbout`): `불교의례`, `불교의례해설사`, `불교의례법사`, `영산재`, `수륙재`, `천도재`, `관음시식`, `상단불공`, `중단권공`, `불교 교육`
   - 소재지 우편주소(`PostalAddress`) 및 지리 좌표(`GeoCoordinates`)
   - `sameAs`를 통한 공식 본원 및 커뮤니티 연결
2. **`Course` (강좌 스키마 2종)**:
   - 과정 1: `불교의례해설사 2급 전문 자격과정` (문체부 제 2026-00183호 명시, 50,000 KRW, Online)
   - 과정 2: `불교의례법사 과정` (30차시 총람, 50,000 KRW, Online)
3. **`FAQPage` (자주 묻는 질문 스키마)**:
   - Q1. 수강신청 방법
   - Q2. 불교의례해설사 2급 자격증의 문화체육관광부 공인 여부
   - Q3. 수료증 및 자격증 발급 기준 (진도율 100% + 시험 60점)
   - Q4. 수료증 실시간 진위 확인 방법 (`/#verify`)

---

## 5. Local SEO & Geolocation (위치/지역 기반 최적화) 구축 현황

불교 학술 및 의례 교육 기관으로서 오프라인 대면 수납, 교학처 방문, 법인 증빙 등 지역 기반 신뢰도를 담보하기 위한 지리적 최적화 설정 현황입니다.

### 5.1. 지리적 메타태그 (`index.html`)

```html
<!-- Geolocation & Local Search Meta Tags (Local SEO & GEO) -->
<meta name="geo.region" content="KR-11" />
<meta name="geo.placename" content="서울특별시 종로구 삼봉로 81" />
<meta name="geo.position" content="37.5732;126.9823" />
<meta name="ICBM" content="37.5732, 126.9823" />
```

- **`geo.region`**: 대한민국 서울특별시 ISO 표준 코드 (`KR-11`)
- **`geo.placename`**: 공식 소재지 명칭
- **`geo.position` / `ICBM`**: 종로구 수송동 두산위브파빌리온 일대의 정밀 위도/경도 좌표

### 5.2. 구조화 주소 데이터 (`index.html` 내 Schema.org)

```json
"address": {
  "@type": "PostalAddress",
  "streetAddress": "삼봉로 81, 613호 (수송동, 두산위브파빌리온)",
  "addressLocality": "종로구",
  "addressRegion": "서울특별시",
  "postalCode": "03150",
  "addressCountry": "KR"
},
"geo": {
  "@type": "GeoCoordinates",
  "latitude": 37.5732,
  "longitude": 126.9823
}
```

---

## 6. 최근 개정 사항 반영 현황 (2026-09-24)

2026년 9월 24일 커밋 `f2cacff` (`[사]세화불학원으로 수정`)에 따른 브랜드 명칭 통일 작업과 본 현황화 작업을 통해 다음 파일들이 일관성 있게 정비되었습니다.

1. **`index.html`**:
   - `author`: `[사] 세화불학원` 통일
   - Schema.org의 기관명: `[사] 세화불학원 세화붓다아카데미`
   - 법인 고유번호, 주소 스키마, 지리적 메타태그(`geo.*`) 및 공식 채널 `sameAs` 링크 보강
2. **`public/llms.txt`**:
   - `[사] 세화불학원 부설 세화붓다아카데미` 기관명 및 법인 고유번호(`777-82-00464`) 반영
   - 종로구 교학처 소재지, 공식 본원 도메인, 네이버 밴드 링크, 농협 수납 계좌 명시
3. **`public/sitemap.xml`**:
   - 대표 이미지 타이틀을 `[사] 세화불학원 세화붓다아카데미`로 통일
   - 전체 사이트맵 URL의 `lastmod`를 최신 일자(`2026-09-24`)로 갱신
4. **`src/services/seoService.js`**:
   - 동적 타이틀 및 설명에 `[사] 세화불학원` 및 `세화붓다아카데미` 브랜드 키워드 일관성 확보

---

## 7. 주요 검색엔진 및 AI 플랫폼 등록·운영 가이드

### 7.1. 네이버 (Naver Search Advisor)
- **등록 URL**: `https://searchadvisor.naver.com/`
- **사이트 소유확인**: 이미 `index.html`에 `<meta name="naver-site-verification" content="ff11a9b4b588d06b10f3a172f81082897b21b42f" />`가 삽입되어 있으므로 서치어드바이저 콘솔에서 즉시 '확인' 완료 가능.
- **수집 요청 및 사이트맵 제출**:
  - 사이트맵 제출 메뉴에서 `https://세화붓다아카데미.com/sitemap.xml` 제출
  - 웹 페이지 수집 요청 메뉴에서 메인 URL 수집 요청

### 7.2. 구글 (Google Search Console)
- **등록 URL**: `https://search.google.com/search-console/`
- **소유권 인증 방식 권장**:
  1. DNS TXT 레코드 인증 (도메인 등록기관에서 한 번에 퓨니코드 포함 전체 서브도메인 인증)
  2. 또는 HTML 메타태그 방식 (`<meta name="google-site-verification" content="..." />` 추가)
- **사이트맵 제출**: `sitemap.xml` 제출 시 약 1~3일 내 인덱싱 개시.

### 7.3. 네이버 스마트플레이스 및 카카오맵 (로컬 비즈니스 연동)
- **목적**: "종로 불교 아카데미", "세화불학원 위치", "불교의례해설사 교육원" 검색 시 지도 탭 및 통합검색 상단 노출
- **등록 주소**: `서울 종로구 삼봉로 81, 613호 (수송동, 두산위브파빌리온)`
- **홈페이지 링크**: `https://세화붓다아카데미.com/` 등록 필수

### 7.4. 대화형 AI 검색 엔진 (ChatGPT, Perplexity, Gemini) 모니터링
- `robots.txt`에 의해 크롤링이 완전 개방되어 있으므로 정기적으로 다음 프롬프트를 통해 인용 현황을 테스트합니다:
  - *"세화붓다아카데미의 불교의례해설사 2급 자격증 등록번호와 주무부처는 어디인가요?"*
  - *"세화불학원 세화붓다아카데미의 수료증 발급 기준과 위치를 알려줘."*

---

## 8. 정기 점검 및 유지관리 체크리스트

| 점검 주기 | 점검 항목 | 대상 파일/도구 | 확인 사항 |
|---|---|---|---|
| **상시 (배포 시)** | 빌드 후 메타태그 및 스키마 유효성 | `npm run build` / 검사기 | Schema.org JSON 문법 오류 여부 |
| **월 1회** | 사이트맵 최신화 | `public/sitemap.xml` | 신규 강좌나 정적 페이지 추가 시 URL 반영 |
| **월 1회** | 네이버 서치어드바이저 색인 현황 | Search Advisor 콘솔 | 수집 오류 및 색인 누락 페이지 점검 |
| **분기 1회** | LLM 컨텍스트 최신화 | `public/llms.txt` | 학사 정책, 수강료, 대표전화 변경 시 동기화 |
| **분기 1회** | 소셜 미리보기 이미지 캐시 갱신 | 카카오/페이스북 디버거 | 카카오 개발자 도구의 'OG 캐시 초기화' 실행 |
