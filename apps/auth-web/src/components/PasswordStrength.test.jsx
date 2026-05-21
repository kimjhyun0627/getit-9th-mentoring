/**
 * PasswordStrength 분석기 unit test (#466 — UI label 과 zod refine 동기화 검증).
 *
 * 정책 (packages/schemas/src/auth.js passwordStrong):
 *  - 8자 이상 + 영문/숫자/특수 중 2종 이상 → 통과.
 *  - 8자 미만 또는 1종만 → fail.
 *
 * UI 가 "약함/보통/강함" 으로 표시하는 시점이 정책 통과와 일치하는지 검증.
 */
import { SignupInput } from '@getit/schemas/auth';
import { describe, expect, it } from 'vitest';

import { analyzePasswordStrength } from './PasswordStrength.jsx';

/**
 * SignupInput 을 통해 passwordStrong 정책을 우회 검증.
 * password 외의 다른 필드 (name/email/passwordConfirm/accept*) 도 만족시킨 뒤
 * password 만 다양화 → password 정책 자체만 분리 검증 가능.
 *
 * @param {string} v
 * @returns {boolean}
 */
const zodPasses = (v) => {
  const r = SignupInput.safeParse({
    email: 'a@b.com',
    password: v,
    passwordConfirm: v,
    name: 'x',
    acceptTerms: true,
    acceptPrivacy: true,
  });
  if (r.success) return true;
  // password 외 사유라면 정책 자체는 통과로 간주 — 본 테스트에서는 사용되지 않는 케이스.
  return !r.error.issues.some((i) => i.path[0] === 'password');
};

describe('analyzePasswordStrength', () => {
  it('빈 문자열 → score 0, passesPolicy false', () => {
    const r = analyzePasswordStrength('');
    expect(r.score).toBe(0);
    expect(r.passesPolicy).toBe(false);
  });

  it('8자 미만 → "매우 약함" + passesPolicy false (정책 fail)', () => {
    const r = analyzePasswordStrength('Abc1');
    expect(r.label).toBe('매우 약함');
    expect(r.passesPolicy).toBe(false);
    expect(zodPasses('Abc1')).toBe(false);
  });

  it('8자 + 영문만 (1종) → 정책 fail (label 가 "강함" 으로 거짓말하지 않음)', () => {
    const r = analyzePasswordStrength('abcdefgh');
    expect(r.passesPolicy).toBe(false);
    expect(zodPasses('abcdefgh')).toBe(false);
    // 1종만이라 label 은 "약함" 이하 — "보통/강함" 이 뜨면 거짓.
    expect(['매우 약함', '약함']).toContain(r.label);
  });

  it('8자 + 2종 (영문+숫자) → 정책 통과 + label 최소 "약함"', () => {
    const r = analyzePasswordStrength('Pass1234');
    expect(r.passesPolicy).toBe(true);
    expect(zodPasses('Pass1234')).toBe(true);
    expect(['약함', '보통', '강함']).toContain(r.label);
  });

  it('12자 + 3종 → "강함" + 정책 통과', () => {
    const r = analyzePasswordStrength('Pass1234!@#$');
    expect(r.label).toBe('강함');
    expect(r.passesPolicy).toBe(true);
  });

  it('UI label 가 거짓말 안 한다 — passesPolicy=true 이면 정책도 통과', () => {
    const samples = ['Pass1234', 'longLong12', 'symbol!!12', 'A1b2C3d4'];
    for (const v of samples) {
      const r = analyzePasswordStrength(v);
      expect(r.passesPolicy).toBe(zodPasses(v));
    }
  });
});
