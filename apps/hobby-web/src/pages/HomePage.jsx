import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyCard } from '../components/EmptyCard.jsx';
import { FilterChips } from '../components/FilterChips.jsx';
import { Header } from '../components/Header.jsx';
import { MeetupCard } from '../components/MeetupCard.jsx';
import { SchoolAuthBanner } from '../components/SchoolAuthBanner.jsx';
import { api } from '../lib/api.js';

import { NewMeetupCta } from './HomePage.cta.jsx';

/**
 * 홈 — 모집 카드 리스트. 시안 (docs/design/hobby/playful.html) 1:1.
 *
 * 데이터 흐름:
 *  - useInfiniteQuery 로 GET /api/posts cursor 페이지네이션.
 *  - 검색(q) / 시간(timeWindow) / 태그(tag) 전부 서버 사이드 필터 (#229).
 *  - 검색 입력은 250ms debounce 후 q 쿼리에 박힘.
 *
 * 빈 상태:
 *  - 카드 0개일 때만 EmptyCard placeholder 표시 (시안 카드 7 슬롯).
 *  - 카드가 있어도 그리드 마지막에 항상 EmptyCard 를 보여줘 "새 모임" CTA 유도.
 */
export const HomePage = () => {
  // #266: URL `?q=` 가 있으면 초기 검색어로 채움 (다른 페이지 헤더 검색창에서 enter 시 진입).
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [timeKey, setTimeKey] = useState(/** @type {'all'|'today'|'week'} */ ('all'));
  const [tagKey, setTagKey] = useState(/** @type {string|null} */ (null));
  // #541: 학교 인증 안내 배너 dismiss — 세션 내만 (localStorage X — PRD 결정).
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // #541: 로그인 + 학교 미인증이면 배너/비활성 버튼 노출.
  // staleTime 60s — Header 의 me query 와 동일 키 → 캐시 공유.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });
  // Gemini review #549: me 가 해소되기 전엔 배너/disabled 상태 결정 X — flicker 방지.
  // PostDetailPage 의 meSettled 패턴 재사용. 401 도 settled 로 본다 (비로그인 확정).
  const meErrorStatus = meQuery.error?.response?.status;
  const meSettled = !meQuery.isLoading || meQuery.data != null || meErrorStatus === 401;
  const isLoggedIn = Boolean(meQuery.data);
  const isSchoolVerified = Boolean(meQuery.data?.schoolVerifiedAt);
  const showSchoolAuthBanner = meSettled && isLoggedIn && !isSchoolVerified && !bannerDismissed;
  const newMeetupDisabled = meSettled && isLoggedIn && !isSchoolVerified;

  // #229: 검색 입력은 250ms debounce. 빈 문자열은 서버 q 미전송.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // URL `?q=` 가 외부 페이지에서 갱신될 때 input/검색 상태도 동기화.
  useEffect(() => {
    const next = searchParams.get('q') ?? '';
    setSearchInput((prev) => (prev !== next ? next : prev));
  }, [searchParams]);

  // #229: tag / timeWindow / q 전부 서버 사이드 필터로 BE 에 위임.
  // queryKey 에 모든 필터를 포함해 변경 시 자동 refetch.
  const query = useInfiniteQuery({
    queryKey: ['posts', { tag: tagKey, timeWindow: timeKey, q: search }],
    queryFn: ({ pageParam }) =>
      api.listPosts({
        ...(tagKey ? { tag: tagKey } : {}),
        ...(timeKey !== 'all' ? { timeWindow: timeKey } : {}),
        ...(search ? { q: search } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: 12,
      }),
    initialPageParam: null,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });

  const posts = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

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

      <Header search={searchInput} onSearchChange={setSearchInput} />

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

          <NewMeetupCta disabled={newMeetupDisabled} />
        </div>

        {showSchoolAuthBanner ? (
          <div className="mt-8">
            <SchoolAuthBanner onDismiss={() => setBannerDismissed(true)} />
          </div>
        ) : null}

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
            <div
              role="alert"
              className="rounded-3xl bg-white/80 dark:bg-white/5 ring-1 ring-rose-200/60 dark:ring-rose-400/20 px-6 py-8 text-center shadow-sm"
            >
              <p className="text-2xl" aria-hidden="true">
                🌧️
              </p>
              <p className="mt-2 font-display font-extrabold text-lg text-slate-900 dark:text-white">
                모집 목록을 불러오지 못했어
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 font-round">
                서버가 잠시 자리를 비웠나봐. 잠시 후 다시 시도해줘.
              </p>
              <button
                type="button"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-display font-bold shadow-sm disabled:opacity-50"
              >
                <span aria-hidden="true">↻</span>
                {query.isFetching ? '다시 시도 중…' : '다시 시도'}
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <p role="status" className="text-slate-500 dark:text-slate-400 font-round">
              모임 모아오는 중…
            </p>
          ) : !isError ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {posts.map((post) => (
                <MeetupCard key={post.id} post={post} />
              ))}
              <EmptyCard mode={posts.length === 0 ? 'empty' : 'cta'} />
            </div>
          ) : null}

          {query.hasNextPage ? (
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="chip-pop inline-flex items-center gap-2 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-700 dark:text-slate-200 px-5 py-2.5 text-sm font-display font-bold shadow-sm disabled:opacity-50"
              >
                {query.isFetchingNextPage ? '또 모아오는 중…' : '더 둘러보기'}{' '}
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
              ✅ 노쇼 방지
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};
