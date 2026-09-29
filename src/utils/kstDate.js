// 한국(Asia/Seoul) 기준 날짜 문자열 'YYYY-MM-DD'.
// toISOString()은 UTC 기준이라 한국 0~9시에는 하루 전 날짜가 된다(수강·결제·만료·영수증 날짜 오기록).
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function kstDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
