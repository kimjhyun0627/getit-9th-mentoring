/**
 * Express 앱 팩토리. server.js 의 listen() 과 분리해 supertest 친화적.
 *
 * 미들웨어 스택:
 *   helmet → cors → cookieParser → json → pino-http
 *   → /api/health, /api/posts/*
 *   → /api/docs (swagger UI)
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { buildOpenApiDoc } from './openapi.js';
import { createPostsRouter } from './routes/posts.js';

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
 * @param {{ trustProxy?: boolean }} [opts]
 * @returns {import('express').Express}
 */
export const createApp = (opts = {}) => {
  const { trustProxy = true } = opts;
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
    app.use(pinoHttp({ redact: ['req.headers.cookie', 'req.headers.authorization'] }));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'hobby-api' }));

  const jwtSecret = readJwtSecret();
  app.use('/api', createPostsRouter({ jwtSecret }));

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
