import { useTheme } from './store.js';

/**
 * Sun SVG (lucide-style, stroke-width 1.75, currentColor).
 * 다크모드에서 노출 — 클릭 시 라이트로 전환.
 */
const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

/**
 * Moon SVG (lucide-style, stroke-width 1.75, currentColor).
 * 라이트모드에서 노출 — 클릭 시 다크로 전환.
 */
const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/**
 * 다크/라이트 토글 버튼.
 * - 이모지 대신 인라인 SVG (Sun/Moon) 사용.
 * - 6 FE 앱 공통이므로 store/Provider/aria 시그니처는 보존.
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
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};
