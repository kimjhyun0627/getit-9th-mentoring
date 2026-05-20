import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';
import { initials } from '../lib/initials.js';

/**
 * 멤버 관리 다이얼로그 (#203).
 *
 * - OWNER: userId 입력 → 초대, 다른 멤버는 추방 가능.
 * - MEMBER: 본인 탈퇴 가능 (currentUserId 와 일치하면), 다른 멤버 조작 불가.
 * - 초대/추방은 mutation 진행 중 동안 비활성.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   role: 'OWNER' | 'MEMBER';
 *   members: Array<{ userId: string; role: 'OWNER'|'MEMBER'; name?: string | null }>;
 *   currentUserId: string | null;
 *   onInvite: (userId: string) => Promise<void> | void;
 *   onRemove: (userId: string) => Promise<void> | void;
 *   inviting?: boolean;
 *   removingUserId?: string | null;
 *   serverError?: string | null;
 * }} props
 */
export const MembersDialog = ({
  open,
  onClose,
  role,
  members,
  currentUserId,
  onInvite,
  onRemove,
  inviting = false,
  removingUserId = null,
  serverError = null,
}) => {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [userId, setUserId] = useState('');
  const [localErr, setLocalErr] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal?.();
    if (!open && node.open) node.close?.();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setUserId('');
      setLocalErr(null);
    }
  }, [open]);

  const handleInvite = async (e) => {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) {
      setLocalErr('userId가 필요합니다');
      return;
    }
    setLocalErr(null);
    await onInvite(trimmed);
    setUserId('');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="members-dialog-title"
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
      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-accent" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Members
            </span>
          </div>
          <h2 id="members-dialog-title" className="text-xl font-semibold tracking-tight">
            멤버 관리
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {role === 'OWNER'
              ? 'userId 로 다른 사람을 초대하거나 멤버를 추방할 수 있어요.'
              : '본인 탈퇴만 가능합니다. 다른 멤버는 OWNER만 관리해요.'}
          </p>
        </header>

        {role === 'OWNER' ? (
          <form onSubmit={handleInvite} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">멤버 초대 (userId)</span>
              <input
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  if (localErr) setLocalErr(null);
                }}
                aria-invalid={Boolean(localErr) || undefined}
                aria-label="초대할 userId"
                placeholder="예: u_abc123"
                className={cn(
                  'h-10 rounded-md border border-hairline bg-background px-3 text-sm',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  localErr && 'border-destructive focus-visible:ring-destructive',
                )}
              />
              {localErr ? (
                <p role="alert" className="text-xs text-destructive">
                  {localErr}
                </p>
              ) : null}
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {inviting ? '초대 중…' : '초대'}
              </button>
            </div>
          </form>
        ) : null}

        <section aria-label="멤버 목록" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            현재 멤버 ({members.length})
          </h3>
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {members.map((m) => {
              const display = m.name ?? m.userId;
              const isSelf = currentUserId === m.userId;
              const canRemoveOther = role === 'OWNER' && !isSelf;
              const canSelfLeave = isSelf && m.role !== 'OWNER';
              const showRemove = canRemoveOther || canSelfLeave;
              const removing = removingUserId === m.userId;
              return (
                <li key={m.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/[0.08] text-[10px] font-medium text-foreground"
                    >
                      {initials(display)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {display}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {m.role === 'OWNER' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </div>
                  {showRemove ? (
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => onRemove(m.userId)}
                      aria-label={canSelfLeave ? `${display} 탈퇴` : `${display} 추방`}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-hairline px-3 text-xs font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removing ? '처리 중…' : canSelfLeave ? '탈퇴' : '추방'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
          >
            닫기
          </button>
        </div>
      </div>
    </dialog>
  );
};
