import { cn } from '../lib/cn.js';
import { upscaleCoverUrl } from '../lib/coverUrl.js';

import { StarRating } from './StarRating.jsx';

/**
 * BookCardSkeleton — 로딩 중 placeholder. 카드 1장은 presentational.
 *
 * SR announce 는 부모 컨테이너가 `role="status" aria-busy="true"` 로 한 번만 흘려야
 * 깜빡임 없이 한 차례만 읽힌다. 따라서 카드 본체는 `aria-hidden="true"`.
 * shimmer 는 prefers-reduced-motion 시 정지 (CSS @media).
 *
 * @param {{ className?: string }} props
 */
export const BookCardSkeleton = ({ className }) => (
  <div aria-hidden="true" className={cn('book-card-skeleton block w-full', className)}>
    <div className="cover relative w-full bg-paper-2 book-skeleton-shimmer" />
    <div className="mt-3 h-2 w-16 bg-paper-2 book-skeleton-shimmer" />
    <div className="mt-2 h-4 w-3/4 bg-paper-2 book-skeleton-shimmer" />
    <div className="mt-1 h-3 w-1/2 bg-paper-2 book-skeleton-shimmer" />
  </div>
);

/**
 * @typedef {object} Shelf
 * @property {string} id 서재 row id
 * @property {string} bookId 책 id (BE의 BookShelf.bookId)
 * @property {'WANT'|'READING'|'READ'} status 책 상태
 * @property {number|null} rating 별점 (0~5, null 가능)
 * @property {string|null} review 감상평
 * @property {string} addedAt 추가 시각 (ISO)
 * @property {string|null} completedAt 완독 시각 (ISO, READ일 때만)
 * @property {{ id: string, isbn: string, title: string, author: string|null, coverUrl: string|null }} book 책 메타
 */

/**
 * Status → 한국어 라벨 + 매거진 메타.
 *
 * @param {Shelf['status']} status
 */
const statusLabel = (status) => {
  if (status === 'READ') return '읽은 책';
  if (status === 'READING') return '읽는 중';
  return '읽고 싶은';
};

/**
 * 책 카드 — editorial 매거진 그리드 한 칸. 클릭 → onEdit 콜백.
 * 표지가 없으면 그라데이션 fallback + 제목 typography.
 *
 * @param {{
 *   shelf: Shelf;
 *   onEdit: (shelf: Shelf) => void;
 *   className?: string;
 * }} props
 */
export const BookCard = ({ shelf, onEdit, className }) => {
  const { book, status, rating, review, addedAt } = shelf;
  const dateLabel = formatYearMonth(addedAt);
  const meta = status === 'READING' ? statusLabel(status) : `${statusLabel(status)} · ${dateLabel}`;
  // #474 — Kakao R120x174 저화질 URL 이 캐시에서 흘러오는 경우 클라이언트에서도 hi-res 로 방어 변환.
  const cover = upscaleCoverUrl(book.coverUrl);
  const coverStyle = cover
    ? { backgroundImage: `url("${cover}")` }
    : { backgroundImage: fallbackGradient(book.title ?? book.isbn) };

  return (
    <button
      type="button"
      className={cn(
        'book-card group block w-full text-left transition',
        'hover:[&_.cover-inner]:scale-[1.015]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-[var(--wine,#7a1a2a)] focus-visible:ring-offset-[var(--paper-1)]',
        className,
      )}
      onClick={() => onEdit(shelf)}
      aria-label={`${book.title} 자세히 보기`}
    >
      <div className="cover relative w-full">
        <div
          className="cover-inner transition-transform duration-300 ease-out"
          style={coverStyle}
          aria-hidden="true"
        />
        {!book.coverUrl ? (
          // 표지 없음 fallback (#243):
          // mix-blend-difference 는 그라데이션 hue 에 따라 반전 결과가 흐려질 수 있어
          // 가독성 보강을 위해 반투명 잉크 스크림 + 흰 글자 + soft drop-shadow 로 교체.
          // dark/light 양쪽에서 본문 대비 4.5:1 이상 유지.
          <div className="absolute inset-0 z-10 flex flex-col justify-end p-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
            />
            <p
              className="relative font-display text-base font-black leading-[1.05] tracking-tightest text-white"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
            >
              {book.title}
            </p>
          </div>
        ) : null}
      </div>
      <p className="smallcaps mt-3 text-[10px]">{meta}</p>
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
    </button>
  );
};

/**
 * ISO datetime → "2026.04" 형식. 잘못된 입력이면 빈 문자열.
 *
 * @param {string} iso
 */
const formatYearMonth = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}.${m}`;
};

/**
 * 제목 기반 deterministic 그라데이션 — 표지 없는 책의 fallback.
 *
 * @param {string} seed
 */
const fallbackGradient = (seed = '') => {
  const hue = Math.abs(hash(seed)) % 360;
  return `linear-gradient(160deg, hsl(${hue} 22% 28%) 0%, hsl(${(hue + 24) % 360} 18% 18%) 60%, hsl(${(hue + 48) % 360} 14% 10%) 100%)`;
};

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
};
