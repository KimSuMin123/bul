import React from 'react';
import { PRIVACY_POLICY_VERSION } from '../../config/sitePolicy.js';

/** Collection notice remains available without losing form inputs or navigation. */
export function PrivacyNotice() {
  return <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
    <p><strong>개인정보 수집·이용 동의</strong> (버전 {PRIVACY_POLICY_VERSION})</p>
    <p>[사] 세화불학원은 회원 관리와 교육 서비스 제공을 위해 다음 정보를 처리합니다.</p>
    <ul style={{ paddingLeft: '20px' }}>
      <li>수집 항목: 아이디, 비밀번호, 이름, 생년월일, 휴대전화번호, 동의 여부·일시·문서 버전</li>
      <li>이용 목적: 회원 식별과 로그인, 중복 가입 방지, 수강·학습 관리, 수료·자격증 발급, 신청 및 Q&amp;A에 관한 서비스 문자 안내</li>
      <li>보유 기간: 회원 탈퇴 시까지. 별도 보관이 필요한 발급·수납 기록은 적용되는 보관 기준에 따라 분리하여 관리합니다.</li>
    </ul>
    <p>동의를 거부할 수 있으며, 필수 정보 처리에 동의하지 않으면 회원가입과 온라인 수강 서비스를 이용할 수 없습니다. 동의 철회·열람·정정·삭제 문의: <a href="mailto:sehwaba@gmail.com">sehwaba@gmail.com</a></p>
    <p>서비스 안내 문자는 수강 신청과 질문·답변 처리에 사용됩니다.</p>
  </div>;
}

export default function PrivacyConsent({ checked, onChange, disabled = false }) {
  return <fieldset style={{ padding: '14px', border: '1px solid var(--color-border)', borderRadius: '8px', margin: '16px 0' }}>
    <legend style={{ fontSize: '14px' }}>개인정보 처리 동의</legend>
    <details style={{ marginBottom: '12px' }}>
      <summary style={{ cursor: 'pointer' }}>개인정보 수집·이용 동의 내용 보기</summary>
      <PrivacyNotice />
    </details>
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px' }}>
      <input type="checkbox" name="privacyConsent" required checked={checked} disabled={disabled}
        onChange={event => onChange(event.target.checked)} style={{ marginTop: '4px' }} />
      <span>[필수] 개인정보 수집·이용에 동의합니다.</span>
    </label>
  </fieldset>;
}
