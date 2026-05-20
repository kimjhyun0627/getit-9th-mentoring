/**
 * board-api 부트스트랩 — .env 로드, Sentry(옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js`. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import pino from 'pino';

import { createApp } from './app.js';

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

  const shutdown = (signal) => {
    log.info({ signal }, 'shutting down');
    let forced = false;
    const timer = setTimeout(() => {
      forced = true;
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 5000);
    timer.unref();
    server.close(() => {
      clearTimeout(timer);
      // 타임아웃으로 강제 종료된 경우엔 exitCode를 0으로 덮어쓰지 않음
      if (!forced) process.exitCode = 0;
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  log.error({ err }, 'fatal during startup');
  process.exitCode = 1;
});
