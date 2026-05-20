import { useEffect } from 'react';

/**
 * 일회용 토스트 — 단일 메시지를 상단에서 잠깐 띄움.
 * `duration` 후 자동 dismiss. role="status" 로 SR 알림.
 *
 * 외부 라이브러리 없이도 충분한 스코프 — 검색 페이지 1곳만.
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
