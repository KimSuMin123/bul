import React, { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { enrichCertificate } from '../../services/certService';
import SealGraphic from './SealGraphic';

const logo = import.meta.env?.VITE_CERTIFICATE_LOGO_URL || '/images/logo.png';
const dateText = value => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed).map(p => [p.type, p.value]));
  return `${parts.year}.${parts.month}.${parts.day}`;
};

export default function CertificateModal({ certificate: rawCert, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!rawCert) return undefined;
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previousFocus?.focus?.(); };
  }, [rawCert, onClose]);
  if (!rawCert) return null;
  const cert = enrichCertificate(rawCert);
  return <div className="cert-modal-backdrop" onClick={onClose}>
    <div className="cert-modal-shell" role="dialog" aria-modal="true" aria-labelledby="certificate-title" onClick={event => event.stopPropagation()}>
      <div className="cert-actions no-print"><span>자격증 미리보기</span><div><button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={16} /> 인쇄 / PDF 저장</button><button ref={closeRef} className="btn btn-secondary btn-sm" onClick={onClose} aria-label="자격증 닫기"><X size={17} /> 닫기</button></div></div>
      <article className="cert-paper" id="printable-certificate" aria-label={`${cert.studentName || ''} 자격증`}>
        <div className="cert-frame" aria-hidden="true" />
        <header className="cert-header"><img className="cert-logo" src={logo} alt="세화불학원 로고" /><p className="cert-serial">자격증 번호 {cert.certNo || '—'}</p><h1 id="certificate-title">자 격 증</h1><p className="cert-title-en">{cert.certEnTitle || 'CERTIFICATE OF QUALIFICATION'}</p></header>
        <section className="cert-main" aria-label="자격 정보">
          <div className="cert-person"><div className="cert-person-fields"><p><span>자격종목</span><strong>{cert.certTypeFull || cert.certType || '—'}</strong></p><p><span>성명</span><strong>{cert.studentName || '—'}</strong></p><p><span>생년월일</span><strong>{cert.birthDate || '—'}</strong></p></div></div>
          <p className="cert-statement">위 사람은 세화붓다아카데미의 검정기준에 따라 시행한 <strong>{cert.certTypeFull || cert.certType || '해당 자격'}</strong> 검정 시험에 합격하였으므로 이 자격증을 수여합니다.</p>
        </section>
        <footer className="cert-footer"><p className="cert-date">{dateText(cert.issuedAt)}</p><div className="cert-issuer"><strong>{cert.issuingOrg || '[사] 세화불학원'} {cert.representative || '이사장'}</strong><SealGraphic size={78} /></div><p className="cert-office">{cert.regOffice || ''}</p><p className="cert-check">발급고유코드 {cert.certNo || '—'} · 학적식별번호 {cert.memberNo || '—'}</p><p className="cert-legal">본 자격증은 자격기본법 제17조 제2항에 따른 등록민간자격입니다. 세화불학원 온라인 학사관리시스템에서 진위를 확인할 수 있습니다.</p></footer>
      </article>
    </div>
  </div>;
}
