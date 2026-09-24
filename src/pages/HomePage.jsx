import React from 'react';
import {
  BookOpen, CheckCircle, ShieldCheck, Award, ArrowRight,
  Clock, Users, FileText, ChevronRight, HelpCircle
} from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import NamoAudio from '../components/home/NamoAudio';
import OpeningCeremony from '../components/home/OpeningCeremony';
import AnnouncementPopup from '../components/announcements/AnnouncementPopup';
import '../styles/home-experience.css';

export default function HomePage({ onNavigate, onSelectCourse }) {
  const { courses } = useCourse();
  const { currentUser } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, var(--color-surface-warm) 100%)',
          padding: '64px 0 54px 0',
          borderBottom: '1px solid var(--color-border)'
        }}
      >
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '40px',
            flexWrap: 'wrap'
          }}>
            {/* Left Content */}
            <div style={{ flex: '1 1 540px', textAlign: 'left' }}>
              <div
                className="badge badge-sage"
                style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '13px' }}
              >
                세화붓다아카데미
              </div>

              <h1
                className="heading-1 font-serif hero-heading"
                style={{ fontSize: '34px', lineHeight: '1.35', marginBottom: '10px', color: 'var(--color-charcoal)' }}
              >
                따라하는 불자에서 이끄는 불자로
              </h1>

              <p
                style={{ fontSize: '18px', color: 'var(--color-sage)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '14px', lineHeight: '1.45' }}
              >
                예경에서 영산재까지, 순서와 뜻을 함께 익히는 불교 의례 자격과정
              </p>

              <p
                style={{ fontSize: '15px', color: '#475569', lineHeight: '1.7', marginBottom: '22px' }}
              >
                세화불학원은 붓다의 교학과 함께 불자의 실천행위인 의례를 연구하고 실천해 온 사단법인입니다.<br />
                VOD 강의와 진도 관리, 자격증 발급을 온라인으로 운영합니다.
              </p>

              {/* Namo Buddhaya Greeting Box */}
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid var(--color-border-warm)',
                  borderLeft: '4px solid var(--color-amber)',
                  borderRadius: '10px',
                  marginBottom: '28px'
                }}
              >
                <p
                  style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-charcoal)', lineHeight: '1.6', marginBottom: '4px' }}
                >
                  붓다님께 절할 때나 벗을 보면 “나모붓다야”하며 인사해요.
                </p>
                <p
                  style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: 0, fontStyle: 'italic' }}
                >
                  When you bow to the Buddha or greet a friend,<br />
                  you say: “Namo Buddhāya” (meaning homage to Buddha)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => onNavigate(currentUser ? 'dashboard' : 'login')}
                >
                  <span>{currentUser ? '내 강의실 바로가기' : '수강 시작하기'}</span>
                  <ArrowRight size={18} />
                </button>

                <button
                  className="btn btn-secondary btn-lg"
                  onClick={() => {
                    const el = document.getElementById('curriculum-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <BookOpen size={18} color="var(--color-sage)" />
                  <span>개설 강좌 둘러보기</span>
                </button>
              </div>
            </div>

            {/* Right: Namo Buddhaya Illustration (No Background) */}
            <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', margin: '0 auto', alignSelf: 'center' }}>
              <NamoAudio />
            </div>
          </div>

          {/* Key Metric Highlights */}
          <div
            className="hero-metric-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: '16px',
              marginTop: '54px',
              textAlign: 'left'
            }}
          >
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--color-sage-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={22} color="var(--color-sage)" />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>체계적 VOD 커리큘럼</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>단계별 순차 학습</div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--color-amber-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} color="var(--color-amber-dark)" />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>안심 대면 수납 & 등록</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>학과 교학과 수기 관리</div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(59,82,73,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={22} color="var(--color-sage)" />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>100% 완강 후 시험 합격시</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>자격증 자동 발급</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* <OpeningCeremony /> */}
      <AnnouncementPopup />

      {/* Courses Catalog Section */}
      <section id="curriculum-section" style={{ backgroundColor: '#FFFFFF', padding: '60px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <span className="badge badge-amber" style={{ marginBottom: '8px' }}>CURRICULUM</span>
            <h2 className="heading-1 font-serif" style={{ marginBottom: '10px' }}>개설 강좌 안내</h2>
            <p className="text-body" style={{ color: 'var(--color-text-muted)' }}>
              입문 과정부터 심화 과정까지, 세화불학원의 정통 교수진이 전하는 깊이 있는 강좌입니다.
            </p>
          </div>

          <div
            className="courses-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}
          >
            {courses.map((course) => (
              <div key={course.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Course Thumbnail */}
                <div style={{ position: 'relative', height: '190px', overflow: 'hidden' }}>
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span
                    className="badge badge-sage"
                    style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(30,32,34,0.85)', color: '#FFFFFF', border: 'none' }}
                  >
                    {course.category}
                  </span>
                  <span
                    className="badge badge-amber"
                    style={{ position: 'absolute', bottom: '14px', right: '14px', background: 'rgba(212,155,75,0.92)', color: '#1E2022', fontWeight: 700 }}
                  >
                    수강기간 {course.defaultPeriodDays}일
                  </span>
                </div>

                {/* Course Content */}
                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 className="heading-2 font-serif" style={{ fontSize: '19px', marginBottom: '8px', lineHeight: '1.4' }}>
                    {course.title}
                  </h3>
                  <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: '1.6', marginBottom: '16px', flex: 1 }}>
                    {course.subtitle}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--color-border)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>지도 교수</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{course.instructor}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--color-border)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>수강료 (대면 수납)</span>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-sage)' }}>
                      {course.price ? `${course.price.toLocaleString()}원` : '별도 문의'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => onSelectCourse(course.id)}
                    >
                      <span>강의 목차 보기</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ & Admission Process Section */}
      <section style={{ backgroundColor: 'var(--color-surface-warm)', padding: '60px 0', borderTop: '1px solid var(--color-border)' }}>
        <div className="container" style={{ maxWidth: '840px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span className="badge badge-sage" style={{ marginBottom: '8px' }}>GUIDE & FAQ</span>
            <h2 className="heading-1 font-serif">수강생 이용 안내 FAQ</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="card" style={{ padding: '20px 24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="var(--color-sage)" />
                <span>수강 신청 및 결제는 어떻게 진행되나요?</span>
              </h4>
              <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: '1.7' }}>
                홈페이지에서 회원가입 후, 세화불학원 교학처를 방문하시거나 지정 계좌(농협 301-0264-3664-41, 예금주: [사] 세화불학원)로 수강료를 입금해 주시면
                관리자가 확인 후 해당 코스의 수강 권한을 승인합니다. 승인 즉시 '내 강의실'에서 모든 강의를 시청하실 수 있습니다.
              </p>
            </div>

            <div className="card" style={{ padding: '20px 24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="var(--color-sage)" />
                <span>자격증은 언제 발급되나요?</span>
              </h4>
              <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: '1.7' }}>
                모든 강의를 끝까지 듣고 자격 검정 시험에 합격하시면 내 강의실에서 자격증을 직접 출력하실 수 있습니다. 실물 자격증은 발급비 10,000원을 입금하고 받으실 주소를 알려 주시면 우편으로 발급해 드립니다.
              </p>
            </div>

            <div className="card" style={{ padding: '20px 24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="var(--color-sage)" />
                <span>중복 로그인은 가능한가요?</span>
              </h4>
              <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: '1.7' }}>
                한 계정에 한 기기만 접속됩니다. 다른 기기에서 로그인하시면 먼저 접속된 쪽이 끊깁니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
