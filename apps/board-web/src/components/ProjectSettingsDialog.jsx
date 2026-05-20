import { ProjectUpdateInput } from '@getit/schemas/board';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { cn } from '../lib/cn.js';

import { ConfirmDialog } from './ConfirmDialog.jsx';

/**
 * 프로젝트 설정 다이얼로그 (#208).
 * - name / description 편집 (멤버 누구나)
 * - 삭제 (OWNER 만 — UI 게이트, BE 가 최종 게이트)
 *
 * @param {{
 *   open: boolean;
 *   project: { id: string; name: string; description: string | null; role?: 'OWNER'|'MEMBER'|null } | null;
 *   onClose: () => void;
 *   onSave: (values: { name?: string; description?: string | null }) => void;
 *   onDelete: () => void;
 *   saving?: boolean;
 *   deleting?: boolean;
 *   serverError?: string | null;
 * }} props
 */
export const ProjectSettingsDialog = ({
  open,
  project,
  onClose,
  onSave,
  onDelete,
  saving = false,
  deleting = false,
  serverError = null,
}) => {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(ProjectUpdateInput),
    mode: 'onSubmit',
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal?.();
    if (!open && node.open) node.close?.();
  }, [open]);

  useEffect(() => {
    if (open && project) {
      reset({ name: project.name ?? '', description: project.description ?? '' });
    }
  }, [open, project, reset]);

  if (!project) return null;
  const isOwner = project.role === 'OWNER';

  const onSubmit = (values) => {
    const next = {};
    const name = values.name?.trim();
    const desc = values.description?.trim() ?? '';
    if (name && name !== project.name) next.name = name;
    const currentDesc = project.description ?? '';
    if (desc !== currentDesc) next.description = desc.length === 0 ? null : desc;
    if (Object.keys(next).length === 0) {
      onClose();
      return;
    }
    onSave(next);
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="project-settings-title"
        onClose={onClose}
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
        className={cn(
          'mx-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-card p-0',
          'text-foreground backdrop:bg-foreground/40 backdrop:backdrop-blur-sm',
        )}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6 sm:p-8">
          <header className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Project Settings
            </span>
            <h2 id="project-settings-title" className="text-xl font-semibold tracking-tight">
              프로젝트 설정
            </h2>
          </header>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">이름</span>
            <input
              {...register('name')}
              type="text"
              maxLength={80}
              aria-invalid={Boolean(errors.name) || undefined}
              className={cn(
                'h-10 rounded-md border border-hairline bg-background px-3 text-sm',
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
            <span className="text-sm font-medium">설명</span>
            <textarea
              {...register('description')}
              rows={3}
              maxLength={2000}
              className={cn(
                'min-h-[5rem] resize-y rounded-md border border-hairline bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            />
          </label>

          {serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          ) : null}

          <div className="flex flex-row items-center justify-between gap-2 border-t border-hairline pt-4">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
                className="inline-flex h-9 items-center justify-center rounded-md border border-hairline px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                프로젝트 삭제
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex flex-row items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={saving || deleting || !isDirty}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </form>
      </dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="프로젝트를 삭제할까요?"
        description={`"${project.name}" 프로젝트와 모든 컬럼·카드가 영구 삭제돼요. 되돌릴 수 없어요.`}
        confirmLabel="삭제"
        destructive
        busy={deleting}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
};
