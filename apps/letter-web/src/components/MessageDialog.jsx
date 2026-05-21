import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/cn.js';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import { useDialogFocus } from '../lib/useDialogFocus.js';

/**
 * ComposeModal / EditModal 공통 dialog shell.
 *
 * 책임:
 * - createPortal(document.body) — ancestor CSS containing-block swap 회피 (#511)
 * - 중앙 정렬 + backdrop blur + dialog 카드 스타일 (#354)
 * - 모바일 viewport 넘침 가드 (vh + dvh 듀얼, #280)
 * - Escape 키 닫기
 * - body scroll lock + ancestor inert (#464)
 * - 초기 focus + Tab trap + 복원 (useDialogFocus)
 * - SSR/jsdom 가드 (document 없으면 null)
 *
 * 콘텐츠 (header + form) 는 children 으로 받는다.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   headingId: string;
 *   backdropTestId: string;
 *   initialSelector: string;
 *   eyebrow: string;
 *   title: string;
 *   subtitle: string;
 *   extraSubtitle?: string;
 *   children: import('react').ReactNode;
 * }} props
 */
export const MessageDialog = ({
  open,
  onClose,
  headingId,
  backdropTestId,
  initialSelector,
  eyebrow,
  title,
  subtitle,
  extraSubtitle,
  children,
}) => {
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // Escape 키 → 닫기. open 일 때만 등록.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 초기 포커스 + Tab 트랩 + 복원.
  useDialogFocus({ open, ref: dialogRef, initialSelector });
  // body scroll lock + dialog ancestor 형제만 inert (모달 트리는 살아있음, #464).
  useBodyScrollLock(open, dialogRef);

  if (!open) return null;
  // SSR / jsdom 가드 — document 없으면 portal mount 불가.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 sm:py-8">
      {/* Backdrop — Escape + 외부 클릭 모두 닫기. a11y 친화로 button 분리. */}
      <button
        type="button"
        data-testid={backdropTestId}
        aria-label="모달 닫기 (배경)"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm dark:bg-black/60"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn(
          'relative w-full max-w-md rounded-3xl bg-cream p-6 shadow-2xl ring-1 ring-ink/10',
          'max-h-[calc(100vh-3rem)] max-h-[calc(100dvh-3rem)] overflow-y-auto',
          'sm:p-8 dark:bg-mocha2 dark:ring-beige/10',
          'motion-safe:animate-[popin_180ms_cubic-bezier(0.2,0.7,0.2,1)]',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="모달 닫기"
          className="absolute right-4 top-4 rounded-full bg-white/70 px-2 py-1 text-sm text-ink shadow-sm transition hover:bg-white dark:bg-mocha3/60 dark:text-beige dark:hover:bg-mocha3"
        >
          ✕
        </button>

        <header className="mb-5 flex flex-col gap-1">
          <p className="font-pen text-3xl leading-none text-sageDk dark:text-sageW">{eyebrow}</p>
          <h2
            id={headingId}
            className="font-sans text-2xl font-bold tracking-tight text-ink dark:text-beige"
          >
            {title}
          </h2>
          <p className="font-hand text-base text-ink2 dark:text-beige2">{subtitle}</p>
          {extraSubtitle ? (
            <p className="font-hand text-sm text-sageDk dark:text-sageW">{extraSubtitle}</p>
          ) : null}
        </header>

        {children}
      </div>
    </div>,
    document.body,
  );
};
