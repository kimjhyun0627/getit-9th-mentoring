/**
 * Express 앱 팩토리. server.js 의 listen() 과 분리해 supertest 친화적.
 *
 * 미들웨어 스택:
 *   helmet → cors → cookieParser → json → pino-http (openChatUrl redact)
 *   → /api/health
 *   → mutationLimiter on POST/PATCH/DELETE
 *   → /api/posts/*, /api/applications/*, /api/notifications/*, /api/me/*
 *   → /api/docs (swagger UI)
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { buildOpenApiDoc } from './openapi.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createMeRouter } from './routes/me.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createPostsRouter } from './routes/posts.js';
import { createPostMutationsRouter } from './routes/posts.mutations.js';

const parseOrigins = (raw) =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const readJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET env must be set (32+ chars).');
  }
  return secret;
};

/**
 * Express 앱 인스턴스 생성.
 *
 * @param {{ trustProxy?: boolean, rateLimitMax?: number, rateLimitWindowMs?: number }} [opts]
 * @returns {import('express').Express}
 */
export const createApp = (opts = {}) => {
  const envMax = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10);
  const envWindow = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
  const {
    trustProxy = true,
    rateLimitMax = Number.isFinite(envMax) ? envMax : 30,
    rateLimitWindowMs = Number.isFinite(envWindow) ? envWindow : 60_000,
  } = opts;
  const app = express();

  if (trustProxy) {
    const raw = process.env.TRUST_PROXY;
    const n = raw === undefined ? 1 : Number.parseInt(raw, 10);
    app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : raw);
  }

  // CORS fail-closed: CORS_ORIGINS 비면 cross-origin 거부.
  const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS);
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : false,
      credentials: allowedOrigins.length > 0,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));

  if (process.env.NODE_ENV !== 'test') {
    // #320: openChatUrl 은 PII 에 준하는 민감 정보 — request body / response body 로그에
    // 그대로 찍히면 액세스 로그/Sentry breadcrumb 으로 흘러나갈 수 있음. pino redact 로 마스킹.
    app.use(
      pinoHttp({
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'req.body.openChatUrl',
            'res.body.post.openChatUrl',
            'res.body.openChatUrl',
          ],
          censor: '[REDACTED]',
        },
      }),
    );
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'hobby-api' }));

  // #290: POST/PATCH/DELETE 만 burst 차단. GET 은 free (목록/상세 조회 부하 적음).
  // letter-api 와 동일 패턴: 단일 IP 1분 30회. 환경변수로 운영 중 조절.
  const mutationLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RateLimitExceeded' },
  });

  const jwtSecret = readJwtSecret();
  app.use('/api', createPostsRouter({ jwtSecret, mutationLimiter }));
  app.use('/api', createPostMutationsRouter({ jwtSecret, mutationLimiter }));
  app.use('/api', createApplicationsRouter({ jwtSecret, mutationLimiter }));
  app.use('/api', createNotificationsRouter({ jwtSecret, mutationLimiter }));
  app.use('/api', createMeRouter({ jwtSecret }));

  const openapi = buildOpenApiDoc();
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));

  // 마지막 fallback 에러 핸들러 (4-인자 시그니처 유지).
  app.use((err, req, res, next) => {
    // 응답이 이미 시작된 경우 (스트리밍/SSE 등) 추가 헤더/바디 쓰지 않고 Express 기본 핸들러로 위임.
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status ?? 500;
    if (status >= 500) {
      req.log?.error({ err }, 'unhandled error');
    }
    res.status(status).json({ error: err.code ?? 'InternalServerError' });
  });

  return app;
};
