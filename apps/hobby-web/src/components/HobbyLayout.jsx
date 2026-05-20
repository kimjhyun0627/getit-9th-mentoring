import { ThemeToggle } from '@getit/theme';

/**
 * 취미메이트 공통 레이아웃 — Playful 톤.
 * - Light: slate-50 + 점 패턴 + rose/fuchsia 그라데이션 로고
 * - Dark: slate-950 + amber-300 inverse CTA
 *
 * 모바일 우선 + lg 에서 가운데 정렬 카드 폼.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const HobbyLayout = ({ children }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* dotted backdrop (시안 톤 유지) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-dotted opacity-80"
      />

      <header className="relative z-10 mx-auto flex max-w-[1280px] items-center gap-3 px-5 pt-6 lg:px-10 sm:gap-5">
        <a
          href="/"
          className="group inline-flex shrink-0 items-center gap-2.5"
          aria-label="취미메이트 홈"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 via-fuchsia-500 to-violet-500 text-xl font-extrabold text-white shadow-lg shadow-fuchsia-500/30 transition group-hover:rotate-6 group-hover:scale-105 font-display"
          >
            🤲
          </span>
          <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            취미<span className="text-rose-500 dark:text-rose-300">메이트</span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg shadow-sm ring-1 ring-slate-900/5 transition hover:rotate-12 hover:scale-110 dark:bg-white/10 dark:ring-white/10" />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1280px] px-5 py-10 lg:px-10 lg:py-14">
        {children}
      </main>

      <footer className="relative z-10 mt-10 border-t border-slate-200/70 dark:border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-2 px-5 py-6 text-xs text-slate-500 lg:px-10 sm:flex-row sm:items-center dark:text-slate-400">
          <p>© GETIT 9기 멘토링 · 경북대학교 IT 학회</p>
          <p className="font-mono tracking-wider opacity-80">hobby.get-it.cloud</p>
        </div>
      </footer>
    </div>
  );
};
