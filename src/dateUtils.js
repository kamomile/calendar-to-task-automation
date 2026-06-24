/**
 * 날짜 유틸리티.
 *
 * 워크플로(및 로컬 .env 권장)에서 TZ=Asia/Seoul 을 설정하므로
 * 아래의 모든 Date 연산은 KST(한국 표준시) 기준으로 동작한다.
 */

/** 2자리 0-padding */
function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * 오늘이 이번 달의 말일인지 판정한다.
 * "내일"의 날짜(day)가 1이면 오늘이 말일이다. (28/29/30/31 모두 정확히 처리)
 *
 * @param {Date} [now=new Date()] - 기준 시각(테스트 주입용)
 * @returns {boolean}
 */
export function isLastDayOfMonth(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return tomorrow.getDate() === 1;
}

/**
 * "다음 달"의 시작/끝을 RFC3339 문자열(+09:00 오프셋)로 반환한다.
 * Calendar events.list 의 timeMin/timeMax 로 사용한다.
 *
 * 예) 기준이 2026-06-30 이면 → 2026-07-01T00:00:00+09:00 ~ 2026-07-31T23:59:59+09:00
 *
 * @param {Date} [now=new Date()]
 * @returns {{ timeMin: string, timeMax: string, label: string }}
 *   label 은 "2026-07" 형태로, 로그/Task 목록 이름 등에 사용.
 */
export function getNextMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  // 다음 달 1일
  const firstOfNext = new Date(year, month + 1, 1);
  const ny = firstOfNext.getFullYear();
  const nm = firstOfNext.getMonth(); // 0-based, 다음 달

  // 다음 달의 말일 = (다음다음 달 1일 - 1일)
  const lastOfNext = new Date(ny, nm + 1, 0).getDate();

  const ymPrefix = `${ny}-${pad(nm + 1)}`;

  return {
    timeMin: `${ymPrefix}-01T00:00:00+09:00`,
    timeMax: `${ymPrefix}-${pad(lastOfNext)}T23:59:59+09:00`,
    label: ymPrefix,
  };
}
