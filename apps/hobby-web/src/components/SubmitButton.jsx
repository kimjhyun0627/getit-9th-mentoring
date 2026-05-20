import { cn } from '../lib/cn.js';

/**
 * Playful 톤의 submit 버튼.
 * - 라이트: rose 그라데이션 + 흰 글씨 + rose glow shadow
 * - 다크: amber-300 inverse
 * - 호버: 살짝 회전 + scale up
 *
 * @param {{
 *   children: import('react').ReactNode;
 *   loading?: boolean;
 *   disabled?: boolean;
 *   className?: string;
 *   loadingText?: string;
 * }} props
 */
export const SubmitButton = ({
  children,
  loading = false,
  disabled = false,
  className,
  loadingText = '만드는 중…',
}) => {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 font-display text-base font-extrabold transition',
        'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 text-white shadow-lg shadow-rose-400/40',
        'hover:scale-[1.02] hover:-rotate-[0.5deg] active:scale-[0.99]',
        // #311 — disabled 는 그라데이션 + opacity 대신 단색 muted. 글자 가독성 확보 (WCAG AA).
        'disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:hover:scale-100 disabled:hover:rotate-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'dark:from-amber-300 dark:via-amber-300 dark:to-amber-200 dark:text-slate-900 dark:shadow-amber-300/30 dark:focus-visible:ring-amber-300',
        'dark:disabled:bg-slate-700 dark:disabled:text-slate-300 dark:disabled:shadow-none',
        className,
      )}
    >
      {loading ? loadingText : children}
    </button>
  );
};
