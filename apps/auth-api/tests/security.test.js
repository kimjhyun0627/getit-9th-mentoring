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

  it('protected /api/me/profile — CSRF 헤더 없이 PATCH → 403', async () => {
    const app = createApp({ rateLimitMax: 1000 });
    const res = await request(app).patch('/api/me/profile').send({});
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
