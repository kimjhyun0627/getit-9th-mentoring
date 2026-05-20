/**
 * Express 앱 팩토리. `server.js`의 listen()과 분리해 supertest 친화적으로.
 *
 * Phase 6c 미들웨어 스택 (순서가 중요 — Issue #316):
 *   helmet
 *   → cors (CORS_ORIGINS 비면 origin:false)
 *   → cookieParser
 *   → json
 *   → pino-http
 *   → strictCorsReject  (외부 origin 즉시 403, rate-limit 카운트 X — Issue #316)
 *   → csrfGuard         (상태변경 protected paths 만 — Issue #312)
 *   → /api/health, /api/csrf
 *   → signup/login/reset/refresh/verify-email limiter → 라우터
 *   → /api/docs (swagger UI)
 *
 * 부팅 시 fail-fast (Issue #328): COOKIE_SECURE=true 인데 COOKIE_DOMAIN 미설정이면
 * 4개 SSO 도메인 쿠키 공유가 불가능해 운영 즉시 실패해야 한다 → throw.
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { csrfGuard, setCsrfCookies } from './lib/csrf.js';
import { readAuthEnv } from './lib/tokens.js';
import { buildOpenApiDoc } from './openapi.js';
import { createAuthRouter } from './routes/auth.js';
import { createMeRouter } from './routes/me.js';
import { createPasswordResetRouter } from './routes/password-reset.js';
import { createVerifyEmailRouter } from './routes/verify-email.js';

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
 * 부팅 시 COOKIE_DOMAIN/COOKIE_SECURE 정합성 검증 (Issue #328).
 *
 * - COOKIE_SECURE=true (운영) 인데 COOKIE_DOMAIN 미설정 → 4 도메인 SSO 공유 불가 → throw.
 * - 테스트 환경은 NODE_ENV=test 로 우회.
 */
const assertCookieConfig = () => {
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.COOKIE_SECURE === 'true' && !process.env.COOKIE_DOMAIN) {
    throw new Error(
      'COOKIE_DOMAIN must be set when COOKIE_SECURE=true (e.g. ".get-it.cloud") — Issue #328',
    );
  }
};

/**
 * CORS 거부를 명시적 403 으로 처리하는 게이트 (Issue #316).
 *
 * 기본 `cors` 미들웨어는 Origin 헤더가 화이트리스트에 없어도 next() 하기 때문에
 * 그 뒤의 rate-limit 이 외부 origin 의 카운트를 채우게 된다. 본 미들웨어는
 * cross-origin 요청 (Origin 헤더 존재) 이 화이트리스트 미일치면 **rate-limit 전**
 * 단계에서 403 으로 끊는다 — 외부 origin 으로 IP 잠금 트리거 불가.
 *
 * Same-origin (Origin 헤더 자체가 없는 서버투서버/직접 호출) 은 통과.
 *
 * @param {string[]} allowed
 * @returns {import('express').RequestHandler}
 */
const strictCorsReject = (allowed) => (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  if (allowed.length === 0) {
    return res.status(403).json({ error: 'CorsOriginNotAllowed' });
  }
  if (!allowed.includes(String(origin))) {
    return res.status(403).json({ error: 'CorsOriginNotAllowed' });
  }
  return next();
};

/**
 * Express 앱 인스턴스 생성.
 *
 * @param {{ rateLimitMax?: number, rateLimitWindowMs?: number, trustProxy?: boolean }} [opts]
 * @returns {import('express').Express}
 */
export const createApp = (opts = {}) => {
  // #313: 5/min 은 정상 로그인 폼 실패만으로도 429 → 운영 항의. 30/min 으로 완화.
  // burst 차단 목적은 유지 (특정 IP 가 1초에 100회 시도 → 차단).
  const { rateLimitMax = 30, rateLimitWindowMs = 60 * 1000, trustProxy = true } = opts;
  assertCookieConfig();
  const app = express();

  if (trustProxy) {
    const raw = process.env.TRUST_PROXY;
    const n = raw === undefined ? 1 : Number.parseInt(raw, 10);
    app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : raw);
  }

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

  // #316: CORS 거부 → rate-limit 카운트 전에 끊는다.
  app.use(strictCorsReject(allowedOrigins));

  // /api/health (rate-limit/CSRF 미적용, public)
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'auth-api' }));

  // /api/csrf — FE 가 부팅 시 한 번 호출. 토큰 쿠키 셋 + 본문에도 echo.
  app.get('/api/csrf', (_req, res) => {
    const cfg = readAuthEnv();
    const token = setCsrfCookies(res, cfg);
    res.json({ token });
  });

  // #312: CSRF guard — 상태변경 protected paths 만 (logout/me/profile/me/delete/sessions).
  app.use(csrfGuard());

  // burst 차단 limiter — windowMs 당 max 회.
  const mk = () =>
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'RateLimitExceeded' },
    });
  const signupLimiter = mk();
  const loginLimiter = mk();
  const resetLimiter = mk();
  // #329: refresh 도 burst 차단 대상. 토큰 무차별 대입 가능.
  // 실패 시에만 카운트하려면 별도 store 가 필요해 운영적으론 전체 카운트가 더 안전.
  const refreshLimiter = mk();
  const verifyLimiter = mk();

  app.use('/api', createAuthRouter({ signupLimiter, loginLimiter, refreshLimiter }));
  app.use('/api', createPasswordResetRouter({ resetLimiter }));
  app.use('/api', createVerifyEmailRouter({ verifyLimiter }));
  app.use('/api', createMeRouter());

  // /api/docs — swagger UI
  const openapi = buildOpenApiDoc();
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));

  app.use((err, req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) {
      req.log?.error({ err }, 'unhandled error');
    }
    res.status(status).json({ error: err.code ?? 'InternalServerError' });
  });

  return app;
};
