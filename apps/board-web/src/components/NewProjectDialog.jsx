import { ProjectCreateInput } from '@getit/schemas/board';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { cn } from '../lib/cn.js';

/**
 * 새 프로젝트 만들기 다이얼로그 (native <dialog>).
 * Zod 검증 + react-hook-form. 성공 시 onCreate(name, description).
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   onCreate: (values: { name: string; description?: string }) => Promise<void>;
 *   submitting?: boolean;
 *   serverError?: string | null;
 * }} props
 */
export const NewProjectDialog = ({ open, onClose, onCreate, submitting, serverError }) => {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ProjectCreateInput),
    mode: 'onSubmit',
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal?.();
    if (!open && node.open) node.close?.();
  }, [open]);

  // 다이얼로그 닫힐 때 폼 리셋
  useEffect(() => {
    if (!open) reset({ name: '', description: '' });
  }, [open, reset]);

  const onSubmit = async (values) => {
    await onCreate({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="new-project-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        'mx-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-card p-0',
        'text-foreground backdrop:bg-foreground/40 backdrop:backdrop-blur-sm',
        'open:animate-in open:fade-in',
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6 sm:p-8">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-accent" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              New Project
            </span>
          </div>
          <h2 id="new-project-title" className="text-xl font-semibold tracking-tight">
            새 프로젝트 만들기
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            기본 컬럼(Todo · Doing · Done)이 자동 생성됩니다.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">프로젝트 이름</span>
            <input
              {...register('name')}
              type="text"
              maxLength={80}
              autoComplete="off"
              placeholder="예: GETIT 9기 멘토링"
              aria-invalid={Boolean(errors.name) || undefined}
              className={cn(
                'h-10 rounded-md border border-hairline bg-background px-3 text-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                errors.name && 'border-destructive focus-visible:ring-destructive',
              )}
            />
            {errors.name ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">설명 (선택)</span>
            <textarea
              {...register('description')}
              rows={3}
              maxLength={2000}
              placeholder="이 프로젝트의 목적이나 범위를 간단히…"
              aria-invalid={Boolean(errors.description) || undefined}
              className={cn(
                'min-h-[5rem] resize-y rounded-md border border-hairline bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                errors.description && 'border-destructive focus-visible:ring-destructive',
              )}
            />
            {errors.description ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </label>
        </div>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '만드는 중…' : '만들기'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
