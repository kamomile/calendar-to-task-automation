import { GoogleGenAI, Type } from '@google/genai';

// 우선순위 순서의 모델 목록. 앞 모델이 과부하(503 등)로 재시도까지 실패하면
// 다음 모델로 자동 폴백한다. 기본은 품질 좋은 GA 모델, 폴백은 가용성 높은 Lite.
const MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

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

  const res = await generateWithFallback(ai, prompt);

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

/**
 * MODELS 목록을 순서대로 시도한다. 앞 모델이 과부하성 오류로 재시도까지
 * 모두 실패하면 다음 모델로 폴백한다. 과부하가 아닌 오류는 즉시 던진다.
 *
 * @param {import('@google/genai').GoogleGenAI} ai
 * @param {string} prompt
 */
async function generateWithFallback(ai, prompt) {
  const config = {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.4,
  };

  let lastErr;
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const res = await withRetry(() =>
        ai.models.generateContent({ model, contents: prompt, config }),
      );
      if (i > 0) console.log(`대체 모델로 생성 성공: ${model}`);
      return res;
    } catch (err) {
      lastErr = err;
      const hasNext = i < MODELS.length - 1;
      // 과부하성 오류이고 다음 후보가 있으면 폴백, 아니면 던진다.
      if (hasNext && isOverloadError(err)) {
        console.log(
          `모델 ${model} 과부하 지속 → 대체 모델(${MODELS[i + 1]})로 전환`,
        );
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * 일시적 과부하/한도 오류(503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, 500)에 대해
 * 지수 백오프로 재시도한다. 그 외 오류는 즉시 던진다.
 *
 * @param {() => Promise<any>} fn
 * @param {number} [maxAttempts=5]
 */
async function withRetry(fn, maxAttempts = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isOverloadError(err) || attempt === maxAttempts) throw err;

      // 1s, 2s, 4s, 8s ... + 지터
      const delay = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
      const status = err?.status ?? err?.code ?? 'unknown';
      console.log(
        `Gemini 일시 오류(${status}). ${delay}ms 후 재시도 (${attempt}/${maxAttempts - 1})...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** 재시도/폴백 대상이 되는 일시적 과부하·한도 오류인지 판정한다. */
function isOverloadError(err) {
  const status = err?.status ?? err?.code;
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(
      err?.message ?? '',
    )
  );
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
