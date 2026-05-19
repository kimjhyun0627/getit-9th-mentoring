import { cn } from '../lib/cn.js';

/**
 * 폼 submit 버튼.
 * - 라이트: 검정 배경 + 흰 글씨
 * - 다크: 흰 배경 + 검정 글씨 (CSS variable로 자동 인버스)
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
}) => {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition',
        'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      {loading ? loadingText : children}
    </button>
  );
};
