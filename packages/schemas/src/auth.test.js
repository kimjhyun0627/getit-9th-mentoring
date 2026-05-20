import { describe, it, expect } from 'vitest';

import {
  ForgotPasswordInput,
  JwtPayload,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from './auth.js';

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

describe('ForgotPasswordInput', () => {
  it('정상 이메일 통과', () => {
    expect(ForgotPasswordInput.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('잘못된 이메일 거부', () => {
    expect(ForgotPasswordInput.safeParse({ email: 'no' }).success).toBe(false);
  });
});

describe('ResetPasswordInput', () => {
  const base = {
    token: 'a'.repeat(64),
    password: '12345678',
    passwordConfirm: '12345678',
  };
  it('정상 입력 통과', () => {
    expect(ResetPasswordInput.safeParse(base).success).toBe(true);
  });
  it('토큰 길이 미달 거부', () => {
    expect(ResetPasswordInput.safeParse({ ...base, token: 'short' }).success).toBe(false);
  });
  it('비밀번호 확인 불일치 거부', () => {
    expect(ResetPasswordInput.safeParse({ ...base, passwordConfirm: 'differentpw' }).success).toBe(
      false,
    );
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
