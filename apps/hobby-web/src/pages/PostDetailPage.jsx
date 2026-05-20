import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { CapacityMeter } from '../components/CapacityMeter.jsx';
import { emojiFor, paletteFor } from '../data/palette.js';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { formatMeetAt, initialOf } from '../lib/format.js';

import {
  applyErrorMessage,
  cancelErrorMessage,
  fetchErrorMessage,
} from './PostDetailPage.errors.js';
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
  const queryClient = useQueryClient();
  const postKey = ['post', id];

  const postQuery = useQuery({
    queryKey: postKey,
    queryFn: () => api.getPost(id),
    enabled: Boolean(id),
    retry: false,
  });

  // /me 는 비로그인(401) 이 정상 케이스. retry 끄고, 실패해도 페이지 렌더는 계속.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

  // #212: 신청 여부 식별은 서버 응답 myApplication 으로. reload 후에도 유지됨.
  // optimistic 업데이트는 query cache 의 myApplication 을 함께 set/clear.
  const myApplication = postQuery.data?.post?.myApplication ?? null;

  const applyMutation = useMutation({
    mutationFn: () => api.applyPost(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKey });
      const prev = queryClient.getQueryData(postKey);
      queryClient.setQueryData(postKey, (old) =>
        old
          ? {
              post: {
                ...old.post,
                currentCapacity: old.post.currentCapacity + 1,
                myApplication: old.post.myApplication ?? { id: '__pending__', createdAt: '' },
              },
            }
          : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(postKey, ctx.prev);
    },
    onSuccess: (data) => {
      // 서버에서 받은 application id 로 cache 갱신.
      queryClient.setQueryData(postKey, (old) =>
        old
          ? {
              post: {
                ...old.post,
                myApplication: { id: data.application.id, createdAt: data.application.createdAt },
              },
            }
          : old,
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!myApplication?.id) throw new Error('no application to cancel');
      return api.cancelApplication(myApplication.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKey });
      const prev = queryClient.getQueryData(postKey);
      queryClient.setQueryData(postKey, (old) =>
        old
          ? {
              post: {
                ...old.post,
                currentCapacity: Math.max(0, old.post.currentCapacity - 1),
                myApplication: null,
              },
            }
          : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(postKey, ctx.prev);
    },
  });

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
  const isFull = post.status === 'FULL' || post.status === 'CLOSED';
  const isApplied = Boolean(myApplication?.id);
  const palette = paletteFor(post);
  const ownerNick = post.owner?.nickname ?? '익명';
  const errAlert =
    applyErrorMessage(applyMutation.error) ?? cancelErrorMessage(cancelMutation.error);

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
          {isOwner ? (
            <p className="rounded-2xl bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 p-5 font-round text-slate-700 dark:text-slate-200">
              이 모임의 방장이야. 정원 차면 카카오 오픈채팅이 신청자에게 자동 공개돼.
            </p>
          ) : !meQuery.data ? (
            <a
              href={`https://auth.get-it.cloud/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-6 py-3 font-display font-extrabold text-base shadow-lg"
            >
              로그인하고 신청하기 →
            </a>
          ) : isApplied ? (
            <button
              type="button"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/10 dark:ring-white/15 text-slate-700 dark:text-slate-200 px-6 py-3 font-display font-extrabold text-base shadow-sm disabled:opacity-50 hover:scale-[1.02] transition"
            >
              {cancelMutation.isPending ? '취소 중…' : '신청 취소'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || isFull}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 text-white px-7 py-3 font-display font-extrabold text-base shadow-lg shadow-rose-400/40 disabled:opacity-50 hover:scale-[1.03] hover:-rotate-1 transition"
            >
              {applyMutation.isPending ? '신청 중…' : isFull ? '정원 마감' : '신청하기'}
              {!applyMutation.isPending && !isFull ? <span aria-hidden="true">→</span> : null}
            </button>
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
