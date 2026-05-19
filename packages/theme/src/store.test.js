import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTheme, STORAGE_KEY, resolveInitialTheme, applyTheme } from './store.js';

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

describe('useTheme store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    useTheme.setState({ preference: 'system', resolved: 'light' });
    setSystemDark(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setPreference(\'dark\') → <html>.dark + localStorage 저장', () => {
    useTheme.getState().setPreference('dark');

    expect(useTheme.getState().preference).toBe('dark');
    expect(useTheme.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setPreference(\'light\') → .dark 제거', () => {
    document.documentElement.classList.add('dark');
    useTheme.getState().setPreference('light');

    expect(useTheme.getState().resolved).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggle은 현재 resolved의 반대로 전환', () => {
    useTheme.getState().setPreference('light');
    useTheme.getState().toggle();
    expect(useTheme.getState().resolved).toBe('dark');

    useTheme.getState().toggle();
    expect(useTheme.getState().resolved).toBe('light');
  });

  it('setPreference(\'system\') + 시스템 다크 → resolved = dark', () => {
    setSystemDark(true);
    useTheme.getState().setPreference('system');

    expect(useTheme.getState().preference).toBe('system');
    expect(useTheme.getState().resolved).toBe('dark');
  });
});

describe('resolveInitialTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('localStorage에 저장값 있으면 그걸 반환', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('저장값 없으면 system fallback', () => {
    expect(resolveInitialTheme()).toBe('system');
  });

  it('잘못된 값은 무시', () => {
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
