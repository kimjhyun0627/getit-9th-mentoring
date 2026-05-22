import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { CapacityMeter } from '../components/CapacityMeter.jsx';
import { emojiFor, paletteFor } from '../data/palette.js';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { formatMeetAt, initialOf } from '../lib/format.js';

import { ApplySection } from './PostDetailPage.apply.jsx';
import {
  applyErrorMessage,
  cancelErrorMessage,
  fetchErrorMessage,
} from './PostDetailPage.errors.js';
import { PENDING_APPLICATION_ID, usePostDetailMutations } from './PostDetailPage.mutations.js';
import { PageShell } from './PostDetailPage.shell.jsx';

/**
 * 게시글 상세 + 신청 인터랙션 — Issue #39.
 *
 * 데이터 흐름:
 *  - useQuery(['post', id]) 로 GET /api/posts/:id.
 *  - useQuery(['me']) 로 auth-api /me 핑 — 401 이면 비로그인.
 *  - applyMutation: POST /api/applications. optimistic update 로 capacity +1,
 *    실패하면 자동 롤백 + 에러 alert.
 *  - cancelMutation: DELETE /api/applications/:appId.
 *  - 방장(myUserId === post.ownerId) 이면 신청 버튼 대신 "방장 안내" + openChatUrl.
 *  - 일반 사용자에게는 응답에 openChatUrl 이 포함됐을 때만 (=FULL) 노출.
 *
 * Privacy 검증은 서버 책임 — FE 는 응답에 openChatUrl 이 없으면 단순히 안 보임.
 */
