import { buildNicknameOnboardingUrl, shouldEnforceNicknameOnboarding } from '@getit/auth-utils';
import { useEffect } from 'react';

import { useSession } from '../lib/useSession.js';

const AUTH_ORIGIN = import.meta.env?.VITE_AUTH_URL || 'https://auth.get-it.cloud';

/**
 * NicknameOnboardingGuard — shelf-web 진입 시 nickname null 검사 (#540).
 *
 * 정책:
 *  - 비로그인 (user=null) → redirect X (shelf 는 외부인 사용 OK).
 *  - 로그인 + nickname null → `auth.get-it.cloud/onboarding/nickname?redirect=<현재URL>` 강제 redirect.
 *  - 이미 onboarding path 면 skip (무한 루프 방지 — shelf-web 에는 그 path 없지만 방어).
 *  - loading 중에는 보류 (false-positive redirect 방지).
 *
 * 렌더 결과 없음 — 사이드이펙트만. App.jsx 의 트리에 마운트.
 */
export const NicknameOnboardingGuard = () => {
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;
    if (!shouldEnforceNicknameOnboarding({ user, currentPath })) return;
    window.location.href = buildNicknameOnboardingUrl({
      authOrigin: AUTH_ORIGIN,
      currentUrl: window.location.href,
    });
  }, [loading, user]);

  return null;
};
