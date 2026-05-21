import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  BoardStatusLive,
  EmptyBoard,
  ErrorState,
  LoadingGrid,
} from '../components/BoardStates.jsx';
import { ComposeModal } from '../components/ComposeModal.jsx';
import { EditModal } from '../components/EditModal.jsx';
import { Postit } from '../components/Postit.jsx';
import { api } from '../lib/api.js';
import { readSortMode, sortMessages, writeSortMode } from '../lib/sort.js';

/**
 * `/` — 익명 롤링페이퍼 메인 화이트보드.
 *
 * Phase 6c P2/P3 통합:
 *  - #279: 30초 polling + window focus refetch
 *  - #305: 작성 성공 시 aria-live 토스트 ("✓ 한 줄 살며시 붙였어요")
 *  - #304: 카운트 변화 aria-live=polite (SR 안내)
 *  - #303: grid bottom padding (FAB 마지막 카드 가림 방지)
 *  - #306: meQuery 401 → SSO redirect, 그 전엔 보드 비노출
 *  - #324: role=list 제거, Postit article 에 listitem 으로 부여
 *  - #307: 정렬 토글 (최신 / 무작위) + localStorage persist
 */
export const BoardPage = () => {
  const [composeOpen, setComposeOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(/** @type {null | any} */ (null));
  const [sortMode, setSortMode] = useState(/** @type {'latest'|'random'} */ ('latest'));
  const [statusLive, setStatusLive] = useState('');
  const queryClient = useQueryClient();

  // CR #345 — 같은 문구 연속 announce. 한 번 비웠다 다시 셋팅해야 SR 이 재발화.
  const announceStatus = (msg) => {
    setStatusLive('');
    window.setTimeout(() => setStatusLive(msg), 0);
  };

  // localStorage 는 effect 안에서만 (SSR / 테스트 안전).
  useEffect(() => {
    setSortMode(readSortMode());
  }, []);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const isAuthed = meQuery.isSuccess;

  // #279 — 30초 polling + window focus refetch. 부원 ~50명 + GET limit 60/min 안전.
  const messagesQuery = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const res = await api.listMessages();
      return /** @type {any[]} */ (res.data?.items ?? []);
    },
    enabled: isAuthed,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteMessage(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['messages'] });
      const prev = queryClient.getQueryData(['messages']);
      queryClient.setQueryData(['messages'], (old) =>
        Array.isArray(old) ? old.filter((m) => m.id !== id) : old,
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['messages'], ctx.prev);
    },
    onSuccess: () => announceStatus('쪽지를 떼어냈어요'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  });

  // #307 — sortMode 따라 표시 정렬. random 은 sessionSeed deterministic.
  // rawItems 를 useMemo deps 에 넣으면 매 렌더 fresh array 라 useless cache —
  // messagesQuery.data 를 직접 deps 로 (react-hooks/exhaustive-deps 경고 회피).
  const items = useMemo(
    () => sortMessages(messagesQuery.data ?? [], sortMode),
    [messagesQuery.data, sortMode],
  );
  const count = items.length;

  const onSortToggle = (next) => {
    setSortMode(next);
    writeSortMode(next);
  };

  // #306 — 세션 핑 단계.
  if (meQuery.isLoading) {
    return (
      <section className="paper relative">
        <div className="relative z-10">
          <LoadingGrid />
        </div>
      </section>
    );
  }
  if (meQuery.isError) {
    const meStatus = /** @type {{response?:{status?:number}}} */ (meQuery.error)?.response?.status;
    if (meStatus === 401) {
      return (
        <section className="paper relative">
          <div className="relative z-10 mx-auto max-w-md py-16 text-center">
            <p className="font-hand text-base text-ink2 dark:text-beige2">
              로그인 페이지로 이동 중이에요…
            </p>
          </div>
        </section>
      );
    }
    return (
      <section className="paper relative">
        <div className="relative z-10">
          <ErrorState onRetry={() => meQuery.refetch()} />
        </div>
      </section>
    );
  }

  return (
    <section className="paper relative">
      <div className="relative z-10">
        <TitleStrip count={count} sortMode={sortMode} onSortToggle={onSortToggle} />

        {/* #304 / #305 — sr-only aria-live 상태 영역. mutation 결과를 SR 에 통지. */}
        <BoardStatusLive message={statusLive} />

        {deleteMutation.isError ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-200"
          >
            쪽지를 떼지 못했어요. 잠시 후 다시 시도해주세요.
          </div>
        ) : null}

        {messagesQuery.isLoading ? (
          <LoadingGrid />
        ) : messagesQuery.isError ? (
          <ErrorState onRetry={() => messagesQuery.refetch()} />
        ) : count === 0 ? (
          <EmptyBoard />
        ) : (
          <MessageGrid
            items={items}
            onEdit={(m) => setEditTarget(m)}
            onDelete={(m) => deleteMutation.mutate(m.id)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        aria-label="새 메시지 남기기"
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream shadow-[0_18px_32px_-14px_rgba(58,46,39,0.55)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-beige dark:text-mocha"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <span aria-hidden="true" className="font-hand text-xl leading-none">
          +
        </span>
        메시지 남기기
      </button>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => {
          setComposeOpen(false);
          announceStatus('한 줄 살며시 붙였어요');
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }}
      />
      <EditModal
        open={editTarget !== null}
        message={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null);
          announceStatus('쪽지를 다시 다듬었어요');
        }}
      />
    </section>
  );
};

