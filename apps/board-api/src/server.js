/**
 * board-api 부트스트랩 — .env 로드, Sentry(옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js`. 테스트는 `createApp()` 만 import.
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

const log = pino({ name: 'board-api' });

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
  validateEnvOrDie({ log });

  await initSentry();

  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? '3004', 10);
  const server = app.listen(port, () => {
    log.info({ port }, `board-api listening on :${port}`);
  });
  server.on('error', (err) => {
    log.error({ err, port }, 'failed to start board-api server');
    process.exitCode = 1;
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return; // 재진입 방지 — 같은 시그널 중복 / 다른 시그널 동시 도착 대비
    shuttingDown = true;
    log.info({ signal }, 'shutting down');
    let forced = false;
    const timer = setTimeout(() => {
      forced = true;
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 5000);
    timer.unref();
    server.close((err) => {
      clearTimeout(timer);
      if (err) {
        log.error({ err, signal }, 'server.close failed');
        if (process.exitCode == null) process.exitCode = 1;
        return;
      }
      // 타임아웃으로 강제 종료됐거나 이미 누가 exitCode 세팅했다면 0으로 덮지 않음
      if (!forced && process.exitCode == null) process.exitCode = 0;
    });
  };
  // once — 동일 시그널 두 번째 수신 시 OS 기본 동작으로 떨어지게 (handler 재실행 X)
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  log.error({ err }, 'fatal during startup');
  process.exitCode = 1;
});
