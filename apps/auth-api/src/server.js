/**
 * auth-api 부트스트랩 — .env 로드, Sentry init (옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
// dev 환경 .env 로컬 파일 로드 — production 은 docker compose env_file 이
// 컨테이너 env 를 직접 주입하므로 dotenv 호출 자체가 불필요. prod image 의
// node_modules 에는 dotenv 가 prune 될 수 있으니 try/await 로 swallow.
try {
  if (process.env.NODE_ENV !== 'production') {
    await import('dotenv/config');
  }
} catch {
  /* dotenv 미설치 — 환경변수가 다른 메커니즘으로 주입됐다고 가정. */
}

import pino from 'pino';

import { createApp } from './app.js';
import { validateEnvOrDie } from './lib/validateEnvOrDie.js';

const log = pino({ name: 'auth-api' });

const initSentry = async () => {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
    log.info('Sentry initialized');
  } catch (err) {
    log.warn({ err }, 'Sentry init skipped (@sentry/node missing?)');
  }
};

const main = async () => {
  // boot 시점 1회 — production 위반은 여기서 throw → main().catch 로 fatal 처리.
  validateEnvOrDie({ log });

  await initSentry();

  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  const server = app.listen(port, () => {
    log.info({ port }, `auth-api listening on :${port}`);
  });
  // listen() 실패(EADDRINUSE/EACCES 등)는 비동기 'error' 이벤트로 발생 → main().catch() 로는 못 잡음.
  server.on('error', (err) => {
    log.error({ err, port }, 'failed to start auth-api server');
    process.exitCode = 1;
  });

  const shutdown = (signal) => {
    log.info({ signal }, 'shutting down');
    server.close(() => {
      process.exitCode = 0;
    });
    // 5초 후 강제 종료 (graceful 한계)
    setTimeout(() => {
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  log.error({ err }, 'fatal during startup');
  process.exitCode = 1;
});
