import { useTheme } from './store.js';

/**
 * 다크/라이트 토글 버튼. 우상단 배치 권장.
 *
 * @param {{ className?: string }} props
 */
export const ThemeToggle = ({ className }) => {
  const resolved = useTheme((s) => s.resolved);
  const toggle = useTheme((s) => s.toggle);
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? '라이트모드로 전환' : '다크모드로 전환'}
      aria-pressed={isDark}
      className={className}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};
