/**
 * 이메일 인증 라우터 통합 테스트 (Issue #226).
 *
 * - signup 직후 EmailVerifyToken 1건 발급되고 메일 stub 가 호출되는지.
 * - POST /api/verify-email 정상/만료/잘못 토큰.
 * - POST /api/verify-email/resend (로그인 필요).
 */
import { createHash } from 'node:crypto';

import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { memDb, sentMails } from './setup.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const SIGNUP = {
  email: 'verify@get-it.cloud',
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: 'Verify',
  acceptTerms: true,
  acceptPrivacy: true,
};

const cookie = (setCookie, name) => {
  if (!setCookie) return null;
  const hit = setCookie.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.split(';')[0].split('=')[1] : null;
};

describe('verify-email (#226)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  it('signup 시 EmailVerifyToken + 메일 stub 발송', async () => {
    await request(app).post('/api/signup').send(SIGNUP);
    expect(memDb.emailVerifyTokens.size).toBe(1);
    expect(sentMails.some((m) => m.subject === 'verify-email' && m.to === SIGNUP.email)).toBe(true);
  });

  it('정상 토큰 → 200 + User.emailVerifiedAt 채워짐', async () => {
    await request(app).post('/api/signup').send(SIGNUP);
    // mailer mock 가 verifyUrl 을 캡처했으므로 거기서 token 파싱.
    const sent = sentMails.find((m) => m.subject === 'verify-email');
    const url = new URL(sent.text);
    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();

    const res = await request(app).post('/api/verify-email').send({ token });
    expect(res.status).toBe(200);
    const u = [...memDb.users.values()][0];
    expect(u.emailVerifiedAt).not.toBeNull();
  });

  it('잘못된 토큰 → 400', async () => {
    await request(app).post('/api/signup').send(SIGNUP);
    const res = await request(app)
      .post('/api/verify-email')
      .send({ token: 'a'.repeat(64) });
    expect(res.status).toBe(400);
  });

  it('만료된 토큰 → 400', async () => {
    await request(app).post('/api/signup').send(SIGNUP);
    const sent = sentMails.find((m) => m.subject === 'verify-email');
    const url = new URL(sent.text);
    const token = url.searchParams.get('token');
    const hash = sha256(token);
    for (const [id, t] of memDb.emailVerifyTokens) {
      if (t.tokenHash === hash) {
        memDb.emailVerifyTokens.set(id, { ...t, expiresAt: new Date(Date.now() - 1000) });
      }
    }
    const res = await request(app).post('/api/verify-email').send({ token });
    expect(res.status).toBe(400);
  });

  it('재발송 — 로그인 필요', async () => {
    const signup = await request(app).post('/api/signup').send(SIGNUP);
    const jwt = cookie(signup.headers['set-cookie'], 'getit_jwt');
    sentMails.length = 0; // signup 때 보낸 메일 비움
    const res = await request(app)
      .post('/api/verify-email/resend')
      .set('Cookie', `getit_jwt=${jwt}`);
    expect(res.status).toBe(200);
    expect(sentMails.some((m) => m.subject === 'verify-email')).toBe(true);
  });

  it('재발송 — 토큰 없으면 401', async () => {
    const res = await request(app).post('/api/verify-email/resend');
    expect(res.status).toBe(401);
  });
});
