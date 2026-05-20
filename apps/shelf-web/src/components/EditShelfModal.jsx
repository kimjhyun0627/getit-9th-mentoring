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

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
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
        aria-label="모달 닫기"
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
              placeholder="이 책을 펼치던 계절은 어떤 색이었어?"
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
                  {deleting ? '제거 중…' : '정말 제거하기'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-meta text-[12.5px] font-serif underline-offset-4 hover:underline"
                >
                  서재에서 제거
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
