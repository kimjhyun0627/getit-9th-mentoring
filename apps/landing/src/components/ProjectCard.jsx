/**
 * @typedef {object} ProjectCardProps
 * @property {string} eyebrow - 카드 우상단 메타 (e.g. "01")
 * @property {string} title - 프로젝트명 (한국어)
 * @property {string} href - 서브도메인 URL
 * @property {string} emoji - 임시 아이콘
 * @property {string} description - 한 줄 설명
 * @property {string} hostLabel - 카드 하단 도메인 라벨
 */

/**
 * Minimalist 카드.
 * - shadow 0, 호버 시 배경만 살짝 변화 (no lift/scale)
 * - 호버 시 인디고 화살표가 translate-x
 * - 1px hairline 시스템에 맞춰 카드 자체 배경은 `bg-background`
 *
 * @param {ProjectCardProps} props
 */
export const ProjectCard = ({ eyebrow, title, href, emoji, description, hostLabel }) => {
  return (
    <li className="group bg-background">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${title} — 새 탭에서 열림`}
        className="flex h-full flex-col p-8 transition duration-200 hover:bg-foreground/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="mb-10 flex items-center justify-between">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-md border border-hairline text-base"
          >
            {emoji}
          </span>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
            {eyebrow}
          </span>
        </div>

        <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-10 flex items-center justify-between border-t border-hairline pt-4 text-xs text-muted-foreground">
          <span className="font-mono">{hostLabel}</span>
          <svg
            className="h-3.5 w-3.5 transition duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </div>
      </a>
    </li>
  );
};
