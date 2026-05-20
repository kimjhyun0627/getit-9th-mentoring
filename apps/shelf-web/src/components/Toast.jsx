import { useEffect } from 'react';

/**
 * 일회용 토스트 — 단일 메시지를 상단에서 잠깐 띄움.
 * `duration` 후 자동 dismiss. role="status" 로 SR 알림.
 *
 * 단일 토스트 컴포넌트 (#294 이전 호환용). 다중 메시지가 빠르게 들어오는 경우엔
 * `useToastQueue` + `ToastStack` 을 사용. 같은 message 가 반복되면 stack 에서 counter 로 머지.
 *
 * @param {{
 *   message: string | null,
 *   variant?: 'success' | 'error',
 *   duration?: number,
 *   onDismiss: () => void,
 * }} props
 */
export const Toast = ({ message, variant = 'success', duration = 2400, onDismiss }) => {
  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const tone =
    variant === 'error'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-border bg-background text-ink';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-sm border ${tone} px-4 py-2 font-serif text-sm shadow-sm`}
    >
      {message}
    </div>
  );
};

/**
 * @typedef {import('./useToastQueue.js').ToastItem} ToastItem
 */

/**
 * 다중 토스트 스택 — 상단 가운데에 세로 배치 (#294).
 * 같은 메시지가 반복되면 ×N 카운터가 라벨에 표시됨 (깜빡임 X).
 *
 * @param {{ items: ToastItem[], onDismiss: (id: number) => void }} props
 */
export const ToastStack = ({ items, onDismiss }) => {
  if (!items || items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-6 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
    >
      {items.map((t) => {
        const tone =
          t.variant === 'error'
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-border bg-background text-ink';
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-sm border ${tone} px-4 py-2 font-serif text-sm shadow-sm`}
          >
            <span>{t.message}</span>
            {t.count > 1 ? (
              <span
                className="smallcaps rounded-sm border border-current px-1.5 py-0.5 text-[10px]"
                aria-label={`${t.count}번 반복`}
              >
                ×{t.count}
              </span>
            ) : null}
            <button
              type="button"
              className="text-meta ml-1 text-[12px] underline-offset-2 hover:underline"
              onClick={() => onDismiss(t.id)}
              aria-label="알림 닫기"
            >
              닫기
            </button>
          </div>
        );
      })}
    </div>
  );
};
