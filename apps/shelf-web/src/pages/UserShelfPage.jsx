import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BookCardSkeleton } from '../components/BookCard.jsx';
import { StarRating } from '../components/StarRating.jsx';
import { api } from '../lib/api.js';
import { upscaleCoverUrl } from '../lib/coverUrl.js';
import { userShelfError } from '../lib/error-messages.js';

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

  // #475 — 공개 서재 페이지는 검색엔진 인덱싱 차단.
  // SPA index.html 에 전역으로 두면 다른 라우트까지 noindex 되므로 라우트별 동적 주입.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.parentNode?.removeChild(meta);
    };
  }, []);

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
  // #565 — BE 가 BookShelf.userNickname 스냅샷 (#564) 을 nickname 으로 노출.
  // 누락/공백 이면 userId 앞 8자 + 말줄임 으로 fallback (CUID 전체 노출 회피).
  const rawNickname = shelvesQuery.data?.nickname;
  const nickname =
    typeof rawNickname === 'string' && rawNickname.trim().length > 0 ? rawNickname.trim() : null;
  const displayName = nickname ?? `@${userId.slice(0, 8)}…`;

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
          {displayName}
          <span className="text-wine">.</span>
        </h1>
        <p className="essay-kr text-body mt-4 max-w-[40ch] text-[14px]">
          누구에게나 열려 있는 서가입니다. 마음에 닿는 책을 누르면, 그 책의 상세로 이어집니다.
        </p>
        <p className="smallcaps text-meta mt-3 text-[11px]">총 {total}권 · 공개 서가</p>
      </section>

      {shelvesQuery.isLoading ? (
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
      ) : shelvesQuery.isError ? (
        <p role="alert" className="text-destructive font-serif">
          {userShelfError(shelvesQuery.error)}
        </p>
      ) : shelves.length === 0 ? (
        <p className="text-meta essay-kr text-[14px]">아직 첫 책이 꽂히지 않았습니다.</p>
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
  // #507 — Kakao thumb 403 회피. 캐시 stale row 도 fname 원본 URL 로 클라 측에서 방어 변환.
  const cover = upscaleCoverUrl(book.coverUrl);
  return (
    <Link
      to={`/book/${encodeURIComponent(book.isbn)}`}
      className="book-card block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)]"
    >
      <div className="cover relative w-full">
        {cover ? (
          <div
            className="cover-inner"
            style={{ backgroundImage: `url("${cover}")` }}
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
