import { describe, it, expect } from 'vitest';

import { LoginInput, SignupInput, JwtPayload } from './auth.js';

describe('LoginInput', () => {
  it('정상 입력 통과', () => {
    const r = LoginInput.safeParse({ email: 'a@b.com', password: '12345678' });
    expect(r.success).toBe(true);
  });

  it('이메일 형식 검증', () => {
    const r = LoginInput.safeParse({ email: 'invalid', password: '12345678' });
    expect(r.success).toBe(false);
  });

  it('비밀번호 8자 미만 거부', () => {
    const r = LoginInput.safeParse({ email: 'a@b.com', password: '1234' });
    expect(r.success).toBe(false);
  });
});

describe('SignupInput', () => {
  const base = {
    email: 'a@b.com',
    password: '12345678',
    passwordConfirm: '12345678',
    name: '홍길동',
  };

  it('정상 입력 통과', () => {
    expect(SignupInput.safeParse(base).success).toBe(true);
  });

  it('비밀번호 확인 불일치 거부', () => {
    const r = SignupInput.safeParse({ ...base, passwordConfirm: 'different' });
    expect(r.success).toBe(false);
  });

  it('이름 누락 거부', () => {
    const r = SignupInput.safeParse({ ...base, name: '' });
    expect(r.success).toBe(false);
  });
});

describe('JwtPayload', () => {
  it('정상 payload 통과', () => {
    const r = JwtPayload.safeParse({
      sub: 'u_123',
      email: 'a@b.com',
      name: '홍길동',
      iat: 1700000000,
      exp: 1700003600,
    });
    expect(r.success).toBe(true);
  });
});
