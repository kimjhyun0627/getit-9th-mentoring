import { cn } from '../lib/cn.js';

/**
 * Tech-Dark 폼 submit 버튼 (Issue #172).
 * - 라이트: ink-950 솔리드 + cyan glyph (charcoal CTA 패턴)
 * - 다크: cyan-neon 솔리드 + ink-950 글씨 + 외곽 cyan glow
 * - mono `$ ` prefix 로 터미널 CTA 톤
 *
 * `bg-primary` / `text-primary-foreground` 토큰 계약 유지 (SubmitButton.test.jsx 가드).
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
  loadingText = '처리 중…',
  tone = 'primary',
}) => {
  const palette =
    tone === 'destructive'
      ? 'bg-destructive text-destructive-foreground hover:brightness-110'
      : 'bg-primary text-primary-foreground dark:shadow-[0_0_0_1px_hsla(var(--primary)/0.4),0_0_28px_-4px_hsla(var(--primary)/0.55)]';
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        'group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 font-mono text-sm font-semibold transition',
        palette,
        'hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-cyan-neon',
        className,
      )}
    >
      <span aria-hidden="true" className="opacity-60">
        $
      </span>
      <span>{loading ? loadingText : children}</span>
    </button>
  );
};
