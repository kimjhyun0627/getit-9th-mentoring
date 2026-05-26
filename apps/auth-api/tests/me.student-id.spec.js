/**
 * PATCH /api/me/student-id — #571 8자리 → 10자리 학번 마이그레이션 회귀.
 *
 * 커버:
 *  - 정상 (학교 인증 + 10자리) → 200 + DB studentId 업데이트 + 새 access/refresh 쿠키 + JWT studentIdLegacy 누락
 *  - 8/11자리 / 숫자 아닌 / 누락 → 400 (zod)
 *  - 학교 미인증 (schoolVerifiedAt null) → 403 SchoolNotVerified
 *  - 비로그인 → 401
 *  - CSRF 토큰 없음 (헤더/쿠키 미적용) → 403
 *  - 기존 refresh token rotation (revoke)
 *
 * 별도로 buildAccessTokenPayload 의 studentIdLegacy 계산 unit + publicUser 의
 * studentIdLegacy 직접 계산 unit 까지 한 파일에 묶어 300줄 가드 안에서 동봉.
 */
import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { issueCsrfToken } from '../src/lib/csrf.js';

import { memDb } from './setup.js';

const SIGNUP = {
  email: 'sid@get-it.cloud',
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: '학생',
  acceptTerms: true,
  acceptPrivacy: true,
};

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

describe('PATCH /api/me/student-id (#571 8 → 10자리 학번 마이그레이션)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  /**
   * signup 후 학교 인증 + 8자리 studentId 박힌 상태로 만든다 (legacy 사용자 시뮬).
   */
  const setupLegacyUser = async (overrides = {}) => {
    const res = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, ...overrides });
    const jwtToken = cookie(res.headers['set-cookie'], 'getit_jwt');
    const refresh = cookie(res.headers['set-cookie'], 'getit_refresh');
    // DB 에서 8자리 학번 + schoolVerifiedAt 박기.
    for (const [id, u] of memDb.users) {
      if (u.email === (overrides.email ?? SIGNUP.email)) {
        memDb.users.set(id, {
          ...u,
          studentId: '20241234',
          schoolEmail: 'sid@knu.ac.kr',
          schoolVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
        });
      }
    }
    return { jwt: jwtToken, refresh };
  };

  it('정상: 학교 인증 + 10자리 → 200 + DB 업데이트 + 새 쿠키 + studentIdLegacy 누락', async () => {
    const { jwt: oldJwt, refresh: oldRefresh } = await setupLegacyUser();

    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${oldJwt}`,
      `getit_refresh=${oldRefresh}`,
    ]).send({ studentId: '2024111234' });

    expect(res.status).toBe(200);
    expect(res.body.user.studentId).toBe('2024111234');
    expect(res.body.user.studentIdLegacy).toBe(false);

    // DB 업데이트.
    const u = [...memDb.users.values()].find((x) => x.email === SIGNUP.email);
    expect(u.studentId).toBe('2024111234');
    // 학교 인증은 그대로 (정정 흐름이 인증을 끊지 않음).
    expect(u.schoolVerifiedAt).toBeInstanceOf(Date);
    expect(u.schoolEmail).toBe('sid@knu.ac.kr');

    // 새 쿠키 발급 + JWT payload 에 studentIdLegacy 누락.
    const setCookies = res.headers['set-cookie'] ?? [];
    const newJwt = cookie(setCookies, 'getit_jwt');
    expect(newJwt).toBeTruthy();
    expect(newJwt).not.toBe(oldJwt);
    const newRefresh = cookie(setCookies, 'getit_refresh');
    expect(newRefresh).toBeTruthy();

    const payload = jwt.verify(newJwt, process.env.JWT_SECRET);
    expect('studentIdLegacy' in payload).toBe(false);
  });

  it('정상 후 기존 refresh token rotate (revoke)', async () => {
    const { jwt: jwtTok, refresh: oldRefresh } = await setupLegacyUser({
      email: 'rot-sid@get-it.cloud',
    });
    const oldHash = crypto.createHash('sha256').update(oldRefresh).digest('hex');

    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${jwtTok}`,
      `getit_refresh=${oldRefresh}`,
    ]).send({ studentId: '2024111234' });
    expect(res.status).toBe(200);

    const afterRow = [...memDb.refreshTokens.values()].find((r) => r.tokenHash === oldHash);
    expect(afterRow?.revokedAt).toBeInstanceOf(Date);
  });

  it('8자리 input → 400 (zod)', async () => {
    const { jwt: jwtTok } = await setupLegacyUser({ email: 'eight@get-it.cloud' });
    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${jwtTok}`,
    ]).send({ studentId: '20241234' });
    expect(res.status).toBe(400);
  });

  it('11자리 input → 400 (zod)', async () => {
    const { jwt: jwtTok } = await setupLegacyUser({ email: 'eleven@get-it.cloud' });
    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${jwtTok}`,
    ]).send({ studentId: '20241112345' });
    expect(res.status).toBe(400);
  });

  it('이미 10자리 학번 보유자 → 403 NotLegacyStudentId (마이그레이션 대상 아님 가드)', async () => {
    // signup 후 학교 인증 + 10자리 학번 박힌 사용자 (정상 사용자 시뮬).
    const sign = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, email: 'normal@get-it.cloud' });
    const jwtTok = cookie(sign.headers['set-cookie'], 'getit_jwt');
    for (const [id, u] of memDb.users) {
      if (u.email === 'normal@get-it.cloud') {
        memDb.users.set(id, {
          ...u,
          studentId: '2024111234',
          schoolEmail: 'normal@knu.ac.kr',
          schoolVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
        });
      }
    }
    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${jwtTok}`,
    ]).send({ studentId: '2024999999' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NotLegacyStudentId');

    // DB studentId 변경 안 됨 검증.
    const u = [...memDb.users.values()].find((x) => x.email === 'normal@get-it.cloud');
    expect(u.studentId).toBe('2024111234');
  });

  it('학번 자체 null (학교 인증은 됐지만 studentId 없음) → 403 NotLegacyStudentId', async () => {
    const sign = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, email: 'no-sid@get-it.cloud' });
    const jwtTok = cookie(sign.headers['set-cookie'], 'getit_jwt');
    for (const [id, u] of memDb.users) {
      if (u.email === 'no-sid@get-it.cloud') {
        memDb.users.set(id, {
          ...u,
          studentId: null,
          schoolEmail: 'nosid@knu.ac.kr',
          schoolVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
        });
      }
    }
    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${jwtTok}`,
    ]).send({ studentId: '2024111234' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NotLegacyStudentId');
  });

  it('schoolVerifiedAt null → 403 SchoolNotVerified', async () => {
    // signup 직후 학교 인증 안 한 상태.
    const sign = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, email: 'unverified@get-it.cloud' });
    const jwtTok = cookie(sign.headers['set-cookie'], 'getit_jwt');
    const res = await withCsrf(request(app).patch('/api/me/student-id'), [
      `getit_jwt=${jwtTok}`,
    ]).send({ studentId: '2024111234' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('SchoolNotVerified');

    // DB studentId 변경 안 됨 검증.
    const u = [...memDb.users.values()].find((x) => x.email === 'unverified@get-it.cloud');
    expect(u.studentId ?? null).toBe(null);
  });

  it('비로그인 → 401', async () => {
    const res = await request(app).patch('/api/me/student-id').send({ studentId: '2024111234' });
    expect(res.status).toBe(401);
  });

  it('CSRF 토큰 없음 → 403 CsrfTokenMismatch', async () => {
    const { jwt: jwtTok } = await setupLegacyUser({ email: 'nocsrf@get-it.cloud' });
    // CSRF 헤더 / 쿠키 미동봉 → 403.
    const res = await request(app)
      .patch('/api/me/student-id')
      .set('Cookie', `getit_jwt=${jwtTok}`)
      .send({ studentId: '2024111234' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CsrfTokenMismatch');
  });
});

