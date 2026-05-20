import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';

import { MemberAvatar } from './MemberAvatar.jsx';

/**
 * 단일 칸반 카드.
 * - Doing 컬럼: 좌측 인디고 인디케이터 (`data-testid="doing-indicator"`)
 * - Done 컬럼: 제목 line-through + 흐리게
 * - 우측: 이동 드롭다운(메뉴) + 삭제 버튼
 *
 * @param {{
 *   card: {
 *     id: string;
 *     columnId: string;
 *     title: string;
 *     description?: string | null;
 *     assigneeId?: string | null;
 *   };
 *   columnName: 'Todo' | 'Doing' | 'Done' | string;
 *   otherColumns: Array<{ id: string; name: string }>;
 *   onMove: (targetColumnId: string) => void;
 *   onDelete: () => void;
 * }} props
 */
export const KanbanCard = ({ card, columnName, otherColumns, onMove, onDelete }) => {
  const isDoing = columnName === 'Doing';
  const isDone = columnName === 'Done';

  return (
    <li
      className={cn(
        'kanban-card group relative block px-5 py-4 transition hover:bg-foreground/[0.03]',
      )}
    >
      {isDoing ? (
        <span
          aria-hidden="true"
          data-testid="doing-indicator"
          className="absolute bottom-4 left-0 top-4 w-px bg-indigo-accent"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'truncate text-sm font-medium',
              isDone
                ? 'text-muted-foreground line-through decoration-zinc-300 dark:decoration-zinc-700'
                : 'text-foreground',
            )}
          >
            {card.title}
          </h3>
          {card.description ? (
            <p
              className={cn(
                'mt-1 line-clamp-1 text-xs leading-relaxed',
                isDone ? 'text-muted-foreground/70' : 'text-muted-foreground',
              )}
            >
              {card.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {card.assigneeId ? <MemberAvatar size="sm" userId={card.assigneeId} name={null} /> : null}
          <MoveMenu cardTitle={card.title} otherColumns={otherColumns} onMove={onMove} />
          <DeleteButton cardTitle={card.title} onDelete={onDelete} />
        </div>
      </div>
    </li>
  );
};

/**
 * 카드 이동 드롭다운 메뉴 (드래그 미지원 MVP).
 *
 * @param {{
 *   cardTitle: string;
 *   otherColumns: Array<{ id: string; name: string }>;
 *   onMove: (id: string) => void;
 * }} props
 */
const MoveMenu = ({ cardTitle, otherColumns, onMove }) => {
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
    // 트리거 버튼으로 포커스 복귀 — 키보드 사용성
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
      // Tab 으로 메뉴 밖으로 나가면 닫기 (focus는 자연스럽게 이동)
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
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
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
                aria-label={`${col.name}(으)로 이동`}
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

/**
 * 카드 삭제 버튼 — 확인 없이 즉시 호출 (optimistic remove).
 *
 * @param {{ cardTitle: string; onDelete: () => void }} props
 */
const DeleteButton = ({ cardTitle, onDelete }) => (
  <button
    type="button"
    aria-label={`${cardTitle} 삭제`}
    onClick={onDelete}
    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:bg-foreground/[0.04] hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
  >
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  </button>
);
