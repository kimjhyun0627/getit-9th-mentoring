/**
 * letter-api boot 진입점 env 검증 회귀 (CR #579 thread 1).
 *
 * letter-api 는 SMTP 미사용 → JWT_SECRET 만 검증.
 */
import { describe, expect, it } from 'vitest';

import { validateEnvOrDie } from '../src/lib/validateEnvOrDie.js';

const callWith = (env, opts = {}) => validateEnvOrDie({ env, log: opts.log });

describe('letter-api validateEnvOrDie (boot path)', () => {
  it('production + JWT_SECRET 미설정 → throw', () => {
    expect(() => callWith({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('production + JWT_SECRET placeholder → throw', () => {
    expect(() =>
      callWith({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-min-32-chars-long-aaaaaaaaaaaaa',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('production + JWT_SECRET 정상 → pass', () => {
    expect(() => callWith({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48) })).not.toThrow();
  });

  it('test + JWT_SECRET 미설정 → throw 안 함', () => {
    expect(() => callWith({ NODE_ENV: 'test' })).not.toThrow();
  });
});
