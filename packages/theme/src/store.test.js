import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useTheme,
  STORAGE_KEY,
  COOKIE_KEY,
  COOKIE_MAX_AGE_SEC,
  resolveInitialTheme,
  applyTheme,
} from './store.js';

const setSystemDark = (isDark) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query.includes('dark') ? isDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  });
};

/**
 * jsdom 의 document.cookie 는 max-age/path/secure 등 옵션을 무시하고
 * key=value 만 보관하지만 sync read/write 동작은 정상.
 */
const clearAllCookies = () => {
  const all = document.cookie ? document.cookie.split(';') : [];
  for (const part of all) {
    const k = part.split('=')[0]?.trim();
    if (k) document.cookie = `${k}=; Max-Age=0; Path=/`;
  }
};

describe('useTheme store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAllCookies();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    useTheme.setState({ preference: 'system', resolved: 'light', cookieDomain: undefined });
    setSystemDark(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setPreference('dark') → <html>.dark + localStorage 저장", () => {
    useTheme.getState().setPreference('dark');

    expect(useTheme.getState().preference).toBe('dark');
    expect(useTheme.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it("setPreference('dark') → cookie 에도 저장 (6 도메인 sync)", () => {
    useTheme.getState().setPreference('dark');
    expect(document.cookie).toContain(`${COOKIE_KEY}=dark`);
  });

  it("setPreference('light') → .dark 제거", () => {
    document.documentElement.classList.add('dark');
    useTheme.getState().setPreference('light');

    expect(useTheme.getState().resolved).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggle은 현재 resolved의 반대로 전환 + cookie 갱신', () => {
    useTheme.getState().setPreference('light');
    expect(document.cookie).toContain(`${COOKIE_KEY}=light`);

    useTheme.getState().toggle();
    expect(useTheme.getState().resolved).toBe('dark');
    expect(document.cookie).toContain(`${COOKIE_KEY}=dark`);

    useTheme.getState().toggle();
    expect(useTheme.getState().resolved).toBe('light');
    expect(document.cookie).toContain(`${COOKIE_KEY}=light`);
  });

  it("setPreference('system') + 시스템 다크 → resolved = dark", () => {
    setSystemDark(true);
    useTheme.getState().setPreference('system');

    expect(useTheme.getState().preference).toBe('system');
    expect(useTheme.getState().resolved).toBe('dark');
  });

  it('COOKIE_MAX_AGE_SEC 는 1년 (31536000)', () => {
    expect(COOKIE_MAX_AGE_SEC).toBe(31536000);
  });
});

describe('resolveInitialTheme — cookie 우선', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAllCookies();
  });

  it('cookie 에 값 있으면 그걸 반환 (localStorage 보다 우선)', () => {
    document.cookie = `${COOKIE_KEY}=dark; Path=/`;
    window.localStorage.setItem(STORAGE_KEY, 'light');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('cookie 없고 localStorage 있으면 localStorage 반환 (legacy fallback)', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('cookie/localStorage 모두 없으면 system fallback', () => {
    expect(resolveInitialTheme()).toBe('system');
  });

  it('cookie 잘못된 값은 무시 → localStorage fallback', () => {
    document.cookie = `${COOKIE_KEY}=invalid; Path=/`;
    window.localStorage.setItem(STORAGE_KEY, 'light');
    expect(resolveInitialTheme()).toBe('light');
  });

  it('localStorage 잘못된 값도 무시', () => {
    window.localStorage.setItem(STORAGE_KEY, 'invalid');
    expect(resolveInitialTheme()).toBe('system');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
  });

  it('dark이면 .dark 클래스 + data-theme=dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('light이면 .dark 제거 + data-theme=light', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('cookieDomain override', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAllCookies();
    useTheme.setState({ preference: 'system', resolved: 'light', cookieDomain: undefined });
  });

  it('setCookieDomain 으로 override → cookie write 에 Domain= 포함 (provider props 경로)', () => {
    // jsdom 의 document.cookie 는 cross-domain write 을 silently 무시하므로
    // setter 를 spy 해 실제 write 호출 인자를 검증 (CR #376 제안).
    const setterSpy = vi.spyOn(Document.prototype, 'cookie', 'set');
    useTheme.getState().setCookieDomain('.example.test');
    expect(useTheme.getState().cookieDomain).toBe('.example.test');
    useTheme.getState().setPreference('dark');
    expect(setterSpy).toHaveBeenCalledWith(expect.stringContaining('Domain=.example.test'));
    setterSpy.mockRestore();
  });
});
