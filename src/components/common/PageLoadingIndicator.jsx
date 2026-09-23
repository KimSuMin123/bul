import React from 'react';
import './page-loading.css';

export default function PageLoadingIndicator({ label = '화면을 불러오는 중입니다...' }) {
  return <div className="page-loading" role="status" aria-live="polite">
    <span className="page-loading-ring" aria-hidden="true" />
    <span className="page-loading-sr-only">{label}</span>
  </div>;
}
