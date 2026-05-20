import { ThemeToggle } from '@getit/theme';

/**
 * Auth 페이지 공통 레이아웃 — Tech-Dark 페르소나 (Issue #172).
 * Landing과 동일 톤: ink-950 다크 베이스 + scene-dark 그리드 + hairline 보더 + cyan 액센트.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const AuthLayout = ({ children }) => {
  return (
    <div className="scene-dark scanlines relative flex min-h-screen flex-col text-foreground">
      {/* engineer/print 코너 + 마크 (landing hero와 동일). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-4 font-mono text-[10px] tracking-wider text-zinc-500 dark:text-zinc-600"
      >
        +
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 font-mono text-[10px] tracking-wider text-zinc-500 dark:text-zinc-600"
      >
        +
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] tracking-wider text-zinc-500 dark:text-zinc-600"
      >
        +
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 right-4 font-mono text-[10px] tracking-wider text-zinc-500 dark:text-zinc-600"
      >
        +
      </div>

      <header className="sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur dark:bg-ink-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
          <a
            href="https://get-it.cloud"
            className="group flex items-center gap-2"
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

          <div className="flex items-center gap-2">
            <div
              className="hidden items-center gap-2 rounded-md border border-hairline bg-white/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-600 dark:bg-ink-900/60 dark:text-zinc-400 sm:flex"
              aria-label="auth service status"
            >
              <span
                aria-hidden="true"
                className="pulse-dot inline-block size-1.5 rounded-full bg-lime-600 text-lime-600 dark:bg-lime-neon dark:text-lime-neon"
              />
              <span>auth / nominal</span>
            </div>
            <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white/70 text-base transition hover:border-cyan-700 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-ink-900/70 dark:hover:border-cyan-neon dark:hover:text-cyan-neon" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:py-20">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-hairline bg-white/70 p-8 backdrop-blur dark:bg-ink-900/60 sm:p-10">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-hairline bg-white/60 backdrop-blur dark:bg-ink-950/60">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-6 font-mono text-[11px] text-zinc-500 dark:text-zinc-500 lg:px-10 sm:flex-row sm:items-center">
          <p>
            <span className="text-zinc-400 dark:text-zinc-600">©</span> GETIT/9 — KNU · 경북대학교
            IT 학회
          </p>
          <p className="tracking-wider">
            <span className="text-cyan-700 dark:text-cyan-neon">~/</span>auth.get-it.cloud
          </p>
        </div>
      </footer>
    </div>
  );
};
