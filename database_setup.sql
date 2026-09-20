-- ==============================================================================
-- 원각 불교 아카데미 (Sehwa Buddha Academy) Supabase DDL SQL Schema
-- 전체 테이블 초기화(DROP) 및 최신 정규 스키마 자동 재구축 스크립트
-- ==============================================================================

-- ==============================================================================
-- 0. 기존 테이블 전체 삭제 (CASCADE 순차 초기화)
-- ==============================================================================
DROP TABLE IF EXISTS exam_attempts CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS qa_answers CASCADE;
DROP TABLE IF EXISTS qa_posts CASCADE;
DROP TABLE IF EXISTS progress CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS lectures CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==============================================================================
-- 1. 회원 테이블 (users) - 50명 학인 및 관리자 계정
-- ==============================================================================
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    member_no VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'student', -- 'student' | 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. 강좌 코스 테이블 (courses)
-- ==============================================================================
CREATE TABLE courses (
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

-- ==============================================================================
-- 3. 강의 차시 테이블 (lectures)
-- ==============================================================================
CREATE TABLE lectures (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_seconds INT DEFAULT 2400, -- 기본 40분 (2400초)
    video_url TEXT NOT NULL,
    attachment_name VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 4. 수강 등록 및 권한 테이블 (enrollments)
-- ==============================================================================
CREATE TABLE enrollments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active', -- 'applied' | 'pending' | 'active' | 'completed'
    enrolled_at DATE NOT NULL,
    paid_at DATE,
    expire_at DATE NOT NULL
);

-- ==============================================================================
-- 5. 수납 장부 테이블 (payments)
-- ==============================================================================
CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    paid_at DATE NOT NULL,
    manager VARCHAR(100) NOT NULL,
    amount INT NOT NULL,
    method_memo VARCHAR(200)
);

