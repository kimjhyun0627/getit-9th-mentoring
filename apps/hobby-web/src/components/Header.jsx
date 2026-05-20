import { ThemeToggle } from '@getit/theme';

/**
 * Playful 페르소나 헤더 — 로고 + 검색 + 다크 토글 + Sign in.
 * 시안 (docs/design/hobby/playful.html) 의 <header> 1:1 변환.
 *
 * @param {{ search: string; onSearchChange: (v: string) => void }} props
 */
export const Header = ({ search, onSearchChange }) => {
  return (
    <header className="relative z-10 max-w-[1280px] mx-auto px-5 lg:px-10 pt-6 flex items-center gap-3 sm:gap-5">
      <a
        href="/"
        className="group inline-flex items-center gap-2.5 shrink-0"
        aria-label="취미메이트 홈"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 via-fuchsia-500 to-violet-500 text-white text-xl font-display font-extrabold shadow-lg shadow-fuchsia-500/30 group-hover:rotate-6 group-hover:scale-105 transition"
        >
          🤲
        </span>
        <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
          취미<span className="text-rose-500 dark:text-rose-300">메이트</span>
        </span>
      </a>

      <label className="relative flex-1 max-w-xl hidden sm:block">
        <span
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        >
          🔎
        </span>
        <span className="sr-only">검색</span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="태그/장소로 검색 · 예: 마라탕, 북문, 풋살"
          aria-label="태그 또는 장소로 검색"
          className="w-full rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 pl-11 pr-4 py-2.5 text-sm font-round text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:ring-2 focus:ring-rose-400 outline-none transition"
        />
      </label>

      <div className="ml-auto flex items-center gap-2.5">
        <ThemeToggle className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-lg hover:rotate-12 hover:scale-110 transition shadow-sm" />
        <a
          href="https://auth.get-it.cloud/login?redirect=https%3A%2F%2Fhobby.get-it.cloud"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 sm:px-5 py-2.5 font-display font-bold text-sm shadow-md hover:scale-[1.04] hover:-rotate-1 transition"
        >
          Sign in <span aria-hidden="true">→</span>
        </a>
      </div>
    </header>
  );
};
