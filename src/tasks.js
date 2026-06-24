import { google } from 'googleapis';

/**
 * 등록 대상 Task 목록의 ID를 결정한다.
 * - TASK_LIST_TITLE 환경변수가 있으면 같은 이름의 목록을 찾고, 없으면 생성한다.
 * - 없으면 기본 목록(@default)을 사용한다.
 *
 * @returns {Promise<string>} tasklist id
 */
export async function resolveTaskListId(tasksApi) {
  const wantTitle = process.env.TASK_LIST_TITLE?.trim();
  if (!wantTitle) return '@default';

  const res = await tasksApi.tasklists.list({ maxResults: 100 });
  const found = (res.data.items ?? []).find((l) => l.title === wantTitle);
  if (found) return found.id;

  const created = await tasksApi.tasklists.insert({
    requestBody: { title: wantTitle },
  });
  return created.data.id;
}

/**
 * 준비 작업들을 Google Tasks 에 등록한다.
 * 같은 목록에 동일한 제목의 task 가 이미 있으면 건너뛴다(중복 방지).
 *
 * @param {import('google-auth-library').OAuth2Client} auth
 * @param {Array<{ title, notes, due }>} prepTasks
 * @returns {Promise<{ created: number, skipped: number }>}
 */
export async function createTasks(auth, prepTasks) {
  const tasksApi = google.tasks({ version: 'v1', auth });
  const tasklist = await resolveTaskListId(tasksApi);

  // 기존 제목 수집(완료된 것 포함)
  const existing = new Set();
  let pageToken;
  do {
    const res = await tasksApi.tasks.list({
      tasklist,
      maxResults: 100,
      showCompleted: true,
      showHidden: true,
      pageToken,
    });
    for (const t of res.data.items ?? []) {
      if (t.title) existing.add(t.title.trim());
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  let created = 0;
  let skipped = 0;

  for (const task of prepTasks) {
    const title = (task.title ?? '').trim();
    if (!title) continue;

    if (existing.has(title)) {
      skipped++;
      continue;
    }

    await tasksApi.tasks.insert({
      tasklist,
      requestBody: {
        title,
        notes: task.notes ?? '',
        // Tasks API 의 due 는 RFC3339, 날짜 부분만 의미가 있다.
        ...(task.due ? { due: toDueRfc3339(task.due) } : {}),
      },
    });
    existing.add(title); // 같은 실행 내 중복도 방지
    created++;
  }

  return { created, skipped };
}

/** "YYYY-MM-DD" → RFC3339(UTC 자정). Tasks 는 날짜만 사용한다. */
function toDueRfc3339(due) {
  // 이미 시간 포함된 값이면 그대로 사용
  if (due.includes('T')) return due;
  return `${due}T00:00:00.000Z`;
}
