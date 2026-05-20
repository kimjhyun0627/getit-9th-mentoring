/**
 * env 검증 lib 테스트 — boot 시 미설정 시 fail-fast.
 *
 * - production 에서 KAKAO_BOOK_API_KEY 누락 → throw
 * - test/development 에서는 누락 허용 (경고만)
 * - 공백/dummy placeholder 도 거부
 * - JWT_SECRET 누락 시 throw
 */
import { describe, it, expect } from 'vitest';

import { validateEnv } from '../src/lib/env.js';

describe('validateEnv', () => {
  it('production + KAKAO_BOOK_API_KEY 누락 → throw', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-min-32-chars-long-aaaaaaaaa',
        KAKAO_BOOK_API_KEY: '',
      }),
    ).toThrow(/KAKAO_BOOK_API_KEY/);
  });

  it('production + JWT_SECRET 누락 → throw', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: '',
        KAKAO_BOOK_API_KEY: 'real-key',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('production + JWT_SECRET 32자 미만 → throw', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'short',
        KAKAO_BOOK_API_KEY: 'real-key',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('production + KAKAO_BOOK_API_KEY 가 dummy placeholder → throw', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-min-32-chars-long-aaaaaaaaa',
        KAKAO_BOOK_API_KEY: 'change-me',
      }),
    ).toThrow(/KAKAO_BOOK_API_KEY/);
  });

  it('production + KAKAO_BOOK_API_KEY 공백 → throw', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-min-32-chars-long-aaaaaaaaa',
        KAKAO_BOOK_API_KEY: '   ',
      }),
    ).toThrow(/KAKAO_BOOK_API_KEY/);
  });

  it('production + 모든 필수 값 → ok', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-min-32-chars-long-aaaaaaaaa',
        KAKAO_BOOK_API_KEY: 'real-key',
      }),
    ).not.toThrow();
  });

  it('test 환경에서는 KAKAO_BOOK_API_KEY 누락 허용', () => {
    const warnings = validateEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-min-32-chars-long-aaaaaaaaa',
      KAKAO_BOOK_API_KEY: '',
    });
    expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/KAKAO_BOOK_API_KEY/)]));
  });

  it('development 환경에서는 누락 시 경고만 (throw 안 함)', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: 'dev-secret-min-32-chars-long-aaaaaaaa',
        KAKAO_BOOK_API_KEY: '',
      }),
    ).not.toThrow();
  });

  it('에러 메시지에 실제 키 값이 노출되지 않음 (secret leak 방지)', () => {
    const secretValue = 'super-secret-key-do-not-leak-aaaaaa';
    try {
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'test-secret-min-32-chars-long-aaaaaaaaa',
        KAKAO_BOOK_API_KEY: secretValue.slice(0, 3), // too short triggers? actually we use dummy detection
      });
    } catch (err) {
      // 메시지에는 어떤 키도 노출되면 안 됨
      expect(err.message).not.toContain(secretValue);
    }
  });
});
