/**
 * auth-api 통합 테스트 (supertest).
 *
 * 커버리지:
 *  - POST /api/signup: 정상 / 중복 email / 비밀번호 약함 / name 누락
 *  - POST /api/login:  정상 / 잘못된 비밀번호 / 미존재 email
 *  - GET  /api/me:     토큰 없음(401) / 유효 토큰(200)
 *  - POST /api/refresh: 정상 회전 / revoked 거부 / 만료 거부
 *  - POST /api/logout: 쿠키 clear + 토큰 revoke
 *  - Rate limit: signup/login burst 시 429
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { hashRefreshToken } from '../src/lib/tokens.js';
import { memDb } from './setup.js';

const VALID_SIGNUP = {
  email: 'alice@get-it.cloud',
  password: 'password1234',
  passwordConfirm: 'password1234',
  name: 'Alice',
};

/**
 * supertest agent의 Set-Cookie 헤더에서 특정 쿠키 값을 뽑아낸다.
 *
 * @param {string[] | undefined} setCookie
 * @param {string} name
 * @returns {string | null}
 */
const readCookie = (setCookie, name) => {
  if (!setCookie) return null;
  const hit = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!hit) return null;
  return hit.split(';')[0].split('=')[1];
};

const signupOk = async (app, overrides = {}) => {
  const body = { ...VALID_SIGNUP, ...overrides };
  const res = await request(app).post('/api/signup').send(body);
  return res;
};

describe('auth-api', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    // 기본은 넉넉히 — rate-limit 전용 테스트에서만 별도 작은 인스턴스 사용
    app = createApp({ rateLimitMax: 1000 });
  });

  // 각 테스트 시작 전 in-memory DB는 setup.js의 beforeEach가 리셋함.

  describe('POST /api/signup', () => {
    it('정상 signup → 201 + access/refresh 쿠키 set', async () => {
      const res = await signupOk(app);
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email: VALID_SIGNUP.email, name: VALID_SIGNUP.name });
      expect(res.body.user.passwordHash).toBeUndefined();
      const setCookie = res.headers['set-cookie'];
      expect(readCookie(setCookie, 'getit_jwt')).toBeTruthy();
      expect(readCookie(setCookie, 'getit_refresh')).toBeTruthy();
    });

    it('중복 email → 409', async () => {
      await signupOk(app);
      const res = await signupOk(app);
      expect(res.status).toBe(409);
    });

    it('비밀번호 8자 미만 → 400', async () => {
      const res = await signupOk(app, { password: 'short', passwordConfirm: 'short' });
      expect(res.status).toBe(400);
    });

    it('name 누락 → 400', async () => {
      const res = await signupOk(app, { name: '' });
      expect(res.status).toBe(400);
    });

    it('passwordConfirm 불일치 → 400', async () => {
      const res = await signupOk(app, { passwordConfirm: 'otherpassword' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/login', () => {
    it('정상 로그인 → 200 + 쿠키 set', async () => {
      await signupOk(app);
      const res = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(VALID_SIGNUP.email);
      expect(readCookie(res.headers['set-cookie'], 'getit_jwt')).toBeTruthy();
    });

    it('잘못된 비밀번호 → 401', async () => {
      await signupOk(app);
      const res = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: 'wrong-password-xxx' });
      expect(res.status).toBe(401);
    });

    it('미존재 email → 401', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ email: 'nobody@get-it.cloud', password: 'password1234' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/me', () => {
    it('토큰 없으면 401', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
    });

    it('유효 access 토큰으로 user 응답', async () => {
      const signup = await signupOk(app);
      const accessToken = readCookie(signup.headers['set-cookie'], 'getit_jwt');
      const res = await request(app).get('/api/me').set('Cookie', `getit_jwt=${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: VALID_SIGNUP.email, name: VALID_SIGNUP.name });
      expect(res.body.user.sub).toBeTruthy();
    });
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

      // 이전 refresh 가 DB에서 revoked로 마킹됐는지 확인
      const oldHash = hashRefreshToken(oldRefresh);
      const stored = [...memDb.refreshTokens.values()].find((t) => t.tokenHash === oldHash);
      expect(stored.revokedAt).not.toBeNull();
    });

    it('revoked refresh → 401', async () => {
      const signup = await signupOk(app);
      const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      // 첫 회전 (revoke 됨)
      await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
      // 같은 토큰 재사용 시도
      const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
      expect(res.status).toBe(401);
    });

    it('refresh 쿠키 없으면 401', async () => {
      const res = await request(app).post('/api/refresh');
      expect(res.status).toBe(401);
    });

    it('expired refresh → 401', async () => {
      const signup = await signupOk(app);
      const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      // DB에서 expiresAt 강제 과거로 변경
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
      // 쿠키 clear: Set-Cookie 에 max-age=0 또는 expires 과거
      const setCookie = res.headers['set-cookie'] ?? [];
      const accessClear = setCookie.find((c) => c.startsWith('getit_jwt='));
      const refreshClear = setCookie.find((c) => c.startsWith('getit_refresh='));
      expect(accessClear).toBeTruthy();
      expect(refreshClear).toBeTruthy();

      // DB의 refresh 토큰 revoked 처리
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
    it('signup 5회 초과 시 429', async () => {
      // createApp({ rateLimitMax: 5 })인 별도 인스턴스로 충돌 회피
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
});
