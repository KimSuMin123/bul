import React, { useEffect, useMemo, useState } from 'react';

export const ADMIN_PAGE_SIZE = 15;

// 목록을 페이지 단위로 자른다. 검색어·필터(resetKey)가 바뀌면 1페이지로, 목록이 줄면 마지막 페이지로 맞춘다.
// 엑셀 내보내기 등은 원래 목록을 그대로 쓰고, 화면 표시에만 pageItems를 쓴다.
export function usePagination(items, resetKey, pageSize = ADMIN_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const list = items || [];
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageItems = useMemo(() => list.slice((current - 1) * pageSize, current * pageSize), [list, current, pageSize]);
  return { page: current, setPage, totalPages, pageItems, total: list.length, pageSize };
}

// 현재 페이지 주변 번호만 보여 준다: 1 … 4 5 6 … 12
function pageNumbers(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? ['gap-' + n, n] : [n]));
}

export default function AdminPagination({ page, setPage, totalPages, total, pageSize }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const button = (active, disabled = false) => ({
    minWidth: '34px', height: '34px', padding: '0 10px', borderRadius: '8px', fontSize: '13px', fontWeight: active ? 700 : 500,
    border: active ? '1px solid var(--color-sage)' : '1px solid #E5E7EB',
    background: active ? 'var(--color-sage)' : '#FFFFFF', color: active ? '#FFFFFF' : '#374151',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1
  });
  return (
    <nav aria-label="목록 페이지" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
        <button type="button" style={button(false, page === 1)} disabled={page === 1}onClick={() => setPage(page - 1)} aria-label="이전 페이지">‹ 이전</button>
        {pageNumbers(page, totalPages).map(n => typeof n === 'string'
          ? <span key={n} style={{ alignSelf: 'center', color: '#9CA3AF' }}>…</span>
          : <button key={n} type="button" style={button(n === page)} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>)}
        <button type="button" style={button(false, page === totalPages)} disabled={page === totalPages}onClick={() => setPage(page + 1)} aria-label="다음 페이지">다음 ›</button>
      </div>
      <span style={{ fontSize: '13px', color: '#6B7280' }}>총 {total}건 중 {from}–{to}</span>
    </nav>
  );
}
