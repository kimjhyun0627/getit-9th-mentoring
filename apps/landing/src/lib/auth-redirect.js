/**
 * Sign-in 리다이렉트 URL 빌더 (#271).
 *
 * 보존 정책:
 * - `origin + pathname`: 항상 보존
 * - `hash`: 보존 — `#projects` / `#about` 같은 스크롤 컨텍스트 유지
 * - `search`: drop — 쿼리에 붙은 토큰·식별자가 auth 도메인으로 새는 걸 막기 위해
 *
 * ⚠️ 보안 주의: 여기서 hash는 `redirect=` 쿼리 파라미터의 **값**으로 인코딩되어
 * auth 서버에 명시적으로 전송된다 (일반 URL fragment처럼 브라우저-only가 아님).
 * 따라서 hash에 토큰·식별자를 절대 담지 않는다는 가정 하에서만 안전하다.
 * 현재 landing에서 hash는 순수하게 `#projects` / `#about` 스크롤 앵커 용도로만
 * 쓰이므로 보존이 안전. 향후 hash에 민감 정보가 들어가는 경로가 생기면 화이트리스트
 * 방식으로 재설계해야 한다.
 *
 * 분리 사유: Header.jsx에서 컴포넌트와 같은 파일에 두면 vite/react-refresh 경고
 * (Fast refresh only works when a file only exports components). 별도 모듈로 추출.
 *
 * @module lib/auth-redirect
 */

const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';
const FALLBACK_BACK = 'https://get-it.cloud/';

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
