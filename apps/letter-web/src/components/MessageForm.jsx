import { useId } from 'react';
import { Controller } from 'react-hook-form';

import { cn } from '../lib/cn.js';
import { CONTENT_MAX } from '../lib/modalHelpers.js';

import { ColorPicker } from './ColorPicker.jsx';

/**
 * ComposeModal / EditModal 공통 폼 본문 (ColorPicker + textarea + counter + 서버에러 + 액션).
 *
 * 부모(모달)가 useMessageForm 으로 RHF 셋업 후 register/control/errors 를 내려준다.
 * 마크업/스타일/검증 메시지는 모두 동일. 모달별로 다른 부분:
 * - textareaId / placeholder
 * - submit 버튼 라벨 (idle/pending)
 * - aria-label (작성/수정)
 *
 * @param {{
 *   ariaLabel: string;
 *   textareaId: string;
 *   placeholder?: string;
 *   register: import('react-hook-form').UseFormRegister<any>;
 *   control: import('react-hook-form').Control<any>;
 *   errors: import('react-hook-form').FieldErrors<any>;
 *   serverError: string | null;
 *   contentLen: number;
 *   counterColor: string;
 *   submitting: boolean;
 *   submitIdleLabel: string;
 *   submitPendingLabel: string;
 *   onCancel: () => void;
 *   onSubmit: import('react').FormEventHandler<HTMLFormElement>;
 * }} props
 */
export const MessageForm = ({
  ariaLabel,
  textareaId,
  placeholder,
  register,
  control,
  errors,
  serverError,
  contentLen,
  counterColor,
  submitting,
  submitIdleLabel,
  submitPendingLabel,
  onCancel,
  onSubmit,
}) => {
  const contentErrId = useId();
  const colorErrId = useId();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-label={ariaLabel}>
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <ColorPicker
            value={field.value}
            onChange={field.onChange}
            error={errors.color?.message}
            errorId={colorErrId}
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={textareaId} className="font-hand text-lg text-ink dark:text-beige">
            내용
          </label>
          {/* #281 — 글자수 카운터. aria-live=polite 로 SR 안내, 시각은 색 강조. */}
          <span
            aria-live="polite"
            className={cn('font-hand text-sm tabular-nums transition-colors', counterColor)}
          >
            <span className="sr-only">현재 글자수 </span>
            {contentLen} / {CONTENT_MAX}
          </span>
        </div>
        <textarea
          id={textareaId}
          rows={5}
          maxLength={CONTENT_MAX}
          placeholder={placeholder}
          aria-invalid={Boolean(errors.content?.message) || undefined}
          aria-describedby={errors.content?.message ? contentErrId : undefined}
          className={cn(
            'min-h-[7rem] w-full resize-y rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm',
            'placeholder:text-ink2/60 focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-peachDk focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
            'dark:border-beige/10 dark:bg-mocha3 dark:text-beige dark:placeholder:text-beige2/60',
            'dark:focus-visible:ring-rose dark:focus-visible:ring-offset-mocha2',
            errors.content?.message && 'border-red-500 focus-visible:ring-red-500',
          )}
          {...register('content')}
        />
        {errors.content?.message ? (
          <p
            id={contentErrId}
            role="alert"
            className="text-xs font-medium text-red-600 dark:text-red-300"
          >
            {errors.content.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-200"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-ink2 transition hover:bg-cream2 dark:text-beige2 dark:hover:bg-mocha3"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 font-medium text-cream',
            'shadow-lg transition hover:-translate-y-0.5 hover:bg-mocha2',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peachDk focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
            'dark:bg-beige dark:text-mocha dark:hover:bg-beige2 dark:focus-visible:ring-rose dark:focus-visible:ring-offset-mocha2',
          )}
        >
          {submitting ? submitPendingLabel : submitIdleLabel}
        </button>
      </div>
    </form>
  );
};
