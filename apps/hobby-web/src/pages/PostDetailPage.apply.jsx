/**
 * PostDetailPage 의 신청/상태 영역 (#500/#506) — 정책 + 상태별 분기.
 *
 * 분리 이유: PostDetailPage.jsx 가 300줄 cap 을 넘지 않도록.
 * 책임: 비로그인/CLOSED/방장/REJECTED/PENDING/APPROVED/신규신청 의 8가지 케이스를
 *   한 곳에서 처리. 로딩 placeholder 와 me query 미해소 케이스는 부모가 책임.
 */
import { OwnerPanel } from './PostDetailPage.owner.jsx';

/**
 * @param {{
 *   post: any;
 *   isOwner: boolean;
 *   meQueryData: any;
 *   isApplied: boolean;
 *   isPendingApproval: boolean;
 *   isRejected: boolean;
 *   isCapacityReached: boolean;
 *   isInactive: boolean;
 *   isPendingApplication: boolean;
 *   cancelDisabled: boolean;
 *   applyMutation: any;
 *   cancelMutation: any;
 *   closeMutation: any;
 * }} props
 */
export const ApplySection = ({
  post,
  isOwner,
  meQueryData,
  isApplied,
  isPendingApproval,
  isRejected,
  isCapacityReached,
  isInactive,
  isPendingApplication,
  cancelDisabled,
  applyMutation,
  cancelMutation,
  closeMutation,
}) => {
  if (isOwner) {
    return (
      <OwnerPanel
        postId={post.id}
        status={post.status}
        onClose={() => closeMutation.mutate()}
        closing={closeMutation.isPending}
        closeError={closeMutation.error}
      />
    );
  }
  if (!meQueryData) {
    return (
      <a
        href={`https://auth.get-it.cloud/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-5 sm:px-6 py-3 font-display font-extrabold text-sm sm:text-base shadow-lg whitespace-nowrap"
      >
        로그인하고 신청하기 →
      </a>
    );
  }
  if (isRejected) {
    return (
      <div
        data-testid="apply-section-rejected"
        className="rounded-2xl bg-slate-100 dark:bg-white/10 px-5 py-4 font-round"
      >
        <p className="font-display font-extrabold text-slate-700 dark:text-slate-200">
          신청이 거절되었어 🥲
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">다른 모임도 찾아보자.</p>
      </div>
    );
  }
  if (isPendingApproval) {
    return (
      <div data-testid="apply-section-pending" className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 px-5 py-3 font-display font-extrabold text-sm sm:text-base">
          <span aria-hidden="true">⏳</span> 방장 승인 대기 중
        </span>
        <button
          type="button"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelDisabled}
          className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/10 dark:ring-white/15 text-slate-700 dark:text-slate-200 px-5 py-3 font-display font-extrabold text-sm sm:text-base shadow-sm disabled:opacity-50"
        >
          {cancelMutation.isPending ? '취소 중…' : '신청 취소'}
        </button>
      </div>
    );
  }
  if (isApplied) {
    return (
      <button
        type="button"
        onClick={() => cancelMutation.mutate()}
        disabled={cancelDisabled}
        className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/10 dark:ring-white/15 text-slate-700 dark:text-slate-200 px-6 py-3 font-display font-extrabold text-base shadow-sm disabled:bg-slate-200 disabled:text-slate-500 disabled:dark:bg-slate-700 disabled:dark:text-slate-300 disabled:ring-0 disabled:cursor-not-allowed hover:scale-[1.02] disabled:hover:scale-100 transition"
      >
        {cancelMutation.isPending
          ? '취소 중…'
          : isPendingApplication
            ? '신청 처리 중…'
            : '신청 취소'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => applyMutation.mutate()}
      disabled={applyMutation.isPending || isCapacityReached}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 text-white px-7 py-3 font-display font-extrabold text-base shadow-lg shadow-rose-400/40 disabled:bg-none disabled:bg-slate-300 disabled:text-slate-600 disabled:dark:bg-slate-700 disabled:dark:text-slate-300 disabled:shadow-none disabled:cursor-not-allowed hover:scale-[1.03] hover:-rotate-1 disabled:hover:scale-100 disabled:hover:rotate-0 transition"
    >
      {applyMutation.isPending
        ? '신청 중…'
        : isCapacityReached
          ? '정원 마감'
          : post.applicationPolicy === 'APPROVAL'
            ? '승인 요청'
            : '신청하기'}
      {!applyMutation.isPending && !isInactive ? <span aria-hidden="true">→</span> : null}
    </button>
  );
};
