import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';

import { AssigneePicker } from './AssigneePicker.jsx';

/**
 * 카드 편집 모달 (#198 + #200).
 *
 * - 제목 (1-200자, 필수) / 설명 (0-5000자, 선택) / 담당자 (멤버 중 1명 또는 미지정)
 * - 저장 시 변경된 필드만 onSave 로 (parent 가 PATCH /cards/:id 호출)
 * - 카운터 + 검증 메시지
 *
 * @param {{
 *   open: boolean;
 *   card: {
 *     id: string;
 *     title: string;
 *     description?: string | null;
 *     assigneeId?: string | null;
 *   } | null;
 *   members: Array<{ userId: string; name?: string | null }>;
 *   onClose: () => void;
 *   onSave: (
 *     cardId: string,
 *     changes: { title?: string; description?: string | null; assigneeId?: string | null },
 *   ) => Promise<void> | void;
 *   submitting?: boolean;
 *   serverError?: string | null;
 * }} props
 */
export const CardEditModal = ({
  open,
  card,
  members,
  onClose,
  onSave,
  submitting = false,
  serverError = null,
}) => {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(/** @type {string | null} */ (null));
  const [titleErr, setTitleErr] = useState(/** @type {string | null} */ (null));

  // open + card 변경 시 모달 동기화
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal?.();
    if (!open && node.open) node.close?.();
  }, [open]);

  useEffect(() => {
    if (!open || !card) return;
    setTitle(card.title ?? '');
    setDescription(card.description ?? '');
    setAssigneeId(card.assigneeId ?? null);
    setTitleErr(null);
  }, [open, card]);

  if (!card) return null;

  const trimmedTitle = title.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trimmedTitle) {
      setTitleErr('카드 제목을 적어줘');
      return;
    }
    if (trimmedTitle.length > 200) {
      setTitleErr('카드 제목은 200자 이내로 적어줘');
      return;
    }
    /** @type {{ title?: string; description?: string | null; assigneeId?: string | null }} */
    const changes = {};
    if (trimmedTitle !== card.title) changes.title = trimmedTitle;
    const nextDesc = description.length === 0 ? null : description;
    if (nextDesc !== (card.description ?? null)) changes.description = nextDesc;
    if (assigneeId !== (card.assigneeId ?? null)) changes.assigneeId = assigneeId;
    if (Object.keys(changes).length === 0) {
      // 변경 없음 — 그냥 닫기 (#198 UX: no-op 저장도 닫는다)
      onClose();
      return;
    }
    await onSave(card.id, changes);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="card-edit-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        'mx-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-card p-0',
        'text-foreground backdrop:bg-foreground/40 backdrop:backdrop-blur-sm',
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 sm:p-8">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-accent" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Edit Card
            </span>
          </div>
          <h2 id="card-edit-title" className="text-xl font-semibold tracking-tight">
            카드 편집
          </h2>
        </header>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">제목</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleErr) setTitleErr(null);
              }}
              maxLength={200}
              aria-invalid={Boolean(titleErr) || undefined}
              aria-label="카드 제목"
              className={cn(
                'h-10 rounded-md border border-hairline bg-background px-3 text-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                titleErr && 'border-destructive focus-visible:ring-destructive',
              )}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              {titleErr ? (
                <span role="alert" className="text-destructive">
                  {titleErr}
                </span>
              ) : (
                <span aria-hidden="true">&nbsp;</span>
              )}
              <span data-testid="title-counter">{trimmedTitle.length}/200</span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">설명 (선택)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="카드의 맥락이나 todo 를 적어두세요…"
              aria-label="카드 설명"
              className={cn(
                'min-h-[6rem] resize-y rounded-md border border-hairline bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            />
            <div className="text-right text-[11px] text-muted-foreground">
              <span data-testid="description-counter">{description.length}/5000</span>
            </div>
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-edit-assignee" className="text-sm font-medium">
              담당자
            </label>
            <AssigneePicker
              id="card-edit-assignee"
              members={members}
              value={assigneeId}
              onChange={setAssigneeId}
              disabled={submitting}
            />
          </div>
        </div>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
