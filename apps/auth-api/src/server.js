/**
 * auth-api 부트스트랩 — .env 로드, Sentry init (옵션), listen.
 *
 * 실 미들웨어/라우터 와이어링은 `app.js` 에서. 테스트는 `createApp()` 만 import.
 */
import 'dotenv/config';

import { validateJwtSecret, validateSmtpConfig } from '@getit/env-validator';
import pino from 'pino';

import { createApp } from './app.js';

const log = pino({ name: 'auth-api' });

/**
 * 운영 secret 검증 — production 누락/placeholder 면 throw → 컨테이너 즉시 종료
 * (Issue #575). dev/test 에선 warning 만 흘림.
 *
 * 비-throw 경로의 secret 값 자체는 메시지에 노출되지 않는다 (validator 책임).
 */
const validateEnvOrDie = () => {
  const env = process.env.NODE_ENV;
  // auth-api 만 SMTP 발송 책임 — 비번 재설정 / 이메일 인증 / 학교 인증 메일.
  const allowDisabled = process.env.MAILER_DISABLED_ALLOWED === 'true';
  const warnings = [
    ...validateJwtSecret(process.env.JWT_SECRET, { env }),
    ...validateSmtpConfig(
      {
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      { env, mailerDisabledAllowed: allowDisabled },
    ),
  ];
  for (const w of warnings) log.warn({ env: 'validation' }, w);
};

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
  validateEnvOrDie();

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
