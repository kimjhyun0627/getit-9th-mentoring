import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { api } from '../lib/api.js';
import { useRequireAuth } from '../lib/auth.js';

import { ApplicantList } from './ApplicantsPage.list.jsx';
import { PageShell } from './PostDetailPage.shell.jsx';

/**
 * 방장용 신청자 목록 + 노쇼 신고 페이지 — #245 / #247.
 *
 * 흐름:
 *  - useRequireAuth → 비로그인 시 SSO redirect.
 *  - GET /api/posts/:id/applicants — 방장만 200, 타인 403, 미존재 404.
 *  - 모임 끝난 뒤 (BE 가 422 PostNotEnded 처리) 노쇼 신고 가능.
 *  - 체크박스로 다수 선택 → 일괄 POST /api/posts/:id/no-shows.
 *
 * 권한 분기 UI:
 *  - 403 → "방장만 볼 수 있어" 안내.
 *  - 404 → "이 모임을 찾지 못했어".
 */
export const ApplicantsPage = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { isLoading: meLoading, isLoggedIn, is401 } = useRequireAuth();
  const [selected, setSelected] = useState(/** @type {Set<string>} */ (new Set()));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: ['post', id, 'applicants'],
    queryFn: () => api.listApplicants(id),
    enabled: isLoggedIn,
    retry: false,
  });

  const noShow = useMutation({
    mutationFn: (userIds) => api.reportNoShows(id, userIds),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['post', id, 'applicants'] });
    },
  });

  if (meLoading || (!isLoggedIn && is401)) {
    return (
      <PageShell>
        <p
          role="status"
          className="mt-20 text-center font-round text-slate-500 dark:text-slate-400"
        >
          {meLoading ? '로그인 확인 중…' : '로그인 페이지로 이동 중…'}
        </p>
      </PageShell>
    );
  }

  const status = query.error?.response?.status;
  if (status === 403) {
    return (
      <PageShell>
        <ErrorState
          title="방장만 볼 수 있어"
          body="이 페이지는 모임을 만든 사용자만 접근할 수 있어."
          postId={id}
        />
      </PageShell>
    );
  }
  if (status === 404) {
    return (
      <PageShell>
        <ErrorState
          title="모임을 찾지 못했어"
          body="삭제됐거나 잘못된 링크일 수 있어."
          postId={null}
        />
      </PageShell>
    );
  }
  // CR review #348: 500/네트워크 에러는 빈 목록 fallback 으로 보이면 안 됨.
  if (query.isError) {
    return (
      <PageShell>
        <ErrorState
          title="신청자 정보를 불러오지 못했어"
          body="잠시 후 다시 시도해줘."
          postId={id}
        />
      </PageShell>
    );
  }

  if (query.isLoading) {
    return (
      <PageShell>
        <p
          role="status"
          className="mt-20 text-center font-round text-slate-500 dark:text-slate-400"
        >
          신청자 가져오는 중…
        </p>
      </PageShell>
    );
  }

  const items = query.data?.items ?? [];
  const reportableUids = items.filter((a) => !a.noShow).map((a) => a.userId);
  const toggleSelected = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };
  // #445 — 전체선택/해제. 이미 신고된 (noShow=true) 는 제외.
  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === reportableUids.length ? new Set() : new Set(reportableUids),
    );
  };

  const onReport = () => {
    if (selected.size === 0) return;
    setConfirmOpen(true);
  };
  const onConfirmReport = () => {
    setConfirmOpen(false);
    noShow.mutate([...selected]);
  };

  return (
    <PageShell>
      <main className="relative z-10 max-w-3xl mx-auto px-5 lg:px-10 pt-8 pb-16">
        <Link
          to={`/posts/${id}`}
          className="inline-flex items-center gap-1 text-sm font-round font-bold text-slate-600 dark:text-slate-300"
        >
          ← 모임 상세
        </Link>

        <h1 className="mt-5 font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
          신청자 ({query.data?.total ?? items.length}명)
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-round">
          모임 끝나고 나타나지 않은 사람 있으면 골라서 신고해줘. 다른 방장들에게도 매너 지표로 보여.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 rounded-3xl bg-white/80 dark:bg-white/5 ring-1 ring-slate-900/5 dark:ring-white/10 px-6 py-12 text-center font-round text-slate-500 dark:text-slate-400">
            아직 신청한 사람이 없어.
          </p>
        ) : (
          <ApplicantList
            items={items}
            selected={selected}
            onToggle={toggleSelected}
            onToggleAll={toggleSelectAll}
            disabled={noShow.isPending}
          />
        )}

        {items.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onReport}
              disabled={selected.size === 0 || noShow.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-display font-bold shadow disabled:opacity-50"
            >
              {noShow.isPending ? '신고 중…' : `노쇼 신고 (${selected.size}명)`}
            </button>
            {noShow.error ? (
              <p
                role="alert"
                className="text-sm font-round font-bold text-rose-600 dark:text-rose-300"
              >
                {reportErrorMessage(noShow.error)}
              </p>
            ) : null}
          </div>
        ) : null}
      </main>
      <ConfirmDialog
        open={confirmOpen}
        title={`${selected.size}명을 노쇼로 신고할까?`}
        description="되돌리기 어려우니 한 번 더 확인해줘. 다른 방장에게도 매너 지표로 보여."
        confirmLabel="신고하기"
        cancelLabel="취소"
        destructive
        busy={noShow.isPending}
        onConfirm={onConfirmReport}
        onClose={() => setConfirmOpen(false)}
      />
    </PageShell>
  );
};

const reportErrorMessage = (err) => {
  const status = err?.response?.status;
  const code = err?.response?.data?.error;
  if (status === 422 && code === 'PostNotEnded') return '모임이 끝난 뒤에 신고할 수 있어.';
  if (status === 403) return '방장만 신고할 수 있어.';
  if (status === 429) return '요청이 너무 많아. 잠시 후 다시 시도해줘.';
  return '신고에 실패했어. 잠시 후 다시 시도해줘.';
};

const ErrorState = ({ title, body, postId }) => (
  <main className="relative z-10 max-w-2xl mx-auto px-5 lg:px-10 pt-20 text-center">
    <h1 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white">{title}</h1>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-round">{body}</p>
    <Link
      to={postId ? `/posts/${postId}` : '/'}
      className="mt-6 inline-flex items-center gap-1 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 text-sm font-display font-bold"
    >
      {postId ? '← 모임 상세' : '← 홈으로'}
    </Link>
  </main>
);
