import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';

/**
 * 컬럼 헤더 — accent + 이름 + 카드 카운트 + (rename/delete 액션).
 *
 * - 이름 클릭 시 inline edit (Enter 저장 / Escape 취소). onRename 미제공이면 클릭 비활성.
 * - 삭제 버튼: onDelete + canDelete=true 일 때만 노출.
 * - 마지막 컬럼은 canDelete=false 로 들어와 삭제 버튼 disabled.
 *
 * @param {{
 *   column: { id: string; name: string };
 *   cardCount: number;
 *   onRename?: (name: string) => void;
 *   onDelete?: () => void;
 *   canDelete?: boolean;
 * }} props
 */
export const BoardColumnHeader = ({ column, cardCount, onRename, onDelete, canDelete = true }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    setDraft(column.name);
  }, [column.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === column.name) {
      setDraft(column.name);
      return;
    }
    onRename?.(next);
  };

  const cancel = () => {
    setDraft(column.name);
    setEditing(false);
  };

  return (
    <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 rounded-full', columnAccent(column.name))}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // blur 를 트리거해 commit() 한 번만 — Enter + onBlur 두 번 호출 방지.
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            maxLength={40}
            aria-label={`${column.name} 컬럼 이름 변경`}
            className="h-6 min-w-0 flex-1 rounded-sm border border-hairline bg-background px-1 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        ) : onRename ? (
          // 의미상 h2 유지 — 안에 텍스트 버튼만 둔다 (스크린리더가 heading 으로 인식).
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.15em] text-foreground/80">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`${column.name} 컬럼 이름 변경`}
              className="rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {column.name}
            </button>
          </h2>
        ) : (
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.15em] text-foreground/80">
            {column.name}
          </h2>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">· {cardCount}</span>
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label={`${column.name} 컬럼 삭제`}
          title={canDelete ? '컬럼 삭제' : '마지막 컬럼은 삭제할 수 없어요'}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:bg-foreground/[0.04] hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
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
      ) : null}
    </header>
  );
};

/**
 * 컬럼 이름별 헤더 도트 컬러 — 기본 3개 외엔 회색.
 *
 * @param {string} name
 */
const columnAccent = (name) => {
  if (name === 'Doing') return 'bg-indigo-accent';
  if (name === 'Done') return 'bg-foreground';
  if (name === 'Todo') return 'bg-muted-foreground/60';
  return 'bg-muted-foreground/40';
};
