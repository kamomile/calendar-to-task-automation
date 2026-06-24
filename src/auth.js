import { google } from 'googleapis';

/**
 * Google API 접근에 필요한 OAuth 스코프.
 * - calendar.readonly : 캘린더 일정 읽기 전용
 * - tasks            : Google Tasks 읽기/쓰기
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks',
];

/**
 * 환경변수에서 클라이언트 정보를 읽어 OAuth2 클라이언트를 만든다.
 * redirectUri 는 데스크톱 앱 흐름에서 쓰는 OOB 대체값(코드 수동 입력)이다.
 */
export function createOAuthClient() {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob',
  );
}

/**
 * refresh token 으로 인증된 OAuth2 클라이언트를 반환한다.
 * access token 은 googleapis 라이브러리가 만료 시 자동 갱신한다.
 */
export function getAuthenticatedClient() {
  const client = createOAuthClient();
  client.setCredentials({
    refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN'),
  });
  return client;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  }
  return value;
}
