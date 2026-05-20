/**
 * 외부 사이트(새 탭 또는 외부 origin) 표시용 시각 인디케이터 (#284).
 * - 메인 컨텐츠 방해 X (zinc-400 / dark:zinc-500)
 * - mono 약물 `↗` — Tech-Dark 톤과 일치
 * - aria-hidden (인접한 sr-only "새 탭에서 열림" 텍스트가 의미 담당)
 *
 * @param {{ className?: string }} props
 */
export const ExternalLinkIcon = ({ className = '' }) => (
  <span
    data-testid="external-link-indicator"
    aria-hidden="true"
    className={`font-mono text-[0.85em] leading-none text-zinc-400 dark:text-zinc-500 ${className}`}
  >
    ↗
  </span>
);
