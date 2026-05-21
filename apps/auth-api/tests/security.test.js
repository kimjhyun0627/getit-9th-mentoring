/**
 * Phase 6c 보안 미들웨어/정책 회귀 테스트.
 *
 * - #312 CSRF — protected POST 는 토큰 없이 403, 헤더+쿠키 일치 시 통과.
 * - #313 rate-limit 30/min — 5/min 회귀 차단.
 * - #316 CORS 거부가 rate-limit 카운트 전에 발생 (외부 origin 403).
 * - #328 COOKIE_DOMAIN fail-fast (별도 단위 검사).
 * - #329 /api/refresh limiter 적용.
 */
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';
import { issueCsrfToken } from '../src/lib/csrf.js';

const SIGNUP = {
  email: 'sec@get-it.cloud',
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: 'Sec',
  acceptTerms: true,
  acceptPrivacy: true,
};

describe('#312 CSRF guard', () => {
  it('GET /api/csrf 가 토큰 + httponly+pub 쿠키 set', async () => {
    const app = createApp({ rateLimitMax: 1000 });
    const res = await request(app).get('/api/csrf');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const sc = res.headers['set-cookie'] ?? [];
    expect(sc.some((c) => c.startsWith('getit_csrf='))).toBe(true);
    expect(sc.some((c) => c.startsWith('getit_csrf_pub='))).toBe(true);
  });

  it('protected /api/me/profile — 미인증 PATCH → 401 (CSRF 우선 X, #427)', async () => {
    // #427: JWT 쿠키 없는 요청은 CSRF 검사를 건너뛰고 requireAuth 가 401 을 먼저 응답.
    // 외부 호출 일관성: "왜 안되는지" 가 "CsrfTokenMismatch" 보다 "NotAuthenticated" 가 맞다.
    const app = createApp({ rateLimitMax: 1000 });
    const res = await request(app).patch('/api/me/profile').send({});
    expect(res.status).toBe(401);
  });

  it('protected /api/me/profile — JWT 있는데 CSRF 없으면 403', async () => {
    // CSRF guard 는 인증된 사용자에게만 적용. JWT 가 있으면 CSRF mismatch → 403.
    const app = createApp({ rateLimitMax: 1000 });
    const res = await request(app)
      .patch('/api/me/profile')
      .set('Cookie', 'getit_jwt=anything')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CsrfTokenMismatch');
  });

  it('protected /api/me/profile — 헤더+쿠키 일치 시 인증 단계까지 진입 (401, CSRF 통과)', async () => {
    const app = createApp({ rateLimitMax: 1000 });
    const token = issueCsrfToken();
    const res = await request(app)
      .patch('/api/me/profile')
      .set('Cookie', `getit_csrf=${token}`)
      .set('X-CSRF-Token', token);
    // CSRF 는 통과 → JWT 없어서 401 (CSRF 403 이 아님).
    expect(res.status).toBe(401);
  });

  it('/api/logout 은 CSRF 면제 (idempotent)', async () => {
    const app = createApp({ rateLimitMax: 1000 });
    const res = await request(app).post('/api/logout');
    expect(res.status).toBe(204);
  });

  it('login/signup 은 CSRF 면제 (초기 진입점)', async () => {
    const app = createApp({ rateLimitMax: 1000 });
    const res = await request(app).post('/api/signup').send(SIGNUP);
    expect(res.status).toBe(201);
  });
});

describe('#313 rate-limit 기본 30/min', () => {
  it('기본 limiter 가 5 회 직후 차단하지 않음', async () => {
    const app = createApp(); // default rateLimitMax = 30
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/login')
        .send({ email: `n${i}@get-it.cloud`, password: 'WrongPass1' });
      expect(res.status).toBe(401); // 401 (자격 없음) 이어야 함 — 429 아님.
    }
  });
});

describe('#316 CORS 거부 우선', () => {
  it('CORS_ORIGINS 비고 외부 origin 전송 → 403 (rate-limit 카운트 전)', async () => {
    const original = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = '';
    try {
      const app = createApp({ rateLimitMax: 2 });
      const res = await request(app)
        .post('/api/login')
        .set('Origin', 'https://evil.example')
        .send({ email: 'x@y.com', password: 'WrongPass1' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CorsOriginNotAllowed');
    } finally {
      process.env.CORS_ORIGINS = original ?? 'http://localhost:5173';
    }
  });
});

describe('#329 /api/refresh rate-limit', () => {
  it('refreshLimiter 가 무차별 대입 시 429 반환', async () => {
    const app = createApp({ rateLimitMax: 3 });
    let lastStatus = 401;
    for (let i = 0; i < 6; i++) {
      const r = await request(app).post('/api/refresh').set('Cookie', 'getit_refresh=fake');
      lastStatus = r.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('#415 /api/docs prod gate — recon 표적 차단', () => {
  it('NODE_ENV=production + AUTH_DOCS_PUBLIC 미설정 → /api/docs 404', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDocs = process.env.AUTH_DOCS_PUBLIC;
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_DOCS_PUBLIC;
    try {
      const app = createApp({ rateLimitMax: 100 });
      const docs = await request(app).get('/api/docs/');
      expect(docs.status).toBe(404);
      const spec = await request(app).get('/api/openapi.json');
      expect(spec.status).toBe(404);
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
      if (originalDocs === undefined) delete process.env.AUTH_DOCS_PUBLIC;
      else process.env.AUTH_DOCS_PUBLIC = originalDocs;
    }
  });

  it('NODE_ENV=production + AUTH_DOCS_PUBLIC=true → 명시적 opt-in 으로 노출', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDocs = process.env.AUTH_DOCS_PUBLIC;
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DOCS_PUBLIC = 'true';
    try {
      const app = createApp({ rateLimitMax: 100 });
      const spec = await request(app).get('/api/openapi.json');
      expect(spec.status).toBe(200);
      expect(spec.body.openapi).toMatch(/^3\./);
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
      if (originalDocs === undefined) delete process.env.AUTH_DOCS_PUBLIC;
      else process.env.AUTH_DOCS_PUBLIC = originalDocs;
    }
  });

  it('NODE_ENV=test (기본) → /api/openapi.json 노출 — staging/개발 흐름 보존', async () => {
    const app = createApp({ rateLimitMax: 100 });
    const spec = await request(app).get('/api/openapi.json');
    expect(spec.status).toBe(200);
  });
});
