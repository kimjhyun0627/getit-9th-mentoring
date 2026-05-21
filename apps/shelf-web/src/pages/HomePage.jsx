import { SHELF_SORT_DEFAULT, ShelfSortKey } from '@getit/schemas/shelf';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BookCard, BookCardSkeleton } from '../components/BookCard.jsx';
import { EditShelfModal } from '../components/EditShelfModal.jsx';
import { EmptyShelf } from '../components/EmptyShelf.jsx';
import { FilterTabs } from '../components/FilterTabs.jsx';
import { RatingFilter } from '../components/RatingFilter.jsx';
import { SortControl } from '../components/SortControl.jsx';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { useInfiniteMyShelves, useRemoveShelf, useUpdateShelf } from '../hooks/useShelves.js';
import { shelfError } from '../lib/error-messages.js';

// 한 페이지당 책 수 — 무한 스크롤(#525) 전환 후 첫 페이지로 grid 한 화면 + 약간 여유 채우는
// 균형점. 30 이면 4-col grid 기준 7-8 행, 모바일 2-col 기준 ~15 행으로 첫 fetch ~6KB.
const PAGE_SIZE = 30;

/** @typedef {import('@getit/schemas/shelf').ShelfSortKeyT} SortKey */

/** @type {SortKey[]} */
const SORT_KEYS = ShelfSortKey.options;

/** @typedef {import('../components/BookCard.jsx').Shelf} Shelf */
/** @typedef {'ALL' | 'WANT' | 'READING' | 'READ'} FilterKey */

/**
 * 내 서재 — editorial polish round 2 시안 1:1.
 *
 * 섹션:
 *  1) Hero — "나의 도서관." + 이번 시즌 카운트
 *  2) Filter tabs — All / Read / Reading / Wishlist
 *  3) Library grid — BookCard (무한 스크롤, #525)
 *  4) (옵션) Empty placeholder
 *  5) 책 클릭 → EditShelfModal (PATCH / DELETE)
 *
 * 무한 스크롤(#525): 사용자 피드백 "도서가 몇 권 안 뜨는 것 같다" → `Pagination` 제거,
 * `useInfiniteMyShelves` + IntersectionObserver sentinel 로 자연 누적. URL `?page=` 도
 * 제거 (deep link 의도 없음 — 정렬만 ?sort 로 유지).
 */
