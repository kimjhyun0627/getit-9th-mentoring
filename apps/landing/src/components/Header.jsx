import { ThemeToggle } from '@getit/theme';

import { buildLoginUrl } from '../lib/auth-redirect.js';

/**
 * Sticky 상단 헤더 (Tech-Dark).
 * - 좌: G9 cyan 모노그램 + `GETIT/9` mono 로고 + mono nav (services, about)
 * - 우: "all systems / nominal" pulse 도트 + ThemeToggle + `$ sign in` CTA
 * - hairline 하단 보더 + backdrop-blur (라이트=white/80, 다크=ink-950/80)
 *
 * a11y (#261): 상태 표시 컨테이너에 role="status" + 한국어 aria-label.
 * focus (#293): focus-visible outline + offset-1 — 좁은 sticky 헤더에서 hairline 위로 잘리지 않게.
 *
 * SSO 상태 분기(#246)는 cross-domain cookie + auth /me 엔드포인트 의존성이 커서
 * 별도 follow-up 이슈로 분리. 본 PR은 컴포넌트 구조만 유지.
 */
export const Header = () => {
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
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md border border-hairline bg-ink-950 font-mono text-[11px] font-bold text-cyan-neon dark:bg-cyan-neon dark:text-ink-950"
            >
              G9
            </span>
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

          <ThemeToggle
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-zinc-700 transition hover:border-cyan-700 hover:text-cyan-700 dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon ${focusMono}`}
          />

          <a
            href={buildLoginUrl()}
            aria-label="sign in (로그인)"
            className={`inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white/70 px-3 py-1.5 font-mono text-xs font-medium text-zinc-800 transition hover:border-cyan-700 hover:text-cyan-700 dark:bg-ink-900/70 dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon ${focusMono}`}
          >
            <span className="opacity-60" aria-hidden="true">
              $
            </span>{' '}
            <span aria-hidden="true">sign in</span>
          </a>
        </div>
      </div>
    </header>
  );
};
