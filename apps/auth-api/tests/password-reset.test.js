/**
 * 비밀번호 재설정 라우터 통합 테스트 (Issue #221).
 *
 * 커버리지:
 *  - POST /api/password/forgot
 *    - 존재 이메일: 200 + sent:true + email + (dev 모드면 token 노출)
 *    - 미존재 이메일: 404 + EmailNotFound (Issue #394, 사용자 명시 요청 분기)
 *    - 검증 실패: 400
 *  - POST /api/password/reset
 *    - 정상 토큰: 200 + 비밀번호 변경 + 토큰 used 마킹 + 모든 refresh revoke
 *    - 잘못된 토큰: 400
 *    - 만료된 토큰: 400
 *    - 사용된 토큰: 400
 *    - 비밀번호 약함: 400
 *    - 새 비밀번호로 로그인 가능 (회귀)
 */
import { createHash } from 'node:crypto';

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.js';
import { memDb } from './setup.js';

const VALID_SIGNUP = {
  email: 'reset@get-it.cloud',
  password: 'Oldpass123',
  passwordConfirm: 'Oldpass123',
  name: 'Reset User',
  acceptTerms: true,
  acceptPrivacy: true,
};
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('password-reset', () => {
  /** @type {import('express').Express} */
  let app;
  /** @type {string | undefined} */
  let originalDevToken;

  beforeAll(() => {
    // dev 모드 활성화 → forgot 응답 본문에 token 포함 (테스트 편의용)
    originalDevToken = process.env.RESET_TOKEN_DEV_RETURN;
    process.env.RESET_TOKEN_DEV_RETURN = 'true';
    app = createApp({ rateLimitMax: 1000 });
  });

  afterAll(() => {
    // 환경변수 원복 — 다른 테스트 파일/배치로 누수 방지.
    if (originalDevToken === undefined) {
      delete process.env.RESET_TOKEN_DEV_RETURN;
    } else {
      process.env.RESET_TOKEN_DEV_RETURN = originalDevToken;
    }
  });

  beforeEach(async () => {
    await request(app).post('/api/signup').send(VALID_SIGNUP);
  });

  describe('POST /api/password/forgot', () => {
    it('존재 이메일 → 200 + sent:true + email + token (dev mode)', async () => {
      const res = await request(app)
        .post('/api/password/forgot')
        .send({ email: VALID_SIGNUP.email });
      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);
      expect(res.body.email).toBe(VALID_SIGNUP.email);
      expect(res.body.token).toBeTruthy();
      expect(typeof res.body.token).toBe('string');
      // 토큰이 DB에 hash 로만 저장돼야 한다 (평문 X)
      const stored = [...memDb.passwordResetTokens.values()];
      expect(stored.length).toBe(1);
      expect(stored[0].tokenHash).toBe(sha256(res.body.token));
      expect(stored[0].usedAt).toBeNull();
    });

    it('미존재 이메일 → 404 + EmailNotFound (Issue #394 분기)', async () => {
      const res = await request(app)
        .post('/api/password/forgot')
        .send({ email: 'nobody@get-it.cloud' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('EmailNotFound');
      expect(res.body.token).toBeUndefined();
      // DB 에 토큰 row 도 생성되지 않음
      expect(memDb.passwordResetTokens.size).toBe(0);
    });

    it('이메일 형식 오류 → 400', async () => {
      const res = await request(app).post('/api/password/forgot').send({ email: 'no' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/password/reset', () => {
    /** @returns {Promise<string>} 평문 토큰 */
    const issueToken = async () => {
      const r = await request(app).post('/api/password/forgot').send({ email: VALID_SIGNUP.email });
      return r.body.token;
    };

    it('정상 토큰 → 200 + 비밀번호 변경 + 토큰 used 마킹', async () => {
      const token = await issueToken();
      const res = await request(app).post('/api/password/reset').send({
        token,
        password: 'Newpass456',
        passwordConfirm: 'Newpass456',
      });
      expect(res.status).toBe(200);
      // 토큰 used 마킹 확인
      const stored = [...memDb.passwordResetTokens.values()][0];
      expect(stored.usedAt).not.toBeNull();
    });

    it('새 비밀번호로 로그인 성공 (회귀)', async () => {
      const token = await issueToken();
      await request(app).post('/api/password/reset').send({
        token,
        password: 'Newpass456',
        passwordConfirm: 'Newpass456',
      });
      const res = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: 'Newpass456' });
      expect(res.status).toBe(200);
    });

    it('비밀번호 reset 후 기존 모든 refresh 토큰 revoke', async () => {
      // 사전 로그인 → refresh 1개
      const login = await request(app)
        .post('/api/login')
        .send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
      const refresh = login.headers['set-cookie']
        ?.find((c) => c.startsWith('getit_refresh='))
        ?.split(';')[0]
        ?.split('=')[1];
      expect(refresh).toBeTruthy();

      // 재설정
      const token = await issueToken();
      await request(app).post('/api/password/reset').send({
        token,
        password: 'Newpass456',
        passwordConfirm: 'Newpass456',
      });

      // 기존 refresh 토큰으로 회전 시도 → 401
      const res = await request(app).post('/api/refresh').set('Cookie', `getit_refresh=${refresh}`);
      expect(res.status).toBe(401);
    });

    it('잘못된 토큰 → 400', async () => {
      const res = await request(app)
        .post('/api/password/reset')
        .send({
          token: 'a'.repeat(64),
          password: 'Newpass456',
          passwordConfirm: 'Newpass456',
        });
      expect(res.status).toBe(400);
    });

    it('사용된 토큰 재사용 → 400', async () => {
      const token = await issueToken();
      await request(app).post('/api/password/reset').send({
        token,
        password: 'Newpass456',
        passwordConfirm: 'Newpass456',
      });
      const res = await request(app).post('/api/password/reset').send({
        token,
        password: 'Thirdpw789',
        passwordConfirm: 'Thirdpw789',
      });
      expect(res.status).toBe(400);
    });

    it('만료된 토큰 → 400', async () => {
      const token = await issueToken();
      // expiresAt 강제 과거로 변경
      const hash = sha256(token);
      for (const [id, t] of memDb.passwordResetTokens) {
        if (t.tokenHash === hash) {
          memDb.passwordResetTokens.set(id, { ...t, expiresAt: new Date(Date.now() - 1000) });
        }
      }
      const res = await request(app).post('/api/password/reset').send({
        token,
        password: 'Newpass456',
        passwordConfirm: 'Newpass456',
      });
      expect(res.status).toBe(400);
    });

    it('비밀번호 8자 미만 → 400', async () => {
      const token = await issueToken();
      const res = await request(app).post('/api/password/reset').send({
        token,
        password: 'short',
        passwordConfirm: 'short',
      });
      expect(res.status).toBe(400);
    });

    it('passwordConfirm 불일치 → 400', async () => {
      const token = await issueToken();
      const res = await request(app).post('/api/password/reset').send({
        token,
        password: 'Newpass456',
        passwordConfirm: 'Otherpass1',
      });
      expect(res.status).toBe(400);
    });
  });
});
