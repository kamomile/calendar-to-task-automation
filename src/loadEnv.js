import { existsSync, readFileSync } from 'node:fs';

/**
 * 의존성 없이 프로젝트 루트의 .env 를 파싱해 process.env 에 주입한다.
 * .env 가 없으면(예: GitHub Actions) 아무 동작도 하지 않는다.
 * 이미 설정된 환경변수는 덮어쓰지 않는다.
 */
export function loadEnv() {
  const path = new URL('../.env', import.meta.url);
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
