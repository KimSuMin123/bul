import React from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Award } from 'lucide-react';
import { enrichCertificate } from '../../services/certService';
import SealGraphic from './SealGraphic';

export default function CertificateModal({ certificate: rawCert, onClose }) {
  if (!rawCert) return null;

  const cert = enrichCertificate(rawCert);

  const handlePrint = () => {
    window.print();
  };

  const certDate = cert.issuedAt ? new Date(cert.issuedAt) : new Date();
  const dateFormatted = `${certDate.getFullYear()}년 ${String(certDate.getMonth() + 1).padStart(2, '0')}월 ${String(certDate.getDate()).padStart(2, '0')}일`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card" 
        style={{ 
          maxWidth: '880px', 
          width: '95%', 
          padding: '0', 
          background: 'transparent', 
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Floating Action Bar (hidden in print) */}
        <div 
          className="no-print cert-modal-bar" 
          style={{ 
            width: '100%',
            maxWidth: '880px',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'var(--color-charcoal)', 
            padding: '12px 20px', 
            borderRadius: '10px 10px 0 0',
            color: '#FFFFFF',
            boxSizing: 'border-box',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Award size={19} color="var(--color-amber)" />
            <span style={{ fontSize: '15px', fontWeight: 700 }}>사단법인 정식 수료증 발급</span>
            <span className="badge badge-amber" style={{ fontSize: '11.5px', fontWeight: 600 }}>
              {cert.certTypeFull}
            </span>
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
              {cert.certRegNo}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-amber btn-sm" onClick={handlePrint} style={{ fontWeight: 700, padding: '7px 14px' }}>
              <Printer size={15} />
              <span>수료증 인쇄 / PDF 저장</span>
            </button>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ color: '#E2E8F0', padding: '6px' }}
              onClick={onClose}
              title="닫기"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* The Printable A4 Certificate Paper (wrapped in screen scroll for mobile) */}
        <div className="cert-paper-screen-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div 
            className="cert-paper cert-paper-qualification" 
            id="printable-certificate"
            style={{ 
              width: '100%', 
              maxWidth: '880px', 
              borderRadius: '0', 
              boxSizing: 'border-box' 
            }}
          >
            {/* Background Security Watermark */}
            <div className="cert-watermark" aria-hidden="true">
              <svg width="300" height="300" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="44" stroke="#3B5249" strokeWidth="2" opacity="0.04" />
                <circle cx="50" cy="50" r="36" stroke="#D49B4B" strokeWidth="1" strokeDasharray="3 3" opacity="0.05" />
                <path d="M50 18 L58 42 L82 50 L58 58 L50 82 L42 58 L18 50 L42 42 Z" fill="#3B5249" opacity="0.035" />
                <circle cx="50" cy="50" r="10" fill="#D49B4B" opacity="0.04" />
              </svg>
            </div>

            {/* Decorative Double Frames and Corners */}
            <div className="cert-frame"></div>
            <div className="cert-corner top-left"></div>
            <div className="cert-corner top-right"></div>
            <div className="cert-corner bottom-left"></div>
            <div className="cert-corner bottom-right"></div>

            {/* Top Qualification Meta Header */}
            <div className="cert-top-meta">
              <div className="cert-meta-left">
                <span className="cert-meta-label">등록번호</span>
                <span className="cert-meta-value font-mono"><strong>{cert.certRegNo}</strong></span>
                <span className="cert-meta-sub">발급고유코드: {cert.certNo}</span>
              </div>
              <div className="cert-meta-right">
                <span className="cert-meta-badge">등록민간자격</span>
                <span className="cert-meta-sub">{cert.regOffice}</span>
              </div>
            </div>

            {/* Certificate Grand Title */}
            <div className="cert-header">
              <div className="cert-emblem">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="44" stroke="#3B5249" strokeWidth="2.5" />
                  <circle cx="50" cy="50" r="36" stroke="#D49B4B" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M50 20 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42 Z" fill="#3B5249" opacity="0.9" />
                  <circle cx="50" cy="50" r="7" fill="#D49B4B" />
                </svg>
              </div>
              <h1 className="cert-title-ko font-serif">자&nbsp;&nbsp;격&nbsp;&nbsp;증</h1>
              <p className="cert-title-en">CERTIFICATE OF QUALIFICATION</p>
              <div className="cert-title-divider"></div>
            </div>

            {/* Qualification Details Grid Table (민간자격증 표준 서식 규격) */}
            <div className="cert-table-container">
              <table className="cert-spec-table">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '32%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <th className="cert-th">성&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</th>
                    <td className="cert-td cert-td-name font-serif">{cert.studentName}</td>
                    <th className="cert-th">생 년 월 일</th>
                    <td className="cert-td font-serif">{cert.birthDate}</td>
                  </tr>
                  <tr>
                    <th className="cert-th">자 격 종 목</th>
                    <td className="cert-td">
                      <strong className="cert-type-text">{cert.certType}</strong>
                    </td>
                    <th className="cert-th">자 격 등 급</th>
                    <td className="cert-td">
                      <span className="cert-grade-tag font-serif">{cert.certGrade}</span>
                    </td>
                  </tr>
                  <tr>
                    <th className="cert-th">자 격 번 호</th>
                    <td className="cert-td font-mono" style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>
                      {cert.certRegNo}
                    </td>
                    <th className="cert-th">검 정 일 자</th>
                    <td className="cert-td font-serif">{cert.issuedAt}</td>
                  </tr>
                  <tr>
                    <th className="cert-th">이 수 과 정</th>
                    <td className="cert-td cert-course-title font-serif" colSpan={3}>
                      {cert.courseTitle}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Certification Statement */}
            <div className="cert-clause-wrap">
              <p className="cert-desc font-serif">
                위 사람은 자격기본법 제17조 제2항 및 사단법인 세화불학원 자격검정 관리운영 규정에 따라 
                소정의 전문 교육과정을 성실히 이수하고 자격 검정 평가에 합격하였으므로, 
                <strong style={{ color: '#1E2022', fontWeight: 700 }}> {cert.certTypeFull}</strong> 자격을 취득하였음을 증명합니다.
              </p>
            </div>

            {/* Footer: Issue Date & Issuing Authority with Official Corporation Seal */}
            <div className="cert-footer">
              {/* Left: Verification & Security Identification */}
              <div className="cert-verification-block">
                <div className="cert-verify-stamp-box">
                  <span style={{ fontSize: '8px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>전산정본대조필</span>
                  <span style={{ fontSize: '10px', color: '#3B5249', fontWeight: 800, fontFamily: 'monospace' }}>{cert.certNo}</span>
                </div>
                <div className="cert-verify-info">
                  <span className="cert-verify-label">민간자격 실시간 진위확인</span>
                  <span className="cert-verify-url">{cert.certNo}</span>
                  <span style={{ fontSize: '9px', color: '#8A99A8' }}>학적식별: {cert.memberNo || 'SEHWA-MEMBER'}</span>
                </div>
              </div>

              {/* Center/Right: Date & Authority with Official Seal */}
              <div className="cert-authority-block">
                <p className="cert-date font-serif">{dateFormatted}</p>
                <div className="cert-org-wrapper">
                  <p className="cert-org-name font-serif">
                    사단법인 세화불학원 이사장
                  </p>
                  <div className="cert-seal-position">
                    <SealGraphic size={84} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Legal Notice Bar */}
            <div className="cert-legal-notice">
              <span>• 본 자격증은 자격기본법 제17조 제2항에 따라 등록된 민간자격(주무부처: 문화체육관광부, 등록번호: 제2024-003892호)입니다.</span>
              <span>• 사단법인 세화불학원 온라인 학사관리시스템을 통해 24시간 실시간 진위 확인 및 정본 대조가 가능합니다.</span>
            </div>

          </div>
        </div>

        {/* Bottom Tip Bar (hidden in print) */}
        <div 
          className="no-print" 
          style={{ 
            width: '100%',
            maxWidth: '880px',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            background: 'var(--color-charcoal)', 
            padding: '11px 20px', 
            borderRadius: '0 0 10px 10px',
            color: '#94A3B8',
            fontSize: '12.5px',
            boxSizing: 'border-box',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <span>* 인쇄 설정에서 "배경 그래픽 포함"을 선택하시면 공식 사단 도장 직인 및 금박 테두리가 가장 선명하게 인쇄됩니다.</span>
        </div>
      </div>
    </div>
  );
}
