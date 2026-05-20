import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ComposeModal } from '../components/ComposeModal.jsx';
import { Postit } from '../components/Postit.jsx';
import { api } from '../lib/api.js';

/**
 * `/` — 익명 롤링페이퍼 메인 화이트보드 (#54 + #55 통합).
 *
 * Warm 시안 (`docs/design/letter/warm.html`) 1:1:
 *  - 따뜻한 베이지 벽지 + 종이 노이즈 텍스처 (.paper)
 *  - 포스트잇 그리드 (1열 → 4열 반응형)
 *  - 본인 메시지는 "내 메시지" 라벨 + 편집/삭제 (대상 UI 만)
 *  - 익명 메시지는 본문 + 시간만
 *  - FAB → ComposeModal (#55, 색 선택 + 작성)
 *
 * 데이터: GET /api/messages — `{ items: [{ id, content, color, createdAt, updatedAt, is_mine }] }`.
 * authorId 는 API 응답에 절대 없음 (백엔드 serializer 보장).
 */
export const BoardPage = () => {
  const [composeOpen, setComposeOpen] = useState(false);
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const res = await api.listMessages();
      return /** @type {Array<import('../components/Postit.jsx').Message>} */ (
        res.data?.items ?? []
      );
    },
  });

  const items = messagesQuery.data ?? [];
  const count = items.length;

  return (
    <section className="paper relative">
      <div className="relative z-10">
        <TitleStrip count={count} />

        {messagesQuery.isLoading ? (
          <LoadingGrid />
        ) : messagesQuery.isError ? (
          <ErrorState onRetry={() => messagesQuery.refetch()} />
        ) : count === 0 ? (
          <EmptyBoard />
        ) : (
          <MessageGrid items={items} />
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
          우리들의 한 마디
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight leading-tight sm:text-5xl">
          GETIT 9기 <span className="scribble">롤링페이퍼</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink2 sm:text-base dark:text-beige2">
          이름은 숨기고, 마음은 전하고. 부원실 벽에 살며시 붙여둔 한 줄이에요.
        </p>
      </div>
      <div className="font-hand text-xs text-ink2/80 sm:text-sm dark:text-beige2/80">
        총 <span className="font-bold text-ink dark:text-beige">{count}</span>장의 쪽지가 붙어있어요
      </div>
    </div>
    <div className="stitch mt-6 opacity-70" />
  </div>
);

/**
 * 메시지 그리드 — 1열(모바일) → 2/3/4열 반응형.
 *
 * @param {{ items: Array<import('../components/Postit.jsx').Message> }} props
 */
const MessageGrid = ({ items }) => (
  <div
    aria-label="쪽지 목록"
    role="list"
    className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 md:grid-cols-3 lg:grid-cols-4"
  >
    {items.map((message) => (
      <div role="listitem" key={message.id}>
        <Postit message={message} />
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
    <p className="font-hand text-base text-ink2 dark:text-beige2">
      여기에 당신의 한 줄을 살며시 붙여주세요
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
      네트워크 상태를 확인한 뒤 다시 시도해줘.
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
