/**
 * hobby-api boot 진입점 env 검증 회귀 (CR #579 thread 1).
 *
 * hobby-api 는 SMTP 미사용 → JWT_SECRET 만 검증. server.js 가 위임하는
 * \`validateEnvOrDie\` 헬퍼가 production 위반 시 실제 throw 되는지 회귀 가드.
 */
import { describe, expect, it } from 'vitest';

import { validateEnvOrDie } from '../src/lib/validateEnvOrDie.js';

/** @param {Record<string, string | undefined>} env */
const callWith = (env, opts = {}) => validateEnvOrDie({ env, log: opts.log });

describe('hobby-api validateEnvOrDie (boot path)', () => {
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

  it('test + JWT_SECRET 미설정 → throw 안 함 (warn)', () => {
    const warnings = [];
    expect(() =>
      callWith({ NODE_ENV: 'test' }, { log: { warn: (_meta, msg) => warnings.push(msg) } }),
    ).not.toThrow();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('development + placeholder JWT_SECRET → throw 안 함', () => {
    expect(() =>
      callWith({
        NODE_ENV: 'development',
        JWT_SECRET: 'change-me-min-32-chars-long-aaaaaaaaaaaaa',
      }),
    ).not.toThrow();
  });
});
