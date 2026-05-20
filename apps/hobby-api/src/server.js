/**
 * hobby-api 부트스트랩 — .env 로드, Sentry init (옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import pino from 'pino';

import { createApp } from './app.js';

const log = pino({ name: 'hobby-api' });

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
