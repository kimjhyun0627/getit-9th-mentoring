import { forwardRef, useId } from 'react';

import { cn } from '../lib/cn.js';

/**
 * Playful 톤의 input 필드 (label + input + help/error).
 * `react-hook-form` 의 register 결과를 spread 해서 쓰는 패턴.
 *
 * @typedef {object} FormFieldExtraProps
 * @property {string} label 시각적 라벨 텍스트
 * @property {string} [hint] 보조 설명 (input 아래 placeholder 톤)
 * @property {string} [error] 검증 에러 메시지 (있으면 destructive 스타일)
 */

export const FormField = forwardRef(
  /**
   * @param {FormFieldExtraProps & import('react').InputHTMLAttributes<HTMLInputElement>} props
   * @param {import('react').Ref<HTMLInputElement>} ref
   */
  ({ label, type = 'text', hint, error, className, id: idProp, ...rest }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={id}
          className="font-round text-sm font-bold text-slate-800 dark:text-slate-100"
        >
          {label}
        </label>
        <input
          {...rest}
          ref={ref}
          id={id}
          type={type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm transition [color-scheme:light]',
            'placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-inner dark:shadow-black/30 dark:[color-scheme:dark] dark:focus-visible:ring-amber-300',
            error && 'border-rose-500 focus-visible:ring-rose-500 dark:border-rose-400',
          )}
        />
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs font-medium text-rose-600 dark:text-rose-300"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

FormField.displayName = 'FormField';
