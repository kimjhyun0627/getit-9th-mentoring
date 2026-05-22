/**
 * letter 무한 redirect 회귀 테스트.
 *
 * 배경:
 *  - letter-web BoardPage 가 /api/me 로 nickname 키 누락된 응답을 받으면 onboarding
 *    페이지로 강제 redirect → onboarding 에서 nickname 설정 → letter 복귀 → JWT 가
 *    옛 payload (nickname 없음) 라 또 redirect → 무한 루프.
 *  - 근본 원인: JWT access token 발급 시 nickname / schoolVerifiedAt 누락.
 *
 * 검증:
 *  1. signup 직후 JWT payload 에 nickname 박혀 있음
 *  2. PATCH /me/nickname 후 새 access token 의 payload nickname 갱신
 *  3. refresh 후 DB row 의 nickname 이 새 JWT 에 박힘
 *  4. nickname null/빈 사용자는 JWT 에 키 누락 (legacy 호환)
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { issueCsrfToken } from '../src/lib/csrf.js';

import { readCookie, signupOk, VALID_SIGNUP } from './_auth.helpers.js';
import { memDb } from './setup.js';

const SECRET = process.env.JWT_SECRET;

/**
 * @param {string} accessToken
 * @returns {Record<string, unknown>}
 */
const decodeAccess = (accessToken) => {
  const decoded = jwt.verify(accessToken, SECRET);
  if (typeof decoded !== 'object' || decoded === null) throw new Error('decoded not object');
  return decoded;
};

const withCsrf = (agent, extraCookies = []) => {
  const t = issueCsrfToken();
  return agent
    .set('X-CSRF-Token', t)
    .set('Cookie', [...extraCookies, `getit_csrf=${t}`].join('; '));
};

