/**
 * auth-api boot 진입점 env 검증 회귀 (CR #579 thread 1).
 *
 * 단순 unit (`validateJwtSecret`/`validateSmtpConfig`) 테스트와 별개로 — boot path
 * 자체가 실제로 두 validator 를 호출하고 production 위반 시 throw 되는지 확인.
 * \`server.js\` 가 위임하는 \`validateEnvOrDie\` 헬퍼를 직접 호출해 회귀 가드.
 *
 * 비밀값은 메시지에 흘리지 않는 게 정책이라 throw 메시지 내용만 검사 (값 X).
 */
import { describe, expect, it } from 'vitest';

import { validateEnvOrDie } from '../src/lib/validateEnvOrDie.js';

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ log?: { warn: (...args: unknown[]) => void } }} [opts]
 */
const callWith = (env, opts = {}) => validateEnvOrDie({ env, log: opts.log });

describe('auth-api validateEnvOrDie (boot path)', () => {
  describe('NODE_ENV=production', () => {
    it('JWT_SECRET 미설정 → throw', () => {
      expect(() =>
        callWith({
          NODE_ENV: 'production',
          SMTP_HOST: 'smtp.real.example.org',
          SMTP_USER: 'noreply',
          SMTP_PASS: 'real-pass',
        }),
      ).toThrow(/JWT_SECRET/);
    });

    it('JWT_SECRET placeholder → throw', () => {
      expect(() =>
        callWith({
          NODE_ENV: 'production',
          JWT_SECRET: 'change-me-min-32-chars-long-aaaaaaaaaaaaa',
          SMTP_HOST: 'smtp.real.example.org',
        }),
      ).toThrow(/JWT_SECRET/);
    });

    it('SMTP_HOST 미설정 (MAILER_DISABLED_ALLOWED 미설정) → throw', () => {
      expect(() =>
        callWith({
          NODE_ENV: 'production',
          JWT_SECRET: 'a'.repeat(48),
        }),
      ).toThrow(/SMTP_HOST/);
    });

    it('SMTP_HOST placeholder → throw (CR #579 round 2)', () => {
      expect(() =>
        callWith({
          NODE_ENV: 'production',
          JWT_SECRET: 'a'.repeat(48),
          SMTP_HOST: '__REPLACE_WITH_smtp_host__',
        }),
      ).toThrow(/SMTP_HOST/);
    });

    it('SMTP_HOST 미설정 + MAILER_DISABLED_ALLOWED=true → pass (warn 만)', () => {
      const warnings = [];
      expect(() =>
        callWith(
          {
            NODE_ENV: 'production',
            JWT_SECRET: 'a'.repeat(48),
            MAILER_DISABLED_ALLOWED: 'true',
          },
          { log: { warn: (_meta, msg) => warnings.push(msg) } },
        ),
      ).not.toThrow();
      expect(warnings.some((w) => /SMTP_HOST/.test(w))).toBe(true);
    });

    it('JWT_SECRET + SMTP_HOST 모두 정상 → pass', () => {
      expect(() =>
        callWith({
          NODE_ENV: 'production',
          JWT_SECRET: 'a'.repeat(48),
          SMTP_HOST: 'smtp.postmark.io',
          SMTP_USER: 'u',
          SMTP_PASS: 'p',
        }),
      ).not.toThrow();
    });
  });

  describe('NODE_ENV=test / development', () => {
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

    it('test + placeholder SMTP_HOST → throw 안 함', () => {
      expect(() =>
        callWith({
          NODE_ENV: 'test',
          JWT_SECRET: 'a'.repeat(48),
          SMTP_HOST: '__REPLACE_WITH_smtp_host__',
        }),
      ).not.toThrow();
    });
  });

  describe('의존성 주입 안전망', () => {
    it('log 미주입 → silent (no-op warn) — process 영향 X', () => {
      expect(() => callWith({ NODE_ENV: 'test', JWT_SECRET: 'a'.repeat(48) })).not.toThrow();
    });
  });
});
