/**
 * letter-api `GET /api/me` 통합 테스트 (supertest).
 *
 * 회귀 배경:
 *  - production build 에 `VITE_AUTH_API_URL` 안 박혀서 FE 가 `GET /api/me` 를
 *    letter-api 로 보냄 → 라우터 없으면 404 → FE 401 핸들러 안 탐 → SSO redirect 누락.
 *  - 이 테스트는 letter-api 가 `/me` 를 항상 제공한다는 invariant 를 락한다.
 *
 * 커버리지:
 *  - Authorization 헤더 없음 → 401 (FE 401 핸들러가 SSO redirect 트리거할 수 있게)
 *  - 잘못된 JWT → 401
 *  - 유효 JWT → 200 + `{ user: { sub, email, name } }` (auth-api 컨트랙트와 동일)
 *  - 응답 모양: 추가 키 없음 (passwordHash 등 안전한 echo)
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;

const tokenFor = (sub, email = `${sub}@get-it.cloud`, name = sub) =>
  signJwt({ sub, email, name }, SECRET);

describe('letter-api GET /api/me', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  it('Authorization 헤더 없음 → 401 (404 가 아님)', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    // 404 회귀 명시 가드: FE 의 401 핸들러가 발화하려면 정확히 401 이어야 함.
    expect(res.status).not.toBe(404);
  });

  it('잘못된 JWT → 401', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('유효 JWT → 200 + user echo (auth-api 컨트랙트와 동일)', async () => {
    const token = tokenFor('user-1', 'user1@get-it.cloud', 'User One');
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: { sub: 'user-1', email: 'user1@get-it.cloud', name: 'User One' },
    });
  });

  it('응답 모양 — user 외 추가 top-level 키 없음', async () => {
    const token = tokenFor('user-2');
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['user']);
  });
});