export const PostDetailPage = () => {
  const { id } = useParams();
  const postKey = ['post', id];

  const postQuery = useQuery({
    queryKey: postKey,
    queryFn: () => api.getPost(id),
    enabled: Boolean(id),
    retry: false,
    // #288: RECRUITING 일 때 15초마다 폴링 → 다른 사용자의 신청으로 FULL 전이된 걸 실시간 반영.
    // FULL/CLOSED 면 폴링 종료 (status 가 안정 상태). 탭이 백그라운드면 자동 일시정지 (RQ 기본).
    refetchInterval: (q) => {
      const status = q.state.data?.post?.status;
      return status === 'RECRUITING' ? 15_000 : false;
    },
    refetchIntervalInBackground: false,
  });

  // /me 는 비로그인(401) 이 정상 케이스. retry 끄고, 실패해도 페이지 렌더는 계속.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

  // #212: 신청 여부 식별은 서버 응답 myApplication 으로. reload 후에도 유지됨.
  const myApplication = postQuery.data?.post?.myApplication ?? null;
  const isPendingApplication = myApplication?.id === PENDING_APPLICATION_ID;
  // #500/#506: APPROVAL 정책에서 PENDING/REJECTED 상태 분기.
  const appStatus = myApplication?.status ?? 'APPROVED';
  const isPendingApproval = appStatus === 'PENDING';
  const isRejected = appStatus === 'REJECTED';

  const {
    apply: applyMutation,
    cancel: cancelMutation,
    close: closeMutation,
  } = usePostDetailMutations(id, postKey, myApplication);

  if (postQuery.isLoading) {
    return (
      <PageShell>
        <p
          role="status"
          className="mt-20 text-center text-slate-500 dark:text-slate-400 font-round"
        >
          모임을 가져오는 중…
        </p>
      </PageShell>
    );
  }

  if (postQuery.isError || !postQuery.data?.post) {
    return (
      <PageShell>
        <p
          role="alert"
          className="mt-20 text-center text-rose-600 dark:text-rose-300 font-round font-bold"
        >
          {fetchErrorMessage(postQuery.error)}
        </p>
      </PageShell>
    );
  }

  const post = postQuery.data.post;
  const me = meQuery.data ?? null;
  const isOwner = Boolean(me && me.id === post.ownerId);
  // #541: 학교 인증 안 한 로그인 사용자 — 신청 버튼 비활성화 + 안내.
  const isSchoolUnverified = Boolean(me && !me.schoolVerifiedAt);
  // #310 — FULL/CLOSED 분리: CLOSED 는 별도 안내 (모집 종료), FULL 은 정원 마감.
  const isCapacityReached = post.status === 'FULL';
  const isClosed = post.status === 'CLOSED';
  const isInactive = isCapacityReached || isClosed;
  // 진짜 application id 가 도착해야만 "취소" 버튼 활성. pending 상태에선 비활성 + 라벨 분기.
  const isApplied = Boolean(myApplication?.id);
  const cancelDisabled = isPendingApplication || cancelMutation.isPending;
  const palette = paletteFor(post);
  const ownerNick = post.owner?.nickname ?? '익명';
  const errAlert =
    applyErrorMessage(applyMutation.error) ?? cancelErrorMessage(cancelMutation.error);
  // #310 — me 가 아직 처음 도착도 안 했고 401 도 아직 안 떨어졌으면 placeholder.
  // CR review #350: 캐시된 data 가 있는데 백그라운드 refetch (isFetching=true) 중일 땐
  // 깜빡임이 발생하지 않으므로 placeholder 를 띄우면 안 된다.
  //   - isLoading: true  → 초기 fetch in-flight, data 없음 → 깜빡임 위험 ✓ placeholder
  //   - isFetching && data: 백그라운드 refetch, 화면엔 이미 me 가 있음 → placeholder X
  //   - 401 error: 비로그인 확정 → placeholder X
  const meErrorStatus = meQuery.error?.response?.status;
  const meSettled = !meQuery.isLoading || meQuery.data != null || meErrorStatus === 401;

  return (
    <PageShell>
      <main className="relative z-10 max-w-3xl mx-auto px-5 lg:px-10 pt-8 pb-16">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-sm font-round font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
        >
          ← 모집 둘러보기
        </a>

        <article
          aria-label={`모임: ${post.title}`}
          className={cn(
            'mt-6 rounded-[32px] p-7 lg:p-10 relative overflow-hidden shadow-xl',
            palette.gradient,
            palette.text,
          )}
        >
          <div
            aria-hidden="true"
            className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-round font-bold tracking-wider backdrop-blur',
                palette.chip,
              )}
            >
              <span aria-hidden="true">🗓</span> {formatMeetAt(post.meetAt)}
            </span>
            <CapacityMeter
              currentCapacity={post.currentCapacity}
              capacity={post.capacity}
              tone="dark"
            />
          </div>

          <div className="mt-6 flex items-start gap-4">
            <span aria-hidden="true" className="emoji text-6xl drop-shadow-md">
              {emojiFor(post)}
            </span>
            <h1 className="font-display font-extrabold text-3xl lg:text-4xl leading-tight">
              {post.title}
            </h1>
          </div>

          {post.tags?.length ? (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="태그">
              {post.tags.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-round font-bold',
                    palette.chip,
                  )}
                >
                  #{t.name}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-6 whitespace-pre-wrap font-round leading-relaxed text-[15px] opacity-95">
            {post.body}
          </p>

          <div className="mt-7 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 rounded-full bg-amber-200 text-amber-900 font-display font-extrabold items-center justify-center text-sm"
            >
              {initialOf(ownerNick)}
            </span>
            <span className="text-sm font-round font-bold opacity-90">방장 {ownerNick}</span>
          </div>

          {post.openChatUrl ? (
            <a
              data-testid="open-chat-link"
              href={post.openChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'mt-7 inline-flex items-center gap-2 rounded-full px-5 py-3 font-display font-extrabold text-sm shadow-lg',
                palette.btn,
              )}
            >
              💬 카카오 오픈채팅 열기 <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </article>

        <section className="mt-8" aria-label="신청">
          {!meSettled ? (
            // #310 — me query 가 아직 해소되지 않았을 때 placeholder. 신청 버튼 깜빡임 방지.
            <div
              data-testid="apply-section-placeholder"
              role="status"
              aria-label="로그인 정보 확인 중"
              className="inline-flex items-center gap-2 rounded-full bg-slate-200/70 dark:bg-white/10 px-7 py-3 font-display font-extrabold text-base text-slate-500 dark:text-slate-300 animate-pulse"
            >
              <span aria-hidden="true">⏳</span> 로그인 정보 확인 중…
            </div>
          ) : isClosed ? (
            // #310 — CLOSED 는 신청 자체가 의미 없음. 안내만.
            <p
              data-testid="apply-section-closed"
              className="inline-flex items-center gap-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 font-display font-extrabold text-base"
            >
              <span aria-hidden="true">🔒</span> 모집 종료된 모임이야
            </p>
          ) : (
            <ApplySection
              post={post}
              isOwner={isOwner}
              meQueryData={meQuery.data}
              isApplied={isApplied}
              isPendingApproval={isPendingApproval}
              isRejected={isRejected}
              isCapacityReached={isCapacityReached}
              isInactive={isInactive}
              isPendingApplication={isPendingApplication}
              cancelDisabled={cancelDisabled}
              isSchoolUnverified={isSchoolUnverified}
              applyMutation={applyMutation}
              cancelMutation={cancelMutation}
              closeMutation={closeMutation}
            />
          )}

          {errAlert ? (
            <p role="alert" className="mt-3 text-rose-600 dark:text-rose-300 font-round font-bold">
              {errAlert}
            </p>
          ) : null}
        </section>
      </main>
    </PageShell>
  );
};
