/**
 * `lib/tokens.js` 의 readAuthEnv / parseTtlToMs 단위 테스트.
 *
 * - JWT_REFRESH_EXPIRES_IN 형식 엄격 검증 (`^[1-9]\d*d$`)
 * - parseTtlToMs: ms/s/m/h/d 단위 + 숫자 입력
 */
import { describe, it, expect } from 'vitest';

import { parseTtlToMs, readAuthEnv } from '../src/lib/tokens.js';

const baseEnv = () => {
  process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
};

describe('parseTtlToMs', () => {
  it.each([
    ['15m', 15 * 60_000],
    ['2h', 2 * 3_600_000],
    ['7d', 7 * 86_400_000],
    ['45s', 45_000],
    ['500ms', 500],
    ['1000', 1000], // 단위 없으면 ms
    [60_000, 60_000], // 숫자 직접 입력
  ])('"%s" → %d ms', (input, expected) => {
    expect(parseTtlToMs(input)).toBe(expected);
  });

  it.each(['', 'abc', '5x', '-1d', 'NaN'])('invalid "%s" → throw', (bad) => {
    expect(() => parseTtlToMs(bad)).toThrow();
  });
});

describe('readAuthEnv: JWT_REFRESH_EXPIRES_IN 엄격 검증', () => {
  it('"30d" 정상 → refreshTtlDays = 30', () => {
    baseEnv();
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    expect(readAuthEnv().refreshTtlDays).toBe(30);
  });

  it.each(['12h', '0d', '1w', '30', 'abc', ''])('"%s" 잘못된 형식 → throw (fail-fast)', (bad) => {
    baseEnv();
    process.env.JWT_REFRESH_EXPIRES_IN = bad;
    expect(() => readAuthEnv()).toThrow(/JWT_REFRESH_EXPIRES_IN/);
  });

  it('accessTtlMs 가 JWT_ACCESS_EXPIRES_IN 과 일관', () => {
    baseEnv();
    process.env.JWT_ACCESS_EXPIRES_IN = '20m';
    const cfg = readAuthEnv();
    expect(cfg.accessTtl).toBe('20m');
    expect(cfg.accessTtlMs).toBe(20 * 60_000);
  });
});
