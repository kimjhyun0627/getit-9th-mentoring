/**
 * 학교 인증 라우터 테스트 (Issue #538).
 *
 * 커버리지:
 *  - POST /api/me/school-link        — 도메인 검증 / 토큰 생성 / 메일 발송 / 다른 user 충돌
 *  - POST /api/me/school-link/resend — 기존 토큰 무효화 + 새 토큰 생성 + rate limit
 *  - POST /api/auth/verify-school    — 토큰 검증 / 학번 저장 / consume idempotent
 *  - GET  /api/me                    — 학교 인증 후 응답 확장 필드 노출
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

/** /api/me/school-link 는 CSRF protected — 헬퍼. */
const withCsrf = (agent, extraCookies = []) => {
  const t = issueCsrfToken();
  return agent
    .set('X-CSRF-Token', t)
    .set('Cookie', [...extraCookies, `getit_csrf=${t}`].join('; '));
};

describe('school verify routes (#538)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    // 일반 케이스: 학교 인증 limiter 도 충분히 크게.
    app = createApp({ rateLimitMax: 1000, schoolLinkMax: 1000, schoolResendMax: 1000 });
  });

  const signup = async (overrides = {}) => {
    const res = await request(app)
      .post('/api/signup')
      .send({ ...SIGNUP, ...overrides });
    return {
      jwt: cookie(res.headers['set-cookie'], 'getit_jwt'),
      body: res.body,
    };
  };

  /** /api/me/school-link 으로 토큰 발급 → 메일 본문에서 raw token 추출. */
  const linkAndExtractToken = async (jwt, email = SCHOOL_EMAIL) => {
    sentMails.length = 0;
    const res = await withCsrf(request(app).post('/api/me/school-link'), [`getit_jwt=${jwt}`]).send(
      { email },
    );
    expect(res.status).toBe(200);
    const url = sentMails.at(-1)?.text ?? '';
    const m = url.match(/token=([^&\s]+)/);
    return { res, token: m?.[1] };
  };

  describe('POST /api/me/school-link', () => {
    it('정상 — @knu.ac.kr 메일 입력 시 200 + 메일 발송 + 마스킹 응답', async () => {
      const { jwt } = await signup();
      const { res } = await linkAndExtractToken(jwt);
      expect(res.body).toMatchObject({ ok: true, sent: true });
      expect(res.body.email).toMatch(/^so\*\*\*@knu\.ac\.kr$/);
      const sent = sentMails.find((m) => m.subject === 'school-verify');
      expect(sent?.to).toBe(SCHOOL_EMAIL);
      expect(sent?.text).toMatch(/verify-school\?token=/);
    });

    it('다른 도메인 메일 → 400 InvalidSchoolEmail', async () => {
      const { jwt } = await signup();
      const res = await withCsrf(request(app).post('/api/me/school-link'), [
        `getit_jwt=${jwt}`,
      ]).send({ email: 'foo@gmail.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('InvalidSchoolEmail');
    });

    it('다른 user 가 이미 인증한 schoolEmail → 409 SchoolEmailTaken', async () => {
      const a = await signup();
      // 기존 인증된 user 를 직접 DB 에 박는다.
      memDb.users.set('u_other', {
        id: 'u_other',
        email: 'other@get-it.cloud',
        passwordHash: 'x',
        name: 'Other',
        nickname: null,
        schoolEmail: SCHOOL_EMAIL,
        schoolVerifiedAt: new Date(),
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await withCsrf(request(app).post('/api/me/school-link'), [
        `getit_jwt=${a.jwt}`,
      ]).send({ email: SCHOOL_EMAIL });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('SchoolEmailTaken');
    });

    it('인증 없이 호출 → 401', async () => {
      const res = await request(app).post('/api/me/school-link').send({ email: SCHOOL_EMAIL });
      expect(res.status).toBe(401);
    });

    it('CSRF 없이 호출 → 403 CsrfTokenMismatch', async () => {
      const { jwt } = await signup();
      const res = await request(app)
        .post('/api/me/school-link')
        .set('Cookie', `getit_jwt=${jwt}`)
        .send({ email: SCHOOL_EMAIL });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/auth/verify-school', () => {
    it('정상 — 토큰 + 학번 → 200 + User.studentId/schoolEmail/schoolVerifiedAt 셋', async () => {
      const { jwt } = await signup();
      const { token } = await linkAndExtractToken(jwt);
      const res = await request(app)
        .post('/api/auth/verify-school')
        .send({ token, studentId: '2024111234' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: SIGNUP.email,
        studentId: '2024111234',
        schoolEmail: SCHOOL_EMAIL,
      });
      expect(res.body.user.schoolVerifiedAt).toBeTruthy();

      // DB 검증 — fixture 가 추가되면 첫 원소가 흔들리므로 email 기반으로 찾는다 (CR #546).
      const u = [...memDb.users.values()].find((x) => x.email === SIGNUP.email);
      expect(u).toBeTruthy();
      expect(u.studentId).toBe('2024111234');
      expect(u.schoolEmail).toBe(SCHOOL_EMAIL);
      expect(u.schoolVerifiedAt).toBeInstanceOf(Date);
    });

    it('잘못된 토큰 → 400 InvalidToken', async () => {
      const res = await request(app)
        .post('/api/auth/verify-school')
        .send({ token: 'a'.repeat(48), studentId: '2024111234' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('InvalidToken');
    });

    it('만료된 토큰 → 400 InvalidToken', async () => {
      const { jwt } = await signup();
      const { token } = await linkAndExtractToken(jwt);
      // 토큰 만료 강제 — DB 직접 조작.
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      for (const [id, t] of memDb.schoolVerifyTokens) {
        if (t.tokenHash === tokenHash) {
          memDb.schoolVerifyTokens.set(id, { ...t, expiresAt: new Date(Date.now() - 1000) });
        }
      }
      const res = await request(app)
        .post('/api/auth/verify-school')
        .send({ token, studentId: '2024111234' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('InvalidToken');
    });

    it('consumed 토큰 재사용 → 400 InvalidToken (idempotent)', async () => {
      const { jwt } = await signup();
      const { token } = await linkAndExtractToken(jwt);
      const ok = await request(app)
        .post('/api/auth/verify-school')
        .send({ token, studentId: '2024111234' });
      expect(ok.status).toBe(200);
      const again = await request(app)
        .post('/api/auth/verify-school')
        .send({ token, studentId: '2024999999' });
      expect(again.status).toBe(400);
      expect(again.body.error).toBe('InvalidToken');
    });

    it('학번이 10자리 숫자 아니면 400 ValidationError', async () => {
      const { jwt } = await signup();
      const { token } = await linkAndExtractToken(jwt);
      const res = await request(app)
        .post('/api/auth/verify-school')
        .send({ token, studentId: 'abc123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('학번이 8자리(구 정책)면 400 ValidationError — 회귀 방지', async () => {
      const { jwt } = await signup();
      const { token } = await linkAndExtractToken(jwt);
      const res = await request(app)
        .post('/api/auth/verify-school')
        .send({ token, studentId: '20241234' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('짧은 토큰 → 400 InvalidToken (스키마 단계)', async () => {
      const res = await request(app)
        .post('/api/auth/verify-school')
        .send({ token: 'short', studentId: '2024111234' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('InvalidToken');
    });

    // #569: verify-school 후 access token 미갱신 → hobby 가드 stale → 재인증 요구 버그.
    //   PATCH /me/nickname (#560) 과 같은 패턴 — 트랜잭션 직후 새 토큰 + 쿠키 발급.
    it('성공 시 새 access/refresh 쿠키 발급 + JWT payload 에 schoolVerifiedAt 박힘 (#569)', async () => {
      const { jwt: oldJwt } = await signup();
      // 로그인 직후 토큰엔 schoolVerifiedAt 없음 (회귀 baseline).
      const oldPayload = verifyJwt(oldJwt, process.env.JWT_SECRET);
      expect(oldPayload.schoolVerifiedAt).toBeUndefined();

      const { token } = await linkAndExtractToken(oldJwt);
      const res = await request(app)
        .post('/api/auth/verify-school')
        .set('Cookie', `getit_jwt=${oldJwt}`)
        .send({ token, studentId: '2024111234' });
      expect(res.status).toBe(200);

      // Set-Cookie 에 새 access/refresh 둘 다 박혀야 함.
      const setCookies = res.headers['set-cookie'] ?? [];
      const newJwt = cookie(setCookies, 'getit_jwt');
      const newRefresh = cookie(setCookies, 'getit_refresh');
      expect(newJwt).toBeTruthy();
      expect(newRefresh).toBeTruthy();
      expect(newJwt).not.toBe(oldJwt);

      // 새 JWT payload 에 schoolVerifiedAt 박힘 → 다음 요청부터 hobby 가드 통과.
      const newPayload = verifyJwt(newJwt, process.env.JWT_SECRET);
      expect(typeof newPayload.schoolVerifiedAt).toBe('string');
      expect(new Date(newPayload.schoolVerifiedAt).getTime()).not.toBeNaN();
      expect(newPayload.sub).toBe(oldPayload.sub);
    });

    it('성공 시 기존 refresh token 은 revoke 됨 (rotation, #569)', async () => {
      const signupRes = await request(app).post('/api/signup').send(SIGNUP);
      const oldRefresh = cookie(signupRes.headers['set-cookie'], 'getit_refresh');
      const jwt = cookie(signupRes.headers['set-cookie'], 'getit_jwt');
      expect(oldRefresh).toBeTruthy();

      const oldHash = crypto.createHash('sha256').update(oldRefresh).digest('hex');
      const beforeRow = [...memDb.refreshTokens.values()].find((r) => r.tokenHash === oldHash);
      expect(beforeRow?.revokedAt).toBeFalsy();

      const { token } = await linkAndExtractToken(jwt);
      const res = await request(app)
        .post('/api/auth/verify-school')
        .set('Cookie', [`getit_jwt=${jwt}`, `getit_refresh=${oldRefresh}`].join('; '))
        .send({ token, studentId: '2024111234' });
      expect(res.status).toBe(200);

      // 기존 refresh token row 가 revoke 되어야 한다.
      const afterRow = [...memDb.refreshTokens.values()].find((r) => r.tokenHash === oldHash);
      expect(afterRow?.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/me/school-link/resend', () => {
    it('기존 미사용 토큰 무효화 + 새 토큰 발급', async () => {
      const { jwt } = await signup();
      const first = await linkAndExtractToken(jwt);
      // resend 로 새 토큰 발급.
      sentMails.length = 0;
      const second = await withCsrf(request(app).post('/api/me/school-link/resend'), [
        `getit_jwt=${jwt}`,
      ]).send({ email: SCHOOL_EMAIL });
      expect(second.status).toBe(200);
      const url = sentMails.at(-1)?.text ?? '';
      const newToken = url.match(/token=([^&\s]+)/)?.[1];
      expect(newToken).toBeTruthy();
      expect(newToken).not.toBe(first.token);

      // 기존 토큰은 invalidated.
      const reuseOld = await request(app)
        .post('/api/auth/verify-school')
        .send({ token: first.token, studentId: '2024111234' });
      expect(reuseOld.status).toBe(400);

      // 새 토큰은 동작.
      const useNew = await request(app)
        .post('/api/auth/verify-school')
        .send({ token: newToken, studentId: '2024111234' });
      expect(useNew.status).toBe(200);
    });

    it('rate limit — 분당 1건 초과 시 429', async () => {
      // 별도 작은 limit 인스턴스로 — rate-limit 자체 테스트.
      // 본 라우터의 resend limiter 는 1/min keyGenerator=userId → 2회째 429.
      const localApp = createApp({
        rateLimitMax: 1000,
        schoolLinkMax: 1000,
        schoolResendMax: 1,
      });
      const signupRes = await request(localApp).post('/api/signup').send(SIGNUP);
      const jwt = cookie(signupRes.headers['set-cookie'], 'getit_jwt');
      await withCsrf(request(localApp).post('/api/me/school-link/resend'), [
        `getit_jwt=${jwt}`,
      ]).send({ email: SCHOOL_EMAIL });
      const r2 = await withCsrf(request(localApp).post('/api/me/school-link/resend'), [
        `getit_jwt=${jwt}`,
      ]).send({ email: SCHOOL_EMAIL });
      expect(r2.status).toBe(429);
      expect(r2.body.error).toBe('RateLimitExceeded');
    });
  });
});

describe('GET /api/me — #538 응답 확장', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000, schoolLinkMax: 1000, schoolResendMax: 1000 });
  });

  it('기본 응답에 nickname/studentId/schoolEmail/schoolVerifiedAt/createdAt 포함', async () => {
    const res = await request(app).post('/api/signup').send(SIGNUP);
    const jwt = cookie(res.headers['set-cookie'], 'getit_jwt');
    const me = await request(app).get('/api/me').set('Cookie', `getit_jwt=${jwt}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      email: SIGNUP.email,
      name: SIGNUP.name,
      // #557: SIGNUP fixture 에 nickname 미지정 → BE 가 자동 추천을 채운다.
      //   기존 spec 은 null 이었으나 자동추천 도입으로 항상 string.
      studentId: null,
      schoolEmail: null,
      schoolVerifiedAt: null,
    });
    expect(typeof me.body.user.nickname).toBe('string');
    expect(me.body.user.nickname.length).toBeGreaterThanOrEqual(2);
    expect(me.body.user.createdAt).toBeTruthy();
  });
});
