import { CodeTerminalToggle } from '@getit/theme';

import { buildLoginUrl } from '../lib/auth-redirect.js';
import { performLogout } from '../lib/logout.js';
import { useSession } from '../lib/useSession.js';

import { BrandMark } from './BrandMark.jsx';

/**
 * Sticky 상단 헤더 (Tech-Dark).
 * - 좌: G9 cyan 모노그램 + `GETIT/9` mono 로고 + mono nav (services, about)
 * - 우: "all systems / nominal" pulse 도트 + CodeTerminalToggle + (로그인 분기)
 *   - 비로그인: `$ sign in` CTA
 *   - 로그인 (#343 / #246): 사용자 이름 + 로그아웃 폼 — PRD "통합 SSO" 가치 시각 증명
 * - hairline 하단 보더 + backdrop-blur (라이트=white/80, 다크=ink-950/80)
 *
 * a11y (#261): 상태 표시 컨테이너에 role="status" + 한국어 aria-label.
 * focus (#293): focus-visible outline + offset-1 — 좁은 sticky 헤더에서 hairline 위로 잘리지 않게.
 *
 * SSO 세션 분기 (#343 / #246):
 *  - useSession 이 `auth.get-it.cloud/api/me` 를 cross-domain cookie 와 함께 fetch.
 *  - 로딩 중에는 어떤 CTA 도 그리지 않는다 — flicker (비로그인→로그인 깜빡임) 방지.
 *  - 401/5xx/네트워크 에러는 fail-soft 로 비로그인 표시.
 *  - 로그아웃은 `POST auth.get-it.cloud/api/logout` 직접 호출. `/api/logout` 은
 *    CSRF guard 면제 (auth-api/src/lib/csrf.js 주석 참고) — 다른 web 앱이 토큰 없이
 *    호출 가능하도록 의도된 설계. 호출 후 페이지 새로고침으로 헤더 상태 동기화.
 */
export const Header = () => {
  const { user, loading } = useSession();

  const focusMono =
    'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-700 dark:focus-visible:outline-cyan-neon';

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur dark:bg-ink-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-8">
          <a
            href="/"
            className={`group flex items-center gap-2 ${focusMono}`}
            aria-label="GETIT 9기 홈"
          >
            <BrandMark className="h-7 w-7" />

            <span className="font-mono text-sm font-semibold tracking-tight">
              <span className="text-cyan-700 dark:text-cyan-neon">GETIT</span>
              <span className="text-zinc-400 dark:text-zinc-500">/</span>9
            </span>
          </a>

          <nav aria-label="주요 섹션" className="hidden items-center gap-8 md:flex">
            <a
              href="#projects"
              aria-label="services (프로젝트 섹션으로 이동)"
              className={`font-mono text-xs text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white ${focusMono}`}
            >
              services
            </a>
            <a
              href="#about"
              aria-label="about (소개 섹션으로 이동)"
              className={`font-mono text-xs text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white ${focusMono}`}
            >
              about
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="status"
            aria-label="서비스 상태: 모든 시스템 정상"
            className="hidden items-center gap-2 rounded-md border border-hairline bg-white/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-600 sm:flex dark:bg-ink-900/60 dark:text-zinc-400"
          >
            <span
              aria-hidden="true"
              className="pulse-dot inline-block size-1.5 rounded-full bg-lime-600 text-lime-600 dark:bg-lime-neon dark:text-lime-neon"
            />
            <span aria-hidden="true">all systems / nominal</span>
          </div>

          <CodeTerminalToggle />

          <SessionCta user={user} loading={loading} focusMono={focusMono} />
        </div>
      </div>
    </header>
  );
};

/**
 * 헤더 우측 세션 CTA. 로딩/비로그인/로그인 3 상태 분기.
 *
 * @param {{
 *   user: { sub: string; email?: string; name?: string } | null,
 *   loading: boolean,
 *   focusMono: string,
 * }} props
 */
const SessionCta = ({ user, loading, focusMono }) => {
  if (loading) {
    // 로딩 중에는 placeholder skeleton — width 보존으로 layout shift 방지 (CLS).
    return (
      <div
        aria-hidden="true"
        data-testid="session-cta-skeleton"
        className="inline-flex h-[30px] w-[88px] items-center rounded-md border border-hairline bg-white/50 dark:bg-ink-900/50"
      />
    );
  }

  if (user) {
    const displayName = user.name || user.email || 'me';
    return (
      <div className="flex items-center gap-2" data-testid="session-cta-signed-in">
        <span
          className="hidden max-w-[160px] truncate font-mono text-xs text-zinc-700 sm:inline dark:text-zinc-200"
          title={displayName}
          aria-label={`로그인 사용자: ${displayName}`}
        >
          <span className="text-zinc-400 dark:text-zinc-500">~/</span>
          {displayName}
        </span>
        <button
          type="button"
          aria-label="로그아웃"
          data-testid="session-logout"
          onClick={performLogout}
          className={`inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white/70 px-3 py-1.5 font-mono text-xs font-medium text-zinc-800 transition hover:border-cyan-700 hover:text-cyan-700 dark:bg-ink-900/70 dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon ${focusMono}`}
        >
          <span className="opacity-60" aria-hidden="true">
            $
          </span>{' '}
          <span aria-hidden="true">logout</span>
        </button>
      </div>
    );
  }

  return (
    <a
      href={buildLoginUrl()}
      aria-label="sign in (로그인)"
      data-testid="session-signin"
      className={`inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white/70 px-3 py-1.5 font-mono text-xs font-medium text-zinc-800 transition hover:border-cyan-700 hover:text-cyan-700 dark:bg-ink-900/70 dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon ${focusMono}`}
    >
      <span className="opacity-60" aria-hidden="true">
        $
      </span>{' '}
      <span aria-hidden="true">sign in</span>
    </a>
  );
};
