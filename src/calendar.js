import { google } from 'googleapis';

/**
 * primary 캘린더에서 주어진 기간의 일정을 조회해 정규화한 배열로 반환한다.
 * 반복 일정은 singleEvents:true 로 개별 인스턴스로 펼친다.
 *
 * @param {import('google-auth-library').OAuth2Client} auth
 * @param {{ timeMin: string, timeMax: string }} range
 * @returns {Promise<Array<{ summary, start, end, location, description, allDay }>>}
 */
export async function fetchEvents(auth, { timeMin, timeMax }) {
  const calendar = google.calendar({ version: 'v3', auth });

  const events = [];
  let pageToken;

  do {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });

    for (const e of res.data.items ?? []) {
      // 취소된 인스턴스 제외
      if (e.status === 'cancelled') continue;

      const allDay = Boolean(e.start?.date);
      events.push({
        summary: e.summary ?? '(제목 없음)',
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        location: e.location ?? '',
        description: e.description ?? '',
        allDay,
      });
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
}
