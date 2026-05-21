import { create } from 'zustand';

/** @typedef {'light' | 'dark' | 'system'} ThemePreference */
/** @typedef {'light' | 'dark'} ResolvedTheme */

export const STORAGE_KEY = 'getit:theme';
/**
 * 6 도메인 (*.get-it.cloud) 다크모드 sync 용 쿠키 key.
 * - localStorage 와 별도. 키 충돌 방지 위해 동일 이름 사용 (`getit:theme`).
 * - max-age: 1년 (31536000s)
 * - SameSite=Lax (다른 서브도메인 navigation 시 따라가도록)
 * - production: `domain=.get-it.cloud` → get-it.cloud + 모든 subdomain 공유
 * - dev/localhost: domain 옵션 생략 → 현재 호스트로만 저장 (브라우저 기본)
 */
export const COOKIE_KEY = 'getit:theme';
export const COOKIE_MAX_AGE_SEC = 31536000;
const DEFAULT_PROD_HOST_SUFFIX = '.get-it.cloud';

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
 * 현재 호스트가 *.get-it.cloud 인지 (production) 판정.
 * - localhost / 127.0.0.1 / *.local 등 dev 호스트는 false.
 *
 * @returns {boolean}
 */
const isProductionHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname ?? '';
  return host === 'get-it.cloud' || host.endsWith(DEFAULT_PROD_HOST_SUFFIX);
};

/**
 * cookie domain 옵션 계산.
 * - props 로 명시 받으면 그걸 우선
 * - 그 외 production host 면 `.get-it.cloud`
 * - dev/localhost 등은 undefined (현재 호스트로만 저장)
 *
 * @param {string} [override]
 * @returns {string | undefined}
 */
const resolveCookieDomain = (override) => {
  if (typeof override === 'string') return override.length > 0 ? override : undefined;
  return isProductionHost() ? DEFAULT_PROD_HOST_SUFFIX : undefined;
};

/**
 * document.cookie 에서 key 값 읽기.
 *
 * @param {string} key
 * @returns {string | null}
 */
const readCookie = (key) => {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie || '';
  if (!cookie) return null;
  const prefix = `${key}=`;
  for (const part of cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
};

/**
 * document.cookie 에 key=value 쓰기.
 *
 * @param {string} key
 * @param {string} value
 * @param {{ domain?: string }} [opts]
 */
const writeCookie = (key, value, opts = {}) => {
  if (typeof document === 'undefined') return;
  const parts = [
    `${key}=${encodeURIComponent(value)}`,
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
    'Path=/',
    'SameSite=Lax',
  ];
  const domain = resolveCookieDomain(opts.domain);
  if (domain) parts.push(`Domain=${domain}`);
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
    parts.push('Secure');
  }
  try {
    document.cookie = parts.join('; ');
  } catch {
    /* SSR / 제3자 쿠키 차단 환경 — 무시 */
  }
};

/**
 * localStorage + cookie + 시스템 설정으로 초기 preference 결정.
 * 우선순위: cookie → localStorage → 'system'.
 *
 * @returns {ThemePreference}
 */
export const resolveInitialTheme = () => {
  if (typeof window === 'undefined') return 'system';
  // 1) cookie 우선 (6 도메인 sync)
  try {
    const cookieVal = readCookie(COOKIE_KEY);
    if (cookieVal === 'light' || cookieVal === 'dark' || cookieVal === 'system') {
      return cookieVal;
    }
  } catch {
    /* cookie 차단 */
  }
  // 2) localStorage fallback (legacy)
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    /* localStorage 차단 */
  }
  return 'system';
};

/**
 * 다크모드 Zustand store.
 * - preference: 유저 선택 ('light' | 'dark' | 'system')
 * - resolved: 실제 적용된 테마 ('light' | 'dark')
 * - cookieDomain: 테스트/dev 에서 cookie domain override (옵션)
 */
export const useTheme = create((set, get) => ({
  /** @type {ThemePreference} */
  preference: 'system',
  /** @type {ResolvedTheme} */
  resolved: 'light',
  /** @type {string | undefined} */
  cookieDomain: undefined,

  /**
   * cookie domain override (provider props/env).
   *
   * @param {string | undefined} domain
   */
  setCookieDomain: (domain) => set({ cookieDomain: domain }),

  /**
   * preference 설정 + DOM 적용 + cookie + localStorage 저장.
   *
   * @param {ThemePreference} pref
   */
  setPreference: (pref) => {
    const resolved = resolve(pref);
    // cookie 우선 (6 도메인 sync) — 실패 시 무시
    writeCookie(COOKIE_KEY, pref, { domain: get().cookieDomain });
    // localStorage fallback (cookie 차단 환경 대비)
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
