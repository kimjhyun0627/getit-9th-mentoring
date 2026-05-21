import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/cn.js';

/**
 * Playful 톤 confirm 다이얼로그 — #433.
 *
 * window.confirm 대체용. ApplicantsPage (노쇼 신고) + PostDetailPage.owner (모집 종료).
 *
 * 기능:
 *  - role="alertdialog" + aria-labelledby
 *  - ESC 키 닫기 (onClose)
 *  - 백드롭 클릭 닫기 (data-testid="confirm-backdrop")
 *  - 포커스 트랩: Tab/Shift+Tab 이 dialog 내부 (cancel/confirm) 만 순환
 *  - destructive 시 cancel 이 초기 포커스 (안전한 기본값)
 *  - busy=true: 두 버튼 disabled + "처리 중…"
 *  - cream/mocha + amber accent + 다크 (slate-900/amber-100) 지원
 *
 * native <dialog> 대신 portal + role=alertdialog 사용 — jsdom 의 <dialog> showModal
 * polyfill 부재 + Tailwind backdrop 토큰 + Playful rounded-3xl/dashed 톤이 필요해서.
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
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const confirmRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  // ESC 키 → onClose
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // 초기 포커스 — destructive 면 cancel, 아니면 confirm
  useEffect(() => {
    if (!open) return;
    const node = destructive ? cancelRef.current : confirmRef.current;
    node?.focus();
  }, [open, destructive]);

  if (!open) return null;

  const handleBackdropClick = (e) => {
    // Only close when the click landed on the backdrop element itself
    if (e.target === e.currentTarget) onClose();
  };

  // 포커스 트랩 — Tab/Shift+Tab 이 cancel ↔ confirm 만 순환
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const cancel = cancelRef.current;
    const confirm = confirmRef.current;
    if (!cancel || !confirm) return;
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === cancel) {
        e.preventDefault();
        confirm.focus();
      }
    } else if (active === confirm) {
      e.preventDefault();
      cancel.focus();
    }
  };

  const node = (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      data-testid="confirm-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-modal="true"
        onKeyDown={handleKeyDown}
        className={cn(
          'w-[min(28rem,calc(100vw-2rem))]',
          'rounded-3xl border-2 border-dashed border-amber-400/70 dark:border-amber-300/40',
          'bg-amber-50 dark:bg-slate-900',
          'shadow-2xl shadow-rose-200/50 dark:shadow-black/60',
          'p-6 sm:p-7',
          'font-round',
        )}
      >
        <h2
          id={titleId}
          className="font-display font-extrabold text-xl text-slate-900 dark:text-amber-100"
        >
          {title}
        </h2>
        {description ? (
          <p
            id={descriptionId}
            className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
          >
            {description}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/10 dark:ring-white/15 text-slate-700 dark:text-slate-100 px-4 py-2 text-sm font-display font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'inline-flex items-center gap-1 rounded-full text-white px-5 py-2 text-sm font-display font-bold shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50',
              destructive
                ? 'bg-rose-500 hover:bg-rose-600 focus-visible:ring-rose-400'
                : 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400',
            )}
          >
            {busy ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  // SSR safe: document 없으면 그냥 인라인 렌더 (테스트 환경에서도 portal 잡힘)
  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};
