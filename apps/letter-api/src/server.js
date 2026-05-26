/**
 * letter-api 부트스트랩 — .env 로드, listen, graceful shutdown.
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
} catch (err) {
  // ERR_MODULE_NOT_FOUND (dotenv 미설치 — prod image 등) 만 swallow.
  // 그 외 (모듈 평가 에러 등) 는 부팅 실패로 표면화시켜야 안전.
  const isMissingDotenv =
    err?.code === 'ERR_MODULE_NOT_FOUND' && String(err?.message ?? '').includes('dotenv');
  if (!isMissingDotenv) throw err;
}

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
