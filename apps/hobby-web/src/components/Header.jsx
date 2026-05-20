import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';

import { NotificationBell } from './NotificationBell.jsx';
import { PlayfulThemeToggle } from './PlayfulThemeToggle.jsx';

/**
 * Playful 페르소나 헤더 — 로고 + 검색 + 다크 토글 + 알림 + 마이 + Sign in.
 *
 * #229: 알림 벨 추가 (로그인 시만 노출).
 * #228: 마이페이지 진입점 (로그인 시 "내 모임" 아이콘 노출).
 *
 * 내부 라우팅은 react-router 의 `Link` — `<a href>` 는 전체 페이지 새로고침을 유발.
 *
 * @param {{ search: string; onSearchChange: (v: string) => void }} props
 */
export const Header = ({ search, onSearchChange }) => {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });
  const isLoggedIn = Boolean(meQuery.data);
  const userId = meQuery.data?.id ?? null;

  return (
    <header className="relative z-10 max-w-[1280px] mx-auto px-5 lg:px-10 pt-6 flex items-center gap-3 sm:gap-5">
      <Link
        to="/"
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
      </Link>

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
          placeholder="태그·장소 검색 (예: 북문 마라탕)"
          aria-label="태그 또는 장소로 검색"
          className="w-full rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 pl-11 pr-4 py-2.5 text-sm font-round text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:ring-2 focus:ring-rose-400 outline-none transition"
        />
      </label>

      <div className="ml-auto flex items-center gap-2.5">
        <PlayfulThemeToggle />
        <NotificationBell enabled={isLoggedIn} userId={userId} />
        {isLoggedIn ? (
          <Link
            to="/me"
            aria-label="내 모임"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-[1.05] transition"
          >
            <span aria-hidden="true" className="text-lg">
              👤
            </span>
          </Link>
        ) : (
          <a
            href="https://auth.get-it.cloud/login?redirect=https%3A%2F%2Fhobby.get-it.cloud"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 sm:px-5 py-2.5 font-display font-bold text-sm shadow-md hover:scale-[1.04] hover:-rotate-1 transition"
          >
            Sign in <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </header>
  );
};
