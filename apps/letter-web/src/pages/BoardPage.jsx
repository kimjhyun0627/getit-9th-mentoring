import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ComposeModal } from '../components/ComposeModal.jsx';
import { EditModal } from '../components/EditModal.jsx';
import { Postit } from '../components/Postit.jsx';
import { api } from '../lib/api.js';

/**
 * `/` — 익명 롤링페이퍼 메인 화이트보드 (#54 + #55 + #249 통합).
 *
 * Warm 시안 (`docs/design/letter/warm.html`) 1:1:
 *  - 따뜻한 베이지 벽지 + 종이 노이즈 텍스처 (.paper)
 *  - 포스트잇 그리드 (1열 → 4열 반응형)
 *  - 본인 메시지는 "내 메시지" 라벨 + 편집/삭제 (#249 — onEdit/onDelete 연결)
 *  - 익명 메시지는 본문 + 시간만
 *  - FAB → ComposeModal (#55, 색 선택 + 작성)
 *
 * 보안 / 익명성 (#305):
 *  - 마운트 시 GET /api/me 핑 — 비로그인이면 axios 인터셉터가 SSO 로 redirect.
 *  - 세션 확인 전엔 보드 데이터 (메시지) 자체를 안 부른다 (UI 누설 차단).
 *
 * 데이터: GET /api/messages — `{ items: [{ id, content, color, createdAt, is_mine }] }`.
 * authorId / updatedAt 은 BE 응답에 없음 (익명성 — #250, #251).
 */
export const BoardPage = () => {
  const [composeOpen, setComposeOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(
    /** @type {null | import('../components/Postit.jsx').Message} */ (null),
  );
  const queryClient = useQueryClient();

  // #305 — 세션 게이트. 401 이면 main.jsx 의 setUnauthorizedHandler 가 SSO redirect.
  // retry: false (재시도 시 SSO 루프 위험). 성공 후 staleTime 길게 잡아 핑 절감.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const isAuthed = meQuery.isSuccess;

  const messagesQuery = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const res = await api.listMessages();
      return /** @type {Array<import('../components/Postit.jsx').Message>} */ (
        res.data?.items ?? []
      );
    },
    enabled: isAuthed, // 세션 확정 전엔 보드 안 부른다.
  });

  // #249 — 삭제 mutation. 옵티미스틱 update 로 즉시 카드 사라짐, 실패 시 롤백.
  // onSettled 로 성공/실패 무관 invalidate (Gemini #335 review): 옵티미스틱 결과에만
  // 의존하면 다른 사용자의 동시 변경이 반영되지 않을 수 있어 서버 진실로 다시 sync.
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
      // 실패 시 옵티미스틱 롤백. 사용자에게는 보드 상단 banner 로 알림 (#249 DoD).
      if (ctx?.prev) queryClient.setQueryData(['messages'], ctx.prev);
    },
    onSettled: () => {
      // 성공/실패 무관 — 서버 진실과 다시 sync.
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  const items = messagesQuery.data ?? [];
  const count = items.length;

  // 세션 핑 진행 중 — 짧은 placeholder. 401 이면 redirect 가 발화하므로 영구 spinner 아님.
  if (meQuery.isLoading) {
    return (
      <section className="paper relative">
        <div className="relative z-10">
          <LoadingGrid />
        </div>
      </section>
    );
  }

  // CR #335 — 401 와 그 외(네트워크/500) 를 분기. 401 만 redirect placeholder,
  // 그 외는 재시도 가능한 ErrorState. 다 같이 묶으면 BE down 시 영원히 막힘.
  if (meQuery.isError) {
    const meStatus = /** @type {{response?: {status?: number}}} */ (meQuery.error)?.response
      ?.status;
    if (meStatus === 401) {
      return (
        <section className="paper relative">
          <div className="relative z-10 mx-auto max-w-md py-16 text-center">
            <p className="font-hand text-sm text-ink2 dark:text-beige2">
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
        <TitleStrip count={count} />

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
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }}
      />

      <EditModal
        open={editTarget !== null}
        message={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => setEditTarget(null)}
      />
    </section>
  );
};

