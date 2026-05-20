import { useEffect, useRef } from 'react';

import { cn } from '../lib/cn.js';

/**
 * 단순 confirm/cancel 다이얼로그 (native <dialog>).
 * - destructive: 확인 버튼이 destructive 컬러
 * - Escape / 백드롭 → onClose
 * - 카드 삭제 (#219), 컬럼 삭제 (#206), 프로젝트 삭제 (#208) 공통 사용.
 *
 * @param {{
 *   open: boolean;
 *   title: string;
 *   description?: string | null;
 *   confirmLabel?: string;
 *   cancelLabel?: string;
 *   destructive?: boolean;
 *   busy?: boolean;
 *   onConfirm: () => void;
 *   onClose: () => void;
 * }} props
 */
export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}) => {
  const ref = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal?.();
    if (!open && node.open) node.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="confirm-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        'mx-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-card p-0',
        'text-foreground backdrop:bg-foreground/40 backdrop:backdrop-blur-sm',
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <header className="flex flex-col gap-1">
          <h2 id="confirm-title" className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </header>
        <div className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
              destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {busy ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};
