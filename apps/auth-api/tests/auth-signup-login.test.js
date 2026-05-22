/**
 * auth-api signup / login 통합 테스트 (#546 split — 기존 auth.test.js 분할).
 *
 * 커버리지:
 *  - POST /api/signup: 정상 / 중복 email / 비밀번호 약함 / name 누락 / nickname 케이스
 *  - POST /api/login:  정상 / 잘못된 비밀번호 / 미존재 email / enumeration 차단
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { readCookie, signupOk, VALID_SIGNUP } from './_auth.helpers.js';

describe('auth-api signup / login', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

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
      const [r1, r2] = await Promise.all([signupOk(app), signupOk(app)]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });

    // #538 — nickname 회귀.
    it('#538 nickname 포함 가입 → 201 + 응답에 nickname 노출', async () => {
      const res = await signupOk(app, { nickname: '길동이' });
      expect(res.status).toBe(201);
      expect(res.body.user.nickname).toBe('길동이');
    });

    it('#538 nickname 중복 → 409 NicknameTaken', async () => {
      await signupOk(app, { nickname: 'samenick' });
      const r2 = await signupOk(app, {
        email: 'other@get-it.cloud',
        nickname: 'samenick',
      });
      expect(r2.status).toBe(409);
      expect(r2.body.error).toBe('NicknameTaken');
    });

    it('#538 nickname 형식 위반 (특수문자) → 400', async () => {
      const res = await signupOk(app, { nickname: 'bad!nick' });
      expect(res.status).toBe(400);
    });

    it('#538 nickname 1자 → 400', async () => {
      const res = await signupOk(app, { nickname: 'a' });
      expect(res.status).toBe(400);
    });

    it('#538 nickname 빈 문자열은 허용 (마이그레이션 단계 nullable)', async () => {
      const res = await signupOk(app, { nickname: '' });
      expect(res.status).toBe(201);
      expect(res.body.user.nickname).toBeNull();
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
      await signupOk(app);

      const measure = async (body) => {
        const start = process.hrtime.bigint();
        await request(app).post('/api/login').send(body);
        return Number(process.hrtime.bigint() - start);
      };

      // Warm-up: JIT/bcrypt 초기화 비용을 측정에서 제외 (CodeRabbit 권고).
      await measure({ email: VALID_SIGNUP.email, password: 'wrong-password-xxx' });
      await measure({ email: 'warmup-nobody@get-it.cloud', password: 'password1234' });

      // 표본 수 9개 → median 안정성 ↑.
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
      // 환경 편차 (CI / 로컬) 완화 — 미존재 케이스가 존재 케이스의 0.3~3배 범위면 충분히
      // 더미 bcrypt 가 실행됐다고 본다. 너무 빡빡하면 flake (CR #546).
      expect(missingMed).toBeGreaterThan(existingMed * 0.3);
      expect(missingMed).toBeLessThan(existingMed * 3);
    });

    it('미존재 email + 존재 email 잘못된 비번 → 동일한 에러 응답 (enumeration 차단, #299)', async () => {
      await signupOk(app);
      const a = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: 'wrong-password-xxx' });
      const b = await request(app)
        .post('/api/login')
        .send({ email: 'nobody@get-it.cloud', password: 'password1234' });
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.body).toEqual({ error: 'InvalidCredentials' });
      expect(b.body).toEqual({ error: 'InvalidCredentials' });
    });
  });

  describe('GET /api/me (basic)', () => {
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

    it('Cache-Control: no-store 헤더 응답 — 304 매칭으로 body 손실 차단', async () => {
      const signup = await signupOk(app);
      const accessToken = readCookie(signup.headers['set-cookie'], 'getit_jwt');
      const res = await request(app).get('/api/me').set('Cookie', `getit_jwt=${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });
});
