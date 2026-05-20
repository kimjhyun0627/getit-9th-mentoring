/**
 * letter-api 부트스트랩 — .env 로드, listen, graceful shutdown.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import pino from 'pino';

import { createApp } from './app.js';

const log = pino({ name: 'letter-api' });

const main = async () => {
  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? '3005', 10);
  const server = app.listen(port, () => {
    log.info({ port }, `letter-api listening on :${port}`);
  });
  server.on('error', (err) => {
    log.error({ err, port }, 'failed to start letter-api server');
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
