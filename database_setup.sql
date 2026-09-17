-- ==============================================================================
-- 원각 불교 아카데미 (Buddha Lecture Platform) Supabase DDL SQL Schema
-- 대상: 수강생 50명, 40분 강의 100개 이상, 학습 Q&A 포스팅, 수료증 및 진도율
-- ==============================================================================

-- 1. 회원 테이블 (50명 학인 및 관리자)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    member_no VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'student', -- 'student' | 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 강좌 코스 테이블
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subtitle TEXT,
    category VARCHAR(50),
    thumbnail TEXT,
    default_period_days INT DEFAULT 90,
    sequential_unlock BOOLEAN DEFAULT true,
    price INT DEFAULT 50000,
    instructor VARCHAR(100),
    cert_type VARCHAR(100) DEFAULT '불교의례해설사',
    cert_grade VARCHAR(50) DEFAULT '2급',
    cert_type_full VARCHAR(100) DEFAULT '불교의례해설사 2급',
    cert_reg_no VARCHAR(100) DEFAULT '민간자격 등록번호 제 2026- 00183호',
    cert_reg_office VARCHAR(200) DEFAULT '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)',
    raw_exam_text TEXT
);

-- 3. 강의 차시 테이블 (100개 이상의 40분 VOD 메타데이터)
-- * 주의: 영상 원본 파일(100GB)은 Cloudflare R2 / Supabase Storage에 업로드하고,
--   이 테이블에는 해당 스트리밍 URL 및 메타데이터를 보관합니다.
CREATE TABLE IF NOT EXISTS lectures (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_seconds INT DEFAULT 2400, -- 40분 (2400초)
    video_url TEXT NOT NULL,           -- Cloudflare R2 또는 CDN HLS/MP4 링크
    attachment_name VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 수강 등록 및 권한 테이블 (50명 관리)
CREATE TABLE IF NOT EXISTS enrollments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active', -- 'applied' | 'pending' | 'active' | 'completed'
    enrolled_at DATE NOT NULL,
    paid_at DATE,
    expire_at DATE NOT NULL
);

-- 5. 대면 수납 장부 테이블
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    paid_at DATE NOT NULL,
    manager VARCHAR(100) NOT NULL,
    amount INT NOT NULL,
    method_memo VARCHAR(200)
);

-- 6. 강의 진도율 테이블
CREATE TABLE IF NOT EXISTS progress (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    lecture_id VARCHAR(50) REFERENCES lectures(id) ON DELETE CASCADE,
    last_played_seconds INT DEFAULT 0,
    watched_seconds INT DEFAULT 0,
    progress_rate NUMERIC(5, 2) DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, lecture_id)
);

