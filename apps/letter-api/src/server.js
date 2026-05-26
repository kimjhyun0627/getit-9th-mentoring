/**
 * letter-api 부트스트랩 — .env 로드, listen, graceful shutdown.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import pino from 'pino';

import { createApp } from './app.js';
import { validateEnvOrDie } from './lib/validateEnvOrDie.js';

const log = pino({ name: 'letter-api' });

const main = async () => {
  validateEnvOrDie({ log });

  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? '3005', 10);
  const server = app.listen(port, () => {
    log.info({ port }, `letter-api listening on :${port}`);
  });
  server.on('error', (err) => {
    log.error({ err, port }, 'failed to start letter-api server');
    // listen 실패 (EADDRINUSE/EACCES 등) 에서 exitCode 만 세팅하면 프로세스가 hang.
    // 비동기 'error' 이벤트라 throw 가 main().catch 로 안 잡혀 명시 종료가 안전.
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  });

  const shutdown = (signal) => {
    log.info({ signal }, 'shutting down');
    // 강제 종료 타이머는 정상 close 가 끝나면 clearTimeout 으로 취소 — 안 그러면
    // 5초 후에 exitCode 가 1 로 덮어써져 정상 종료가 비정상으로 보고된다.
    const forceTimer = setTimeout(() => {
      log.warn('shutdown timeout — forcing close');
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 5000);
    forceTimer.unref();
    server.close(() => {
      clearTimeout(forceTimer);
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
