/**
 * letter-api Express 앱 팩토리. server.js 의 listen() 과 분리해 supertest 친화적.
 *
 * 미들웨어 스택:
 *   helmet → cors (fail-closed) → cookieParser → json (64kb)
 *   → pino-http (test 제외)
 *   → /api/health (public)
 *   → /api/me (JWT 필요, FE BoardPage mount 시 호출)
 *   → /api/messages/* (JWT 필요, mutation + GET 은 rate-limit, #252)
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { createMeRouter } from './routes/me.js';
import { createMessagesRouter } from './routes/messages.js';

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
 * 환경변수에서 JWT_SECRET 읽기. 32자 이상 강제. 부팅 시 fail-fast.
 *
 * @returns {string}
 */
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
 * @param {{
 *   rateLimitMax?: number,
 *   rateLimitWindowMs?: number,
 *   readRateLimitMax?: number,
 *   trustProxy?: boolean,
 * }} [opts]
 * @returns {import('express').Express}
 */
export const createApp = (opts = {}) => {
  const envMax = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10);
  const envWindow = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
  const envReadMax = Number.parseInt(process.env.RATE_LIMIT_READ_MAX ?? '60', 10);
  const {
    rateLimitMax: rawMax = Number.isFinite(envMax) && envMax >= 1 ? envMax : 30,
    rateLimitWindowMs: rawWindow = Number.isFinite(envWindow) && envWindow >= 1
      ? envWindow
      : 60_000,
    // CR #345 — 0/음수 방어. 잘못된 배포 설정에서 조회 전면 차단 회피.
    readRateLimitMax: rawReadMax = Number.isFinite(envReadMax) && envReadMax >= 1 ? envReadMax : 60,
    trustProxy = true,
  } = opts;
  // CR #345 round 2 — caller 가 createApp({ rateLimitMax: 0 }) 같이 직접 invalid 를
  // 넘겨도 limiter 가 받지 못하도록 한 번 더 coerce.
  const rateLimitMax = Number.isFinite(rawMax) && rawMax >= 1 ? rawMax : 30;
  const rateLimitWindowMs = Number.isFinite(rawWindow) && rawWindow >= 1 ? rawWindow : 60_000;
  const readRateLimitMax = Number.isFinite(rawReadMax) && rawReadMax >= 1 ? rawReadMax : 60;

  const app = express();

  if (trustProxy) {
    const raw = process.env.TRUST_PROXY;
    const n = raw === undefined ? 1 : Number.parseInt(raw, 10);
    app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : raw);
  }

  // CORS fail-closed: CORS_ORIGINS 비면 cross-origin 전면 거부 + credentials 끔.
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

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'letter-api' }));

  // POST/PATCH/DELETE 는 burst 차단 (기본 분당 30).
  const mutationLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RateLimitExceeded' },
  });

  // GET /api/messages 도 timing oracle 차단 목적으로 limit (#252).
  // mutation 보다는 후하게 (기본 분당 60 = 1초당 1회).
  //
  // #486 — per-user (JWT sub) limit 으로 키 전환.
  //   기존 per-IP 는 동아리 공용 wifi / 모바일 NAT 뒤 다중 사용자 누적 → 60/min 도달 가능
  //   (탭 5개 × 30s polling + focus refetch). per-user 로 가면 IP 공유 false-positive 해소,
  //   사용자 한 명이 다중 탭으로 폭주하는 진짜 abuse 만 잡힘. timing oracle 차단 의도는
  //   "한 사용자가 짧은 시간 안에 많은 GET 으로 createdAt 분포를 캐기 어렵게" — sub 기준이
  //   오히려 의도와 더 정합. auth 미통과 (req.user 없음) 케이스는 ip fallback 으로 안전.
  const readLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: readRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RateLimitExceeded' },
    keyGenerator: (req) => {
      const sub = /** @type {{ user?: { sub?: string } }} */ (req)?.user?.sub;
      if (typeof sub === 'string' && sub.length > 0) return `u:${sub}`;
      // unauthenticated 케이스 — auth 미들웨어가 먼저 401 처리하지만 방어 차원.
      return `ip:${req.ip ?? 'unknown'}`;
    },
  });

  const jwtSecret = readJwtSecret();
  // /api/me — FE BoardPage 가 mount 시 호출. 미등록이면 404 → FE 의 401 핸들러
  // 발화 안 함 → SSO redirect 누락 → "롤링페이퍼 못 불러옴" UX 회귀. 반드시 등록.
  app.use('/api', createMeRouter({ jwtSecret }));
  app.use('/api', createMessagesRouter({ jwtSecret, mutationLimiter, readLimiter }));

  // 마지막 fallback 에러 핸들러 (4-인자 시그니처 유지).
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status ?? 500;
    if (status >= 500) {
      req.log?.error({ err }, 'unhandled error');
    }
    res.status(status).json({ error: err.code ?? 'InternalServerError' });
  });

  return app;
};
