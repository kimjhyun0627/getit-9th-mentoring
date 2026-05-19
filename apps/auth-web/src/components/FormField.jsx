import { forwardRef, useId } from 'react';

import { cn } from '../lib/cn.js';

/**
 * shadcn 톤의 input 필드 (label + input + error).
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
        <label htmlFor={id} className="text-sm font-medium text-foreground">
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
            'h-10 w-full rounded-md border border-hairline bg-background px-3 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            error && 'border-destructive focus-visible:ring-destructive',
          )}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

FormField.displayName = 'FormField';
