/**
 * E2E 흐름 자동 검증 (Issue #330).
 *
 * signup → me → logout → me(401) → 새 login → refresh 회전 → me → 회전 후 me 유효.
 *
 * supertest agent 사용 — 쿠키가 자동 보존돼서 실제 브라우저 흐름에 가까움.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

const SIGNUP = {
  email: 'e2e@get-it.cloud',
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: 'E2E',
  acceptTerms: true,
  acceptPrivacy: true,
};

describe('E2E flow (#330) — signup → me → logout → login → refresh → me', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  it('전체 flow 가 성공한다', async () => {
    const agent = request.agent(app);

    // 1) signup → 201 + 자동 로그인 쿠키.
    const signup = await agent.post('/api/signup').send(SIGNUP);
    expect(signup.status).toBe(201);
    expect(signup.body.user.email).toBe(SIGNUP.email);

    // 2) /api/me → 200 + 같은 user 응답.
    const me1 = await agent.get('/api/me');
    expect(me1.status).toBe(200);
    expect(me1.body.user.email).toBe(SIGNUP.email);

    // 3) logout → 204 + 쿠키 clear.
    const logout = await agent.post('/api/logout');
    expect(logout.status).toBe(204);

    // 4) logout 후 /api/me → 401.
    const me2 = await agent.get('/api/me');
    expect(me2.status).toBe(401);

    // 5) login 다시 → 200.
    const login = await agent
      .post('/api/login')
      .send({ email: SIGNUP.email, password: SIGNUP.password });
    expect(login.status).toBe(200);

    // 6) refresh 회전 → 200 + 새 토큰.
    const refresh = await agent.post('/api/refresh');
    expect(refresh.status).toBe(200);

    // 7) 회전 후에도 /api/me → 200.
    const me3 = await agent.get('/api/me');
    expect(me3.status).toBe(200);
    expect(me3.body.user.email).toBe(SIGNUP.email);
  });
});
