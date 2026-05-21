import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { CONTENT_MAX, counterColorClass, retryAfterSec } from '../lib/modalHelpers.js';
import { useDialogFocus } from '../lib/useDialogFocus.js';

import { ColorPicker, STICKY_COLORS } from './ColorPicker.jsx';

/**
 * EditModal — 본인 메시지 편집 모달 (Issue #249).
 *
 * ComposeModal 과 형태는 비슷하지만 책임이 다름:
 *  - PATCH /api/messages/:id (createMessage 대신 updateMessage)
 *  - initial 값으로 미리 채워진 폼
 *  - 변경 없으면 비활성 (no-op 차단)
 *
 * Postit 의 ✏ 편집 버튼이 호출. ComposeModal 과 한 파일로 묶으려다가 파일이
 * 300줄 초과해 분리 (CLAUDE.md 제약).
 */

const COLOR_VALUES = STICKY_COLORS.map((c) => c.value);

const EditFormSchema = z.object({
  // #323 — BE 와 동일 trim. 공백만 입력 시 FE 단에서 잡힘.
  content: z
    .string({ required_error: '한 줄 적어주세요' })
    .trim()
    .min(1, '한 줄 적어주세요')
    .max(CONTENT_MAX, '500자까지 적을 수 있어요'),
  color: z
    .union([z.string(), z.undefined(), z.null()])
    .refine((v) => typeof v === 'string' && COLOR_VALUES.includes(v), {
      message: '포스트잇 색을 골라주세요',
    }),
});

/**
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 수정해주세요';
  if (status === 403) return '본인 쪽지만 수정할 수 있어요';
  if (status === 404) return '이미 떼어진 쪽지에요';
  if (status === 400 || status === 422) return '입력 내용을 다시 확인해주세요';
  if (status === 429) {
    const sec = retryAfterSec(err);
    if (sec != null && sec > 0) return `잠시만요, ${sec}초 후 다시 시도해주세요`;
    return '잠시만요, 너무 빨리 보냈어요. 조금 있다 다시 시도해주세요';
  }
  if (typeof status === 'number' && status >= 500)
    return '서버가 잠깐 쉬는 중이에요. 잠시 후 다시 시도해주세요';
  return '쪽지를 수정하지 못했어요. 잠시 후 다시 시도해주세요';
};

/**
 * @typedef {object} EditTarget
 * @property {string} id - 메시지 PK (cuid).
 * @property {string} content - 현재 본문 (편집 폼 initial value).
 * @property {'PINK'|'MINT'|'LEMON'|'LAVENDER'} color - 현재 색상 (편집 폼 initial value).
 */

/**
 * 본인 메시지 편집 모달.
 *
 * @param {{
 *   open: boolean;
 *   message: EditTarget | null;
 *   onClose: () => void;
 *   onSuccess?: () => void;
 * }} props
 */
export const EditModal = ({ open, message, onClose, onSuccess }) => {
  const headingId = useId();
  const contentErrId = useId();
  const colorErrId = useId();
  const [serverError, setServerError] = useState(/** @type {string | null} */ (null));
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(EditFormSchema),
    mode: 'onSubmit',
    defaultValues: { content: '', color: undefined },
  });

  // #281 — 글자수 카운터.
  const contentValue = useWatch({ control, name: 'content' }) ?? '';
  const contentLen = contentValue.length;
  const counterColor = counterColorClass(contentLen);

  // open / message 바뀔 때마다 초기값 채움. 닫혀있을 땐 reset 안 함 (마운트 X).
  useEffect(() => {
    if (open && message) {
      setServerError(null);
      reset({ content: message.content, color: message.color });
    }
  }, [open, message, reset]);

  const mutation = useMutation({
    mutationFn: (body) => api.updateMessage(message?.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => setServerError(toFriendlyError(err)),
  });

  // Escape 키 → 닫기
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 포커스 관리 — useDialogFocus 가 초기 포커스(textarea) + Tab 트랩 + 복원.
  useDialogFocus({ open, ref: dialogRef, initialSelector: '#edit-content' });

  if (!open || !message) return null;

  /** @param {{ content: string; color: string }} values */
  const onSubmit = (values) => {
    // 변경 없으면 no-op (네트워크 절감).
    if (values.content === message.content && values.color === message.color) {
      onClose();
      return;
    }
    setServerError(null);
    mutation.mutate(values);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 sm:py-8">
      <button
        type="button"
        data-testid="edit-modal-backdrop"
        aria-label="모달 닫기 (배경)"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm dark:bg-black/60"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn(
          // #354 — ComposeModal 과 동일한 중앙 팝업 dialog 스타일.
          'relative w-full max-w-md rounded-3xl bg-cream p-6 shadow-2xl ring-1 ring-ink/10',
          // #280 — 모바일 viewport 넘침 가드 (vh + dvh 듀얼).
          'max-h-[calc(100vh-3rem)] max-h-[calc(100dvh-3rem)] overflow-y-auto',
          'sm:p-8 dark:bg-mocha2 dark:ring-beige/10',
          // motion-safe: prefix 는 prefers-reduced-motion: no-preference 일 때만
          // 적용 → 사용자가 모션 감소를 선호하면 애니메이션 자동 비활성화.
          'motion-safe:animate-[popin_180ms_cubic-bezier(0.2,0.7,0.2,1)]',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="모달 닫기"
          className="absolute right-4 top-4 rounded-full bg-white/70 px-2 py-1 text-sm text-ink shadow-sm transition hover:bg-white dark:bg-mocha3/60 dark:text-beige dark:hover:bg-mocha3"
        >
          ✕
        </button>

        <header className="mb-5 flex flex-col gap-1">
          <p className="font-pen text-3xl leading-none text-sageDk dark:text-sageW">고쳐 적기</p>
          <h2
            id={headingId}
            className="font-sans text-2xl font-bold tracking-tight text-ink dark:text-beige"
          >
            메시지 수정
          </h2>
          <p className="font-hand text-base text-ink2 dark:text-beige2">한 줄 다시 다듬어볼게요.</p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
          aria-label="메시지 수정 폼"
        >
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
              <label htmlFor="edit-content" className="font-hand text-lg text-ink dark:text-beige">
                내용
              </label>
              <span
                aria-live="polite"
                className={cn('font-hand text-sm tabular-nums transition-colors', counterColor)}
              >
                <span className="sr-only">현재 글자수 </span>
                {contentLen} / {CONTENT_MAX}
              </span>
            </div>
            <textarea
              id="edit-content"
              rows={5}
              maxLength={CONTENT_MAX}
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
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-ink2 transition hover:bg-cream2 dark:text-beige2 dark:hover:bg-mocha3"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 font-medium text-cream',
                'shadow-lg transition hover:-translate-y-0.5 hover:bg-mocha2',
                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peachDk focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
                'dark:bg-beige dark:text-mocha dark:hover:bg-beige2 dark:focus-visible:ring-rose dark:focus-visible:ring-offset-mocha2',
              )}
            >
              {mutation.isPending ? '고치는 중…' : '고치기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
