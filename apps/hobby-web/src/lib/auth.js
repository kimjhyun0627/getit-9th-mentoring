import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from './api.js';

/**
 * hobby-web 공용 인증 훅 (#331).
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
 * @returns {{
 *   me: { id: string; email?: string; name?: string } | null,
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

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (meQuery.data) return;
    if (!is401) return;
    if (typeof window === 'undefined') return;
    const here = encodeURIComponent(window.location.href);
    window.location.href = `https://auth.get-it.cloud/login?redirect=${here}`;
  }, [meQuery.isLoading, meQuery.data, is401]);

  return {
    me: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    isLoggedIn: Boolean(meQuery.data),
    is401,
  };
};
