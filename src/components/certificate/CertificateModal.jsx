import React, { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { enrichCertificate } from '../../services/certService';
import SealGraphic from './SealGraphic';

const logo = import.meta.env?.VITE_CERTIFICATE_LOGO_URL || '/images/logo.png';
const dateText = value => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(parsed);
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
  const photo = cert.photoUrl || cert.photo_url || cert.studentPhoto || cert.profileImage || '';
  return <div className="cert-modal-backdrop" onClick={onClose}>
    <div className="cert-modal-shell" role="dialog" aria-modal="true" aria-labelledby="certificate-title" onClick={event => event.stopPropagation()}>
      <div className="cert-actions no-print"><span>자격증 미리보기</span><div><button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={16} /> 인쇄 / PDF 저장</button><button ref={closeRef} className="btn btn-secondary btn-sm" onClick={onClose} aria-label="자격증 닫기"><X size={17} /> 닫기</button></div></div>
      <article className="cert-paper" id="printable-certificate" aria-label={`${cert.studentName || ''} 자격증`}>
        <div className="cert-frame" aria-hidden="true" />
        <header className="cert-header"><img className="cert-logo" src={logo} alt="세화불학원 로고" /><p className="cert-serial">자격증 번호 {cert.certNo || '—'}</p><h1 id="certificate-title">자 격 증</h1><p className="cert-title-en">{cert.certEnTitle || 'CERTIFICATE OF QUALIFICATION'}</p></header>
        <section className="cert-main" aria-label="자격 정보">
          <div className="cert-person"><div className="cert-person-fields"><p><span>성명</span><strong>{cert.studentName || '—'}</strong></p><p><span>생년월일</span><strong>{cert.birthDate || '—'}</strong></p><p><span>학적식별번호</span><strong>{cert.memberNo || '—'}</strong></p></div>{photo && <img className="cert-photo" src={photo} alt={`${cert.studentName || '수료자'} 사진`} />}</div>
          <dl className="cert-details">
            <div><dt>자격 종목</dt><dd>{cert.certType || '—'}</dd></div><div><dt>자격 등급</dt><dd>{cert.certGrade || '—'}</dd></div><div><dt>등록번호</dt><dd>{cert.certRegNo || '—'}</dd></div><div><dt>이수 과정</dt><dd>{cert.courseTitle || '—'}</dd></div><div><dt>교육·검정 기간</dt><dd>{cert.period || '—'}</dd></div><div><dt>검정일자</dt><dd>{dateText(cert.issuedAt)}</dd></div><div><dt>발급 상태</dt><dd>{cert.status === 'valid' ? '유효' : cert.status || '—'}</dd></div>
          </dl>
          <p className="cert-statement">위 사람은 <strong>{cert.courseTitle || '해당 과정'}</strong>을 이수하고 자격 검정을 통과하여 <strong>{cert.certTypeFull || cert.certType || '해당 자격'}</strong>을 취득하였음을 증명합니다.</p>
          {cert.competency && <p className="cert-competency"><strong>직무 내용</strong><br />{cert.competency}</p>}
        </section>
        <footer className="cert-footer"><p className="cert-date">{dateText(cert.issuedAt)}</p><div className="cert-issuer"><strong>{cert.issuingOrg || '[사] 세화불학원'} {cert.representative || '이사장'}</strong><SealGraphic size={78} /></div><p className="cert-office">{cert.regOffice || ''}</p><p className="cert-check">발급고유코드 {cert.certNo || '—'} · 학적식별번호 {cert.memberNo || '—'}</p><p className="cert-legal">본 자격증은 자격기본법 제17조 제2항에 따른 등록민간자격입니다. 세화불학원 온라인 학사관리시스템에서 진위를 확인할 수 있습니다.</p></footer>
      </article>
    </div>
  </div>;
}
