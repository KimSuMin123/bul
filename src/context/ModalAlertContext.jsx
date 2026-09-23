import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Sparkles, 
  X,
  Bell
} from 'lucide-react';

const ModalAlertContext = createContext(null);

export function ModalAlertProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'info' | 'success' | 'warning' | 'error'
    isConfirm: false,
    confirmText: '확인',
    cancelText: '취소',
    onConfirm: null,
    onCancel: null,
    resolve: null
  });

  const queueRef = useRef([]);
  const confirmBtnRef = useRef(null);
  const dialogRef = useRef(null);

  // Auto-detect title and type from message content if not provided
  const detectMeta = (message, explicitType, explicitTitle, isConfirm) => {
    const text = String(message || '');
    let type = explicitType;
    let title = explicitTitle;

    if (!type) {
      if (/성공|완료|축하|발급|정상|승인되었습니다|저장되었습니다|등록되었습니다|🎉/.test(text)) {
        type = 'success';
      } else if (/오류|실패|에러|불가|금지|제거되었습니다/.test(text)) {
        type = 'error';
      } else if (/주의|경고|삭제|입력해 주세요|선택해 주세요|필수|권한|필요합니다/.test(text)) {
        type = isConfirm ? 'warning' : 'warning';
      } else {
        type = 'info';
      }
    }

    if (!title) {
      if (type === 'success') {
        title = text.includes('수강 신청') ? '수강 신청 접수' :
                text.includes('완강') ? '강의 완강 축하' :
                text.includes('수료') ? '수료 및 자격증' :
                text.includes('개설') ? '코스 개설 완료' :
                text.includes('답변') ? '답변 등록 완료' :
                text.includes('수납') ? '수납 승인 완료' : '완료 안내';
      } else if (type === 'error') {
        title = text.includes('업로드') ? '업로드 오류' :
                text.includes('비밀번호') ? '비밀번호 오류' : '확인 필요';
      } else if (type === 'warning') {
        title = isConfirm ? (text.includes('삭제') ? '삭제 확인' : '진행 확인') : '입력 및 확인 안내';
      } else {
        title = '알림';
      }
    }

    return { type, title };
  };

  const processNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      setModalState(next);
    } else {
      setModalState(prev => ({ ...prev, isOpen: false }));
    }
  }, []);

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const { type, title } = detectMeta(message, options.type, options.title, false);
      const modalData = {
        isOpen: true,
        title,
        message: String(message || ''),
        type,
        isConfirm: false,
        confirmText: options.confirmText || '확인',
        cancelText: '취소',
        onConfirm: options.onConfirm || null,
        onCancel: null,
        resolve
      };

      setModalState(prev => {
        if (prev.isOpen) {
          queueRef.current.push(modalData);
          return prev;
        }
        return modalData;
      });
    });
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const { type, title } = detectMeta(message, options.type, options.title, true);
      const modalData = {
        isOpen: true,
        title,
        message: String(message || ''),
        type,
        isConfirm: true,
        confirmText: options.confirmText || (textLooksLikeDelete(message) ? '삭제' : '확인'),
        cancelText: options.cancelText || '취소',
        onConfirm: options.onConfirm || null,
        onCancel: options.onCancel || null,
        resolve
      };

      setModalState(prev => {
        if (prev.isOpen) {
          queueRef.current.push(modalData);
          return prev;
        }
        return modalData;
      });
    });
  }, []);

  function textLooksLikeDelete(msg) {
    return /삭제|제거|취소하시겠습니까/.test(String(msg || ''));
  }

  // Handle closing / confirming
  const handleConfirm = () => {
    if (modalState.onConfirm) {
      try { modalState.onConfirm(); } catch (e) { console.error(e); }
    }
    if (modalState.resolve) {
      modalState.resolve(true);
    }
    processNext();
  };

  const handleCancel = () => {
    if (modalState.onCancel) {
      try { modalState.onCancel(); } catch (e) { console.error(e); }
    }
    if (modalState.resolve) {
      modalState.resolve(false);
    }
    processNext();
  };

  // Restore the opener only when the entire dialog queue closes.
  useEffect(() => {
    if (!modalState.isOpen) return;
    const opener = document.activeElement;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [modalState.isOpen]);

  // Keep keyboard focus in the current dialog. Enter uses native button behavior.
  useEffect(() => {
    if (!modalState.isOpen) return;

    // Focus confirm button when opened
    const timer = setTimeout(() => {
      if (confirmBtnRef.current) {
        confirmBtnRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (modalState.isConfirm) {
          handleCancel();
        } else {
          handleConfirm();
        }
      } else if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter(element => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          e.preventDefault();
          dialog.focus();
        } else if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleFocusIn = (e) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) {
        confirmBtnRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [modalState]);

  // Hook global window.alert and window.confirm to ALWAYS open this custom modal
  useEffect(() => {
    const origAlert = window.alert;
    const origConfirm = window.confirm;

    window.alert = (msg) => {
      showAlert(msg);
    };
    window.confirm = (msg) => {
      return showConfirm(msg);
    };

    window.__showModalAlert = showAlert;
    window.__showModalConfirm = showConfirm;
    window.__closeModalAlert = () => {
      setModalState(prev => ({ ...prev, isOpen: false }));
    };

    return () => {
      window.alert = origAlert;
      window.confirm = origConfirm;
      delete window.__showModalAlert;
      delete window.__showModalConfirm;
      delete window.__closeModalAlert;
    };
  }, [showAlert, showConfirm]);

  // Render Icon according to type
  const renderIcon = () => {
    const size = 32;
    switch (modalState.type) {
      case 'success':
        return (
          <div className="alert-icon-wrapper alert-icon-success">
            <CheckCircle2 size={size} color="#15803D" strokeWidth={2.3} />
          </div>
        );
      case 'warning':
        return (
          <div className="alert-icon-wrapper alert-icon-warning">
            <AlertTriangle size={size} color="#B45309" strokeWidth={2.3} />
          </div>
        );
      case 'error':
        return (
          <div className="alert-icon-wrapper alert-icon-error">
            <XCircle size={size} color="#B91C1C" strokeWidth={2.3} />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="alert-icon-wrapper alert-icon-info">
            <Info size={size} color="#2D4A3E" strokeWidth={2.3} />
          </div>
        );
    }
  };

  return (
    <ModalAlertContext.Provider value={{ showAlert, showConfirm, alert: showAlert, confirm: showConfirm }}>
      {children}

      {/* Global Custom Alert / Confirm Modal Dialog */}
      {modalState.isOpen && (
        <div 
          ref={dialogRef}
          tabIndex={-1}
          className="modal-backdrop alert-modal-backdrop"
          onClick={(e) => {
            // Click outside backdrop to dismiss if not a strict confirm
            if (e.target === e.currentTarget && !modalState.isConfirm) {
              handleConfirm();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alert-dialog-title"
        >
          <div className="modal-card alert-modal-card">
            {/* Top Close Button for Alert */}
            {!modalState.isConfirm && (
              <button 
                className="alert-modal-close-btn"
                onClick={handleConfirm}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            )}

            {/* Icon Header */}
            <div className="alert-modal-icon-container">
              {renderIcon()}
            </div>

            {/* Title */}
            <h3 id="alert-dialog-title" className="alert-modal-title">
              {modalState.title}
            </h3>

            {/* Message Body with clean multi-line formatting */}
            <div className="alert-modal-message">
              {modalState.message.split('\n').map((line, idx) => (
                <p key={idx} className={line.trim().startsWith('•') || line.trim().startsWith('*') ? 'alert-bullet-line' : 'alert-text-line'}>
                  {line || '\u00A0'}
                </p>
              ))}
            </div>

            {/* Modal Actions */}
            <div className={`alert-modal-actions ${modalState.isConfirm ? 'is-confirm' : 'is-alert'}`}>
              {modalState.isConfirm && (
                <button
                  type="button"
                  className="btn alert-btn-cancel"
                  onClick={handleCancel}
                >
                  {modalState.cancelText}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                className={`btn alert-btn-confirm ${
                  modalState.isConfirm && (modalState.type === 'error' || modalState.confirmText.includes('삭제'))
                    ? 'alert-btn-danger'
                    : 'alert-btn-primary'
                }`}
                onClick={handleConfirm}
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalAlertContext.Provider>
  );
}

export function useModalAlert() {
  const context = useContext(ModalAlertContext);
  if (!context) {
    throw new Error('useModalAlert must be used within a ModalAlertProvider');
  }
  return context;
}
