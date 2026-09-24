// Version must match the server-side registration contract.
export const PRIVACY_POLICY_VERSION = '2026-09-23';
export const APPROVAL_SCHEDULE = '입금 확인 및 수강 승인은 매일 오전 10시~11시, 오후 6시~7시에 진행됩니다.';
export const PAYMENT_ACCOUNT = '농협 301-0264-3664-41 ([사] 세화불학원)';
export const NEXT_LECTURE_PROGRESS = 80;
export const CERTIFICATE_PRINT_NOTICE = `자격증은 본인이 직접 출력하여 사용합니다. 실물 자격증을 따로 받으시려면 발급비 10,000원을 ${PAYMENT_ACCOUNT}으로 입금한 뒤 교학처(010-4702-0283)에 받으실 주소를 알려 주세요. 확인 후 우편으로 발급해 드립니다.`;

/** The next lesson opens at 80%; completion and certificates still require 100%. */
export function canOpenNextLecture(progress) {
  return Number(progress?.progressRate) >= NEXT_LECTURE_PROGRESS;
}

export function enrollmentConfirmation(course) {
  return `[${course.title}] 수강 신청이 완료되었습니다!\n\n• 현재 입금 확인 및 수강 승인 대기 상태입니다.\n• 입금 계좌: ${PAYMENT_ACCOUNT}\n• 입금 금액: ${Number(course.price || 0).toLocaleString('ko-KR')}원\n• ${APPROVAL_SCHEDULE}\n• [내 강의실]에서 신청 결과를 확인하실 수 있습니다.`;
}