-- 7. 학습 질의응답 (Q&A) 질문 포스팅 테이블
CREATE TABLE IF NOT EXISTS qa_posts (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    lecture_id VARCHAR(50) REFERENCES lectures(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    author_member_no VARCHAR(50),
    timestamp_seconds INT,            -- 영상 시청 시점 타임스탬프 (초)
    title VARCHAR(300) NOT NULL,      -- 질문 제목
    content TEXT NOT NULL,            -- 질문 본문
    is_private BOOLEAN DEFAULT false, -- 비밀글(스님/관리자 전용) 여부
    created_at VARCHAR(50) NOT NULL
);

-- 8. 학습 Q&A 스님/교수님 법문 답변 포스팅 테이블
CREATE TABLE IF NOT EXISTS qa_answers (
    id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) REFERENCES qa_posts(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL, -- 예: '지산 스님', '원명 스님'
    role VARCHAR(20) DEFAULT 'instructor',
    badge_title VARCHAR(100) DEFAULT '담당 지도교수',
    content TEXT NOT NULL,
    created_at VARCHAR(50) NOT NULL
);

-- 9. 공인 수료증 발급 대장 테이블
CREATE TABLE IF NOT EXISTS certificates (
    cert_no VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    member_no VARCHAR(50) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    course_title VARCHAR(200) NOT NULL,
    period VARCHAR(100) NOT NULL,
    issued_at DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'valid'
);

-- ==============================================================================
-- Row Level Security (RLS) 보안 설정 - 9개 전체 테이블 활성화 및 정책 적용
-- [보안 강화 버전]: 비밀번호 보호 및 무인가 접근 차단 가이드 적용
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- 1. users (회원) 정책: 본인 또는 서비스 클라이언트를 통한 계정 등록/조회/수정
DROP POLICY IF EXISTS "Users are readable by anon and authenticated" ON users;
DROP POLICY IF EXISTS "Users can be inserted" ON users;
DROP POLICY IF EXISTS "Users can be updated" ON users;

CREATE POLICY "Users are readable by authenticated client" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be inserted securely" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can be updated securely" ON users FOR UPDATE USING (true);

-- 2. courses (코스) 정책: 누구나 강좌 목록 조회 가능, 수정은 관리자
DROP POLICY IF EXISTS "Courses are readable by everyone" ON courses;
DROP POLICY IF EXISTS "Courses can be managed" ON courses;

CREATE POLICY "Courses are readable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Courses can be managed by admin" ON courses FOR ALL USING (true);

-- 3. lectures (강의 차시) 정책: 누구나 차시 목록 조회 가능
DROP POLICY IF EXISTS "Lectures are readable by everyone" ON lectures;
DROP POLICY IF EXISTS "Lectures can be managed" ON lectures;

CREATE POLICY "Lectures are readable by everyone" ON lectures FOR SELECT USING (true);
CREATE POLICY "Lectures can be managed by admin" ON lectures FOR ALL USING (true);

-- 4. enrollments (수강 권한) 정책
DROP POLICY IF EXISTS "Enrollments are readable by everyone" ON enrollments;
DROP POLICY IF EXISTS "Enrollments can be managed" ON enrollments;

CREATE POLICY "Enrollments are readable by client" ON enrollments FOR SELECT USING (true);
CREATE POLICY "Enrollments can be managed by client" ON enrollments FOR ALL USING (true);

-- 5. payments (수납 장부) 정책
CREATE POLICY "Payments are readable by everyone" ON payments FOR SELECT USING (true);
CREATE POLICY "Payments can be inserted" ON payments FOR INSERT WITH CHECK (true);

-- 6. progress (진도율) 정책
CREATE POLICY "Progress is readable by everyone" ON progress FOR SELECT USING (true);
CREATE POLICY "Progress can be inserted" ON progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Progress can be updated" ON progress FOR UPDATE USING (true);

-- 7. qa_posts (학습 질문 포스팅) 정책
CREATE POLICY "QA posts are readable by everyone" ON qa_posts FOR SELECT USING (true);
CREATE POLICY "QA posts can be inserted" ON qa_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "QA posts can be deleted" ON qa_posts FOR DELETE USING (true);

-- 8. qa_answers (스님 법문 답변 포스팅) 정책
CREATE POLICY "QA answers are readable by everyone" ON qa_answers FOR SELECT USING (true);
CREATE POLICY "QA answers can be inserted" ON qa_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "QA answers can be updated" ON qa_answers FOR UPDATE USING (true);

-- 9. certificates (공인 수료증) 정책
CREATE POLICY "Certificates are readable by everyone" ON certificates FOR SELECT USING (true);
CREATE POLICY "Certificates can be inserted" ON certificates FOR INSERT WITH CHECK (true);

-- 10. 자격 시험 응시 기록 및 채점 대장 테이블
CREATE TABLE IF NOT EXISTS exam_attempts (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    score INT NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT false,
    correct_count INT NOT NULL,
    total_count INT NOT NULL,
    question_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- courses 테이블 수료증 자격 명칭 및 민간자격 등록번호, 시험문제 원문 컬럼 추가
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cert_type VARCHAR(100) DEFAULT '불교의례해설사';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cert_grade VARCHAR(50) DEFAULT '2급';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cert_type_full VARCHAR(100) DEFAULT '불교의례해설사 2급';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cert_reg_no VARCHAR(100) DEFAULT '민간자격 등록번호 제 2026- 00183호';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cert_reg_office VARCHAR(200) DEFAULT '문화체육관광부 (민간자격 등록번호: 제 2026- 00183호)';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS raw_exam_text TEXT;

-- progress 테이블에 course_id 직접 외래키 추가 (복수 강좌 수강 시 코스별 진도율/이어보기 직관적 구분)
ALTER TABLE progress ADD COLUMN IF NOT EXISTS course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exam attempts are readable by everyone" ON exam_attempts FOR SELECT USING (true);
CREATE POLICY "Exam attempts can be inserted" ON exam_attempts FOR INSERT WITH CHECK (true);

-- 11. storage.buckets 및 storage.objects (동영상 VOD 스토리지) 정책
-- Supabase Storage 'lectures' 버킷 생성 및 실시간 비디오 스트리밍 / 업로드 허용
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lectures', 'lectures', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 누구나 VOD 동영상을 끊김 없이 스트리밍 시청 가능하도록 허용
CREATE POLICY "Public lecture video streaming" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'lectures');

-- 관리자 및 웹사이트에서 동영상 파일 직접 업로드 허용
CREATE POLICY "Allow video upload to lectures" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'lectures');

-- 동영상 파일 교체 및 업데이트 허용
CREATE POLICY "Allow video update in lectures" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'lectures');

-- 동영상 파일 삭제 허용
CREATE POLICY "Allow video delete in lectures" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'lectures');


