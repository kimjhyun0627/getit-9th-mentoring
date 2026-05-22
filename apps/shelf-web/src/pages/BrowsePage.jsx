import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { api } from '../lib/api.js';
import { shelfError } from '../lib/error-messages.js';

/**
 * BrowsePage — 부원 서재 디렉토리 (#561).
 *
 * 사용자 신고:
 *  > "다른 사람 도서관 볼 수 있는 기능이 있을까요?"
 *
 * 기존 `/u/:userId` (#292) BE/FE 는 라이브였으나 진입 경로 없음. 이 페이지가 discover 채널.
 *
 * 정책:
 *  - 비로그인이어도 열람 가능 (UserShelfPage 와 동일 트러스트).
 *  - nickname 스냅샷 있는 부원만 (BE 가 필터) — 학교 인증 onboarding 자동 게이트.
 *  - 책 권 수만 노출. 책 목록은 카드 클릭 후 `/u/:userId` 에서.
 *  - 정렬: 책 권 수 desc (default) / 최근 활동 desc.
 *  - 무한 스크롤 (HomePage 패턴).
 */
const PAGE_SIZE = 20;

const SORTS = /** @type {const} */ ([
  { key: 'bookCount', label: '책 권 수' },
  { key: 'recent', label: '최근 활동' },
]);

/** @typedef {'bookCount' | 'recent'} BrowseSort */

export const BrowsePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = /** @type {BrowseSort} */ (searchParams.get('sort') ?? 'bookCount');
  const sort = SORTS.some((s) => s.key === sortParam) ? sortParam : 'bookCount';

  const { data, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['shelves', 'browse', { sort, pageSize: PAGE_SIZE }],
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const res = await api.listBrowseUsers({ page: pageParam, pageSize: PAGE_SIZE, sort });
        return res.data;
      },
      getNextPageParam: (lastPage, allPages) => {
        const total = lastPage?.pagination?.total ?? 0;
        const loaded = allPages.reduce((sum, p) => sum + (p?.users?.length ?? 0), 0);
        if (loaded >= total) return undefined;
        if ((lastPage?.users?.length ?? 0) === 0) return undefined;
        return (lastPage?.pagination?.page ?? allPages.length) + 1;
      },
    });

  const users = useMemo(() => (data?.pages ?? []).flatMap((p) => p?.users ?? []), [data]);
  const total = data?.pages?.[0]?.pagination?.total ?? users.length;

  const setSentinel = useInfiniteScroll({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    },
    enabled: hasNextPage && !isFetchingNextPage,
  });

  /** @param {BrowseSort} next */
  const onSortChange = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'bookCount') params.delete('sort');
    else params.set('sort', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <article aria-busy={isLoading} className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
      <BrowseHeader total={total} sort={sort} onSortChange={onSortChange} />

      {isLoading ? (
        <SkeletonGrid />
      ) : isError ? (
        <p role="alert" className="text-destructive font-serif">
          {shelfError(error)}
        </p>
      ) : users.length === 0 ? (
        <EmptyDirectory />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 md:gap-x-10 md:gap-y-10 lg:grid-cols-4">
            {users.map((u) => (
              <li key={u.userId}>
                <UserCard user={u} />
              </li>
            ))}
          </ul>
          <div ref={setSentinel} className="mt-12 flex justify-center" aria-live="polite">
            {isFetchingNextPage ? (
              <p className="font-serif text-sm text-meta">더 불러오는 중…</p>
            ) : !hasNextPage && users.length >= PAGE_SIZE ? (
              <p className="essay-kr text-[13px] text-meta">모든 부원의 서가를 봤어요.</p>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
};

/** @param {{ total: number, sort: BrowseSort, onSortChange: (s: BrowseSort) => void }} props */
const BrowseHeader = ({ total, sort, onSortChange }) => (
  <section aria-labelledby="browse-title" className="mb-10 md:mb-14">
    <p className="smallcaps mb-2 text-[12px]">A Directory Of</p>
    <h1
      id="browse-title"
      className="font-display text-[10vw] font-black leading-[1.02] tracking-tightest md:text-[4rem]"
    >
      부원의 서가<span className="text-wine">.</span>
    </h1>
    <p className="essay-kr text-body mt-4 max-w-[44ch] text-[14px]">
      누구의 서가가 가장 두꺼울까요. 다른 부원의 도서관을 펼쳐보고, 책 한 권에서 시작되는 대화를
      이어가세요.
    </p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="smallcaps text-meta text-[11px]">총 {total}명 · 공개 디렉토리</p>
      <div className="flex items-center gap-2 font-serif text-[12px] text-meta">
        <span className="smallcaps text-[10px]">Sort</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSortChange(s.key)}
            aria-pressed={sort === s.key}
            className={
              sort === s.key
                ? 'rounded-sm border border-foreground px-2 py-0.5 text-ink'
                : 'rounded-sm border border-rule-2 px-2 py-0.5 transition hover:border-foreground hover:text-ink'
            }
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  </section>
);

/** @param {{ user: { userId: string, nickname: string, bookCount: number } }} props */
const UserCard = ({ user }) => (
  <Link
    to={`/u/${encodeURIComponent(user.userId)}`}
    className="group block rounded-sm border border-rule-2 bg-paper-2 px-5 py-6 transition hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)]"
  >
    <p className="smallcaps mb-2 text-[10px]">A Reader</p>
    <p className="font-display tracking-hero text-2xl font-black leading-tight text-ink-strong group-hover:text-wine md:text-3xl">
      {user.nickname}
    </p>
    <p className="essay-kr text-body mt-2 text-[13px]">
      <span className="num-display text-[15px]">{user.bookCount}</span>권의 책을 모았습니다.
    </p>
  </Link>
);

const SkeletonGrid = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="부원 서재 디렉토리를 불러오는 중"
    className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 md:gap-x-10 md:gap-y-10 lg:grid-cols-4"
  >
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="h-32 animate-pulse rounded-sm border border-rule-2 bg-paper-2"
        aria-hidden="true"
      />
    ))}
  </div>
);

const EmptyDirectory = () => (
  <p className="text-meta essay-kr text-[14px]">
    아직 공개된 서재가 없습니다. 첫 부원이 되어 책을 꽂아보세요.
  </p>
);
