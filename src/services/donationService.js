// ==============================================================================
// Sehwa Buddha Academy - Donation Receipt Management Service
// 1전화번호당 단 1개 행 엄격 유지 (기부 건수 무관 금액 누적 가산)
// 엑셀(CSV) 추출: 전체 보기 / 미발행 건(기발행자 제외) / 기발행 건 추출 지원
// ==============================================================================

/**
 * 전화번호 정규화 유틸리티 (하이픈 통일: 010-XXXX-XXXX)
 * @param {string} rawPhone 
 * @returns {string}
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return rawPhone.trim();
}

/**
 * 1개 전화번호당 1행 엄격 누적 가산 처리 함수
 * 기부가 2건이든 3건이든 동일 전화번호는 기존 행의 totalAmount에 금액만 가산
 * 
 * @param {Array} currentReceipts - 현재 기부 영수증 대장 목록
 * @param {Object} payload - { userId, name, phone, amount, courseTitle, paymentId, paidAt }
 * @returns {{ updatedList: Array, targetReceipt: Object, isNew: boolean }}
 */
export function aggregateDonationReceipt(currentReceipts = [], {
  userId,
  name,
  phone,
  amount,
  courseTitle = '강좌 수강료',
  paymentId = null,
  paidAt = null
}) {
  const normPhone = normalizePhone(phone);
  const nowStr = paidAt || new Date().toISOString().split('T')[0];
  const numAmount = Math.max(0, parseInt(amount, 10) || 0);

  const listCopy = Array.isArray(currentReceipts) ? [...currentReceipts] : [];

  // 전화번호(또는 회원 ID)로 기존 등록 여부 탐색 (1전번 = 1행 원칙)
  const existingIndex = listCopy.findIndex(item => {
    const itemNormPhone = normalizePhone(item.phone);
    if (normPhone && itemNormPhone && normPhone === itemNormPhone) return true;
    if (userId && item.userId && userId === item.userId) return true;
    return false;
  });

  const historyItem = {
    paymentId: paymentId || `pay_${Date.now()}`,
    courseTitle: courseTitle || '불교의례 강좌',
    amount: numAmount,
    issuedAt: nowStr
  };

  if (existingIndex >= 0) {
    // [기존 행 갱신] 새 행을 추가하지 않고 금액만 누적 가산!
    const prev = listCopy[existingIndex];
    const prevHistory = Array.isArray(prev.history) ? prev.history : [];

    const updated = {
      ...prev,
      userId: prev.userId || userId,
      name: name || prev.name,
      phone: normPhone || prev.phone,
      totalAmount: (parseInt(prev.totalAmount, 10) || 0) + numAmount,
      lastIssuedAt: nowStr,
      donationCount: (prev.donationCount || prevHistory.length || 1) + 1,
      history: [...prevHistory, historyItem]
    };

    listCopy[existingIndex] = updated;
    return {
      updatedList: listCopy,
      targetReceipt: updated,
      isNew: false
    };
  } else {
    // [신규 행 생성] 최초 1회 행 등록
    const newReceipt = {
      id: `don_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: userId || null,
      name: (name || '익명 학인').trim(),
      phone: normPhone,
      totalAmount: numAmount,
      lastIssuedAt: nowStr,
      createdAt: nowStr,
      donationCount: 1,
      history: [historyItem]
    };

    listCopy.push(newReceipt);
    return {
      updatedList: listCopy,
      targetReceipt: newReceipt,
      isNew: true
    };
  }
}

/**
 * 특정 학인 또는 전화번호의 기부 영수증 기발행 여부 및 정보 조회
 * @param {Array} receipts 
 * @param {string} phone 
 * @param {string} userId 
 * @returns {Object|null}
 */
export function findReceiptByPhoneOrUser(receipts = [], phone = '', userId = '') {
  if (!Array.isArray(receipts)) return null;
  const normTarget = normalizePhone(phone);

  return receipts.find(r => {
    if (normTarget && normalizePhone(r.phone) === normTarget) return true;
    if (userId && r.userId === userId) return true;
    return false;
  }) || null;
}

/**
 * Excel 호환 UTF-8 BOM CSV 생성 및 브라우저 다운로드
 * 한글 깨짐 방지 (\uFEFF) 적용
 * 
 * @param {Array<Object>} rows - 테이블 데이터 행 배열
 * @param {Array<{ key: string, label: string, formatter?: Function }>} columns - 컬럼 정의
 * @param {string} filename - 저장될 파일명
 */
export function exportToExcelCSV(rows = [], columns = [], filename = '세화붓다아카데미_수납_기부금_명단.csv') {
  if (!rows || rows.length === 0) {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('추출할 데이터가 없습니다.');
    }
    return false;
  }

  // 1. 헤더 생성
  const headerLine = columns.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',');

  // 2. 데이터 행 생성
  const dataLines = rows.map((row, idx) => {
    return columns.map(col => {
      let val = '';
      if (col.key === '_index') {
        val = idx + 1;
      } else if (typeof col.formatter === 'function') {
        val = col.formatter(row[col.key], row, idx);
      } else {
        val = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '';
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  // 3. UTF-8 BOM (\uFEFF) 추가하여 엑셀 더블클릭 시 한글 깨짐 방지
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

  if (typeof window !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  return csvContent;
}
