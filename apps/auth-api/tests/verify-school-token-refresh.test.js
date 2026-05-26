/**
 * verify-school 토큰 회전 + Session Overwrite 방어 회귀 테스트 (#569 / #570).
 *
 * 본 파일은 `school-verify.test.js` 의 300-line 가드 초과 방지 + 본 PR 의 scope
 * (verify-school 직후 토큰 재발급 + UserMismatch 차단) 회귀를 한 곳에 모은다.
 *
 * 커버:
 *  - #569 — verify-school 성공 시 새 access/refresh 쿠키 + JWT payload 에
 *    `schoolVerifiedAt` 박힘 (hobby 가드 stale 차단)
 *  - #569 — 기존 refresh token rotation (revoke)
 *  - #570 — 다른 user 토큰 verify 시 403 + DB 부작용 0
 *  - #570 — access invalid + 다른 user 의 활성 refresh → 403 (refresh fallback)
 *  - #570 — 비로그인 (쿠키 X) 흐름 보존 (200)
 */
import crypto from 'node:crypto';

import { verifyJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { issueCsrfToken } from '../src/lib/csrf.js';
import { memDb, sentMails } from './setup.js';

const SIGNUP = {
  email: 'student@get-it.cloud',
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: '학생',
  acceptTerms: true,
  acceptPrivacy: true,
};
const SCHOOL_EMAIL = 'someone@knu.ac.kr';

const cookie = (setCookie, name) => {
  if (!setCookie) return null;
  const hit = setCookie.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.split(';')[0].split('=')[1] : null;
};

const withCsrf = (agent, extraCookies = []) => {
  const t = issueCsrfToken();
  return agent
    .set('X-CSRF-Token', t)
    .set('Cookie', [...extraCookies, `getit_csrf=${t}`].join('; '));
};

describe('verify-school token refresh + Session Overwrite 방어 (#569 / #570)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000, schoolLinkMax: 1000, schoolResendMax: 1000 });
  });

  const signup = async (overrides = {}) => {
    const res = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, ...overrides });
    return {
      jwt: cookie(res.headers['set-cookie'], 'getit_jwt'),
      refresh: cookie(res.headers['set-cookie'], 'getit_refresh'),
    };
  };

  const linkAndExtractToken = async (jwt, email = SCHOOL_EMAIL) => {
    sentMails.length = 0;
    const res = await withCsrf(request(app).post('/api/me/school-link'), [`getit_jwt=${jwt}`]).send(
      { email },
    );
    expect(res.status).toBe(200);
    const url = sentMails.at(-1)?.text ?? '';
    const m = url.match(/token=([^&\s]+)/);
    return { token: m?.[1] };
  };

  it('성공 시 새 access/refresh 쿠키 + JWT payload schoolVerifiedAt (#569)', async () => {
    const { jwt: oldJwt } = await signup();
    const oldPayload = verifyJwt(oldJwt, process.env.JWT_SECRET);
    expect(oldPayload.schoolVerifiedAt).toBeUndefined();

    const { token } = await linkAndExtractToken(oldJwt);
    const res = await request(app)
      .post('/api/auth/verify-school')
      .set('Cookie', `getit_jwt=${oldJwt}`)
      .send({ token, studentId: '2024111234' });
    expect(res.status).toBe(200);

    const setCookies = res.headers['set-cookie'] ?? [];
    const newJwt = cookie(setCookies, 'getit_jwt');
    expect(newJwt).toBeTruthy();
    expect(cookie(setCookies, 'getit_refresh')).toBeTruthy();
    expect(newJwt).not.toBe(oldJwt);

    const newPayload = verifyJwt(newJwt, process.env.JWT_SECRET);
    expect(typeof newPayload.schoolVerifiedAt).toBe('string');
    expect(new Date(newPayload.schoolVerifiedAt).getTime()).not.toBeNaN();
    expect(newPayload.sub).toBe(oldPayload.sub);
  });

  it('성공 시 기존 refresh token revoke (rotation, #569)', async () => {
    const { jwt, refresh: oldRefresh } = await signup({ email: 'rot@get-it.cloud' });
    expect(oldRefresh).toBeTruthy();
    const oldHash = crypto.createHash('sha256').update(oldRefresh).digest('hex');

    const { token } = await linkAndExtractToken(jwt);
    const res = await request(app)
      .post('/api/auth/verify-school')
      .set('Cookie', [`getit_jwt=${jwt}`, `getit_refresh=${oldRefresh}`].join('; '))
      .send({ token, studentId: '2024111234' });
    expect(res.status).toBe(200);

    const afterRow = [...memDb.refreshTokens.values()].find((r) => r.tokenHash === oldHash);
    expect(afterRow?.revokedAt).toBeInstanceOf(Date);
  });

  // user A 로 로그인한 상태에서 user B 의 verify token 검증 시도 → 403 + DB 부작용 0.
  it('다른 user 토큰으로 verify → 403 UserMismatch + DB 부작용 0 (#570)', async () => {
    const a = await signup({ email: 'aa@get-it.cloud' });
    const b = await signup({ email: 'bb@get-it.cloud' });

    const { token: bToken } = await linkAndExtractToken(b.jwt, 'bb@knu.ac.kr');
    const bId = [...memDb.users.values()].find((x) => x.email === 'bb@get-it.cloud').id;

    const res = await request(app)
      .post('/api/auth/verify-school')
      .set('Cookie', `getit_jwt=${a.jwt}`)
      .send({ token: bToken, studentId: '2024111234' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('UserMismatch');

    // DB 부작용 검증: B 의 schoolVerifiedAt / studentId 그대로 null.
    const bRow = memDb.users.get(bId);
    expect(bRow.schoolVerifiedAt ?? null).toBe(null);
    expect(bRow.studentId ?? null).toBe(null);

    // 같은 token 쿠키 없이 재시도 → 200 + B 의 schoolVerifiedAt 박힘.
    const retry = await request(app)
      .post('/api/auth/verify-school')
      .send({ token: bToken, studentId: '2024111234' });
    expect(retry.status).toBe(200);
    expect(memDb.users.get(bId).schoolVerifiedAt).toBeInstanceOf(Date);
  });

  // CR 2차 review — access JWT 가 invalid/expired 라도 refresh cookie 가 다른 user
  //   소유면 issueTokensAndCookies 가 그 세션을 덮어쓸 수 있음. refresh fallback 검사.
  it('access garbage + 다른 user 활성 refresh → 403 UserMismatch (#570)', async () => {
    const b = await signup({ email: 'bb2@get-it.cloud' });
    const { token: bToken } = await linkAndExtractToken(b.jwt, 'bb2@knu.ac.kr');

    // 별도 user A signup 으로 활성 refresh cookie 확보.
    const a = await signup({ email: 'aa3@get-it.cloud' });
    expect(a.refresh).toBeTruthy();

    const res = await request(app)
      .post('/api/auth/verify-school')
      .set('Cookie', ['getit_jwt=not-a-valid-jwt', `getit_refresh=${a.refresh}`].join('; '))
      .send({ token: bToken, studentId: '2024111234' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('UserMismatch');
  });

  it('비로그인 (쿠키 X) verify-school → 200 + 자동 로그인 (#570)', async () => {
    const { jwt } = await signup({ email: 'logout@get-it.cloud' });
    const { token } = await linkAndExtractToken(jwt);
    const res = await request(app)
      .post('/api/auth/verify-school')
      .send({ token, studentId: '2024111234' });
    expect(res.status).toBe(200);
    const setCookies = res.headers['set-cookie'] ?? [];
    expect(cookie(setCookies, 'getit_jwt')).toBeTruthy();
    expect(cookie(setCookies, 'getit_refresh')).toBeTruthy();
  });
});
