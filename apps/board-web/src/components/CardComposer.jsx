import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';

/**
 * 인라인 "+ 카드 추가" 컴포저.
 * - 기본: dashed border CTA 버튼 (시안의 `empty-add` 톤)
 * - 활성화: 텍스트 입력 + 추가/취소 버튼
 * - #315: Esc 키 / outside click 으로 reset. unsaved 텍스트는 silent drop (별도 confirm X).
 *
 * @param {{
 *   onSubmit: (title: string) => void;
 *   submitting?: boolean;
 * }} props
 */
export const CardComposer = ({ onSubmit, submitting = false }) => {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const formRef = useRef(/** @type {HTMLFormElement | null} */ (null));

  const reset = () => {
    setTitle('');
    setActive(false);
  };

  // #315: outside click 으로 reset — submit 중엔 막지 않는다 (race 회피).
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (submitting) return;
      const form = formRef.current;
      if (form && !form.contains(e.target)) reset();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, submitting]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    reset();
  };

  if (!active) {
    return (
      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => {
            setActive(true);
            // input 마운트 후 focus
            queueMicrotask(() => inputRef.current?.focus());
          }}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-hairline px-3 py-3 text-xs text-muted-foreground transition',
            'hover:border-foreground/30 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          )}
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
            <path d="M12 5v14M5 12h14" />
          </svg>
          카드 추가
        </button>
      </div>
    );
  }

  // #263: 200자 카운터 + 근접 시 색 변화 (180+ 경고, 200 도달 시 destructive).
  const trimmedLen = title.length;
  const nearLimit = trimmedLen >= 180 && trimmedLen < 200;
  const tooLong = trimmedLen >= 200;
  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2 px-5 py-4">
      <label className="flex flex-col gap-1.5">
        <span className="sr-only">카드 제목</span>
        <input
          ref={inputRef}
          aria-label="카드 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              reset();
            }
          }}
          maxLength={200}
          placeholder="새 카드 제목"
          className="h-9 rounded-md border border-hairline bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span
          data-testid="card-title-counter"
          className={cn(
            'font-mono text-[10px] text-muted-foreground',
            nearLimit && 'text-amber-500',
            tooLong && 'text-destructive',
          )}
        >
          {trimmedLen}/200
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={submitting}
            className="inline-flex h-8 items-center justify-center rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '추가 중…' : '추가'}
          </button>
        </div>
      </div>
    </form>
  );
};