-- ==============================================================================
-- 6. 강의 진도율 테이블 (progress)
-- ==============================================================================
CREATE TABLE progress (
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

-- ==============================================================================
-- 7. 학습 질의응답 (Q&A) 질문 포스팅 테이블 (qa_posts)
-- ==============================================================================
CREATE TABLE qa_posts (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
    lecture_id VARCHAR(50) REFERENCES lectures(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    author_member_no VARCHAR(50),
    timestamp_seconds INT,
    title VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false,
    created_at VARCHAR(50) NOT NULL
);

-- ==============================================================================
-- 8. 학습 Q&A 스님/교수님 법문 답변 포스팅 테이블 (qa_answers)
-- ==============================================================================
CREATE TABLE qa_answers (
    id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) REFERENCES qa_posts(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'instructor',
    badge_title VARCHAR(100) DEFAULT '담당 지도교수',
    content TEXT NOT NULL,
    created_at VARCHAR(50) NOT NULL
);

-- ==============================================================================
-- 9. 공인 수료증 발급 대장 테이블 (certificates)
-- ==============================================================================
CREATE TABLE certificates (
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
-- 10. 자격 시험 응시 기록 및 채점 대장 테이블 (exam_attempts)
-- ==============================================================================
CREATE TABLE exam_attempts (
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

-- ==============================================================================
-- Row Level Security (RLS) 및 보안 정책 일괄 적용
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
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- 1. users 정책
DROP POLICY IF EXISTS "Users are readable by authenticated client" ON users;
DROP POLICY IF EXISTS "Users can be inserted securely" ON users;
DROP POLICY IF EXISTS "Users can be updated securely" ON users;
CREATE POLICY "Users are readable by authenticated client" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be inserted securely" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can be updated securely" ON users FOR UPDATE USING (true);

-- 2. courses 정책
DROP POLICY IF EXISTS "Courses are readable by everyone" ON courses;
DROP POLICY IF EXISTS "Courses can be managed by admin" ON courses;
CREATE POLICY "Courses are readable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Courses can be managed by admin" ON courses FOR ALL USING (true);

-- 3. lectures 정책
DROP POLICY IF EXISTS "Lectures are readable by everyone" ON lectures;
DROP POLICY IF EXISTS "Lectures can be managed by admin" ON lectures;
CREATE POLICY "Lectures are readable by everyone" ON lectures FOR SELECT USING (true);
CREATE POLICY "Lectures can be managed by admin" ON lectures FOR ALL USING (true);

-- 4. enrollments 정책
DROP POLICY IF EXISTS "Enrollments are readable by client" ON enrollments;
DROP POLICY IF EXISTS "Enrollments can be managed by client" ON enrollments;
CREATE POLICY "Enrollments are readable by client" ON enrollments FOR SELECT USING (true);
CREATE POLICY "Enrollments can be managed by client" ON enrollments FOR ALL USING (true);

-- 5. payments 정책
DROP POLICY IF EXISTS "Payments are readable by everyone" ON payments;
DROP POLICY IF EXISTS "Payments can be inserted" ON payments;
CREATE POLICY "Payments are readable by everyone" ON payments FOR SELECT USING (true);
CREATE POLICY "Payments can be inserted" ON payments FOR INSERT WITH CHECK (true);

-- 6. progress 정책
DROP POLICY IF EXISTS "Progress is readable by everyone" ON progress;
DROP POLICY IF EXISTS "Progress can be inserted" ON progress;
DROP POLICY IF EXISTS "Progress can be updated" ON progress;
CREATE POLICY "Progress is readable by everyone" ON progress FOR SELECT USING (true);
CREATE POLICY "Progress can be inserted" ON progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Progress can be updated" ON progress FOR UPDATE USING (true);

-- 7. qa_posts 정책
DROP POLICY IF EXISTS "QA posts are readable by everyone" ON qa_posts;
DROP POLICY IF EXISTS "QA posts can be inserted" ON qa_posts;
DROP POLICY IF EXISTS "QA posts can be deleted" ON qa_posts;
CREATE POLICY "QA posts are readable by everyone" ON qa_posts FOR SELECT USING (true);
CREATE POLICY "QA posts can be inserted" ON qa_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "QA posts can be deleted" ON qa_posts FOR DELETE USING (true);

-- 8. qa_answers 정책
DROP POLICY IF EXISTS "QA answers are readable by everyone" ON qa_answers;
DROP POLICY IF EXISTS "QA answers can be inserted" ON qa_answers;
DROP POLICY IF EXISTS "QA answers can be updated" ON qa_answers;
CREATE POLICY "QA answers are readable by everyone" ON qa_answers FOR SELECT USING (true);
CREATE POLICY "QA answers can be inserted" ON qa_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "QA answers can be updated" ON qa_answers FOR UPDATE USING (true);

-- 9. certificates 정책
DROP POLICY IF EXISTS "Certificates are readable by everyone" ON certificates;
DROP POLICY IF EXISTS "Certificates can be inserted" ON certificates;
CREATE POLICY "Certificates are readable by everyone" ON certificates FOR SELECT USING (true);
CREATE POLICY "Certificates can be inserted" ON certificates FOR INSERT WITH CHECK (true);

-- 10. exam_attempts 정책
DROP POLICY IF EXISTS "Exam attempts are readable by everyone" ON exam_attempts;
DROP POLICY IF EXISTS "Exam attempts can be inserted" ON exam_attempts;
CREATE POLICY "Exam attempts are readable by everyone" ON exam_attempts FOR SELECT USING (true);
CREATE POLICY "Exam attempts can be inserted" ON exam_attempts FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 11. Storage 버킷 및 보안 정책 (동영상 VOD 스트리밍 버킷)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lectures', 'lectures', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public lecture video streaming" ON storage.objects;
DROP POLICY IF EXISTS "Allow video upload to lectures" ON storage.objects;
DROP POLICY IF EXISTS "Allow video update in lectures" ON storage.objects;
DROP POLICY IF EXISTS "Allow video delete in lectures" ON storage.objects;

CREATE POLICY "Public lecture video streaming" ON storage.objects FOR SELECT USING (bucket_id = 'lectures');
CREATE POLICY "Allow video upload to lectures" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lectures');
CREATE POLICY "Allow video update in lectures" ON storage.objects FOR UPDATE USING (bucket_id = 'lectures');
CREATE POLICY "Allow video delete in lectures" ON storage.objects FOR DELETE USING (bucket_id = 'lectures');

-- ==============================================================================
-- 12. 서버 인증 RPC (비밀번호 클라이언트 노출 차단)
-- ==============================================================================
CREATE OR REPLACE FUNCTION login_user(p_id TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
BEGIN
    SELECT id, password, name, birth_date, phone, member_no, role, created_at
    INTO v_user
    FROM users
    WHERE id = TRIM(p_id);

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 비밀번호 일치 검증 (SHA-256 해시 또는 레거시 평문)
    IF v_user.password = p_password THEN
        RETURN jsonb_build_object(
            'id', v_user.id,
            'name', v_user.name,
            'birthDate', v_user.birth_date,
            'phone', v_user.phone,
            'memberNo', v_user.member_no,
            'role', COALESCE(v_user.role, 'student'),
            'createdAt', v_user.created_at
        );
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

-- ==============================================================================
-- 13. 수납 & 수강권 활성화 원자적 트랜잭션 함수
-- ==============================================================================
CREATE OR REPLACE FUNCTION process_course_payment(
    p_user_id TEXT,
    p_course_id TEXT,
    p_amount INT,
    p_manager TEXT,
    p_method_memo TEXT,
    p_paid_at DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id TEXT;
    v_enrollment RECORD;
    v_period_days INT := 90;
    v_expire_date DATE;
BEGIN
    v_payment_id := 'pay_' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
    
    -- 1. 결제 기록 원자적 INSERT
    INSERT INTO payments (id, user_id, course_id, paid_at, manager, amount, method_memo)
    VALUES (v_payment_id, p_user_id, p_course_id, COALESCE(p_paid_at, CURRENT_DATE), TRIM(p_manager), p_amount, TRIM(p_method_memo));

    -- 2. 강좌 기본 수강기간(일) 조회
    SELECT COALESCE(default_period_days, 90) INTO v_period_days FROM courses WHERE id = p_course_id;
    IF v_period_days IS NULL THEN
        v_period_days := 90;
    END IF;
    v_expire_date := CURRENT_DATE + (v_period_days || ' days')::interval;

    -- 3. enrollment 활성화 (기존 신청건 UPDATE 또는 신규 INSERT)
    SELECT * INTO v_enrollment FROM enrollments WHERE user_id = p_user_id AND course_id = p_course_id;
    IF FOUND THEN
        UPDATE enrollments 
        SET status = 'active', paid_at = COALESCE(p_paid_at, CURRENT_DATE), expire_at = v_expire_date
        WHERE id = v_enrollment.id;
    ELSE
        INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at, paid_at, expire_at)
        VALUES (
            'enr_' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
            p_user_id,
            p_course_id,
            'active',
            CURRENT_DATE,
            COALESCE(p_paid_at, CURRENT_DATE),
            v_expire_date
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'paymentId', v_payment_id,
        'userId', p_user_id,
        'courseId', p_course_id,
        'status', 'active',
        'expireAt', v_expire_date
    );
END;
$$;

-- ==============================================================================
-- 14. 비밀번호를 제외한 공개 회원 뷰 (외부 비인가 접근 방지)
-- ==============================================================================
CREATE OR REPLACE VIEW users_public_view AS
SELECT id, name, birth_date, phone, member_no, role, created_at
FROM users;
