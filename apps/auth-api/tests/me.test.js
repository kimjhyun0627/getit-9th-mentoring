/**
 * /api/me/* + #308 (revoked user 차단) 통합 테스트.
 *
 * - PATCH /api/me/profile (#235)
 * - POST  /api/me/delete  (#231)
 * - GET   /api/me/sessions / POST revoke-others (#321)
 * - GET   /api/me — DB 재조회 후 deletedAt 차단 (#308)
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { issueCsrfToken } from '../src/lib/csrf.js';
import { memDb } from './setup.js';

/**
 * me/* 라우트는 CSRF protected — 테스트 헬퍼로 헤더+쿠키 동시 전송.
 *
 * @param {import('supertest').Test} agent
 * @param {string[]} extraCookies
 */
const withCsrf = (agent, extraCookies = []) => {
  const t = issueCsrfToken();
  return agent
    .set('X-CSRF-Token', t)
    .set('Cookie', [...extraCookies, `getit_csrf=${t}`].join('; '));
};

const SIGNUP = {
  email: 'me@get-it.cloud',
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: 'Me',
  acceptTerms: true,
  acceptPrivacy: true,
};

const cookie = (setCookie, name) => {
  if (!setCookie) return null;
  const hit = setCookie.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.split(';')[0].split('=')[1] : null;
};

describe('me endpoints (Phase 6c)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  const signupAndGetCookies = async (overrides = {}) => {
    const res = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, ...overrides });
    return {
      jwt: cookie(res.headers['set-cookie'], 'getit_jwt'),
      refresh: cookie(res.headers['set-cookie'], 'getit_refresh'),
      body: res.body,
    };
  };

  describe('#308 GET /api/me revoked/삭제된 user 차단', () => {
    it('유효한 access 토큰 + 활성 user → 200', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await request(app).get('/api/me').set('Cookie', `getit_jwt=${jwt}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(SIGNUP.email);
    });

    it('access 토큰은 유효해도 user.deletedAt 마킹되면 401', async () => {
      const { jwt } = await signupAndGetCookies();
      // DB 에서 직접 deletedAt 마킹.
      for (const [id, u] of memDb.users) {
        memDb.users.set(id, { ...u, deletedAt: new Date() });
      }
      const res = await request(app).get('/api/me').set('Cookie', `getit_jwt=${jwt}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UserRevokedOrDeleted');
    });
  });

  describe('#235 PATCH /api/me/profile', () => {
    it('이름만 변경 → 200', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${jwt}`]).send({
        name: 'New Name',
        email: SIGNUP.email,
        currentPassword: SIGNUP.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('New Name');
    });

    it('잘못된 currentPassword → 401', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${jwt}`]).send({
        name: 'X',
        email: SIGNUP.email,
        currentPassword: 'wrongwrong',
      });
      expect(res.status).toBe(401);
    });

    it('이메일 변경 → emailVerifiedAt 초기화', async () => {
      const { jwt } = await signupAndGetCookies();
      for (const [id, u] of memDb.users) {
        memDb.users.set(id, { ...u, emailVerifiedAt: new Date() });
      }
      const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${jwt}`]).send({
        name: SIGNUP.name,
        email: 'new@get-it.cloud',
        currentPassword: SIGNUP.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('new@get-it.cloud');
      expect(res.body.user.emailVerifiedAt).toBeNull();
    });

    it('비밀번호 변경 → 새 비번으로 로그인 가능', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${jwt}`]).send({
        name: SIGNUP.name,
        email: SIGNUP.email,
        currentPassword: SIGNUP.password,
        newPassword: 'Brand9999',
        newPasswordConfirm: 'Brand9999',
      });
      expect(res.status).toBe(200);
      const login = await request(app)
        .post('/api/login')
        .send({ email: SIGNUP.email, password: 'Brand9999' });
      expect(login.status).toBe(200);
    });

    // #538 — nickname PATCH 회귀.
    it('#538 nickname 변경 → 200 + 응답 반영', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${jwt}`]).send({
        name: SIGNUP.name,
        email: SIGNUP.email,
        nickname: '새닉네임',
        currentPassword: SIGNUP.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.user.nickname).toBe('새닉네임');
    });

    it('#538 nickname 중복 → 409 NicknameTaken', async () => {
      // 다른 user 가 먼저 같은 nickname 점유.
      memDb.users.set('u_squatter', {
        id: 'u_squatter',
        email: 'squat@get-it.cloud',
        passwordHash: 'x',
        name: 'Squat',
        nickname: 'taken',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { jwt } = await signupAndGetCookies();
      const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${jwt}`]).send({
        name: SIGNUP.name,
        email: SIGNUP.email,
        nickname: 'taken',
        currentPassword: SIGNUP.password,
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('NicknameTaken');
    });
  });

  describe('#231 POST /api/me/delete', () => {
    it('정상 탈퇴 → deletedAt 마킹 + 쿠키 clear + 이후 /api/me 401', async () => {
      const { jwt, refresh } = await signupAndGetCookies();
      const res = await withCsrf(request(app).post('/api/me/delete'), [
        `getit_jwt=${jwt}`,
        `getit_refresh=${refresh}`,
      ]).send({ currentPassword: SIGNUP.password, confirm: '탈퇴' });
      expect(res.status).toBe(200);
      const after = await request(app).get('/api/me').set('Cookie', `getit_jwt=${jwt}`);
      expect(after.status).toBe(401);
    });

    it('잘못된 confirm 문구 → 400', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await withCsrf(request(app).post('/api/me/delete'), [`getit_jwt=${jwt}`]).send({
        currentPassword: SIGNUP.password,
        confirm: '예',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('#321 sessions', () => {
    it('GET /api/me/sessions → 활성 토큰 list', async () => {
      const { jwt } = await signupAndGetCookies();
      const res = await request(app).get('/api/me/sessions').set('Cookie', `getit_jwt=${jwt}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBe(1);
    });

    it('POST revoke-others → 다른 세션 revoke', async () => {
      const { jwt, refresh } = await signupAndGetCookies();
      const second = await request(app)
        .post('/api/login')
        .send({ email: SIGNUP.email, password: SIGNUP.password });
      const r2 = cookie(second.headers['set-cookie'], 'getit_refresh');
      expect(r2).toBeTruthy();

      const res = await withCsrf(request(app).post('/api/me/sessions/revoke-others'), [
        `getit_jwt=${jwt}`,
        `getit_refresh=${refresh}`,
      ]);
      expect(res.status).toBe(200);
      expect(res.body.revoked).toBe(1);
      const rot = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r2}`);
      expect(rot.status).toBe(401);
    });
  });
});
