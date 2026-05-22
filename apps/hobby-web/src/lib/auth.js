import { buildNicknameOnboardingUrl, shouldEnforceNicknameOnboarding } from '@getit/auth-utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from './api.js';

// dev / preview / prod 분기 — 다른 web 들과 동일하게 import.meta.env 우선.
const AUTH_ORIGIN = import.meta.env?.VITE_AUTH_URL || 'https://auth.get-it.cloud';
// PRD 롤백 시나리오: NICKNAME_ONBOARDING_ENFORCED 플래그 OFF 가능.
const ENFORCED = import.meta.env?.VITE_NICKNAME_ONBOARDING_ENFORCED !== 'false';

/**
 * hobby-web 공용 인증 훅 (#331, school-auth #540 확장).
 *
 * 사용처:
 *  - CreatePostPage (`/new`) — 비로그인 진입 시 즉시 SSO redirect.
 *  - EditPostPage (`/posts/:id/edit`)
 *  - ApplicantsPage (`/posts/:id/applicants`)
 *
 * MePage 와 동일 정책:
 *  - 로딩 중에는 redirect 보류 (false-positive 방지).
 *  - me 조회 401 일 때만 SSO. 5xx/네트워크는 재시도 UX 로 분리 (CR review #340).
 *  - JWT 쿠키 갱신을 위한 staleTime 60s — 짧은 페이지 이동마다 /me 폭격 방지.
 *
 * school-auth (#540):
 *  - 로그인 됐고 `me.nickname == null` 이면 `auth.get-it.cloud/onboarding/nickname` 으로 강제 redirect.
 *  - 이미 `/onboarding/nickname` 페이지에 있으면 X (무한 루프 방지 — hobby-web 에는 그 path 가 없지만 방어).
 *  - `?redirect=<현재URL>` 은 `buildNicknameOnboardingUrl` 이 `safeRedirect` 로 검증.
 *
 * @returns {{
 *   me: import('./api.types.js').MeResponse | null,
 *   isLoading: boolean,
 *   isLoggedIn: boolean,
 *   is401: boolean,
 * }}
 */
export const useRequireAuth = () => {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });
  const status = meQuery.error?.response?.status;
  const is401 = status === 401;
  const me = meQuery.data ?? null;

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (typeof window === 'undefined') return;

    // 비로그인 (401) → SSO 로그인 page 로 redirect.
    if (!me && is401) {
      const here = encodeURIComponent(window.location.href);
      window.location.href = `${AUTH_ORIGIN}/login?redirect=${here}`;
      return;
    }

    // 로그인 됐는데 nickname null → onboarding 강제 redirect (#540).
    // 공용 가드 `shouldEnforceNicknameOnboarding` 으로 정책 일원화 (Gemini medium #550).
    if (
      shouldEnforceNicknameOnboarding({
        user: me,
        currentPath: window.location.pathname,
        enforced: ENFORCED,
      })
    ) {
      window.location.href = buildNicknameOnboardingUrl({
        authOrigin: AUTH_ORIGIN,
        currentUrl: window.location.href,
      });
    }
  }, [meQuery.isLoading, me, is401]);

  return {
    me,
    isLoading: meQuery.isLoading,
    isLoggedIn: Boolean(me),
    is401,
  };
};
