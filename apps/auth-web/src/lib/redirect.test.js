import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redirectAfterAuth } from './redirect.js';

/**
 * redirect.js 보안 가드 테스트.
 * - 화이트리스트 호스트만 허용
 * - http/https 외 스킴(javascript:, data: 등)은 차단 (open redirect 방어)
 */

describe('redirectAfterAuth', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let replaceSpy;
  /** @type {PropertyDescriptor | undefined} */
  let originalLocationDescriptor;

  beforeEach(() => {
    // 원본 window.location descriptor 보존 (afterEach 에서 복원)
    originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, replace: replaceSpy, hostname: 'auth.get-it.cloud' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // window.location 원복 — 후속 테스트 격리 보장
    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  const run = (redirect) => {
    const sp = new URLSearchParams(redirect ? { redirect } : {});
    redirectAfterAuth(sp);
  };

  it('redirect 파라미터 없으면 fallback (/) 으로 이동', () => {
    run(null);
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('상대 경로는 허용', () => {
    run('/dashboard');
    expect(replaceSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('//evil.com 같은 protocol-relative URL은 차단 (상대 경로 아님)', () => {
    run('//evil.com/path');
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('*.get-it.cloud 호스트는 허용', () => {
    run('https://hobby.get-it.cloud');
    expect(replaceSpy).toHaveBeenCalledWith('https://hobby.get-it.cloud');
  });

  it('get-it.cloud (apex) 도 허용', () => {
    run('https://get-it.cloud/welcome');
    expect(replaceSpy).toHaveBeenCalledWith('https://get-it.cloud/welcome');
  });

  it('외부 호스트는 차단', () => {
    run('https://evil.com');
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('javascript: 스킴은 호스트가 비어있어도 차단', () => {
    // new URL('javascript:alert(1)') 파싱되지만 hostname 빈 문자열
    run('javascript:alert(1)');
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('data: 스킴 차단', () => {
    run('data:text/html,<script>alert(1)</script>');
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('file: 스킴 차단', () => {
    run('file:///etc/passwd');
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });

  it('http(s) 가짜 도메인이 허용된 도메인 끝에 붙어있어도 차단', () => {
    // host.endsWith('.get-it.cloud') 가 아닌 'evil-get-it.cloud' 같은 경우
    run('https://evilget-it.cloud');
    expect(replaceSpy).toHaveBeenCalledWith('/');
  });
});
