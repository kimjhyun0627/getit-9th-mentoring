/**
 * Sign-in 리다이렉트 URL 빌더 (#271).
 *
 * 보존 정책:
 * - `origin + pathname`: 항상 보존
 * - `hash`: 보존 (브라우저 한정 → 서버 전송 X → 토큰 누출 무관)
 *   → `#projects` / `#about` 같은 스크롤 컨텍스트 유지
 * - `search`: drop (의도된 동작)
 *   → 쿼리에 붙은 토큰·식별자가 auth 도메인으로 새는 걸 막기 위해
 *
 * 분리 사유: Header.jsx에서 컴포넌트와 같은 파일에 두면 vite/react-refresh 경고
 * (Fast refresh only works when a file only exports components). 별도 모듈로 추출.
 *
 * @module lib/auth-redirect
 */

const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';
const FALLBACK_BACK = 'https://get-it.cloud';

/**
 * `auth.get-it.cloud/login?redirect=<origin+pathname+hash>` 빌더.
 * SSR/JSDOM에서 window 가드.
 *
 * @returns {string} `${AUTH_ORIGIN}/login?redirect=<encoded back URL>`.
 */
export const buildLoginUrl = () => {
  const back =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`
      : FALLBACK_BACK;
  return `${AUTH_ORIGIN}/login?redirect=${encodeURIComponent(back)}`;
};
