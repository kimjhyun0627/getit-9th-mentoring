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
    server.close(() => {
      process.exitCode = 0;
    });
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
