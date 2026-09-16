import React, { useState } from 'react';
import { Search, Award, CheckCircle2, XCircle, ShieldCheck, ArrowRight, Calendar, User } from 'lucide-react';
import { verifyCertificate } from '../services/certService';
import { useCourse } from '../context/CourseContext';
import SealGraphic from '../components/certificate/SealGraphic';

export default function CertificateVerifyPage({ onNavigate }) {
  const { certificates } = useCourse();
  const [searchQuery, setSearchQuery] = useState('CERT-2026-00088');
  const [verifyResult, setVerifyResult] = useState(() => verifyCertificate('CERT-2026-00088', certificates));
  const [hasSearched, setHasSearched] = useState(true);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    const result = verifyCertificate(searchQuery, certificates);
    setVerifyResult(result);
    setHasSearched(true);
  };

  // Mask student name for privacy: "이보디" -> "이*디", "김도현" -> "김*현"
  const maskName = (name) => {
    if (!name) return '';
    if (name.length <= 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  return (
    <div style={{ padding: '60px 0 80px 0', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: '680px' }}>
        
        {/* Verification Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div 
            style={{ 
              width: '52px', 
              height: '52px', 
              borderRadius: '50%', 
              background: 'var(--color-amber-subtle)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 16px auto' 
            }}
          >
            <Award size={28} color="var(--color-amber-dark)" />
          </div>
          <h1 className="heading-1 font-serif" style={{ fontSize: '30px', marginBottom: '8px' }}>
            수료증 진위 확인 시스템
          </h1>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            사단법인 세화불학원에서 정식 발급된 수료증의 진위 여부를 실시간으로 대외 검증합니다.
          </p>
        </div>

        {/* Search Bar Card */}
        <div className="card" style={{ padding: '24px 28px', marginBottom: '28px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={18} 
                color="#94A3B8" 
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} 
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '40px', fontSize: '15px', textTransform: 'uppercase' }}
                placeholder="수료증 발급번호 (예: CERT-2026-00088)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0 24px' }}>
              <span>조회하기</span>
            </button>
          </form>

          {/* Sample quick button */}
          <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>예시 발급번호:</span>
            <button 
              type="button" 
              className="btn-ghost" 
              style={{ color: 'var(--color-sage)', padding: 0, textDecoration: 'underline', fontSize: '12.5px' }}
              onClick={() => {
                setSearchQuery('CERT-2026-00088');
                setVerifyResult(verifyCertificate('CERT-2026-00088', certificates));
                setHasSearched(true);
              }}
            >
              CERT-2026-00088 (이보디 수료생)
            </button>
          </div>
        </div>

        {/* Verification Result Area */}
        {hasSearched && (
          <div>
            {verifyResult ? (
              <div 
                className="card" 
                style={{ 
                  padding: '36px', 
                  border: '2px solid var(--color-sage)', 
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Official Verification Header Tag */}
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    backgroundColor: 'var(--color-sage-subtle)', 
                    padding: '12px 18px', 
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '24px',
                    border: '1px solid rgba(59,82,73,0.2)'
                  }}
                >
                  <CheckCircle2 size={24} color="var(--color-sage)" />
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--color-sage-dark)' }}>
                      정상 등록된 공인 민간자격증입니다
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      사단법인 세화불학원 전산 학사시스템 및 주무부처 등록대장의 정본 기록과 100% 일치합니다.
                    </div>
                  </div>
                </div>

                {/* Verified Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px', marginBottom: '28px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>자격증 등록번호</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-charcoal)', marginTop: '2px' }}>
                      {verifyResult.certRegNo || verifyResult.certNo}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>발급 전산 식별코드</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-sage)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {verifyResult.certNo}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>자격 종목 및 등급</span>
                    <div style={{ marginTop: '3px' }}>
                      <span className="badge badge-amber" style={{ fontSize: '13px', fontWeight: 700 }}>
                        {verifyResult.certTypeFull || '불교의례법사 2급'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>자격 취득자 (개인정보 마스킹)</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-charcoal)', marginTop: '2px' }}>
                      {maskName(verifyResult.studentName)}
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>이수 교육과정명</span>
                    <div className="font-serif" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-sage)', marginTop: '4px' }}>
                      {verifyResult.courseTitle}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>교육 이수 기간</span>
                    <div style={{ fontSize: '13px', color: 'var(--color-charcoal)', marginTop: '2px' }}>
                      {verifyResult.period}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>공식 검정/발급일자</span>
                    <div style={{ fontSize: '13px', color: 'var(--color-charcoal)', marginTop: '2px' }}>
                      {verifyResult.issuedAt}
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>자격 등록 및 주무부처</span>
                    <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                      {verifyResult.regOffice || '문화체육관광부 (민간자격 등록번호: 제 2024-003892 호)'}
                    </div>
                  </div>
                </div>

                {/* Authority & Seal Verification Footer */}
                <div 
                  style={{ 
                    borderTop: '1px dashed var(--color-border-warm)', 
                    paddingTop: '18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between' 
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 800, color: 'var(--color-charcoal)' }}>
                      사단법인 세화불학원 이사장
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      검증 확인 일시: {new Date().toLocaleDateString('ko-KR')} (전산 정본 대조필)
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <SealGraphic size={76} />
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="card" 
                style={{ 
                  padding: '40px 24px', 
                  textAlign: 'center', 
                  backgroundColor: 'var(--color-coral-subtle)',
                  border: '1px solid rgba(224, 109, 83, 0.25)' 
                }}
              >
                <XCircle size={44} color="var(--color-coral)" style={{ margin: '0 auto 12px auto' }} />
                <h3 className="heading-3" style={{ color: 'var(--color-coral-dark)', marginBottom: '6px' }}>
                  일치하는 수료증 정보를 찾을 수 없습니다
                </h3>
                <p style={{ fontSize: '13.5px', color: '#4A5568', maxWidth: '440px', margin: '0 auto 16px auto', lineHeight: '1.6' }}>
                  입력하신 발급번호 <strong>"{searchQuery}"</strong>에 해당하는 정식 수료 기록이 존재하지 않습니다.
                  발급번호의 영문 대소문자 및 숫자를 다시 확인해 주세요.
                </p>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                  관련 문의: 학과 교학처 02-2260-8888
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
