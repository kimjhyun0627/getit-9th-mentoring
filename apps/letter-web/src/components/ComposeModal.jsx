import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { CONTENT_MAX, counterColorClass, retryAfterSec } from '../lib/modalHelpers.js';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import { useDialogFocus } from '../lib/useDialogFocus.js';

import { ColorPicker, STICKY_COLORS } from './ColorPicker.jsx';

const COLOR_VALUES = STICKY_COLORS.map((c) => c.value);

/**
 * 폼 검증 스키마. BE `MessageCreateInput` 과 동일 규칙 + 한국어 메시지.
 * color 는 z.enum 대신 union+refine 으로 "비선택" 케이스 안내 친화.
 */
const ComposeFormSchema = z.object({
  // #323 — BE 도 trim 후 min(1) 검증. FE 에서 미리 잡아 친절한 메시지.
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
 * 서버 에러 → 사용자 친화 메시지.
 *
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 붙여주세요';
  if (status === 400 || status === 422) return '입력 내용을 다시 확인해주세요';
  if (status === 429) {
    // #326 — Retry-After 가 있으면 카운트다운 카피로 강화.
    const sec = retryAfterSec(err);
    if (sec != null && sec > 0) return `잠시만요, ${sec}초 후 다시 시도해주세요`;
    return '잠시만요, 너무 빨리 보냈어요. 조금 있다 다시 시도해주세요';
  }
  if (typeof status === 'number' && status >= 500)
    return '서버가 잠깐 쉬는 중이에요. 잠시 후 다시 붙여주세요';
  return '쪽지를 붙이지 못했어요. 잠시 후 다시 시도해주세요';
};

/**
 * 메시지 작성 모달 (Issue #55).
 * RHF+Zod 검증 / POST /api/messages / backdrop+Escape 닫기 / Warm 4색 스와치.
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

  // #281 — 글자수 카운터 (480 초과 시 peachDk → red 강조).
  const contentValue = useWatch({ control, name: 'content' }) ?? '';
  const contentLen = contentValue.length;
  const counterColor = counterColorClass(contentLen);

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

  // 포커스 관리 — useDialogFocus hook 이 초기 포커스 + Tab 트랩 + 복원 담당.
  useDialogFocus({ open, ref: dialogRef, initialSelector: '#compose-content' });

  // #464 — body scroll lock + dialog ancestor 형제만 inert (모달 트리는 살아있음).
  useBodyScrollLock(open, dialogRef);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 sm:py-8">
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
          // #354 — 중앙 팝업 dialog. 부모 flex(items-center justify-center) 가 viewport 중앙,
          //   여기서는 카드 모양 + 등장 애니메이션만. 과거 bottom-sheet 인상은 sm: padding
          //   여백 부족으로 카드가 viewport 끝까지 닿아서 시각적으로 "올라온 시트" 처럼 보였던 것.
          //   max-w-md 로 데스크탑에서도 명확한 카드 hierarchy.
          'relative w-full max-w-md rounded-3xl bg-cream p-6 shadow-2xl ring-1 ring-ink/10',
          // #280 — 모바일 viewport 넘침 가드. dvh 로 iOS 주소창 동적 변경에도 안전.
          //   100dvh 미지원 환경(아주 옛 브라우저) fallback 으로 100vh 도 같이.
          'max-h-[calc(100vh-3rem)] max-h-[calc(100dvh-3rem)] overflow-y-auto',
          'sm:p-8 dark:bg-mocha2 dark:ring-beige/10',
          // 팝업 등장 애니메이션 — bottom-sheet 슬라이드가 아니라 중앙 fade+zoom.
          //   motion-safe: prefix 는 prefers-reduced-motion: no-preference 일 때만
          //   적용 → 사용자가 모션 감소를 선호하면 애니메이션 자동 비활성화.
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
          <p className="font-pen text-3xl leading-none text-sageDk dark:text-sageW">한 줄 남기기</p>
          <h2
            id={headingId}
            className="font-sans text-2xl font-bold tracking-tight text-ink dark:text-beige"
          >
            메시지 작성
          </h2>
          <p className="font-hand text-base text-ink2 dark:text-beige2">
            익명으로 부원실 벽에 살며시 붙여둘게요.
          </p>
          {/* #325 — 익명성 약속을 더 명확히. 다른 부원에게는 표시되지 않음 (DB 저장 사실과 정합). */}
          <p className="font-hand text-sm text-sageDk dark:text-sageW">
            이름은 다른 부원에게 표시되지 않아요.
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
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="compose-content"
                className="font-hand text-lg text-ink dark:text-beige"
              >
                내용
              </label>
              {/* #281 — 글자수 카운터. aria-live=polite 로 SR 에도 알림 (단, 매 키입력마다는 시끄러우니 fluid 변화는 시각만). */}
              <span
                aria-live="polite"
                className={cn('font-hand text-sm tabular-nums transition-colors', counterColor)}
              >
                <span className="sr-only">현재 글자수 </span>
                {contentLen} / {CONTENT_MAX}
              </span>
            </div>
            <textarea
              id="compose-content"
              rows={5}
              maxLength={CONTENT_MAX}
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
