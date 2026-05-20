import { forwardRef, useId, useState } from 'react';

import { cn } from '../lib/cn.js';

/**
 * PasswordField — 비밀번호 입력 + 보기/숨기기 토글 + Caps Lock 경고.
 *
 * - 토글 (Issue #259): type=password ↔ text. aria-pressed 로 SR 상태 반영.
 * - Caps Lock (Issue #262): 입력 중 capsLock 감지 → alert role 텍스트.
 * - 16px (Issue #275): iOS Safari 자동 줌 방지 — input class 에 text-[16px].
 *
 * react-hook-form register 결과를 spread 받는 패턴 (FormField 와 동일).
 */
export const PasswordField = forwardRef(
  /**
   * @param {{
   *   label: string,
   *   error?: string,
   *   className?: string,
   *   id?: string,
   *   showToggle?: boolean,
   *   capsLockWarn?: boolean,
   * } & import('react').InputHTMLAttributes<HTMLInputElement>} props
   */
  (
    {
      label,
      error,
      className,
      id: idProp,
      showToggle = true,
      capsLockWarn = true,
      onKeyDown,
      onKeyUp,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const capsId = `${id}-caps`;
    const [revealed, setRevealed] = useState(false);
    const [capsOn, setCapsOn] = useState(false);

    /** @param {React.KeyboardEvent<HTMLInputElement>} e */
    const onKey = (e) => {
      if (capsLockWarn && typeof e.getModifierState === 'function') {
        setCapsOn(e.getModifierState('CapsLock'));
      }
    };

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={id}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-400"
        >
          {label}
        </label>
        <div className="relative">
          <input
            {...rest}
            ref={ref}
            id={id}
            type={revealed ? 'text' : 'password'}
            onKeyDown={(e) => {
              onKey(e);
              onKeyDown?.(e);
            }}
            onKeyUp={(e) => {
              onKey(e);
              onKeyUp?.(e);
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={
              [error ? errorId : null, capsOn ? capsId : null].filter(Boolean).join(' ') ||
              undefined
            }
            className={cn(
              'h-10 w-full rounded-md border border-hairline bg-white/70 px-3 pr-10 font-sans text-[16px] text-foreground transition dark:bg-ink-950/60',
              'placeholder:font-mono placeholder:text-[12px] placeholder:text-muted-foreground',
              'hover:border-cyan-700/50 dark:hover:border-cyan-neon/40',
              'focus-visible:border-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 dark:focus-visible:border-cyan-neon dark:focus-visible:ring-cyan-neon/30',
              error &&
                'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
            )}
          />
          {showToggle ? (
            <button
              type="button"
              aria-label={revealed ? '비밀번호 숨기기' : '비밀번호 표시'}
              aria-pressed={revealed}
              onClick={() => setRevealed((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 dark:text-zinc-500 dark:hover:text-cyan-neon dark:focus-visible:ring-cyan-neon/30"
            >
              {revealed ? '숨김' : '보기'}
            </button>
          ) : null}
        </div>
        {capsOn ? (
          <p
            id={capsId}
            role="alert"
            className="font-mono text-[11px] text-amber-700 dark:text-amber-400"
          >
            <span aria-hidden="true">⇪ </span>
            Caps Lock 이 켜져 있습니다
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="font-mono text-[11px] text-destructive">
            <span aria-hidden="true">! </span>
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

PasswordField.displayName = 'PasswordField';
