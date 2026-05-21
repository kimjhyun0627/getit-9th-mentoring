/**
 * BoardPage 의 상태 표시 컴포넌트들 (loading / empty / error / live-status).
 *
 * - LoadingGrid: 회전 + 워시테이프 ghost 가 있는 포스트잇 스켈레톤 (#278)
 * - EmptyBoard: 빈 포스트잇 메타포 + 점선 워시테이프 (#277)
 * - ErrorState: 재시도 가능 에러 카드
 * - BoardStatusLive: sr-only aria-live 상태 영역 (#304 / #305)
 *
 * BoardPage 본체 (sort/polling/auth 로직) 의 라인 수를 줄이기 위해 분리.
 */
import { useEffect, useState } from 'react';

/**
 * @param {string} id
 * @returns {number}
 */
const seededAngle = (id) => {
  // -2.5 ~ +2.5 deg deterministic.
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const bounded = (((h % 51) + 51) % 51) - 25;
  return Math.round(bounded) / 10;
};

/**
 * Warm 페르소나 — 회전된 포스트잇 ghost 6개 + 워시테이프 ghost.
 * `prefers-reduced-motion` 존중 (animate-pulse 자체가 비활성됨).
 */
export const LoadingGrid = () => {
  const slots = ['a', 'b', 'c', 'd', 'e', 'f'];
  return (
    <div
      role="status"
      aria-label="쪽지 불러오는 중"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      {slots.map((slot) => {
        const angle = seededAngle(slot);
        return (
          <div
            key={slot}
            style={{ transform: `rotate(${angle}deg)` }}
            className="relative h-40 animate-pulse rounded-[6px_18px_8px_14px] bg-white/55 ring-1 ring-ink/5 dark:bg-mocha3/45 dark:ring-beige/5"
          >
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1.5 h-3 w-12 rounded-sm bg-ink/10 dark:bg-beige/10"
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * #277 — 가운데 빈 포스트잇 1장 (살짝 회전된 ghost) + 점선 워시테이프 + 손글씨 카피.
 * FAB 와 시각 연결되는 화살표 ghost 는 sr-only 텍스트로 대체 (시각 노이즈 회피).
 */
export const EmptyBoard = () => (
  <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <div
      aria-hidden="true"
      style={{ transform: 'rotate(-2deg)' }}
      className="relative rounded-[6px_18px_8px_14px] bg-note-lemon/80 px-10 py-12 shadow-sm ring-1 ring-ink/5 dark:bg-note-lemonDk/70 dark:ring-beige/10"
    >
      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-2 h-3 w-16 border-2 border-dashed border-ink2/40 bg-white/40 dark:border-beige2/40 dark:bg-mocha2/40" />
      <span className="font-pen text-4xl text-peachDk dark:text-rose">+</span>
    </div>
    <p className="mt-3 text-base font-medium text-ink dark:text-beige">아직 쪽지가 없어요</p>
    <p className="font-hand text-lg text-ink2 dark:text-beige2">첫 한 줄을 살며시 붙여주세요</p>
    <p className="font-hand text-sm text-sageDk dark:text-sageW">
      이름은 다른 부원에게 표시되지 않아요
    </p>
  </div>
);

/**
 * #304 / #305 — sr-only 라이브 영역. message prop 변경 시 SR 이 announce.
 * 일시 표시 후 자동 클리어 (중복 announce 방지).
 *
 * @param {{ message: string }} props
 */
export const BoardStatusLive = ({ message }) => {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!message) return undefined;
    setShown(message);
    const t = setTimeout(() => setShown(''), 4000);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {shown}
    </span>
  );
};

/**
 * @param {{ onRetry: () => void }} props
 */
export const ErrorState = ({ onRetry }) => (
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
