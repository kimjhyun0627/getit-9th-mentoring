import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';

/**
 * 새 컬럼 추가 컴포저 (#206). 칸반 우측 끝에 항상 표시되는 카드.
 * - 평소엔 "+ 컬럼 추가" 버튼만, 클릭 시 inline form 으로 전환
 * - Enter 제출 / Escape 취소
 * - 빈 이름은 비활성, 40자 cap (Zod 와 일치)
 *
 * @param {{
 *   onSubmit: (name: string) => void;
 *   submitting?: boolean;
 * }} props
 */
export const NewColumnComposer = ({ onSubmit, submitting = false }) => {
  const [active, setActive] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  // a11y: jsx-a11y/no-autofocus 회피 — 활성화될 때 prog. focus.
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const trimmed = name.trim();

  const reset = () => {
    setActive(false);
    setName('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
    reset();
  };

  if (!active) {
    return (
      <section
        aria-label="새 컬럼 추가"
        className="flex h-full flex-col items-center justify-start bg-background/60 p-4"
      >
        <button
          type="button"
          onClick={() => setActive(true)}
          disabled={submitting}
          className={cn(
            'inline-flex h-9 w-full items-center justify-center gap-1 rounded-md border border-dashed border-hairline text-xs font-medium text-muted-foreground transition',
            'hover:border-foreground/30 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <span aria-hidden="true">+</span>
          컬럼 추가
        </button>
      </section>
    );
  }

  return (
    <section aria-label="새 컬럼 추가" className="flex flex-col bg-background p-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') reset();
          }}
          maxLength={40}
          placeholder="컬럼 이름"
          aria-label="새 컬럼 이름"
          className="h-9 rounded-md border border-hairline bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <div className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={submitting}
            className="inline-flex h-8 items-center justify-center rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || !trimmed}
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '추가 중…' : '추가'}
          </button>
        </div>
      </form>
    </section>
  );
};
