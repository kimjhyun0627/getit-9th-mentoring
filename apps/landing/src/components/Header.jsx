import { ThemeToggle } from '@getit/theme';

const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';

/**
 * `auth.get-it.cloud/login?redirect=<origin+pathname>` 빌더.
 * SSR/JSDOM에서 window 가드.
 * 쿼리/프래그먼트에 붙은 토큰·식별자가 auth 도메인으로 새는 걸 막기 위해
 * `href` 전체가 아닌 `origin + pathname`만 redirect로 넘긴다.
 *
 * @returns {string}
 */
const buildLoginUrl = () => {
  const back =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://get-it.cloud';
  return `${AUTH_ORIGIN}/login?redirect=${encodeURIComponent(back)}`;
};

/**
 * Sticky 상단 헤더 (Tech-Dark).
 * - 좌: G9 cyan 모노그램 + `GETIT/9` mono 로고 + mono nav (services, about)
 * - 우: "all systems / nominal" pulse 도트 + ThemeToggle + `$ sign in` CTA
 * - hairline 하단 보더 + backdrop-blur (라이트=white/80, 다크=ink-950/80)
 */
export const Header = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur dark:bg-ink-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-8">
          <a href="/" className="group flex items-center gap-2" aria-label="GETIT 9기 홈">
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
              className="font-mono text-xs text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              services
            </a>
            <a
              href="#about"
              className="font-mono text-xs text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              about
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border border-hairline bg-white/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-600 sm:flex dark:bg-ink-900/60 dark:text-zinc-400">
            <span
              aria-hidden="true"
              className="pulse-dot inline-block size-1.5 rounded-full bg-lime-600 text-lime-600 dark:bg-lime-neon dark:text-lime-neon"
            />
            <span>all systems / nominal</span>
          </div>

          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-zinc-700 transition hover:border-cyan-700 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon" />

          <a
            href={buildLoginUrl()}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white/70 px-3 py-1.5 font-mono text-xs font-medium text-zinc-800 transition hover:border-cyan-700 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-ink-900/70 dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon"
          >
            <span className="opacity-60">$</span> sign in
          </a>
        </div>
      </div>
    </header>
  );
};