/**
 * @param {{ count: number, sortMode: 'latest'|'random', onSortToggle: (m: 'latest'|'random') => void }} props
 */
const TitleStrip = ({ count, sortMode, onSortToggle }) => (
  <div className="mb-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-pen text-3xl leading-none text-sageDk sm:text-4xl dark:text-sageW">
          우리들의 한 줄
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight leading-tight sm:text-5xl">
          <span className="[font-family:Inter,system-ui,-apple-system,sans-serif]">GETIT</span> 9기{' '}
          <span className="scribble">롤링페이퍼</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink2 sm:text-base dark:text-beige2">
          이름은 숨기고, 마음은 전하고. 부원실 벽에 살며시 붙여둔 한 줄이에요.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <SortToggle value={sortMode} onChange={onSortToggle} />
        {/* #304 — 카운트 영역 aria-live: SR 사용자가 추가/삭제를 인지. */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="font-hand text-sm text-ink2/80 sm:text-base dark:text-beige2/80"
        >
          {count > 0 ? (
            <>
              총 <span className="font-bold text-ink dark:text-beige">{count}</span>장의 쪽지가
              붙어있어요
            </>
          ) : (
            '벽이 비어있어요'
          )}
        </div>
      </div>
    </div>
    <div className="stitch mt-6 opacity-70" />
  </div>
);

/**
 * #307 — 정렬 토글 (라디오 그룹).
 *
 * @param {{ value: 'latest'|'random', onChange: (m: 'latest'|'random') => void }} props
 */
const SortToggle = ({ value, onChange }) => (
  <div
    role="radiogroup"
    aria-label="정렬 방식"
    className="inline-flex rounded-full border border-ink/15 bg-white/65 p-0.5 text-xs font-medium text-ink2 shadow-sm dark:border-beige/20 dark:bg-mocha3/55 dark:text-beige2"
  >
    {[
      ['latest', '최신순'],
      ['random', '무작위'],
    ].map(([mode, label]) => (
      <button
        key={mode}
        type="button"
        role="radio"
        aria-checked={value === mode}
        onClick={() => onChange(/** @type {'latest'|'random'} */ (mode))}
        className={
          value === mode
            ? 'rounded-full bg-ink px-3 py-1 text-cream dark:bg-beige dark:text-mocha'
            : 'rounded-full px-3 py-1 hover:text-ink dark:hover:text-beige'
        }
      >
        {label}
      </button>
    ))}
  </div>
);

/**
 * @param {{ items: any[], onEdit: (m:any)=>void, onDelete: (m:any)=>void }} props
 */
const MessageGrid = ({ items, onEdit, onDelete }) => (
  // #303 — 모바일 bottom padding 추가로 마지막 카드 FAB 가림 방지.
  // #324 — wrapping div 의 role=listitem 제거. Postit article 자체에 listitem role.
  <ul
    aria-label="쪽지 목록"
    className="grid grid-cols-1 gap-6 pb-28 sm:grid-cols-2 sm:gap-7 sm:pb-10 md:grid-cols-3 lg:grid-cols-4"
  >
    {items.map((message) => (
      <li key={message.id} className="list-none">
        <Postit message={message} onEdit={onEdit} onDelete={onDelete} />
      </li>
    ))}
  </ul>
);
