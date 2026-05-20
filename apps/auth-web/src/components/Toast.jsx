import { useEffect, useState } from 'react';

/**
 * 간단한 1회용 토스트 — 페이지 전체 상태 라이브러리 없이.
 * Issue #272 (로그인/가입 성공 토스트) 용.
 */
export const Toast = ({ message, tone = 'success', durationMs = 2400, onDone }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDone]);

  if (!message || !visible) return null;

  const palette =
    tone === 'success'
      ? 'border-cyan-700/40 bg-cyan-50/80 text-cyan-800 dark:border-cyan-neon/40 dark:bg-cyan-neon/10 dark:text-cyan-neon'
      : 'border-destructive/40 bg-destructive/5 text-destructive';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-md border px-4 py-2 font-mono text-[12px] backdrop-blur ${palette}`}
    >
      {message}
    </div>
  );
};
