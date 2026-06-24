# 📅 Calendar to Task — 월말 자동 준비 작업 생성기

매월 **말일**에 GitHub Actions가 자동으로 실행되어,

1. **Google Calendar** 의 **다음 달** 일정을 읽고
2. **Google Gemini(AI) API** 로 각 일정에 필요한 **실행 가능한 준비 작업**을 생성한 뒤
3. **Google Tasks** 에 등록합니다.

모든 인증 정보는 GitHub Actions Secrets로 안전하게 관리됩니다.

---

## 🔧 동작 원리

```
GitHub Actions (매월 28~31일 cron)
        │
        ▼
  말일인지 확인 (KST 기준) ── 말일 아님 → 종료
        │ 말일
        ▼
  Google Calendar 에서 "다음 달" 일정 조회
        │
        ▼
  Gemini 가 각 일정 → 준비 작업(title/notes/due) 생성
        │
        ▼
  Google Tasks 에 등록 (중복 제목은 건너뜀)
```

- GitHub cron은 "매월 말일"을 직접 지원하지 않으므로, **28·29·30·31일에 매일 실행**하되
  코드에서 **실제 말일일 때만** 동작합니다. (2월·평년·윤년·연말 모두 정확히 처리)
- 워크플로는 `TZ=Asia/Seoul` 로 실행되어 모든 날짜 판단이 **한국 시간** 기준입니다.

---

## 📁 프로젝트 구조

```
calendar_to_task/
├── .github/workflows/monthly-sync.yml   # 스케줄러 + 수동 실행
├── src/
│   ├── index.js          # 전체 흐름 (말일 체크 → 조회 → AI → 등록)
│   ├── auth.js           # OAuth2 클라이언트 (refresh token)
│   ├── calendar.js       # 다음 달 일정 조회
│   ├── gemini.js         # 일정 → 준비 작업 변환
│   ├── tasks.js          # Google Tasks 등록 + 중복 방지
│   ├── dateUtils.js      # 말일 판정 / 다음 달 범위 계산
│   └── loadEnv.js        # 로컬 .env 로더 (CI에선 무시)
├── scripts/
│   └── get-refresh-token.js   # refresh token 발급 (최초 1회 로컬 실행)
├── .env.example
└── package.json
```

---

## 🚀 설정 방법

### 1단계. Google Cloud 프로젝트 & API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속 → 새 프로젝트 생성
2. **API 및 서비스 → 라이브러리** 에서 아래 두 API를 **사용 설정**:
   - **Google Calendar API**
   - **Google Tasks API**

### 2단계. OAuth 클라이언트 생성

1. **API 및 서비스 → OAuth 동의 화면**
   - User Type: **외부(External)** 선택 후 앱 이름/이메일 등 기본 정보 입력
   - **테스트 사용자(Test users)** 에 본인 Gmail 주소(`kanghun3664@gmail.com`)를 추가
     (게시 상태가 "테스트"여도 본인 계정은 정상 동작합니다.)
2. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **데스크톱 앱(Desktop app)**
   - 생성 후 **클라이언트 ID** 와 **클라이언트 보안 비밀(secret)** 을 복사

### 3단계. Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. **Get API key / API 키 만들기** → 키 복사

### 4단계. Refresh Token 발급 (로컬 1회)

```bash
# 1) 의존성 설치
npm install

# 2) .env 파일 생성 후 CLIENT_ID / CLIENT_SECRET 입력
cp .env.example .env
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 두 값만 먼저 채우면 됩니다.

# 3) refresh token 발급 스크립트 실행
npm run auth
```

- 출력된 URL을 브라우저에서 열어 로그인 → 권한 허용
- 화면에 표시된 **인증 코드**를 터미널에 붙여넣으면 **refresh token** 이 출력됩니다.
- 이 토큰을 `.env` 의 `GOOGLE_REFRESH_TOKEN`(로컬 테스트용)과
  GitHub Secret(아래 5단계)에 등록합니다.

### 5단계. GitHub Secrets 등록

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
아래 4개를 등록합니다.

| Secret 이름 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 2단계의 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | 2단계의 클라이언트 보안 비밀 |
| `GOOGLE_REFRESH_TOKEN` | 4단계에서 발급한 refresh token |
| `GEMINI_API_KEY` | 3단계의 Gemini API 키 |

### 6단계. 코드 푸시 & 자동 실행

코드를 GitHub에 푸시하면 끝입니다.
- 이후 **매월 말일(KST)** 에 자동 실행됩니다.
- 저장소 **Actions** 탭 → **Monthly Calendar to Tasks** → **Run workflow** 로
  언제든 수동 실행할 수 있습니다. 이때 **force** 를 `true` 로 두면
  말일이 아니어도 즉시 동작합니다(테스트용).

---

## 🧪 로컬 테스트

`.env` 에 4개 값을 모두 채운 뒤:

```bash
# 말일 체크를 건너뛰고 강제 실행
FORCE_RUN=true npm start
```

> Windows PowerShell:
> ```powershell
> $env:FORCE_RUN="true"; npm start
> ```

실행하면 다음 달 일정이 조회되고, 준비 작업이 Google Tasks에 등록됩니다.
같은 명령을 다시 실행하면 동일 제목은 **중복으로 건너뜀** 처리됩니다.

---

## ⚙️ 커스터마이징

| 환경변수 | 설명 | 기본값 |
|---|---|---|
| `TASK_LIST_TITLE` | 등록할 Task 목록 이름. 없으면 만들고, 있으면 재사용 | 기본 목록(`@default`) |
| `FORCE_RUN` | `true` 면 말일 체크를 건너뜀 | (미설정) |

- **대상 캘린더**: 기본은 `primary`(기본 캘린더)입니다. 다른 캘린더를 쓰려면
  `src/calendar.js` 의 `calendarId` 를 해당 캘린더 ID로 바꾸세요.
- **AI 모델/프롬프트**: `src/gemini.js` 의 `MODEL` 과 프롬프트 문구를 수정하면
  준비 작업의 스타일과 개수를 조절할 수 있습니다.

---

## ❓ 자주 묻는 문제

- **refresh token이 안 나와요**: Google 계정 →
  [앱 액세스 권한 관리](https://myaccount.google.com/permissions) 에서 기존 권한을 제거한 뒤
  `npm run auth` 를 다시 실행하세요. (스크립트는 `prompt=consent` 로 매번 재발급을 시도합니다.)
- **`invalid_grant` 오류**: refresh token이 만료/폐기되었을 수 있습니다.
  OAuth 동의 화면이 "테스트" 상태면 토큰 유효기간이 7일로 짧을 수 있으니,
  필요 시 동의 화면을 **게시(프로덕션)** 상태로 전환하세요.
- **일정은 있는데 작업이 0건**: 단순/개인 일정은 준비 작업이 생략될 수 있습니다.
  `src/gemini.js` 의 프롬프트 규칙을 조정하세요.
