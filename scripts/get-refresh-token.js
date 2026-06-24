/**
 * 최초 1회 로컬에서 실행해 refresh token 을 발급받는 스크립트.
 *
 * 사용법:
 *   1) .env 에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 입력
 *   2) node scripts/get-refresh-token.js
 *   3) 출력된 URL 을 브라우저에서 열어 로그인/동의
 *   4) 표시된 인증 코드를 터미널에 붙여넣기
 *   5) 출력된 refresh token 을 GitHub Secret(GOOGLE_REFRESH_TOKEN)에 등록
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createOAuthClient, SCOPES } from '../src/auth.js';
import { loadEnv } from '../src/loadEnv.js';

// .env 가 있으면 로드 (GOOGLE_CLIENT_ID / SECRET)
loadEnv();

async function run() {
  const client = createOAuthClient();

  const authUrl = client.generateAuthUrl({
    access_type: 'offline', // refresh token 발급에 필요
    prompt: 'consent', // 매번 refresh token 을 확실히 받기 위해
    scope: SCOPES,
  });

  console.log('\n아래 URL 을 브라우저에서 열어 로그인 후 권한을 허용하세요:\n');
  console.log(authUrl);
  console.log('');

  const rl = createInterface({ input, output });
  const code = (await rl.question('표시된 인증 코드를 붙여넣고 Enter: ')).trim();
  rl.close();

  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      '\n refresh token 이 반환되지 않았습니다. ' +
        'Google 계정의 앱 권한을 제거한 뒤 다시 시도하거나 prompt=consent 가 적용됐는지 확인하세요.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('\n발급 성공! 아래 값을 GitHub Secret(GOOGLE_REFRESH_TOKEN)에 등록하세요:\n');
  console.log(tokens.refresh_token);
  console.log('');
}

run().catch((err) => {
  console.error('오류:', err.message);
  process.exitCode = 1;
});