describe('buildAccessTokenPayload studentIdLegacy 계산 unit (#571)', () => {
  it('studentId 8자리 → studentIdLegacy: true', async () => {
    const { buildAccessTokenPayload } = await import('../src/lib/issueTokens.js');
    const p = buildAccessTokenPayload({
      id: 'a',
      email: 'a@x.com',
      name: 'A',
      studentId: '20241234',
    });
    expect(p.studentIdLegacy).toBe(true);
  });

  it('studentId 10자리 → studentIdLegacy 키 누락 (false 동치)', async () => {
    const { buildAccessTokenPayload } = await import('../src/lib/issueTokens.js');
    const p = buildAccessTokenPayload({
      id: 'a',
      email: 'a@x.com',
      name: 'A',
      studentId: '2024111234',
    });
    expect('studentIdLegacy' in p).toBe(false);
  });

  it('studentId null → studentIdLegacy 키 누락', async () => {
    const { buildAccessTokenPayload } = await import('../src/lib/issueTokens.js');
    const p = buildAccessTokenPayload({
      id: 'a',
      email: 'a@x.com',
      name: 'A',
      studentId: null,
    });
    expect('studentIdLegacy' in p).toBe(false);
  });

  it('studentId 누락 → studentIdLegacy 키 누락', async () => {
    const { buildAccessTokenPayload } = await import('../src/lib/issueTokens.js');
    const p = buildAccessTokenPayload({ id: 'a', email: 'a@x.com', name: 'A' });
    expect('studentIdLegacy' in p).toBe(false);
  });
});

describe('publicUser studentIdLegacy 직접 계산 unit (#571 — auth-api DB 진실)', () => {
  it('DB studentId 8자리 → studentIdLegacy: true', async () => {
    const { publicUser } = await import('../src/routes/userSerialize.js');
    const u = publicUser({ id: 'a', email: 'a@x.com', name: 'A', studentId: '20241234' });
    expect(u.studentIdLegacy).toBe(true);
  });

  it('DB studentId 10자리 → studentIdLegacy: false', async () => {
    const { publicUser } = await import('../src/routes/userSerialize.js');
    const u = publicUser({ id: 'a', email: 'a@x.com', name: 'A', studentId: '2024111234' });
    expect(u.studentIdLegacy).toBe(false);
  });

  it('DB studentId null → studentIdLegacy: false', async () => {
    const { publicUser } = await import('../src/routes/userSerialize.js');
    const u = publicUser({ id: 'a', email: 'a@x.com', name: 'A', studentId: null });
    expect(u.studentIdLegacy).toBe(false);
  });
});
