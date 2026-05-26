/**
 * validateJwtSecret 회귀 테스트 (Issue #575).
 *
 * 핵심 게이트:
 *  - .env.prod.example 의 known placeholder 가 production 에서 통과되면 회귀.
 *  - 32+ 진짜 random secret 은 production 에서도 통과.
 *  - 길이 미만은 환경 무관 throw (brute force 위험).
 *  - dev/test 환경에선 placeholder 도 warn 로 격하 (로컬 부팅 친화).
 */
import { describe, expect, it } from 'vitest';

import { validateJwtSecret } from '../src/validateJwtSecret.js';

describe('validateJwtSecret', () => {
  describe('production', () => {
    it('빈 문자열 → throw', () => {
      expect(() => validateJwtSecret('', { env: 'production' })).toThrow(/JWT_SECRET/);
    });

    it('undefined → throw', () => {
      expect(() => validateJwtSecret(undefined, { env: 'production' })).toThrow(/JWT_SECRET/);
    });

    it('공백만 → throw', () => {
      expect(() => validateJwtSecret('   ', { env: 'production' })).toThrow(/JWT_SECRET/);
    });

    it('32자 미만 → throw (production)', () => {
      expect(() => validateJwtSecret('short-secret', { env: 'production' })).toThrow(/at least 32/);
    });

    it('.env.prod.example 의 known placeholder → throw', () => {
      expect(() =>
        validateJwtSecret('change-me-min-32-chars-long-aaaaaaaaaaaaa', { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('새 example placeholder (__REPLACE_WITH_...) → throw', () => {
      expect(() =>
        validateJwtSecret('__REPLACE_WITH_openssl_rand_base64_48__', { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('weak pattern "your-secret-..." → throw', () => {
      expect(() =>
        validateJwtSecret('your-secret-here-aaaaaaaaaaaaaaaaaaaaaaaa', { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('weak pattern "please-change-me-..." → throw', () => {
      expect(() =>
        validateJwtSecret('please-change-me-aaaaaaaaaaaaaaaaaaaaaaa', { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('weak pattern "example-secret-..." → throw', () => {
      expect(() =>
        validateJwtSecret('example-secret-aaaaaaaaaaaaaaaaaaaaaaaaa', { env: 'production' }),
      ).toThrow(/placeholder/);
    });

    it('32자 이상 random secret → pass', () => {
      // openssl rand -base64 48 형태를 흉내낸 더미 (실제 base64 가 아니어도 패턴만 매치 안 되면 OK).
      const secret = '8aQwErTyUiOpAsDfGhJkLzXcVbNm1234567890QwErTy';
      expect(() => validateJwtSecret(secret, { env: 'production' })).not.toThrow();
    });

    it('에러 메시지에 secret 값이 노출되지 않음', () => {
      // expect.assertions: validateJwtSecret 가 throw 안 하고 통과하면 거짓 양성 → 강제 실패.
      expect.assertions(2);
      const secret = 'change-me-min-32-chars-long-aaaaaaaaaaaaa';
      try {
        validateJwtSecret(secret, { env: 'production' });
      } catch (err) {
        // placeholder pattern 단어 자체 ("change-me") 는 메시지에 없어야 함.
        expect(err.message).not.toContain(secret);
        expect(err.message).not.toContain('change-me');
      }
    });

    it('env 대소문자/공백 정규화 — "Production" 도 production 보호 발동 (CR #579)', () => {
      expect(() =>
        validateJwtSecret('change-me-min-32-chars-long-aaaaaaaaaaaaa', { env: 'Production' }),
      ).toThrow(/placeholder/);
      expect(() =>
        validateJwtSecret('change-me-min-32-chars-long-aaaaaaaaaaaaa', { env: ' PRODUCTION ' }),
      ).toThrow(/placeholder/);
    });
  });

  describe('test/development', () => {
    it('test env + placeholder → warn (throw 안 함)', () => {
      const warnings = validateJwtSecret('change-me-min-32-chars-long-aaaaaaaaaaaaa', {
        env: 'test',
      });
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/placeholder/)]));
    });

    it('development env + placeholder → warn', () => {
      const warnings = validateJwtSecret('change-me-min-32-chars-long-aaaaaaaaaaaaa', {
        env: 'development',
      });
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('test env + 빈 문자열 → warn (throw 안 함)', () => {
      const warnings = validateJwtSecret('', { env: 'test' });
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/required/)]));
    });

    it('test env + 32자 미만 → warn (dev 편의, gemini #579)', () => {
      const warnings = validateJwtSecret('short', { env: 'test' });
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/at least 32/)]));
    });

    it('development env + 32자 미만 → warn (throw 안 함)', () => {
      const warnings = validateJwtSecret('dev-short', { env: 'development' });
      expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/at least 32/)]));
    });

    it('test env + 32+ random → no warnings', () => {
      const secret = '8aQwErTyUiOpAsDfGhJkLzXcVbNm1234567890QwErTy';
      const warnings = validateJwtSecret(secret, { env: 'test' });
      expect(warnings).toEqual([]);
    });

    it('opts 없이 호출 → non-prod 로 간주 (placeholder warn)', () => {
      const warnings = validateJwtSecret('change-me-min-32-chars-long-aaaaaaaaaaaaa');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
