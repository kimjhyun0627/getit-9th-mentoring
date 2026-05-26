/**
 * hobby-api 부트스트랩 — .env 로드, Sentry init (옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import pino from 'pino';

import { createApp } from './app.js';
import { assertSchoolAuthEnvDeclared } from './lib/assertSchoolAuthEnv.js';

const log = pino({ name: 'hobby-api' });

// Sentry 는 `optionalDependencies` — 운영 이미지에는 설치되고, 로컬/테스트에는
// 없어도 부팅됨. SENTRY_DSN 이 비어 있으면 import 자체를 건너뜀.
const initSentry = async () => {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
    log.info('Sentry initialized');
  } catch (err) {
    log.warn({ err }, 'Sentry init skipped (@sentry/node missing — install optional dep?)');
  }
};

const main = async () => {
  // #572: prod 에서 SCHOOL_AUTH_GUARD_ENABLED 미정의/잘못된 값이면 즉시 종료.
  // PRD 정책상 학교 인증 가드는 prod 에서 반드시 켜져 있어야 함 — silent disable 방지.
  // dev/test 환경은 통과 (createApp 직접 호출하는 테스트도 영향 없음).
  // Gemini #577: process.exitCode 만 설정하면 active handle 잡힌 상태에서 hang 가능 →
  // 운영 컨테이너가 restart loop 으로 못 들어감. process.exit(1) 로 즉시 종료.
  try {
    assertSchoolAuthEnvDeclared();
  } catch (err) {
    log.error({ err }, 'fatal configuration error during startup');
    // letter-api 와 동일 패턴 — process.exitCode 만 세팅하면 active handle 잡힌 상태에서
    // 컨테이너가 hang. restart loop 으로 즉시 빠지려면 exit(1) 명시.
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  }

  await initSentry();

  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? '3002', 10);
  const server = app.listen(port, () => {
    log.info({ port }, `hobby-api listening on :${port}`);
  });
  server.on('error', (err) => {
    log.error({ err, port }, 'failed to start hobby-api server');
    process.exitCode = 1;
  });

  const shutdown = (signal) => {
    log.info({ signal }, 'shutting down');
    // graceful close 가 5초 안에 끝나지 않으면 강제 종료. close() 가 먼저 끝나면
    // clearTimeout 으로 타이머를 끄고 정상 exitCode 를 보존.
    const forceCloseTimer = setTimeout(() => {
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 5000);
    forceCloseTimer.unref();

    server.close(() => {
      clearTimeout(forceCloseTimer);
      process.exitCode = 0;
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  log.error({ err }, 'fatal during startup');
  process.exitCode = 1;
});
