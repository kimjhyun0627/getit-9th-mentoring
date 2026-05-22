/**
 * auth-api refresh / logout / rate-limit / CORS 통합 테스트 (#546 split).
 *
 * 커버리지:
 *  - POST /api/refresh: 정상 회전 / revoked 거부 / 만료 거부 / reuse-detection
 *  - POST /api/logout: 쿠키 clear + 토큰 revoke
 *  - Rate limit: signup burst → 429
 *  - GET /api/health: 200 OK
 *  - CORS fail-closed
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { hashRefreshToken } from '../src/lib/tokens.js';
import { readCookie, signupOk, VALID_SIGNUP } from './_auth.helpers.js';
import { memDb } from './setup.js';

describe('auth-api refresh / logout / rate-limit / CORS', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  describe('POST /api/refresh', () => {
    it('정상 회전 → 새 access+refresh 발급 + 이전 토큰 revoked', async () => {
      const signup = await signupOk(app);
      const oldRefresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      expect(oldRefresh).toBeTruthy();

      const res = await request(app)
        .post('/api/refresh')
        .set('Cookie', `getit_refresh=${oldRefresh}`);
      expect(res.status).toBe(200);
      const newAccess = readCookie(res.headers['set-cookie'], 'getit_jwt');
      const newRefresh = readCookie(res.headers['set-cookie'], 'getit_refresh');
      expect(newAccess).toBeTruthy();
      expect(newRefresh).toBeTruthy();
      expect(newRefresh).not.toBe(oldRefresh);

      const oldHash = hashRefreshToken(oldRefresh);
      const stored = [...memDb.refreshTokens.values()].find((t) => t.tokenHash === oldHash);
      expect(stored.revokedAt).not.toBeNull();
    });

    it('revoked refresh → 401', async () => {
      const signup = await signupOk(app);
      const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
      const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
      expect(res.status).toBe(401);
    });

    it('refresh 쿠키 없으면 401', async () => {
      const res = await request(app).post('/api/refresh');
      expect(res.status).toBe(401);
    });

    it('revoked refresh 재사용 → 사용자 모든 활성 refresh 토큰 강제 무효화', async () => {
      const signup = await signupOk(app);
      const r1 = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      const rot1 = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r1}`);
      const r2 = readCookie(rot1.headers['set-cookie'], 'getit_refresh');
      expect(r2).toBeTruthy();

      const reuse = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r1}`);
      expect(reuse.status).toBe(401);

      const after = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r2}`);
      expect(after.status).toBe(401);
    });

    it('expired refresh → 401', async () => {
      const signup = await signupOk(app);
      const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      const hash = hashRefreshToken(refresh);
      for (const [id, t] of memDb.refreshTokens) {
        if (t.tokenHash === hash) {
          memDb.refreshTokens.set(id, { ...t, expiresAt: new Date(Date.now() - 1000) });
        }
      }
      const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/logout', () => {
    it('로그아웃 → 쿠키 clear + refresh revoke', async () => {
      const signup = await signupOk(app);
      const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      const res = await request(app).post('/api/logout').set('Cookie', `getit_refresh=${refresh}`);
      expect(res.status).toBe(204);
      const setCookie = res.headers['set-cookie'] ?? [];
      const accessClear = setCookie.find((c) => c.startsWith('getit_jwt='));
      const refreshClear = setCookie.find((c) => c.startsWith('getit_refresh='));
      expect(accessClear).toBeTruthy();
      expect(refreshClear).toBeTruthy();

      const hash = hashRefreshToken(refresh);
      const stored = [...memDb.refreshTokens.values()].find((t) => t.tokenHash === hash);
      expect(stored.revokedAt).not.toBeNull();
    });

    it('refresh 쿠키 없어도 204 (멱등)', async () => {
      const res = await request(app).post('/api/logout');
      expect(res.status).toBe(204);
    });
  });

  describe('Rate limit', () => {
    it('signup 3회 초과 시 429', async () => {
      const localApp = createApp({ rateLimitMax: 3 });
      await request(localApp)
        .post('/api/signup')
        .send({ ...VALID_SIGNUP, email: 'a1@x.com' });
      await request(localApp)
        .post('/api/signup')
        .send({ ...VALID_SIGNUP, email: 'a2@x.com' });
      await request(localApp)
        .post('/api/signup')
        .send({ ...VALID_SIGNUP, email: 'a3@x.com' });
      const res = await request(localApp)
        .post('/api/signup')
        .send({ ...VALID_SIGNUP, email: 'a4@x.com' });
      expect(res.status).toBe(429);
    });
  });

  describe('GET /api/health', () => {
    it('200 OK (public)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('CORS fail-closed', () => {
    it('CORS_ORIGINS 비면 cross-origin Access-Control-Allow-Origin 미반사', async () => {
      const original = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = '';
      try {
        const closedApp = createApp({ rateLimitMax: 100 });
        const res = await request(closedApp)
          .get('/api/health')
          .set('Origin', 'https://evil.example');
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      } finally {
        if (original === undefined) {
          delete process.env.CORS_ORIGINS;
        } else {
          process.env.CORS_ORIGINS = original;
        }
      }
    });
  });
});
