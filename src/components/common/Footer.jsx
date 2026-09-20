import React from 'react';
import { Phone, Mail, MapPin, Clock, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: 'var(--color-charcoal)',
        color: '#E2E8F0',
        padding: '50px 0 30px 0',
        borderTop: '1px solid #2D3136',
        marginTop: 'auto'
      }}
    >
      <div className="container">
        {/* Contemplative Quote Banner */}
        <div
          style={{
            textAlign: 'center',
            paddingBottom: '36px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '36px'
          }}
        >
          <p className="font-serif" style={{ fontSize: '18px', color: '#F8F9FA', letterSpacing: '0.04em', marginBottom: '6px' }}>
            “마음이 맑으면 머무는 곳마다 청정하리라 (心淸淨 隨其心淨 則佛土淨)”
          </p>
          <span style={{ fontSize: '12.5px', color: 'var(--color-amber)', letterSpacing: '0.08em' }}>
            — 유마경(維摩經) 불국품
          </span>
        </div>

        {/* Office Details & Links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '32px', marginBottom: '36px' }}>
          <div>
            <div style={{ marginBottom: '16px' }}>
              <img
                src="/images/logo-white.png"
                alt="사단법인 세화불학원"
                style={{ height: '36px', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#FFFFFF', marginBottom: '10px' }}>
              사단법인 세화붓다아카데미
            </h4>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.7', marginBottom: '16px' }}>
              인류의 성자 붓다의 교학을 근본으로 정통 불교 인문학 및 명상 강좌를 제공합니다.
              체계적인 VOD 강의와 정식 수료증 발급 시스템을 통해 마음의 평안과 바른 지혜를 함께 닦아갑니다.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href="https://www.xn--wr3bl1e16firr29a.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: 'var(--color-amber)',
                  textDecoration: 'none',
                  background: 'rgba(212, 155, 75, 0.12)',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid rgba(212, 155, 75, 0.3)',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <span>세화불학원 공식 본원</span>
                <ExternalLink size={13} />
              </a>

              <a
                href="https://band.us/n/a7a2b3X7k88dC"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: '#4ADE80',
                  textDecoration: 'none',
                  background: 'rgba(74, 222, 128, 0.1)',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid rgba(74, 222, 128, 0.25)',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <span>네이버 밴드 바로가기</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginBottom: '14px' }}>
              법인 및 교학처 정보
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px', color: '#94A3B8' }}>
              <div>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>사단법인 세화불학원</span>
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#CBD5E1' }}>법인고유번호: 777-82-00464</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={15} color="var(--color-amber)" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>서울 종로구 삼봉로 81, 613호 (수송동, 두산위브파빌리온)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={15} color="var(--color-amber)" />
                <span>대표 이메일: <a href="mailto:sehwaba@gmail.com" style={{ color: '#E2E8F0', textDecoration: 'underline' }}>sehwaba@gmail.com</a></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={15} color="var(--color-amber)" />
                <span>상담 시간: 평일 09:00 ~ 17:00 (주말 및 공휴일 휴무)</span>
              </div>

              <div style={{ marginTop: '6px', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--color-amber)', fontWeight: 600, marginBottom: '2px' }}>회비 및 수납 계좌</div>
                <div style={{ fontSize: '12.5px', color: '#F1F5F9', fontWeight: 500 }}>농협 301-0264-3664-41 <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 400 }}>(사단법인 세화불학원)</span></div>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginBottom: '14px' }}>
              수강 및 수료 정책
            </h4>
            <ul style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.8', paddingLeft: 0, listStyle: 'none' }}>


              <li>•   수강기간은 승인일부터 90일</li>
              <li>•   모든 강의를 들으면 수료</li>
              <li>•   한 계정에 한 기기만 접속</li>
              <li>•   수료증은 내 강의실에서 바로 발급</li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B', flexWrap: 'wrap', gap: '10px' }}>
          <div>© 2026 Sehwa Buddha Academy (사단법인 세화불학원). All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}

