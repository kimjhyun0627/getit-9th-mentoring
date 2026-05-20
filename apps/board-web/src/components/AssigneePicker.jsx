import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';
import { initials } from '../lib/initials.js';

/**
 * 카드 담당자 picker (#200).
 *
 * - 프로젝트 멤버 중 1명 선택 또는 미지정.
 * - 단일 select 대안의 가벼운 popover — 멤버 수가 5명 안팎이라 검색 X.
 *
 * @param {{
 *   members: Array<{ userId: string; name?: string | null }>;
 *   value: string | null;
 *   onChange: (userId: string | null) => void;
 *   id?: string;
 *   disabled?: boolean;
 * }} props
 */
export const AssigneePicker = ({ members, value, onChange, id, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = value ? members.find((m) => m.userId === value) : null;
  const labelText = selected ? (selected.name ?? selected.userId) : '미지정';

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="담당자 선택"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-hairline bg-background px-3 text-sm text-foreground transition',
          'hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="truncate text-left">{labelText}</span>
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="담당자 후보"
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-md border border-hairline bg-popover py-1 text-sm shadow-md"
        >
          <li role="none">
            <button
              role="option"
              type="button"
              aria-selected={value === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                'block w-full px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-foreground/[0.05]',
                value === null && 'bg-foreground/[0.04]',
              )}
            >
              미지정
            </button>
          </li>
          {members.map((m) => {
            const display = m.name ?? m.userId;
            return (
              <li key={m.userId} role="none">
                <button
                  role="option"
                  type="button"
                  aria-selected={value === m.userId}
                  onClick={() => {
                    onChange(m.userId);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition hover:bg-foreground/[0.05]',
                    value === m.userId && 'bg-foreground/[0.04]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.08] text-[10px] font-medium text-foreground"
                  >
                    {initials(display)}
                  </span>
                  <span className="truncate">{display}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
