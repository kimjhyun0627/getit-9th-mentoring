import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { BookCardSkeleton } from '../components/BookCard.jsx';
import { StarRating } from '../components/StarRating.jsx';
import { api } from '../lib/api.js';

/**
 * 다른 유저 서재 공개 보기 — /u/:userId (#292).
 *
 * - read-only. 별점/리뷰/상태 표시. 본인 식별 정보(이메일 등) 노출 X.
 * - 비로그인이어도 조회 가능 (BE 가 requireAuth 전에 라우트 노출).
 * - 책 카드 클릭 → /book/:isbn (#201).
 *
 * 현재 정책: "모두 공개". 비공개 토글은 후속 PR.
 */
export const UserShelfPage = () => {
  const { userId = '' } = useParams();

  const shelvesQuery = useQuery({
    queryKey: ['user-shelves', userId],
    queryFn: async () => {
      const res = await api.listUserShelves(userId, { pageSize: 100 });
      return res.data;
    },
    enabled: userId.length > 0,
    retry: false,
  });

  const shelves = shelvesQuery.data?.shelves ?? [];
  const total = shelvesQuery.data?.pagination?.total ?? 0;

  return (
    <article
      aria-busy={shelvesQuery.isLoading}
      className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10"
    >
      <section aria-labelledby="user-shelf-title" className="mb-10 md:mb-14">
        <p className="smallcaps mb-2 text-[12px]">A Library Of</p>
        <h1
          id="user-shelf-title"
          className="font-display text-[10vw] font-black leading-[1.02] tracking-tightest md:text-[4rem]"
        >
          @{userId}
          <span className="text-wine">.</span>
        </h1>
        <p className="essay-kr text-body mt-4 max-w-[40ch] text-[14px]">
          공개로 열려 있는 서재예요. 마음에 드는 책을 클릭하면 내 서재에도 담을 수 있어요.
        </p>
        <p className="smallcaps text-meta mt-3 text-[11px]">총 {total}권</p>
      </section>

      {shelvesQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-14 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      ) : shelvesQuery.isError ? (
        <p role="alert" className="text-destructive font-serif">
          {toFriendlyError(shelvesQuery.error)}
        </p>
      ) : shelves.length === 0 ? (
        <p className="text-meta essay-kr text-[14px]">아직 담긴 책이 없어요.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-14 lg:grid-cols-4">
          {shelves.map((s) => (
            <li key={s.id}>
              <PublicBookCard shelf={s} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

/**
 * 공개 서재용 책 카드 — read-only. /book/:isbn 으로 이동.
 *
 * @param {{ shelf: any }} props
 */
const PublicBookCard = ({ shelf }) => {
  const { book, status, rating, review } = shelf;
  if (!book) return null;
  return (
    <Link
      to={`/book/${encodeURIComponent(book.isbn)}`}
      className="book-card block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)]"
    >
      <div className="cover relative w-full">
        {book.coverUrl ? (
          <div
            className="cover-inner"
            style={{ backgroundImage: `url("${book.coverUrl}")` }}
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 flex items-end bg-paper-2 p-3">
            <p className="font-display text-sm font-black leading-tight text-ink-strong">
              {book.title}
            </p>
          </div>
        )}
      </div>
      <p className="smallcaps mt-3 text-[10px]">{statusLabel(status)}</p>
      <h3 className="font-display tracking-hero mt-1 text-base font-bold leading-tight md:text-lg">
        {book.title}
      </h3>
      {book.author ? <p className="body-kr text-meta text-[12px]">{book.author}</p> : null}
      {review ? (
        <p className="essay-kr pullquote text-body mt-2 line-clamp-3 text-[12.5px] leading-snug">
          {review}
        </p>
      ) : null}
      <div className="mt-2">
        <StarRating value={rating} readonly />
      </div>
    </Link>
  );
};

const statusLabel = (s) => (s === 'READ' ? '읽은 책' : s === 'READING' ? '읽는 중' : '읽고 싶은');

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  if (status === 400) return '잘못된 사용자 주소예요.';
  if (typeof status === 'number' && status >= 500)
    return '지금은 서재를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.';
  return '서재를 불러오지 못했어요.';
};
