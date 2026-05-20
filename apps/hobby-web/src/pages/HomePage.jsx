import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyCard } from '../components/EmptyCard.jsx';
import { FilterChips } from '../components/FilterChips.jsx';
import { Header } from '../components/Header.jsx';
import { MeetupCard } from '../components/MeetupCard.jsx';
import { api } from '../lib/api.js';

import { filterPosts } from './HomePage.logic.js';

/**
 * 홈 — 모집 카드 리스트. 시안 (docs/design/hobby/playful.html) 1:1.
 *
 * 데이터 흐름:
 *  - useInfiniteQuery 로 GET /api/posts cursor 페이지네이션.
 *  - 검색어 / 시간 필터는 클라이언트에서 (서버 query 미지원).
 *  - 태그 필터는 서버 query 의 `tag` 로 직접 전달 (지원됨).
 *
 * 빈 상태:
 *  - 카드 0개일 때만 EmptyCard placeholder 표시 (시안 카드 7 슬롯).
 *  - 카드가 있어도 그리드 마지막에 항상 EmptyCard 를 보여줘 "새 모임" CTA 유도.
 */
export const HomePage = () => {
  const [search, setSearch] = useState('');
  const [timeKey, setTimeKey] = useState(/** @type {'all'|'today'|'week'} */ ('all'));
  const [tagKey, setTagKey] = useState(/** @type {string|null} */ (null));

  const query = useInfiniteQuery({
    queryKey: ['posts', { tag: tagKey }],
    queryFn: ({ pageParam }) =>
      api.listPosts({
        ...(tagKey ? { tag: tagKey } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: 12,
      }),
    initialPageParam: null,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });

  const posts = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.items) ?? [];
    return filterPosts(all, { search, timeKey });
  }, [query.data, search, timeKey]);

  const isLoading = query.isLoading;
  const isError = query.isError;
  const total = posts.length;

  return (
    <div className="relative overflow-hidden min-h-screen">
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 380,
          height: 380,
          top: -80,
          left: -60,
          background: 'radial-gradient(circle,#ff8aae 0%,transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 320,
          height: 320,
          top: 60,
          right: -40,
          background: 'radial-gradient(circle,#a5b4fc 0%,transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 360,
          height: 360,
          bottom: -80,
          left: '30%',
          background: 'radial-gradient(circle,#86efac 0%,transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 300,
          height: 300,
          top: '40%',
          right: '10%',
          background: 'radial-gradient(circle,#fde68a 0%,transparent 65%)',
        }}
      />

      <div aria-hidden="true" className="absolute inset-0 bg-dotted pointer-events-none" />

      <Header search={search} onSearchChange={setSearch} />

      <main className="relative z-10 max-w-[1280px] mx-auto px-5 lg:px-10 pt-10 lg:pt-14 pb-14">
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 px-3.5 py-1.5 text-xs font-round font-bold text-rose-600 dark:text-rose-300 shadow-sm">
              <span aria-hidden="true">🎉</span>
              <span>KNU 학우 일회성 모임</span>
            </span>
            <h1 className="mt-5 font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-slate-900 dark:text-white">
              오늘 누구랑
              <span className="block">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 dark:from-rose-300 dark:via-fuchsia-300 dark:to-violet-300">
                  뭐 할까?
                </span>{' '}
                <span
                  aria-hidden="true"
                  className="inline-block float-fast"
                  style={{ ['--r']: '-6deg' }}
                >
                  🥳
                </span>
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-round">
              공강·주말, 한 끼·한 게임. 경북대 학우끼리 가볍게 모이는{' '}
              <span className="font-bold text-slate-900 dark:text-white">일회성 취미 모임</span>{' '}
              매칭.
            </p>
          </div>

          <Link
            to="/new"
            className="group relative inline-flex items-center gap-3 rounded-full card-coral text-white px-7 py-4 font-display font-extrabold text-lg shadow-xl shadow-rose-400/40 hover:scale-[1.04] hover:-rotate-2 transition self-start"
          >
            <span aria-hidden="true" className="text-2xl emoji">
              ＋
            </span>
            <span>새 모임 만들기</span>
            <span aria-hidden="true" className="arrow">
              →
            </span>
          </Link>
        </div>

        <FilterChips
          timeKey={timeKey}
          onTimeChange={setTimeKey}
          tagKey={tagKey}
          onTagChange={setTagKey}
        />

        <section id="meetups" className="mt-10" aria-label="모집 중인 모임">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
              지금 모집 중{' '}
              <span aria-hidden="true" className="inline-block float-mid">
                🎯
              </span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-round">
              총 <b className="text-slate-800 dark:text-slate-100">{total}</b>개 · 정원 마감되면
              자동 알림
            </p>
          </div>

          {isError ? (
            <p role="alert" className="text-rose-600 dark:text-rose-300 font-round">
              모집 목록을 불러오지 못했어. 잠시 후 다시 시도해줘.
            </p>
          ) : null}

          {isLoading ? (
            <p role="status" className="text-slate-500 dark:text-slate-400 font-round">
              모집을 불러오는 중...
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {posts.map((post) => (
                <MeetupCard key={post.id} post={post} />
              ))}
              <EmptyCard />
            </div>
          )}

          {query.hasNextPage ? (
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="chip-pop inline-flex items-center gap-2 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-700 dark:text-slate-200 px-5 py-2.5 text-sm font-display font-bold shadow-sm disabled:opacity-50"
              >
                {query.isFetchingNextPage ? '불러오는 중…' : '더 둘러보기'}{' '}
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          ) : null}
        </section>

        <footer className="mt-16 pb-10 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 via-fuchsia-500 to-violet-500 text-white text-lg font-display font-extrabold shadow"
            >
              🤲
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-round">
              © 취미메이트 · GETIT 9기 · hobby.get-it.cloud
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-round font-bold">
            <span className="rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 px-3 py-1.5 text-slate-700 dark:text-slate-200">
              🔐 통합 SSO
            </span>
            <span className="rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 px-3 py-1.5 text-slate-700 dark:text-slate-200">
              🚫 노쇼 패널티
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};
