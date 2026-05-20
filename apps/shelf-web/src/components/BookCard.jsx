import { cn } from '../lib/cn.js';

import { StarRating } from './StarRating.jsx';

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
  const coverStyle = book.coverUrl
    ? { backgroundImage: `url("${book.coverUrl}")` }
    : { backgroundImage: fallbackGradient(book.title ?? book.isbn) };

  return (
    <button
      type="button"
      className={cn('book-card group block w-full text-left', className)}
      onClick={() => onEdit(shelf)}
      aria-label={`${book.title} 편집`}
    >
      <div className="cover w-full">
        <div className="cover-inner" style={coverStyle} aria-hidden="true" />
        {!book.coverUrl ? (
          <div className="absolute inset-0 z-10 flex flex-col justify-end p-4">
            <p className="font-display text-base font-black leading-[1.05] tracking-tightest text-paper-1 mix-blend-difference">
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
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
