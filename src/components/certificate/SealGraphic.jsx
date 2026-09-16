import React from 'react';

/**
 * 사단법인 세화불학원 공식 사단 도장 (이사장 직인) 그래픽 컴포넌트
 */
export default function SealGraphic({ size = 80, className = '', style = {} }) {
  return (
    <img
      src="/images/official_seal.png"
      alt="사단법인 세화불학원 이사장 직인"
      width={size}
      height={size}
      className={`official-seal-img ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        filter: 'drop-shadow(0 2px 4px rgba(160, 20, 20, 0.3))',
        userSelect: 'none',
        pointerEvents: 'none',
        display: 'inline-block',
        ...style
      }}
    />
  );
}

