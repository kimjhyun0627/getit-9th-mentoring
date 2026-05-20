import { useEffect, useRef, useState } from 'react';

/**
 * 카드 이동 드롭다운 메뉴 (드래그 미지원 MVP).
 * 같은 컬럼 안에서의 reorder 는 KanbanCard 의 ReorderButtons 가 담당 (#214).
 *
 * @param {{
 *   cardTitle: string;
 *   otherColumns: Array<{ id: string; name: string }>;
 *   onMove: (id: string) => void;
 * }} props
 */
export const MoveMenu = ({ cardTitle, otherColumns, onMove }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const itemRefs = useRef(/** @type {Array<HTMLButtonElement | null>} */ ([]));

  // 메뉴 닫혔다 열릴 때 활성 인덱스 0으로 초기화 + ref 슬롯 정리
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      itemRefs.current = itemRefs.current.slice(0, otherColumns.length);
    }
  }, [open, otherColumns.length]);

  // 열린 동안 outside click 닫기
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 활성 인덱스 변경 시 해당 menuitem 으로 focus 이동 — ARIA menu 패턴
  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  /** @param {import('react').KeyboardEvent<HTMLUListElement>} e */
  const handleMenuKeyDown = (e) => {
    const last = otherColumns.length - 1;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i >= last ? 0 : i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? last : i - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(last);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  /** @param {import('react').KeyboardEvent<HTMLButtonElement>} e */
  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        setOpen(true);
      }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${cardTitle} 이동할 컬럼 선택`}
        title="다른 컬럼으로 이동"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-6 items-center justify-center gap-0.5 rounded-md border border-hairline px-1.5 text-[10px] font-medium text-muted-foreground transition hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <span>이동</span>
        <svg
          aria-hidden="true"
          className="h-2.5 w-2.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <ul
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-md border border-hairline bg-popover py-1 text-sm shadow-md"
        >
          {otherColumns.map((col, idx) => (
            <li key={col.id} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                role="menuitem"
                type="button"
                tabIndex={activeIndex === idx ? 0 : -1}
                aria-label={`${col.name} 컬럼으로 이동`}
                onClick={() => {
                  setOpen(false);
                  onMove(col.id);
                }}
                onFocus={() => setActiveIndex(idx)}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground transition hover:bg-foreground/[0.05]"
              >
                {col.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
