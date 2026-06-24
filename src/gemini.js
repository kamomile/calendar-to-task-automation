import { GoogleGenAI, Type } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

/**
 * 생성될 준비 작업의 구조화 출력 스키마.
 * 모델이 항상 이 형태의 JSON 배열을 반환하도록 강제한다.
 */
const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: '실행 가능한 준비 작업 제목 (예: "OO 회의 발표자료 준비")',
      },
      notes: {
        type: Type.STRING,
        description: '작업에 대한 짧은 설명 및 관련 일정 정보',
      },
      due: {
        type: Type.STRING,
        description: '마감 기한. 연결된 일정의 시작일 기준 YYYY-MM-DD 형식',
      },
    },
    required: ['title', 'notes', 'due'],
    propertyOrdering: ['title', 'notes', 'due'],
  },
};

/**
 * 일정 목록을 Gemini 에 보내 각 일정에 대한 준비 작업을 생성한다.
 *
 * @param {Array} events - calendar.js 의 정규화된 일정 배열
 * @param {string} monthLabel - "2026-07" 같은 대상 월 라벨
 * @returns {Promise<Array<{ title, notes, due }>>}
 */
export async function generatePrepTasks(events, monthLabel) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('환경변수 GEMINI_API_KEY 가 설정되지 않았습니다.');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(events, monthLabel);

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  });

  const text = res.text;
  if (!text) return [];

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Gemini 응답 JSON 파싱 실패: ${err.message}\n원문: ${text}`);
  }

  return Array.isArray(parsed) ? parsed : [];
}

function buildPrompt(events, monthLabel) {
  const eventLines = events
    .map((e, i) => {
      const when = e.allDay ? `${e.start} (종일)` : `${e.start} ~ ${e.end}`;
      const loc = e.location ? ` / 장소: ${e.location}` : '';
      const desc = e.description ? ` / 메모: ${e.description}` : '';
      return `${i + 1}. ${e.summary} [${when}]${loc}${desc}`;
    })
    .join('\n');

  return [
    `너는 일정 관리 비서다. 아래는 ${monthLabel} 달의 캘린더 일정 목록이다.`,
    '각 일정을 분석해, 그 일정을 잘 치르기 위해 미리 해야 할 "실행 가능한 준비 작업"을 만들어라.',
    '',
    '규칙:',
    '- 일정마다 1~2개의 구체적인 준비 작업을 만든다. (예약 확인, 자료 준비, 이동/숙소 예약, 사전 연락 등)',
    '- 준비 작업이 불필요한 단순 일정(예: 개인 휴식)은 생략해도 된다.',
    '- 모든 출력은 한국어로 작성한다.',
    '- due(마감일)는 해당 일정의 시작일을 YYYY-MM-DD 형식으로 사용한다.',
    '- title 은 동사로 끝나는 실행 가능한 형태로 작성한다.',
    '',
    '일정 목록:',
    eventLines,
  ].join('\n');
}
