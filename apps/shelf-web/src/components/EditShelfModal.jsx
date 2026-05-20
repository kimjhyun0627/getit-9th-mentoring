import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';

import { StarRating } from './StarRating.jsx';

/** @typedef {import('./BookCard.jsx').Shelf} Shelf */

const STATUS_OPTIONS = /** @type {const} */ ([
  { value: 'WANT', label: '읽고 싶은' },
  { value: 'READING', label: '읽는 중' },
  { value: 'READ', label: '읽은 책' },
]);

/**
 * 서재 편집 모달 — 상태/별점/감상평 PATCH + 삭제.
 *
 * - role=dialog, aria-modal=true
 * - Esc / 백드롭 클릭 / Cancel → onClose
 * - 저장 → onSave({ status, rating, review })
 * - 삭제 → onDelete (확인 한 단계)
 *
 * @param {{
 *   open: boolean;
 *   shelf: Shelf | null;
 *   saving?: boolean;
 *   deleting?: boolean;
 *   errorMessage?: string | null;
 *   onClose: () => void;
 *   onSave: (changes: { status: Shelf['status']; rating: number | null; review: string | null }) => void;
 *   onDelete: () => void;
 * }} props
 */
export const EditShelfModal = ({
  open,
  shelf,
  saving = false,
  deleting = false,
  errorMessage = null,
  onClose,
  onSave,
  onDelete,
}) => {
  const titleId = useId();
  const reviewId = useId();
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const [status, setStatus] = useState(/** @type {Shelf['status']} */ ('WANT'));
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!shelf) return;
    setStatus(shelf.status);
    setRating(shelf.rating ?? 0);
    setReview(shelf.review ?? '');
    setConfirmDelete(false);
  }, [shelf]);

  // Esc 닫기 + Tab 포커스 트랩 + body scroll lock + 이전 포커스 복귀 (#257).
  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    /** @type {HTMLElement | null} */
    const previouslyFocused = /** @type {any} */ (document.activeElement);

    // 1) body scroll lock — 모바일 safari 위해 padding 보정도 함께.
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // 2) 첫 포커스 — close 버튼 대신 dialog 자체에 옮겨 두면 스크린리더가 제목부터 읽는다.
    dialog?.focus();

    // 3) keydown: Esc 닫기 + Tab 트랩.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusables = /** @type {HTMLElement[]} */ (
        Array.from(
          dialog.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
      );
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      // 4) 이전 포커스 복귀 — 키보드 사용자가 어디서 모달을 열었는지 잊지 않게.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open || !shelf) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({
      status,
      rating: rating > 0 ? rating : null,
      review: review.trim() ? review.trim() : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="닫기"
        className="fixed inset-0 z-0 cursor-default bg-black/60"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-xl bg-card p-6 shadow-2xl md:p-8"
        style={{ border: '1px solid var(--rule-2)' }}
      >
        <p className="smallcaps mb-2 text-[11px]">A note in the margin</p>
        <h2
          id={titleId}
          className="font-display tracking-hero text-2xl font-black leading-tight md:text-3xl"
        >
          {shelf.book.title}
        </h2>
        {shelf.book.author ? (
          <p className="body-kr text-meta mt-1 text-[13px]">{shelf.book.author}</p>
        ) : null}

        <div className="hairline my-5" />

        <form onSubmit={submit} className="flex flex-col gap-5" aria-label="서재 편집">
          <fieldset>
            <legend className="smallcaps mb-3 text-[11px]">Status · 상태</legend>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'cursor-pointer px-3 py-1.5 text-[12.5px] font-serif transition',
                    status === opt.value
                      ? 'bg-foreground text-background'
                      : 'text-body hover:bg-paper-2',
                  )}
                  style={{ border: '1px solid var(--rule-2)' }}
                >
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={() => setStatus(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="smallcaps mb-3 text-[11px]">Rating · 별점</p>
            <StarRating value={rating} onChange={setRating} ariaLabel="별점 선택" />
          </div>

          <div>
            <label htmlFor={reviewId} className="smallcaps mb-3 block text-[11px]">
              Review · 한 줄 감상
            </label>
            <textarea
              id={reviewId}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="이 책을 펼치던 계절을 한 줄로 적어 보세요."
              className="essay-kr text-body w-full resize-none bg-transparent p-3 text-[14px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ border: '1px solid var(--rule-1)' }}
            />
            <p className="text-meta mt-1 text-right text-[11px] num-display">
              {review.length} / 5000
            </p>
          </div>

          {errorMessage ? (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage}
            </p>
          ) : null}

          <div className="hairline" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {confirmDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="text-destructive text-[12.5px] font-serif underline-offset-4 hover:underline disabled:opacity-60"
                >
                  {deleting ? '덜어내는 중…' : '정말 덜어내기'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-meta text-[12.5px] font-serif underline-offset-4 hover:underline"
                >
                  서가에서 덜어내기
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-meta text-[13px] font-serif underline-offset-4 hover:underline"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background px-4 py-2 text-[13px] font-serif transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
