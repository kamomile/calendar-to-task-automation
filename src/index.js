import { loadEnv } from './loadEnv.js';
import { getAuthenticatedClient } from './auth.js';
import { fetchEvents } from './calendar.js';
import { generatePrepTasks } from './gemini.js';
import { createTasks } from './tasks.js';
import { isLastDayOfMonth, getNextMonthRange } from './dateUtils.js';

async function main() {
  loadEnv();
  const force = String(process.env.FORCE_RUN).toLowerCase() === 'true';

  // 1) 말일 게이트. workflow_dispatch(force) 가 아니면 말일에만 실행.
  if (!force && !isLastDayOfMonth()) {
    console.log('오늘은 말일이 아닙니다. 작업을 건너뜁니다. (FORCE_RUN=true 로 강제 실행 가능)');
    return;
  }

  const range = getNextMonthRange();
  console.log(`대상 월: ${range.label} (${range.timeMin} ~ ${range.timeMax})`);

  const auth = getAuthenticatedClient();

  // 2) 다음 달 일정 조회
  const events = await fetchEvents(auth, range);
  console.log(`조회된 일정: ${events.length}건`);

  if (events.length === 0) {
    console.log('다음 달 일정이 없어 등록할 작업이 없습니다.');
    return;
  }

  // 3) Gemini 로 준비 작업 생성
  const prepTasks = await generatePrepTasks(events, range.label);
  console.log(`생성된 준비 작업: ${prepTasks.length}건`);

  if (prepTasks.length === 0) {
    console.log('생성된 준비 작업이 없습니다.');
    return;
  }

  // 4) Google Tasks 등록 (중복 제외)
  const { created, skipped } = await createTasks(auth, prepTasks);
  console.log(`등록 완료 — 신규 ${created}건, 중복 건너뜀 ${skipped}건`);
}

main().catch((err) => {
  console.error('실행 중 오류 발생:', err.message);
  process.exitCode = 1;
});
