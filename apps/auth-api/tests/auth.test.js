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
  // #265 강한 정책 — 영문 + 숫자 2종 포함.
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: 'Alice',
  // #237 약관 동의.
  acceptTerms: true,
  acceptPrivacy: true,
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

    it('동시 가입 race → P2002 캐치 후 409 (사전조회 통과해도 409 매핑)', async () => {
      // 같은 이메일을 거의 동시에 두 번 시도. 사전조회는 둘 다 통과할 수 있지만
      // create 단계의 unique 위반(P2002)을 잡아 409 로 매핑하는지 검증.
      const [r1, r2] = await Promise.all([signupOk(app), signupOk(app)]);
      const statuses = [r1.status, r2.status].sort();
      // 하나는 201, 다른 하나는 409 여야 한다. 절대 500 X.
      expect(statuses).toEqual([201, 409]);
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

    it('8자 미만 비번 / 잘못된 email shape → 401 InvalidCredentials (정책 누설 차단, #432)', async () => {
      // 이전엔 ValidationError 로 400 + "비밀번호는 8자 이상이어야 합니다" 응답 → 정책 누설.
      // 이제는 모두 401 InvalidCredentials 로 collapse → 봇이 정책 추론 불가.
      const shortPw = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: 'x' });
      expect(shortPw.status).toBe(401);
      expect(shortPw.body).toEqual({ error: 'InvalidCredentials' });

      const badEmail = await request(app)
        .post('/api/login')
        .send({ email: 'not-an-email', password: 'whatever12' });
      expect(badEmail.status).toBe(401);
      expect(badEmail.body).toEqual({ error: 'InvalidCredentials' });
    });

    it('미존재 email 응답시간이 존재 email 잘못된 비번 시간과 비슷 (timing leak 방어, #299)', async () => {
      // 동일 cost (BCRYPT_COST=4) 의 bcrypt.compare 가 두 케이스 모두 실행돼야 한다.
      await signupOk(app);

      const measure = async (body) => {
        const start = process.hrtime.bigint();
        await request(app).post('/api/login').send(body);
        return Number(process.hrtime.bigint() - start);
      };

      // Warm-up: JIT/bcrypt 초기화 비용을 측정에서 제외 (CodeRabbit 권고).
      await measure({ email: VALID_SIGNUP.email, password: 'wrong-password-xxx' });
      await measure({ email: 'warmup-nobody@get-it.cloud', password: 'password1234' });

      // 표본 수 9개 → median 안정성 ↑ (3개는 환경 노이즈에 흔들림).
      const existingTimes = [];
      const missingTimes = [];
      for (let i = 0; i < 9; i++) {
        existingTimes.push(
          await measure({ email: VALID_SIGNUP.email, password: 'wrong-password-xxx' }),
        );
        missingTimes.push(
          await measure({ email: `nobody${i}@get-it.cloud`, password: 'password1234' }),
        );
      }
      const median = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
      const existingMed = median(existingTimes);
      const missingMed = median(missingTimes);
      // 더미 hash 가 실행되지 않으면 missing 이 existing 의 1/3 미만으로 짧다.
      // 안전 마진: missing 이 existing 의 절반 이상이어야 통과.
      expect(missingMed).toBeGreaterThan(existingMed * 0.5);
    });

    it('미존재 email + 존재 email 잘못된 비번 → 동일한 에러 응답 (enumeration 차단, #299)', async () => {
      await signupOk(app);
      const a = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: 'wrong-password-xxx' });
      const b = await request(app)
        .post('/api/login')
        .send({ email: 'nobody@get-it.cloud', password: 'password1234' });
      // 두 응답이 (1) 일치해야 하고 (2) 정확히 401/InvalidCredentials 여야 한다.
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.body).toEqual({ error: 'InvalidCredentials' });
      expect(b.body).toEqual({ error: 'InvalidCredentials' });
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

    it('revoked refresh 재사용 → 사용자 모든 활성 refresh 토큰 강제 무효화', async () => {
      const signup = await signupOk(app);
      const r1 = readCookie(signup.headers['set-cookie'], 'getit_refresh');
      // 첫 회전 (성공 → r1 revoked, r2 발급)
      const rot1 = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r1}`);
      const r2 = readCookie(rot1.headers['set-cookie'], 'getit_refresh');
      expect(r2).toBeTruthy();

      // revoked 인 r1 을 다시 사용 → reuse-detection 트리거.
      const reuse = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r1}`);
      expect(reuse.status).toBe(401);

      // r2 도 강제 revoked 되어야 함 → r2 로 회전 시도 시 401.
      const after = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${r2}`);
      expect(after.status).toBe(401);
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

  describe('CORS fail-closed', () => {
    it('CORS_ORIGINS 비면 cross-origin Access-Control-Allow-Origin 미반사', async () => {
      // process.env는 try/finally로 원복 보장 (테스트 실패해도 다음 테스트 격리).
      const original = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = '';
      try {
        const closedApp = createApp({ rateLimitMax: 100 });
        const res = await request(closedApp)
          .get('/api/health')
          .set('Origin', 'https://evil.example');
        // origin: false → Access-Control-Allow-Origin 헤더 자체가 생략돼야 함.
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
