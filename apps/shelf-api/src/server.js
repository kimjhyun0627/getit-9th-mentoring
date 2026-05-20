/**
 * shelf-api 부트스트랩 — .env 로드, Sentry init (옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import pino from 'pino';

import { createApp } from './app.js';

const log = pino({ name: 'shelf-api' });

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

  // 운영 환경에선 Traefik 프록시 뒤에 있으므로 trustProxy 명시 활성화.
  // (createApp 기본값은 fail-closed 로 false.)
  const app = createApp({ trustProxy: true });
  const port = Number.parseInt(process.env.PORT ?? '3003', 10);
  const server = app.listen(port, () => {
    log.info({ port }, `shelf-api listening on :${port}`);
  });
  // listen() 실패(EADDRINUSE/EACCES 등)는 비동기 'error' 이벤트로 발생 → main().catch() 로는 못 잡음.
  server.on('error', (err) => {
    log.error({ err, port }, 'failed to start shelf-api server');
    process.exitCode = 1;
  });

  // shutdown 은 중복 호출 방지 + 정상 종료 시 force-close 타이머 해제.
  // 안 그러면 5초 후 타이머가 exitCode 를 1 로 덮어써서 정상 종료도 실패로 찍힘.
  let shuttingDown = false;
  let forceCloseTimer;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'shutting down');
    server.close(() => {
      if (forceCloseTimer) clearTimeout(forceCloseTimer);
      process.exitCode = 0;
    });
    // 5초 후 강제 종료 (graceful 한계)
    forceCloseTimer = setTimeout(() => {
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 5000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  log.error({ err }, 'fatal during startup');
  process.exitCode = 1;
});
