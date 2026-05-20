import { useEffect, useState } from 'react';

/**
 * landing 헤더 SSO 세션 상태 hook (#343 / #246).
 *
 * 동작:
 *  - mount 시 `auth.get-it.cloud/api/me` 를 fetch (credentials: 'include').
 *  - cookie 가 `.get-it.cloud` SLD 에 묶여있어 cross-domain 으로 전송됨 (COOKIE_DOMAIN=.get-it.cloud).
 *  - 200 + `{ user: {...} }` → 로그인 상태로 user 노출.
 *  - 401 / 5xx / 네트워크 에러 / 잘못된 응답 형태 → **fail-soft**: 비로그인으로 조용히 처리.
 *
 * fail-soft 사유: landing 은 진입 페이지 + 공개 콘텐츠. /me 가 흔들려도
 * 페이지 자체는 동작해야 한다. 로그인이 안 보이면 사용자는 다시 `sign in` 누르면 그만.
 * console.error 도 의도적으로 silence — 정상 응답 경로의 일부.
 *
 * AUTH_ORIGIN 은 `auth-redirect.js` 와 동일 env 변수를 공유 (`VITE_AUTH_ORIGIN`).
 *
 * @returns {{
 *   user: { sub: string; email?: string; name?: string } | null,
 *   loading: boolean,
 * }}
 */
const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';

export const useSession = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        const res = await fetch(`${AUTH_ORIGIN}/api/me`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (cancelled) return;
        if (!res.ok) {
          setUser(null);
          return;
        }
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        const u = body?.user;
        if (u && typeof u === 'object' && typeof u.sub === 'string') {
          setUser({ sub: u.sub, email: u.email, name: u.name });
        } else {
          setUser(null);
        }
      } catch {
        // fail-soft: BE-down / 네트워크 끊김 → 비로그인 표시.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    probe();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
};
