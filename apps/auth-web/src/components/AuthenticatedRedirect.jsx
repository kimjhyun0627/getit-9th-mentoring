import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { redirectAfterAuth } from '../lib/redirect.js';
import { useSession } from '../lib/useSession.js';

/**
 * Login / Signup 페이지를 감싸는 가드 (Issue #295).
 *
 * - mount 시 GET /api/me 1회 핑
 * - 200 (로그인 상태) → ?redirect= 우선, 없으면 https://get-it.cloud 로 redirect
 * - 401 (비로그인) → children (LoginPage/SignupPage) 렌더
 * - 로딩 중 → Tech-Dark 톤 인디케이터 (`$ checking session…`)
 *
 * @param {{ children: import('react').ReactNode, fallback?: string }} props
 *   fallback: 로그인 상태인데 ?redirect= 가 없을 때 갈 곳 (기본 landing).
 */
export const AuthenticatedRedirect = ({ children, fallback = 'https://get-it.cloud' }) => {
  const session = useSession();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (session.status === 'authenticated') {
      redirectAfterAuth(searchParams, fallback);
    }
  }, [session.status, searchParams, fallback]);

  if (session.status === 'loading') {
    return (
      <div
        className="flex flex-col items-center gap-2 py-12 font-mono text-[12px] text-zinc-500 dark:text-zinc-500"
        role="status"
        aria-live="polite"
      >
        <span>
          <span className="text-cyan-700 dark:text-cyan-neon">$</span> checking session…
        </span>
        <span
          aria-hidden="true"
          className="caret bg-cyan-700 text-cyan-700 dark:bg-cyan-neon dark:text-cyan-neon"
        />
      </div>
    );
  }

  if (session.status === 'authenticated') {
    // useEffect 가 곧 redirectAfterAuth 를 호출. 깜빡임 방지용 inline 안내.
    return (
      <div
        className="flex flex-col items-center gap-2 py-12 font-mono text-[12px] text-zinc-500 dark:text-zinc-500"
        role="status"
        aria-live="polite"
      >
        <span>
          <span className="text-cyan-700 dark:text-cyan-neon">$</span> already signed in ·
          redirecting…
        </span>
      </div>
    );
  }

  return children;
};
