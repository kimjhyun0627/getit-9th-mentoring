import { forwardRef, useId } from 'react';

import { cn } from '../lib/cn.js';

/**
 * Tech-Dark input 필드 (label + input + error). Issue #172.
 * - label: mono 소형 메타 + cyan glyph
 * - input: ink-950 다크 bg, hairline border, focus 시 cyan ring + border
 * - error: destructive (mono `!` prefix)
 *
 * `react-hook-form` 의 register 결과를 spread해서 쓰는 패턴.
 *
 * @typedef {object} FormFieldExtraProps
 * @property {string} label 시각적 라벨 텍스트
 * @property {string} [error] 표시할 검증 에러 메시지 (있으면 destructive 스타일)
 */

export const FormField = forwardRef(
  /**
   * @param {FormFieldExtraProps & import('react').InputHTMLAttributes<HTMLInputElement>} props
   * @param {import('react').Ref<HTMLInputElement>} ref
   */
  ({ label, type = 'text', error, className, id: idProp, ...rest }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={id}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-400"
        >
          {label}
        </label>
        <input
          {...rest}
          ref={ref}
          id={id}
          type={type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            // #275: 16px 이상 → iOS Safari 입력 시 자동 줌 방지.
            'h-10 w-full rounded-md border border-hairline bg-white/70 px-3 font-sans text-[16px] text-foreground transition dark:bg-ink-950/60',
            'placeholder:font-mono placeholder:text-[12px] placeholder:text-muted-foreground',
            'hover:border-cyan-700/50 dark:hover:border-cyan-neon/40',
            'focus-visible:border-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 dark:focus-visible:border-cyan-neon dark:focus-visible:ring-cyan-neon/30',
            error &&
              'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
          )}
        />
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

FormField.displayName = 'FormField';
