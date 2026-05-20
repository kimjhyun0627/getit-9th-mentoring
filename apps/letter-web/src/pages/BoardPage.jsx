import { useState } from 'react';

import { ComposeModal } from '../components/ComposeModal.jsx';

/**
 * 임시 보드 페이지 — letter-fe-board (#54) 머지 시 교체.
 *
 * 지금은 FAB 만 노출해서 ComposeModal 을 띄우는 최소 화면.
 * 실제 메시지 목록 / 그리드 / 폴링은 #54 PR 에서 합쳐서 들어온다.
 */
export const BoardPage = () => {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative">
      <header className="mb-8 flex flex-col gap-3">
        <p className="font-pen text-3xl leading-none text-sageDk dark:text-sageW">
          우리들의 한 마디
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink dark:text-beige sm:text-5xl">
          GETIT 9기 롤링페이퍼
        </h1>
        <p className="font-hand text-base text-ink2 dark:text-beige2">
          이름은 숨기고, 마음은 전하고. 부원실 벽에 살며시 붙여둔 한 줄이에요.
        </p>
      </header>

      <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-ink/20 bg-white/40 p-10 text-center dark:border-beige/20 dark:bg-mocha2/40">
        <p className="font-hand text-lg text-ink2 dark:text-beige2">
          아직 보드 뷰가 준비되지 않았어요. FAB 으로 메시지 작성을 먼저 체험해보세요.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="새 메시지 남기기"
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-semibold text-cream shadow-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peachDk focus-visible:ring-offset-2 focus-visible:ring-offset-cream dark:bg-beige dark:text-mocha dark:focus-visible:ring-rose dark:focus-visible:ring-offset-mocha2"
      >
        <span className="font-pen text-2xl leading-none">+</span>
        <span>메시지 남기기</span>
      </button>

      <ComposeModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
};
