import { useMemo, useState } from 'react';

import { BookCard } from '../components/BookCard.jsx';
import { EditShelfModal } from '../components/EditShelfModal.jsx';
import { EmptyShelf } from '../components/EmptyShelf.jsx';
import { FilterTabs } from '../components/FilterTabs.jsx';
import { useMyShelves, useRemoveShelf, useUpdateShelf } from '../hooks/useShelves.js';

/** @typedef {import('../components/BookCard.jsx').Shelf} Shelf */
/** @typedef {'ALL' | 'WANT' | 'READING' | 'READ'} FilterKey */

/**
 * 내 서재 — editorial polish round 2 시안 1:1.
 *
 * 섹션:
 *  1) Hero — "나의 도서관." + 이번 시즌 카운트
 *  2) Filter tabs — All / Read / Reading / Wishlist
 *  3) Library grid — BookCard
 *  4) (옵션) Empty placeholder
 *  5) 책 클릭 → EditShelfModal (PATCH / DELETE)
 */
export const HomePage = () => {
  const { data, isLoading, isError, error } = useMyShelves();
  const update = useUpdateShelf();
  const remove = useRemoveShelf();

  const [filter, setFilter] = useState(/** @type {FilterKey} */ ('ALL'));
  const [editing, setEditing] = useState(/** @type {Shelf | null} */ (null));

  const shelves = useMemo(() => data?.shelves ?? [], [data]);

  const counts = useMemo(() => countByStatus(shelves), [shelves]);
  const visible = useMemo(
    () => (filter === 'ALL' ? shelves : shelves.filter((s) => s.status === filter)),
    [shelves, filter],
  );

  const pageError = isError ? toFriendlyError(error) : null;

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
          <FilterTabs active={filter} onChange={setFilter} counts={counts} />
        </div>

        {pageError ? (
          <p role="alert" className="text-destructive text-sm">
            {pageError}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-meta essay-kr text-[14px]">서가를 펼치는 중…</p>
        ) : pageError ? null : visible.length === 0 ? (
          <EmptyShelf filter={filter} />
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-14 lg:grid-cols-4">
            {visible.map((shelf) => (
              <BookCard key={shelf.id} shelf={shelf} onEdit={setEditing} />
            ))}
          </div>
        )}
      </section>

      <EditShelfModal
        open={editing !== null}
        shelf={editing}
        saving={update.isPending}
        deleting={remove.isPending}
        errorMessage={
          update.isError
            ? toFriendlyError(update.error)
            : remove.isError
              ? toFriendlyError(remove.error)
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

/**
 * 서버 에러 → 친절한 한국어 메시지.
 *
 * @param {unknown} err
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 404) return '서재에서 그 책을 찾을 수 없습니다.';
  if (status === 422) return '이미 서재에 꽂혀 있는 책입니다.';
  if (typeof status === 'number' && status >= 500)
    return '지금은 서재를 펼칠 수 없습니다. 잠시 후 다시 시도해 주세요.';
  return '서재를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
};
