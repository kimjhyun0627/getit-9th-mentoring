import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildLoginUrl } from '../lib/auth-redirect.js';

/**
 * #271 — Sign-in redirect builder.
 *
 * 정책:
 * - origin + pathname: 항상 보존
 * - hash: 보존 (브라우저 한정 → 토큰 누출 무관)
 * - search: drop (의도된 동작 → 토큰 누출 차단)
 */

const AUTH_ORIGIN = 'https://auth.get-it.cloud';

/**
 * jsdom의 location은 window.location.href 할당이 navigation을 트리거하지 않고
 * 일반 setter처럼 동작한다. 안전하게 origin/pathname/hash/search를 갈아끼우려면
 * Object.defineProperty로 location 자체를 교체한다.
 *
 * @param {object} parts location 컴포넌트.
 * @param {string} parts.origin scheme + host (예: `https://get-it.cloud`).
 * @param {string} parts.pathname URL path (예: `/`).
 * @param {string} [parts.hash] 프래그먼트 (`#projects`). 기본 ''.
 * @param {string} [parts.search] 쿼리 스트링 (`?utm=x`). 기본 ''.
 */
const setLocation = ({ origin, pathname, hash = '', search = '' }) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      origin,
      pathname,
      hash,
      search,
      href: `${origin}${pathname}${search}${hash}`,
    },
  });
};

describe('buildLoginUrl (#271)', () => {
  /** @type {Location} */
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('hash가 없을 때 origin + pathname만 redirect 한다', () => {
    setLocation({ origin: 'https://get-it.cloud', pathname: '/' });
    const url = new URL(buildLoginUrl());
    expect(url.origin).toBe(AUTH_ORIGIN);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('redirect')).toBe('https://get-it.cloud/');
  });

  it('hash(#projects)를 redirect에 보존한다', () => {
    setLocation({
      origin: 'https://get-it.cloud',
      pathname: '/',
      hash: '#projects',
    });
    const redirect = new URL(buildLoginUrl()).searchParams.get('redirect');
    expect(redirect).toBe('https://get-it.cloud/#projects');
  });

  it('hash(#about)를 redirect에 보존한다', () => {
    setLocation({
      origin: 'https://get-it.cloud',
      pathname: '/',
      hash: '#about',
    });
    const redirect = new URL(buildLoginUrl()).searchParams.get('redirect');
    expect(redirect).toBe('https://get-it.cloud/#about');
  });

  it('search 쿼리는 drop 한다 (토큰 누출 차단 정책 유지)', () => {
    setLocation({
      origin: 'https://get-it.cloud',
      pathname: '/',
      search: '?utm_source=newsletter&token=abc123',
    });
    const redirect = new URL(buildLoginUrl()).searchParams.get('redirect');
    expect(redirect).toBe('https://get-it.cloud/');
    expect(redirect).not.toContain('utm_source');
    expect(redirect).not.toContain('token');
  });

  it('search + hash 동시 케이스에서 hash만 보존하고 search는 drop 한다', () => {
    setLocation({
      origin: 'https://get-it.cloud',
      pathname: '/',
      search: '?utm_source=email',
      hash: '#projects',
    });
    const redirect = new URL(buildLoginUrl()).searchParams.get('redirect');
    expect(redirect).toBe('https://get-it.cloud/#projects');
    expect(redirect).not.toContain('utm_source');
  });

  it('redirect 값이 URL-encode 되어 hash(#)가 noise 없이 전달된다', () => {
    setLocation({
      origin: 'https://get-it.cloud',
      pathname: '/',
      hash: '#projects',
    });
    const raw = buildLoginUrl();
    // raw URL 문자열에는 hash가 %23 으로 인코딩되어야 한다 (top-level fragment 분리 방지).
    expect(raw).toContain('redirect=https%3A%2F%2Fget-it.cloud%2F%23projects');
  });

  it('SSR(window 미정의)에서 fallback origin으로 동작한다', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const redirect = new URL(buildLoginUrl()).searchParams.get('redirect');
    // canonical link (index.html) 과 일치하는 trailing-slash 형태.
    expect(redirect).toBe('https://get-it.cloud/');
  });

  it('AUTH_ORIGIN으로 향한다', () => {
    setLocation({ origin: 'https://get-it.cloud', pathname: '/' });
    const url = new URL(buildLoginUrl());
    expect(url.host).toBe('auth.get-it.cloud');
    expect(url.pathname).toBe('/login');
  });
});