describe('letter 무한 redirect — JWT nickname payload', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  it('signup with nickname → JWT payload 에 nickname 박힘', async () => {
    const res = await signupOk(app, {
      email: 'nick-sign@get-it.cloud',
      nickname: '신호등',
    });
    expect(res.status).toBe(201);
    const access = readCookie(res.headers['set-cookie'], 'getit_jwt');
    expect(access).toBeTruthy();
    const payload = decodeAccess(access);
    expect(payload.nickname).toBe('신호등');
  });

  it('signup without nickname → 자동 추천이 채워져 JWT 에도 박힘', async () => {
    // BE #557: 빈 nickname 은 자동 추천 적용. JWT 에도 그대로 박혀야 함.
    const res = await signupOk(app, { email: 'auto-nick@get-it.cloud', nickname: '' });
    expect(res.status).toBe(201);
    const access = readCookie(res.headers['set-cookie'], 'getit_jwt');
    const payload = decodeAccess(access);
    expect(typeof payload.nickname).toBe('string');
    expect(payload.nickname.length).toBeGreaterThan(0);
  });

  it('PATCH /api/me/nickname → 새 access token 발급 + nickname 갱신', async () => {
    const signup = await signupOk(app, {
      email: 'patch-nick@get-it.cloud',
      nickname: '예전닉',
    });
    const oldJwt = readCookie(signup.headers['set-cookie'], 'getit_jwt');
    const oldRefresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');

    const res = await withCsrf(request(app).patch('/api/me/nickname'), [
      `getit_jwt=${oldJwt}`,
      `getit_refresh=${oldRefresh}`,
    ]).send({ nickname: '새로운닉' });
    expect(res.status).toBe(200);
    expect(res.body.user.nickname).toBe('새로운닉');

    const newAccess = readCookie(res.headers['set-cookie'], 'getit_jwt');
    expect(newAccess).toBeTruthy();
    expect(newAccess).not.toBe(oldJwt);
    const payload = decodeAccess(newAccess);
    expect(payload.nickname).toBe('새로운닉');
  });

  it('PATCH /api/me/profile 에서 nickname 만 변경해도 새 access token 발급', async () => {
    const signup = await signupOk(app, {
      email: 'profile-nick@get-it.cloud',
      nickname: '옛이름',
    });
    const oldJwt = readCookie(signup.headers['set-cookie'], 'getit_jwt');

    const res = await withCsrf(request(app).patch('/api/me/profile'), [`getit_jwt=${oldJwt}`]).send(
      {
        name: VALID_SIGNUP.name,
        email: 'profile-nick@get-it.cloud',
        nickname: '바뀐이름',
        currentPassword: VALID_SIGNUP.password,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.user.nickname).toBe('바뀐이름');

    const newAccess = readCookie(res.headers['set-cookie'], 'getit_jwt');
    expect(newAccess).toBeTruthy();
    const payload = decodeAccess(newAccess);
    expect(payload.nickname).toBe('바뀐이름');
  });

  it('POST /api/refresh → 새 access token 에 DB 의 nickname 박힘', async () => {
    // signup 직후 DB user row 에 nickname 을 박아두고, refresh 가 그 값을 새 JWT 에 반영하는지.
    const signup = await signupOk(app, {
      email: 'refresh-nick@get-it.cloud',
      nickname: '리프레시닉',
    });
    const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');

    // (refresh 핸들러는 DB 에서 user 재조회 후 issueTokensAndCookies — 새 nickname 반영)
    // 추가 변경: DB row 의 nickname 을 다른 값으로 바꿔서, refresh 가 그 값 반영하는지 확인.
    for (const [id, u] of memDb.users) {
      if (u.email === 'refresh-nick@get-it.cloud') {
        memDb.users.set(id, { ...u, nickname: '리프레시변경됨' });
      }
    }

    const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
    expect(res.status).toBe(200);
    const newAccess = readCookie(res.headers['set-cookie'], 'getit_jwt');
    expect(newAccess).toBeTruthy();
    const payload = decodeAccess(newAccess);
    expect(payload.nickname).toBe('리프레시변경됨');
  });

  it('nickname null 인 사용자의 JWT 는 nickname 키 누락 (legacy 호환)', async () => {
    // 시뮬레이션: signup 직후 DB nickname 을 null 로 강제. refresh 하면 nickname 누락 JWT.
    const signup = await signupOk(app, {
      email: 'null-nick@get-it.cloud',
      nickname: '잠깐있는닉',
    });
    const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
    for (const [id, u] of memDb.users) {
      if (u.email === 'null-nick@get-it.cloud') {
        memDb.users.set(id, { ...u, nickname: null });
      }
    }
    const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
    expect(res.status).toBe(200);
    const newAccess = readCookie(res.headers['set-cookie'], 'getit_jwt');
    const payload = decodeAccess(newAccess);
    expect('nickname' in payload).toBe(false);
  });

  it('refresh 가 DB 의 schoolVerifiedAt 도 새 JWT 에 반영', async () => {
    const signup = await signupOk(app, { email: 'school-ver@get-it.cloud', nickname: '학교닉' });
    const refresh = readCookie(signup.headers['set-cookie'], 'getit_refresh');
    const verifiedAt = new Date('2026-05-21T03:00:00.000Z');
    for (const [id, u] of memDb.users) {
      if (u.email === 'school-ver@get-it.cloud') {
        memDb.users.set(id, { ...u, schoolVerifiedAt: verifiedAt });
      }
    }
    const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
    expect(res.status).toBe(200);
    const newAccess = readCookie(res.headers['set-cookie'], 'getit_jwt');
    const payload = decodeAccess(newAccess);
    expect(payload.schoolVerifiedAt).toBe(verifiedAt.toISOString());
  });
});

describe('letter-redirect-fix: tokens.js helper unit', () => {
  it('buildAccessTokenPayload 는 nickname 있을 때만 키 부착', async () => {
    const { buildAccessTokenPayload } = await import('../src/lib/issueTokens.js');
    expect(buildAccessTokenPayload({ id: 'a', email: 'a@x.com', name: 'A' })).toEqual({
      sub: 'a',
      email: 'a@x.com',
      name: 'A',
    });
    expect(buildAccessTokenPayload({ id: 'a', email: 'a@x.com', name: 'A', nickname: '' })).toEqual(
      { sub: 'a', email: 'a@x.com', name: 'A' },
    );
    expect(
      buildAccessTokenPayload({ id: 'a', email: 'a@x.com', name: 'A', nickname: '   ' }),
    ).toEqual({ sub: 'a', email: 'a@x.com', name: 'A' });
    expect(
      buildAccessTokenPayload({ id: 'a', email: 'a@x.com', name: 'A', nickname: '닉' }),
    ).toEqual({ sub: 'a', email: 'a@x.com', name: 'A', nickname: '닉' });
  });

  it('buildAccessTokenPayload 는 schoolVerifiedAt 도 정규화', async () => {
    const { buildAccessTokenPayload } = await import('../src/lib/issueTokens.js');
    const d = new Date('2026-01-02T03:04:05.000Z');
    expect(
      buildAccessTokenPayload({ id: 'a', email: 'a@x.com', name: 'A', schoolVerifiedAt: d }),
    ).toEqual({
      sub: 'a',
      email: 'a@x.com',
      name: 'A',
      schoolVerifiedAt: '2026-01-02T03:04:05.000Z',
    });
  });
});
