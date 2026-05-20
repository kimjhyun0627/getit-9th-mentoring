import { Link } from 'react-router-dom';

/**
 * PostDetailPage 의 방장 패널 — 신청자 보기 + 수정 + 모집 종료 (#244/#245/#333).
 *
 * PostDetailPage.jsx 가 300줄 cap 을 넘지 않도록 분리.
 *
 * @param {{
 *   postId: string;
 *   status: 'RECRUITING'|'FULL'|'CLOSED';
 *   onClose: () => void;
 *   closing: boolean;
 *   closeError: unknown;
 * }} props
 */
export const OwnerPanel = ({ postId, status, onClose, closing, closeError }) => {
  const isClosed = status === 'CLOSED';
  return (
    <div className="rounded-2xl bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 p-5 font-round">
      <p className="text-slate-700 dark:text-slate-200">
        이 모임의 방장이야. 정원 차면 카카오 오픈채팅이 신청자에게 자동 공개돼.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          to={`/posts/${postId}/applicants`}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 text-sm font-display font-bold shadow"
        >
          신청자 보기 <span aria-hidden="true">→</span>
        </Link>
        {!isClosed ? (
          <Link
            to={`/posts/${postId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-white/15 ring-1 ring-slate-900/5 dark:ring-white/15 text-slate-700 dark:text-slate-100 px-4 py-2 text-sm font-display font-bold"
          >
            수정
          </Link>
        ) : null}
        {!isClosed ? (
          <button
            type="button"
            onClick={() => {
              if (
                typeof window !== 'undefined' &&
                !window.confirm('모집을 종료할까? 신청자를 더 받지 못해.')
              ) {
                return;
              }
              onClose();
            }}
            disabled={closing}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 text-sm font-display font-bold shadow disabled:opacity-50"
          >
            {closing ? '종료 중…' : '모집 종료'}
          </button>
        ) : (
          <span className="text-sm font-round font-bold opacity-80">모집이 종료됐어</span>
        )}
      </div>
      {closeError ? (
        <p
          role="alert"
          className="mt-3 text-rose-600 dark:text-rose-300 font-round font-bold text-sm"
        >
          모집 종료에 실패했어. 잠시 후 다시 시도해줘.
        </p>
      ) : null}
    </div>
  );
};
