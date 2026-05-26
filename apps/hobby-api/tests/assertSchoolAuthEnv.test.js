/**
 * 학교 인증 가드 env fail-fast 회귀 테스트 (#572).
 *
 * 정책:
 *  - NODE_ENV=production + SCHOOL_AUTH_GUARD_ENABLED undefined → throw
 *  - NODE_ENV=production + SCHOOL_AUTH_GUARD_ENABLED='false' / '' / 오타 → throw
 *  - NODE_ENV=production + SCHOOL_AUTH_GUARD_ENABLED='true' → 정상 부팅
 *  - NODE_ENV=test/development → 어떤 값이어도 통과 (로컬 회귀 X)
 */
import { describe, expect, it } from 'vitest';

import { assertSchoolAuthEnvDeclared } from '../src/lib/assertSchoolAuthEnv.js';

describe('assertSchoolAuthEnvDeclared (#572)', () => {
  describe('NODE_ENV=production', () => {
    it('SCHOOL_AUTH_GUARD_ENABLED 미정의 → throw', () => {
      expect(() => assertSchoolAuthEnvDeclared({ NODE_ENV: 'production' })).toThrow(
        /SCHOOL_AUTH_GUARD_ENABLED is not set/,
      );
    });

    it("SCHOOL_AUTH_GUARD_ENABLED='true' → 정상 통과", () => {
      expect(() =>
        assertSchoolAuthEnvDeclared({
          NODE_ENV: 'production',
          SCHOOL_AUTH_GUARD_ENABLED: 'true',
        }),
      ).not.toThrow();
    });

    it("SCHOOL_AUTH_GUARD_ENABLED='false' → throw (silent disable 방지)", () => {
      expect(() =>
        assertSchoolAuthEnvDeclared({
          NODE_ENV: 'production',
          SCHOOL_AUTH_GUARD_ENABLED: 'false',
        }),
      ).toThrow(/must be exactly "true"/);
    });

    it("SCHOOL_AUTH_GUARD_ENABLED='' (빈 문자열) → throw", () => {
      expect(() =>
        assertSchoolAuthEnvDeclared({
          NODE_ENV: 'production',
          SCHOOL_AUTH_GUARD_ENABLED: '',
        }),
      ).toThrow(/must be exactly "true"/);
    });

    it("SCHOOL_AUTH_GUARD_ENABLED='True' (대소문자 다름) → throw", () => {
      // strict equality — Boolean 강제 변환에 의존하지 않음.
      expect(() =>
        assertSchoolAuthEnvDeclared({
          NODE_ENV: 'production',
          SCHOOL_AUTH_GUARD_ENABLED: 'True',
        }),
      ).toThrow(/must be exactly "true"/);
    });

    it("SCHOOL_AUTH_GUARD_ENABLED='1' (truthy 지만 'true' 아님) → throw", () => {
      expect(() =>
        assertSchoolAuthEnvDeclared({
          NODE_ENV: 'production',
          SCHOOL_AUTH_GUARD_ENABLED: '1',
        }),
      ).toThrow(/must be exactly "true"/);
    });
  });

  describe('NODE_ENV !== production (로컬 회귀 방지)', () => {
    it("NODE_ENV='test' + 미정의 → 통과", () => {
      expect(() => assertSchoolAuthEnvDeclared({ NODE_ENV: 'test' })).not.toThrow();
    });

    it("NODE_ENV='development' + 미정의 → 통과", () => {
      expect(() => assertSchoolAuthEnvDeclared({ NODE_ENV: 'development' })).not.toThrow();
    });

    it('NODE_ENV 미정의 + SCHOOL_AUTH_GUARD_ENABLED 미정의 → 통과 (로컬 npm run dev)', () => {
      expect(() => assertSchoolAuthEnvDeclared({})).not.toThrow();
    });

    it("NODE_ENV='development' + SCHOOL_AUTH_GUARD_ENABLED='false' → 통과", () => {
      // 로컬에서 의도적으로 끄는 케이스는 dev 에서 허용.
      expect(() =>
        assertSchoolAuthEnvDeclared({
          NODE_ENV: 'development',
          SCHOOL_AUTH_GUARD_ENABLED: 'false',
        }),
      ).not.toThrow();
    });
  });

  describe('기본 인자 (process.env)', () => {
    it('인자 생략 시 process.env 사용 — test 환경에서는 통과', () => {
      // setup.js 가 NODE_ENV='test' 로 강제 → 통과해야 함.
      expect(() => assertSchoolAuthEnvDeclared()).not.toThrow();
    });
  });
});
