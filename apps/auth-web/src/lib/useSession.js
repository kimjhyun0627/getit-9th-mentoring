/**
 * useSession — 마운트 시 GET /api/me 핑으로 현재 SSO 세션 상태 확인 (Issue #295).
 *
 * 반환:
 *   - status: 'loading' | 'authenticated' | 'unauthenticated'
 *   - user:   { sub, email, name } | null
 *
 * /api/me 는 우리 axios 인스턴스의 401 콜백을 트리거할 수 있으므로,
 * 이 훅을 호출하는 페이지에선 콜백을 등록하지 않거나 no-op 로 두는 게 안전하다.
 */
import { useEffect, useState } from 'react';

import { api } from './api.js';

/**
 * @typedef {{ sub: string, email: string, name: string }} SessionUser
 */

/** @returns {{ status: 'loading' | 'authenticated' | 'unauthenticated', user: SessionUser | null }} */
export const useSession = () => {
  const [state, setState] = useState(
    /** @type {{ status: 'loading' | 'authenticated' | 'unauthenticated', user: SessionUser | null }} */ ({
      status: 'loading',
      user: null,
    }),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.me();
        if (cancelled) return;
        const user = res?.data?.user ?? null;
        setState({ status: user ? 'authenticated' : 'unauthenticated', user });
      } catch {
        if (cancelled) return;
        setState({ status: 'unauthenticated', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