export const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get('sort');
  const sort = /** @type {SortKey} */ (
    SORT_KEYS.includes(/** @type {SortKey} */ (sortParam)) ? sortParam : SHELF_SORT_DEFAULT
  );

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isFetchNextPageError,
    refetch,
  } = useInfiniteMyShelves({ sort, pageSize: PAGE_SIZE });
  const update = useUpdateShelf();
  const remove = useRemoveShelf();

  const [filter, setFilter] = useState(/** @type {FilterKey} */ ('ALL'));
  // 별점 2차 필터 (#199): 0=전체, 1~5=최소 별점.
  const [minRating, setMinRating] = useState(0);
  const [editing, setEditing] = useState(/** @type {Shelf | null} */ (null));

  /** @param {SortKey} next */
  const handleSortChange = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === SHELF_SORT_DEFAULT) params.delete('sort');
    else params.set('sort', next);
    setSearchParams(params, { replace: true });
  };

  const shelves = useMemo(() => (data?.pages ?? []).flatMap((p) => p?.shelves ?? []), [data]);
  const total = data?.pages?.[0]?.pagination?.total ?? shelves.length;

  const counts = useMemo(() => countByStatus(shelves), [shelves]);
  const visible = useMemo(() => {
    let next = filter === 'ALL' ? shelves : shelves.filter((s) => s.status === filter);
    if (minRating > 0) {
      next = next.filter((s) => (s.rating ?? 0) >= minRating);
    }
    return next;
  }, [shelves, filter, minRating]);

  // sentinel — 화면 끝에서 200px 전에 미리 fetch. 필터 걸려도 누적 자체는 계속 진행해야
  // 사용자가 필터 조건 만족하는 더 많은 책을 볼 수 있음 → enabled 는 hasNextPage 만 본다.
  const setSentinel = useInfiniteScroll({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) fetchNextPage();
    },
    enabled: hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
  });

  const pageError = isError ? shelfError(error) : null;
  const nextPageError = isFetchNextPageError ? shelfError(error) : null;

  const closeModal = () => {
    setEditing(null);
    update.reset();
    remove.reset();
  };

  return (
    <article aria-busy={isLoading}>
      <section
        aria-labelledby="hero-title"
        className="mx-auto w-full max-w-7xl px-6 pb-10 pt-12 md:px-10 md:pb-14 md:pt-20"
      >
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 md:col-span-3">
            <p className="smallcaps mb-3 text-[12px]">The Library</p>
            <p className="essay-kr text-body max-w-[22ch] text-[14px] leading-snug">
              한 사람이 모은 책장은, 결국 그 사람의 가장 정직한 자서전이다.
            </p>
          </div>

          <div className="col-span-12 md:col-span-9">
            <h1
              id="hero-title"
              className="font-display text-[11vw] font-black leading-[1.02] tracking-tightest md:text-[4.5rem] lg:text-[5.5rem]"
              style={{ letterSpacing: '-0.02em' }}
            >
              나의 도서관<span className="text-wine">.</span>
            </h1>
            <div className="mt-8 grid grid-cols-12 gap-6 md:gap-10">
              <p className="essay-kr text-body dropcap col-span-12 text-[15.5px] leading-[1.78] md:col-span-7 md:text-[16px]">
                이곳은 내가 읽은 책, 읽고 있는 책, 그리고 언젠가 읽을 책의 목록이다. 누군가에게는 한
                권의 베스트셀러일 뿐이지만, 나에게는 그 책을 읽던 계절과 함께 놓이는 기억이 된다.
              </p>
              <aside className="col-span-12 md:col-span-5">
                <div className="hairline mb-4" />
                <p className="smallcaps mb-3 text-[11px]">This Season</p>
                <ul className="text-body space-y-2 font-serif text-[14px]">
                  <li className="flex items-baseline justify-between gap-4">
                    <span>읽은 책</span>
                    <span className="text-meta num-display">{counts.READ}권</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4">
                    <span>읽는 중</span>
                    <span className="text-meta num-display">{counts.READING}권</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4">
                    <span>읽고 싶은</span>
                    <span className="text-meta num-display">{counts.WANT}권</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-t border-rule-2 pt-2 text-meta">
                    <span>전체</span>
                    <span className="text-meta num-display" data-testid="shelf-total-count">
                      {total}권
                    </span>
                  </li>
                </ul>
                <div className="hairline mt-5" />
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section
        id="library"
        aria-labelledby="library-title"
        className="mx-auto w-full max-w-7xl px-6 pb-16 md:px-10"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 md:mb-10">
          <div>
            <p className="smallcaps mb-2 text-[12px]">The Collection</p>
            <h2
              id="library-title"
              className="font-display text-3xl font-black leading-[1.02] tracking-tightest md:text-5xl"
            >
              서가의 기록<span className="text-wine">.</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-5">
            <FilterTabs active={filter} onChange={setFilter} counts={counts} />
            <RatingFilter value={minRating} onChange={setMinRating} />
            <SortControl value={sort} onChange={handleSortChange} />
          </div>
        </div>

        {pageError ? (
          <p role="alert" className="text-destructive text-sm">
            {pageError}
          </p>
        ) : null}

        {isLoading ? (
          <div
            role="status"
            aria-busy="true"
            aria-label="서가를 펼치는 중"
            className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-14 lg:grid-cols-4"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        ) : pageError ? null : visible.length === 0 ? (
          <EmptyShelf filter={filter} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-14 lg:grid-cols-4">
              {visible.map((shelf) => (
                <BookCard key={shelf.id} shelf={shelf} onEdit={setEditing} />
              ))}
            </div>

            {/* sentinel + 더 가져오는 중 / 다 봄 / 다시 시도 status row. */}
            <div
              ref={setSentinel}
              data-testid="shelf-sentinel"
              className="mt-12 flex items-center justify-center"
              aria-live="polite"
            >
              {isFetchingNextPage ? (
                <p className="font-serif text-sm text-meta">더 불러오는 중…</p>
              ) : nextPageError ? (
                <div className="flex flex-col items-center gap-2">
                  <p role="alert" className="font-serif text-sm text-destructive">
                    {nextPageError}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded-sm border border-rule-2 px-3 py-1 font-serif text-xs text-meta transition hover:border-foreground hover:text-ink"
                  >
                    다시 시도
                  </button>
                </div>
              ) : !hasNextPage && shelves.length >= PAGE_SIZE ? (
                <p className="essay-kr text-[13px] text-meta">모든 책을 봤어요.</p>
              ) : null}
            </div>
          </>
        )}
      </section>

      <EditShelfModal
        open={editing !== null}
        shelf={editing}
        saving={update.isPending}
        deleting={remove.isPending}
        errorMessage={
          update.isError
            ? shelfError(update.error)
            : remove.isError
              ? shelfError(remove.error)
              : null
        }
        onClose={closeModal}
        onSave={(changes) => {
          if (!editing) return;
          update.mutate({ bookId: editing.bookId, ...changes }, { onSuccess: closeModal });
        }}
        onDelete={() => {
          if (!editing) return;
          remove.mutate({ bookId: editing.bookId }, { onSuccess: closeModal });
        }}
      />
    </article>
  );
};

/**
 * 서재 status별 카운트 — All/READ/READING/WANT.
 *
 * @param {Shelf[]} shelves
 * @returns {Record<FilterKey, number>}
 */
const countByStatus = (shelves) => {
  const base = { ALL: shelves.length, WANT: 0, READING: 0, READ: 0 };
  for (const s of shelves) {
    if (s.status in base) base[s.status] += 1;
  }
  return base;
};
