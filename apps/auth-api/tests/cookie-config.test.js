/**
 * #328 — COOKIE_DOMAIN fail-fast 회귀 (운영 시뮬레이션).
 *
 * NODE_ENV !== 'test' 일 때 COOKIE_SECURE=true 인데 COOKIE_DOMAIN 비면
 * createApp() 이 throw 해야 한다.
 */
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('#328 COOKIE_DOMAIN fail-fast', () => {
  it('COOKIE_SECURE=true + COOKIE_DOMAIN 누락 → throw (운영 시뮬레이션)', () => {
    // test 환경은 setup.js 가 NODE_ENV=test 로 두므로 우회된다 →
    // 일시적으로 NODE_ENV 를 production 으로 바꿔서 검증.
    const origEnv = process.env.NODE_ENV;
    const origDomain = process.env.COOKIE_DOMAIN;
    const origSecure = process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'true';
    delete process.env.COOKIE_DOMAIN;
    try {
      expect(() => createApp({ rateLimitMax: 1 })).toThrow(/COOKIE_DOMAIN/);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origDomain === undefined) delete process.env.COOKIE_DOMAIN;
      else process.env.COOKIE_DOMAIN = origDomain;
      if (origSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = origSecure;
    }
  });

  it('COOKIE_SECURE=true + COOKIE_DOMAIN=.get-it.cloud → 정상 부팅', () => {
    const origEnv = process.env.NODE_ENV;
    const origDomain = process.env.COOKIE_DOMAIN;
    const origSecure = process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_DOMAIN = '.get-it.cloud';
    try {
      expect(() => createApp({ rateLimitMax: 1 })).not.toThrow();
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origDomain === undefined) delete process.env.COOKIE_DOMAIN;
      else process.env.COOKIE_DOMAIN = origDomain;
      if (origSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = origSecure;
    }
  });
});