/**
 * 시안의 타이틀 strip (eyebrow + h1 + 카운트).
 *
 * @param {{ count: number }} props
 */
const TitleStrip = ({ count }) => (
  <div className="mb-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-pen text-2xl leading-none text-sageDk sm:text-3xl dark:text-sageW">
          우리들의 한 줄
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight leading-tight sm:text-5xl">
          GETIT 9기 <span className="scribble">롤링페이퍼</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink2 sm:text-base dark:text-beige2">
          이름은 숨기고, 마음은 전하고. 부원실 벽에 살며시 붙여둔 한 줄이에요.
        </p>
      </div>
      {count > 0 ? (
        <div className="font-hand text-xs text-ink2/80 sm:text-sm dark:text-beige2/80">
          총 <span className="font-bold text-ink dark:text-beige">{count}</span>장의 쪽지가
          붙어있어요
        </div>
      ) : (
        <div className="font-hand text-xs text-ink2/80 sm:text-sm dark:text-beige2/80">
          벽이 비어있어요
        </div>
      )}
    </div>
    <div className="stitch mt-6 opacity-70" />
  </div>
);

/**
 * 메시지 그리드 — 1열(모바일) → 2/3/4열 반응형.
 *
 * @param {{
 *   items: Array<import('../components/Postit.jsx').Message>,
 *   onEdit: (m: import('../components/Postit.jsx').Message) => void,
 *   onDelete: (m: import('../components/Postit.jsx').Message) => void,
 * }} props
 */
const MessageGrid = ({ items, onEdit, onDelete }) => (
  <div
    aria-label="쪽지 목록"
    role="list"
    className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 md:grid-cols-3 lg:grid-cols-4"
  >
    {items.map((message) => (
      <div role="listitem" key={message.id}>
        <Postit message={message} onEdit={onEdit} onDelete={onDelete} />
      </div>
    ))}
  </div>
);

const LoadingGrid = () => (
  <div
    role="status"
    aria-label="쪽지 불러오는 중"
    className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  >
    {['a', 'b', 'c', 'd', 'e', 'f'].map((slot) => (
      <div
        key={slot}
        className="h-40 animate-pulse rounded-[6px_18px_8px_14px] bg-white/55 dark:bg-mocha3/45"
      />
    ))}
  </div>
);

const EmptyBoard = () => (
  <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-[6px_18px_8px_14px] border-2 border-dashed border-ink2/25 bg-white/55 px-6 py-16 text-center dark:border-beige2/30 dark:bg-mocha3/45">
    <div className="font-pen text-4xl text-peachDk dark:text-rose">+</div>
    <p className="text-sm font-medium text-ink dark:text-beige">아직 쪽지가 없어요</p>
    <p className="font-hand text-base text-ink2 dark:text-beige2">첫 한 줄을 살며시 붙여주세요</p>
    <p className="font-hand text-xs text-sageDk dark:text-sageW">
      이름은 표시되지 않아요 · 마음만 전해져요
    </p>
  </div>
);

/**
 * @param {{ onRetry: () => void }} props
 */
const ErrorState = ({ onRetry }) => (
  <div
    role="alert"
    className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-[6px_18px_8px_14px] border-2 border-dashed border-destructive/40 bg-white/65 px-6 py-16 text-center dark:bg-mocha3/55"
  >
    <p className="text-sm font-semibold text-ink dark:text-beige">쪽지를 불러오지 못했어요</p>
    <p className="text-xs leading-relaxed text-ink2 dark:text-beige2">
      잠깐 연결이 끊겼나봐요. 새로고침해볼까요?
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-2 inline-flex h-9 items-center justify-center rounded-full border border-ink/15 bg-white/80 px-4 text-sm font-medium text-ink transition hover:bg-white dark:border-beige/25 dark:bg-mocha3/70 dark:text-beige dark:hover:bg-mocha3"
    >
      다시 시도
    </button>
  </div>
);
