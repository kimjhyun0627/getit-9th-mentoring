import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';

import { ColorPicker, STICKY_COLORS } from './ColorPicker.jsx';

const COLOR_VALUES = STICKY_COLORS.map((c) => c.value);

/**
 * 폼 검증 스키마 — `MessageCreateInput` 과 동일한 규칙이지만
 * FE 한정으로 친절한 한국어 메시지를 강제 (특히 color 미선택).
 * BE 도 동일 zod (`MessageCreateInput`) 로 다시 검증하니 우회 위험 없음.
 *
 * NOTE: z.enum 은 undefined 를 `Required` 로만 처리하고 invalid 메시지를
 * 노출하지 못해서, color 는 union 으로 받고 refine 으로 "비선택" 케이스에
 * 사용자 친화 메시지를 강제.
 */
const ComposeFormSchema = z.object({
  content: z
    .string({ required_error: '메시지 내용을 입력하세요' })
    .trim()
    .min(1, '메시지 내용을 입력하세요')
    .max(500, '메시지는 500자 이내'),
  color: z
    .union([z.string(), z.undefined(), z.null()])
    .refine((v) => typeof v === 'string' && COLOR_VALUES.includes(v), {
      message: '포스트잇 색을 골라주세요',
    }),
});

/**
 * 서버 에러 → 사용자 친화 메시지.
 *
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 401) return '로그인이 만료됐어. 다시 로그인 후 시도해줘';
  if (status === 400 || status === 422) return '입력값이 올바르지 않습니다. 다시 확인해주세요';
  if (status === 429) return '요청이 많아. 잠시 후 다시 시도해줘';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했어. 잠시 후 다시 시도해줘';
  return '메시지 등록에 실패했어. 잠시 후 다시 시도해줘';
};

/**
 * 메시지 작성 모달 (Issue #55).
 *
 * 동작:
 *  - RHF + Zod (`MessageCreateInput`) 로 검증 — 색 / 내용 필수
 *  - 제출 → POST /api/messages → `['messages']` 쿼리 invalidate → onSuccess + onClose
 *  - backdrop 클릭 / Escape 키 → onClose
 *
 * 디자인:
 *  - Warm 톤 (cream 카드 + 손글씨 액센트 + 4색 파스텔 스와치)
 *  - 모달 본체는 종이 느낌. 색 선택 swatch 는 라디오 그룹.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   onSuccess?: (message: { id: string; content: string; color: string; is_mine: boolean }) => void;
 * }} props
 */
export const ComposeModal = ({ open, onClose, onSuccess }) => {
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
    resolver: zodResolver(ComposeFormSchema),
    mode: 'onSubmit',
    defaultValues: { content: '', color: undefined },
  });

  const mutation = useMutation({
    mutationFn: (body) => api.createMessage(body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      onSuccess?.(res?.data?.message);
      reset({ content: '', color: undefined });
      onClose();
    },
    onError: (err) => setServerError(toFriendlyError(err)),
  });

  // Escape 키 → 닫기. open 일 때만 등록.
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

  // 포커스 관리 — 모달 열릴 때 첫 입력 요소로 포커스 이동, Tab 트랩,
  // 닫을 때 이전 포커스 복원. (a11y: WAI-ARIA dialog 패턴)
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = /** @type {HTMLElement | null} */ (document.activeElement);

    /**
     * 모달 내 tab 가능한 요소 (포커스 트랩 + 초기 포커스용).
     *
     * @returns {HTMLElement[]}
     */
    const getFocusable = () => {
      if (!dialogRef.current) return [];
      const selectors =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(dialogRef.current.querySelectorAll(selectors));
    };

    // 초기 포커스 — 모달 본문 내 textarea (compose-content) 가 있으면 그쪽으로,
    // 없으면 첫 focusable 로.
    const initial =
      /** @type {HTMLElement | null} */ (dialogRef.current?.querySelector('#compose-content')) ??
      getFocusable()[0];
    initial?.focus();

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialogRef.current?.contains(/** @type {Node} */ (active))) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // unmount/close 시 이전 포커스 복원 (요소가 여전히 DOM 에 있을 때만).
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  // 모달 열릴 때마다 state 리셋 (이전 에러 / 입력 흔적 제거).
  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({ content: '', color: undefined });
    }
  }, [open, reset]);

  if (!open) return null;

  /** @param {{ content: string; color: string }} values */
  const onSubmit = (values) => {
    setServerError(null);
    mutation.mutate(values);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
      {/* Backdrop — 별도 button 으로 분리해서 a11y 친화 (Escape + 외부 클릭 모두 닫기). */}
      <button
        type="button"
        data-testid="compose-modal-backdrop"
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
          'relative w-full max-w-md rounded-3xl bg-cream p-6 shadow-2xl ring-1 ring-ink/10',
          'sm:p-8 dark:bg-mocha2 dark:ring-beige/10',
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
          <p className="font-pen text-2xl leading-none text-sageDk dark:text-sageW">한 줄 남기기</p>
          <h2
            id={headingId}
            className="font-sans text-2xl font-bold tracking-tight text-ink dark:text-beige"
          >
            메시지 작성
          </h2>
          <p className="font-hand text-sm text-ink2 dark:text-beige2">
            익명으로 부원실 벽에 살며시 붙여둘게요.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
          aria-label="메시지 작성 폼"
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
            <label
              htmlFor="compose-content"
              className="font-hand text-base text-ink dark:text-beige"
            >
              내용
            </label>
            <textarea
              id="compose-content"
              rows={5}
              maxLength={500}
              placeholder="고마운 마음, 응원, 추억 — 한 줄이면 충분해요"
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
              {mutation.isPending ? '붙이는 중…' : '붙이기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
