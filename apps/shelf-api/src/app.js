/**
 * shelf-api Express 앱 팩토리. server.js의 listen()과 분리해 supertest 친화적으로.
 *
 * 미들웨어 스택:
 *   helmet → cors → json → pino-http(test silent) → rate-limit(search burst)
 *   → /api/health
 *   → /api/books/* (search + :isbn)
 */
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { createBooksRouter } from './routes/books.js';

/**
 * 콤마 분리 ORIGIN 목록 파싱.
 *
 * @param {string | undefined} raw
 * @returns {string[]}
 */
const parseOrigins = (raw) =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Express 앱 인스턴스 생성.
 *
 * @param {{ rateLimitMax?: number, rateLimitWindowMs?: number, trustProxy?: boolean }} [opts]
 * @returns {import('express').Express}
 */
export const createApp = (opts = {}) => {
  const { rateLimitMax = 30, rateLimitWindowMs = 60 * 1000, trustProxy = true } = opts;
  const app = express();

  // 프록시 계층 수는 환경에 따라 다름(예: Cloudflare → LB → Traefik).
  // 기본값 1(=Traefik 단일 계층), `TRUST_PROXY` 로 오버라이드 가능.
  if (trustProxy) {
    const raw = process.env.TRUST_PROXY;
    const n = raw === undefined ? 1 : Number.parseInt(raw, 10);
    app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : raw);
  }

  // CORS: 운영 설정 누락 시 전면 개방되지 않도록 fail-closed.
  // `CORS_ORIGINS` 가 비어있으면 cross-origin 자체를 거부 + credentials 끔.
  const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS);
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : false,
      credentials: allowedOrigins.length > 0,
    }),
  );
  app.use(express.json({ limit: '64kb' }));

  // 로깅 — test 환경에선 silent
  if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ redact: ['req.headers.cookie', 'req.headers.authorization'] }));
  }

  // /api/health (rate-limit 미적용, public)
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'shelf-api' }));

  // 외부 API 호출은 비싸므로 검색 라우터에만 burst 차단.
  const searchLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RateLimitExceeded' },
  });

  app.use('/api/books', searchLimiter, createBooksRouter());

  // 마지막 fallback 에러 핸들러 (4-인자 시그니처 유지).
  // 500 이상은 pino 로 스택 트레이스까지 로깅 → 운영 환경에서 신속히 트리아지.
  app.use((err, req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) {
      req.log?.error({ err }, 'unhandled error');
    }
    res.status(status).json({ error: err.code ?? 'InternalServerError' });
  });

  return app;
};
