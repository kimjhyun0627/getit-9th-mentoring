import { describe, it, expect } from 'vitest';

import {
  DeleteAccountInput,
  ForgotPasswordInput,
  JwtPayload,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  UpdateProfileInput,
  VerifyEmailInput,
  VerifySchoolInput,
} from './auth.js';

describe('LoginInput', () => {
  it('정상 입력 통과 (로그인은 강한 정책 미적용 — 기존 사용자 보호)', () => {
    const r = LoginInput.safeParse({ email: 'a@b.com', password: '12345678' });
    expect(r.success).toBe(true);
  });

  it('이메일 형식 검증', () => {
    const r = LoginInput.safeParse({ email: 'invalid', password: 'Pass1234' });
    expect(r.success).toBe(false);
  });

  it('비밀번호 8자 미만 거부', () => {
    const r = LoginInput.safeParse({ email: 'a@b.com', password: '1234' });
    expect(r.success).toBe(false);
  });
});

describe('SignupInput (#265 강한 정책 + #237 약관 동의)', () => {
  const base = {
    email: 'a@b.com',
    password: 'Pass1234',
    passwordConfirm: 'Pass1234',
    name: '홍길동',
    acceptTerms: true,
    acceptPrivacy: true,
  };

  it('정상 입력 통과', () => {
    expect(SignupInput.safeParse(base).success).toBe(true);
  });

  it('비밀번호 확인 불일치 거부', () => {
    const r = SignupInput.safeParse({ ...base, passwordConfirm: 'Different9' });
    expect(r.success).toBe(false);
  });

  it('이름 누락 거부', () => {
    const r = SignupInput.safeParse({ ...base, name: '' });
    expect(r.success).toBe(false);
  });

  it('약한 비밀번호(숫자만) 거부 — 영문/숫자/특수 중 2종 미만', () => {
    const r = SignupInput.safeParse({
      ...base,
      password: '12345678',
      passwordConfirm: '12345678',
    });
    expect(r.success).toBe(false);
  });

  it('이용약관 미동의 거부', () => {
    expect(SignupInput.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });

  it('개인정보 처리방침 미동의 거부', () => {
    expect(SignupInput.safeParse({ ...base, acceptPrivacy: false }).success).toBe(false);
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
    password: 'Pass1234',
    passwordConfirm: 'Pass1234',
  };
  it('정상 입력 통과', () => {
    expect(ResetPasswordInput.safeParse(base).success).toBe(true);
  });
  it('토큰 길이 미달 거부', () => {
    expect(ResetPasswordInput.safeParse({ ...base, token: 'short' }).success).toBe(false);
  });
  it('비밀번호 확인 불일치 거부', () => {
    expect(ResetPasswordInput.safeParse({ ...base, passwordConfirm: 'Different9' }).success).toBe(
      false,
    );
  });
  it('약한 비밀번호 거부', () => {
    expect(
      ResetPasswordInput.safeParse({
        ...base,
        password: '12345678',
        passwordConfirm: '12345678',
      }).success,
    ).toBe(false);
  });
});

describe('UpdateProfileInput', () => {
  const base = {
    name: '홍길동',
    email: 'a@b.com',
    currentPassword: 'Curr1234',
  };
  it('비밀번호 변경 없이 프로필만 수정 통과', () => {
    expect(UpdateProfileInput.safeParse(base).success).toBe(true);
  });
  it('새 비밀번호 + 확인 일치 통과', () => {
    const r = UpdateProfileInput.safeParse({
      ...base,
      newPassword: 'Pass1234',
      newPasswordConfirm: 'Pass1234',
    });
    expect(r.success).toBe(true);
  });
  it('새 비밀번호 확인 불일치 거부', () => {
    const r = UpdateProfileInput.safeParse({
      ...base,
      newPassword: 'Pass1234',
      newPasswordConfirm: 'Other9999',
    });
    expect(r.success).toBe(false);
  });
});

describe('DeleteAccountInput', () => {
  it('정상 입력 통과', () => {
    expect(
      DeleteAccountInput.safeParse({ currentPassword: 'Pass1234', confirm: '탈퇴' }).success,
    ).toBe(true);
  });
  it('confirm 문구 불일치 거부', () => {
    expect(
      DeleteAccountInput.safeParse({ currentPassword: 'Pass1234', confirm: '아니오' }).success,
    ).toBe(false);
  });
});

describe('VerifyEmailInput', () => {
  it('정상 토큰 통과', () => {
    expect(VerifyEmailInput.safeParse({ token: 'a'.repeat(64) }).success).toBe(true);
  });
  it('짧은 토큰 거부', () => {
    expect(VerifyEmailInput.safeParse({ token: 'short' }).success).toBe(false);
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

  it('schoolVerifiedAt 이 ISO 문자열이면 통과 (#541)', () => {
    const r = JwtPayload.safeParse({
      sub: 'u_123',
      email: 'a@b.com',
      name: '홍길동',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      iat: 1700000000,
      exp: 1700003600,
    });
    expect(r.success).toBe(true);
  });

  it('schoolVerifiedAt 이 null/undefined 면 통과 — 미인증 사용자 (#541)', () => {
    const r1 = JwtPayload.safeParse({
      sub: 'u_123',
      email: 'a@b.com',
      name: '홍길동',
      schoolVerifiedAt: null,
      iat: 1700000000,
      exp: 1700003600,
    });
    expect(r1.success).toBe(true);

    // #549 CR: undefined 도 명시 케이스로 고정 — null/undefined 둘 다 보장.
    const r2 = JwtPayload.safeParse({
      sub: 'u_123',
      email: 'a@b.com',
      name: '홍길동',
      schoolVerifiedAt: undefined,
      iat: 1700000000,
      exp: 1700003600,
    });
    expect(r2.success).toBe(true);
  });

  it('schoolVerifiedAt 이 ISO 형식이 아니면 거부 (#541)', () => {
    const r = JwtPayload.safeParse({
      sub: 'u_123',
      email: 'a@b.com',
      name: '홍길동',
      schoolVerifiedAt: 'not-a-date',
      iat: 1700000000,
      exp: 1700003600,
    });
    expect(r.success).toBe(false);
  });
});

describe('VerifySchoolInput — KNU 학번 10자리 정책', () => {
  const TOKEN = 'a'.repeat(32);

  it('10자리 숫자 학번 통과 (예: 2024111234)', () => {
    const r = VerifySchoolInput.safeParse({ token: TOKEN, studentId: '2024111234' });
    expect(r.success).toBe(true);
  });

  it('9자리 학번 거부', () => {
    const r = VerifySchoolInput.safeParse({ token: TOKEN, studentId: '202411123' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe('학번은 10자리 숫자입니다');
    }
  });

  it('11자리 학번 거부', () => {
    const r = VerifySchoolInput.safeParse({ token: TOKEN, studentId: '20241112345' });
    expect(r.success).toBe(false);
  });

  it('8자리 학번 거부 (구 정책 회귀 방지)', () => {
    const r = VerifySchoolInput.safeParse({ token: TOKEN, studentId: '20241234' });
    expect(r.success).toBe(false);
  });

  it('숫자 아닌 문자 포함 거부', () => {
    const r = VerifySchoolInput.safeParse({ token: TOKEN, studentId: '202411123a' });
    expect(r.success).toBe(false);
  });

  it('앞뒤 공백은 trim 후 통과 (Gemini #568)', () => {
    const r = VerifySchoolInput.safeParse({ token: TOKEN, studentId: '  2024111234  ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.studentId).toBe('2024111234');
    }
  });

  it('토큰 32자 미만 거부', () => {
    const r = VerifySchoolInput.safeParse({ token: 'short', studentId: '2024111234' });
    expect(r.success).toBe(false);
  });
});
