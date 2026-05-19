import { create } from 'zustand';

/** @typedef {'light' | 'dark' | 'system'} ThemePreference */
/** @typedef {'light' | 'dark'} ResolvedTheme */

export const STORAGE_KEY = 'getit:theme';

/**
 * 시스템 다크모드 매체 쿼리.
 *
 * @returns {MediaQueryList | null}
 */
const getSystemQuery = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia('(prefers-color-scheme: dark)');
};

/**
 * preference -> resolved 다크/라이트로 환원.
 *
 * @param {ThemePreference} pref
 * @returns {ResolvedTheme}
 */
const resolve = (pref) => {
  if (pref === 'system') {
    return getSystemQuery()?.matches ? 'dark' : 'light';
  }
  return pref;
};

/**
 * <html>에 .dark 클래스 적용.
 *
 * @param {ResolvedTheme} resolved
 */
export const applyTheme = (resolved) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', resolved);
};

/**
 * localStorage + 시스템 설정으로 초기 preference 결정.
 *
 * @returns {ThemePreference}
 */
export const resolveInitialTheme = () => {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    /* localStorage 접근 실패 — system fallback */
  }
  return 'system';
};

/**
 * 다크모드 Zustand store.
 * - preference: 유저 선택 ('light' | 'dark' | 'system')
 * - resolved: 실제 적용된 테마 ('light' | 'dark')
 */
export const useTheme = create((set, get) => ({
  /** @type {ThemePreference} */
  preference: 'system',
  /** @type {ResolvedTheme} */
  resolved: 'light',

  /**
   * preference 설정 + DOM 적용 + localStorage 저장.
   *
   * @param {ThemePreference} pref
   */
  setPreference: (pref) => {
    const resolved = resolve(pref);
    try {
      window.localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* localStorage 차단된 환경(시크릿 등) — 무시 */
    }
    applyTheme(resolved);
    set({ preference: pref, resolved });
  },

  /**
   * 다크 <-> 라이트 토글 (system 일 때는 현재 resolved의 반대로).
   */
  toggle: () => {
    const next = get().resolved === 'dark' ? 'light' : 'dark';
    get().setPreference(next);
  },

  /**
   * mount 시 초기화 + 시스템 변경 구독.
   *
   * @returns {() => void} unsubscribe
   */
  hydrate: () => {
    const pref = resolveInitialTheme();
    const resolved = resolve(pref);
    applyTheme(resolved);
    set({ preference: pref, resolved });

    const mq = getSystemQuery();
    if (!mq) return () => {};
    const onChange = () => {
      if (get().preference === 'system') {
        const next = mq.matches ? 'dark' : 'light';
        applyTheme(next);
        set({ resolved: next });
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  },
}));
