/**
 * board-api Express 앱 팩토리.
 *
 * 미들웨어 스택:
 *   helmet → cors → cookieParser → json → pino-http
 *   → /api/health (public)
 *   → /api/projects/* (requireAuth)
 *   → /api/projects/:id/members/* (requireAuth + requireProjectMember)
 *   → /api/projects/:id/columns/* (requireAuth + requireProjectMember)
 *
 * `server.js` 의 listen()과 분리해 supertest 친화적.
 */
import { requireAuth } from '@getit/auth-utils/server';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { requireProjectMember } from './middleware/requireProjectMember.js';
import { createColumnsRouter } from './routes/columns.js';
import { createMembersRouter } from './routes/members.js';
import { createProjectsRouter } from './routes/projects.js';

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
  const { rateLimitMax = 60, rateLimitWindowMs = 60 * 1000, trustProxy = true } = opts;
  const app = express();

  // 프록시 계층 수 — 기본 1 (Traefik 단일), TRUST_PROXY 로 오버라이드.
  if (trustProxy) {
    const raw = process.env.TRUST_PROXY;
    const n = raw === undefined ? 1 : Number.parseInt(raw, 10);
    app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : raw);
  }

  // CORS fail-closed: CORS_ORIGINS 비면 cross-origin 거부 + credentials 끔.
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

  // health (public, no auth, no rate-limit)
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'board-api' }));

  // 쓰기 burst 차단 — projects/members 변경 엔드포인트에만 적용
  const writeLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RateLimitExceeded' },
  });

  // JWT 검증 — JWT_SECRET 부재 시 토큰 검증 자체가 실패하므로 명시적 가드.
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET env required');
  }
  const auth = requireAuth({ secret: jwtSecret });

  // GET은 limiter 없이, 쓰기엔 limiter — auth 실패도 limiter 에 잡히도록 limiter 가 먼저 와야 한다.
  // (auth 가 먼저면 401 응답으로 빠지면서 잘못된 토큰 폭주가 사실상 무제한이 됨.)
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (req.path.startsWith('/api/projects')) return writeLimiter(req, res, next);
    return next();
  });
  app.use('/api/projects', auth);

  app.use('/api/projects', createProjectsRouter());
  app.use('/api/projects/:id/members', requireProjectMember(), createMembersRouter());
  app.use('/api/projects/:id/columns', requireProjectMember(), createColumnsRouter());

  // 마지막 fallback 에러 핸들러 (4-인자).
  app.use((err, req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) {
      req.log?.error({ err }, 'unhandled error');
    }
    res.status(status).json({ error: err.code ?? 'InternalServerError' });
  });

  return app;
};
