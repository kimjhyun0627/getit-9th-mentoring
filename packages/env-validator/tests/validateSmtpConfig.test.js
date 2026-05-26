/**
 * validateSmtpConfig 회귀 테스트 (Issue #575).
 *
 * 핵심 게이트:
 *  - production + SMTP_HOST 미설정 → throw (메일이 안 나가는데 200 응답하는 사일런트 실패 차단).
 *  - production + SMTP_HOST 미설정 + MAILER_DISABLED_ALLOWED=true → warn (옵트인 격하).
 *  - dev/test 환경에선 SMTP_HOST 미설정도 warn.
 *  - host 설정 + user/pass 한쪽만 → warn (운영 실수 표시).
 */
import { describe, expect, it } from 'vitest';

import { validateSmtpConfig } from '../src/validateSmtpConfig.js';

describe('validateSmtpConfig', () => {
  describe('production', () => {
    it('host 미설정 → throw', () => {
      expect(() => validateSmtpConfig({}, { env: 'production' })).toThrow(/SMTP_HOST/);
    });

    it('host 빈 문자열 → throw', () => {
      expect(() => validateSmtpConfig({ host: '' }, { env: 'production' })).toThrow(/SMTP_HOST/);
    });

    it('host 공백만 → throw', () => {
      expect(() => validateSmtpConfig({ host: '   ' }, { env: 'production' })).toThrow(/SMTP_HOST/);
    });

    it('host 미설정 + MAILER_DISABLED_ALLOWED=true → warn (throw 안 함)', () => {
      const warnings = validateSmtpConfig(
        { host: '' },
        { env: 'production', mailerDisabledAllowed: true },
      );
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/SMTP_HOST/)]));
    });

    it('host 설정 + user/pass 둘 다 설정 → pass', () => {
      expect(() =>
        validateSmtpConfig(
          { host: 'smtp.postmark.io', user: 'noreply', pass: 'real-pass' },
          { env: 'production' },
        ),
      ).not.toThrow();
    });

    it('host 설정 + user/pass 둘 다 미설정 → pass (no-auth SMTP)', () => {
      expect(() =>
        validateSmtpConfig({ host: 'smtp.internal' }, { env: 'production' }),
      ).not.toThrow();
    });

    it('host 설정 + user 만 설정 → warn', () => {
      const warnings = validateSmtpConfig(
        { host: 'smtp.postmark.io', user: 'noreply' },
        { env: 'production' },
      );
      expect(warnings).toEqual(
        expect.arrayContaining([expect.stringMatching(/SMTP_USER and SMTP_PASS/)]),
      );
    });

    it('host 설정 + pass 만 설정 → warn', () => {
      const warnings = validateSmtpConfig(
        { host: 'smtp.postmark.io', pass: 'real-pass' },
        { env: 'production' },
      );
      expect(warnings).toEqual(
        expect.arrayContaining([expect.stringMatching(/SMTP_USER and SMTP_PASS/)]),
      );
    });

    it('에러 메시지에 SMTP_PASS 가 노출되지 않음', () => {
      // expect.assertions: throw 안 나면 거짓 양성 → 강제 실패.
      expect.assertions(1);
      const pass = 'super-secret-smtp-password-xyz';
      try {
        validateSmtpConfig({ host: '', user: 'u', pass }, { env: 'production' });
      } catch (err) {
        expect(err.message).not.toContain(pass);
      }
    });

    it('env 대소문자/공백 정규화 — "Production" 도 production 보호 발동 (CR #579)', () => {
      expect(() => validateSmtpConfig({}, { env: 'Production' })).toThrow(/SMTP_HOST/);
      expect(() => validateSmtpConfig({}, { env: ' PRODUCTION ' })).toThrow(/SMTP_HOST/);
    });

    it('host 가 .env.example placeholder (__REPLACE_WITH_...) → throw (CR #579 round 2)', () => {
      expect(() =>
        validateSmtpConfig({ host: '__REPLACE_WITH_smtp_host__' }, { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('host 가 weak pattern "change-me-..." → throw', () => {
      expect(() =>
        validateSmtpConfig({ host: 'change-me-smtp.local' }, { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('host 가 RFC 2606 example.com 도메인 → throw (운영에서 mail 발송 불가)', () => {
      expect(() => validateSmtpConfig({ host: 'smtp.example.com' }, { env: 'production' })).toThrow(
        /placeholder/,
      );
    });

    it('host 가 placeholder + MAILER_DISABLED_ALLOWED=true → warn (의도적 disable)', () => {
      const warnings = validateSmtpConfig(
        { host: '__REPLACE_WITH_smtp_host__' },
        { env: 'production', mailerDisabledAllowed: true },
      );
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/placeholder/)]));
    });

    it('host 가 placeholder + dev/test → warn (throw 안 함)', () => {
      const warnings = validateSmtpConfig({ host: '__REPLACE_WITH_smtp_host__' }, { env: 'test' });
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/placeholder/)]));
    });
  });

  describe('test/development', () => {
    it('test env + host 미설정 → warn (throw 안 함)', () => {
      const warnings = validateSmtpConfig({}, { env: 'test' });
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/SMTP_HOST/)]));
    });

    it('development env + host 미설정 → warn', () => {
      const warnings = validateSmtpConfig({}, { env: 'development' });
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('test env + host 설정 + user only → warn', () => {
      const warnings = validateSmtpConfig({ host: 'smtp.local', user: 'u' }, { env: 'test' });
      expect(warnings).toEqual(
        expect.arrayContaining([expect.stringMatching(/SMTP_USER and SMTP_PASS/)]),
      );
    });

    it('test env + 모든 값 어떤 형태든 throw 없음', () => {
      expect(() => validateSmtpConfig({}, { env: 'test' })).not.toThrow();
      expect(() => validateSmtpConfig({ host: 'x' }, { env: 'test' })).not.toThrow();
      expect(() =>
        validateSmtpConfig({ host: 'x', user: 'u', pass: 'p' }, { env: 'test' }),
      ).not.toThrow();
    });

    it('opts 없이 호출 → non-prod 로 간주 (host 미설정 warn)', () => {
      const warnings = validateSmtpConfig({});
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
