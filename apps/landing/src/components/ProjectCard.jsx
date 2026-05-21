import { ACCENT_CLASSES } from '../data/accents.js';

import { ArrowIcon } from './ArrowIcon.jsx';
import { ExternalLinkIcon } from './ExternalLinkIcon.jsx';
import { BoardIcon, HobbyIcon, LetterIcon, ShelfIcon } from './ProjectIcons.jsx';

/**
 * slug → 아이콘 컴포넌트 매핑. PROJECT_ICONS 상수를 컴포넌트 파일에 두면
 * react-refresh 경고가 떠서 호출처 (ProjectCard.jsx) 에 inline 로 둔다.
 */
const PROJECT_ICONS = {
  HOBBY: HobbyIcon,
  SHELF: ShelfIcon,
  BOARD: BoardIcon,
  LETTER: LetterIcon,
};

/**
 * @typedef {import('../data/projects.js').Project} Project
 */

/**
 * Tech-Dark 카드 (data-accent별 hover 네온 outline + glow).
 * - 좌상단: `[NN]` badge (액센트 색) + slug (zinc-400)
 * - 우상단: `ID: XXX-NN` trace 라벨 (mono, 작게)
 * - 메인: 이모지 아이콘 + 한국어 title + 영문 subtitle (mono)
 * - 본문: 한 줄 설명 (zinc-600/400)
 * - 푸터: host (액센트 색) + `open ↗` 외부 링크 인디케이터 (group-hover 시 액센트)
 *
 * CSS의 `.card-tech[data-accent='...']:hover` 가 1px 네온 outline + glow를 그림.
 *
 * #360 — 클라이언트 요청으로 새 탭 오픈 복원 (PR #344 #225 same-tab → new-tab).
 *   - target="_blank" + rel="noopener noreferrer"
 *   - sr-only "새 탭에서 열림" + ExternalLinkIcon 시각 표시
 *
 * @param {Project} props
 */
export const ProjectCard = ({
  eyebrow,
  idLabel,
  slug,
  subtitle,
  title,
  href,
  emoji,
  description,
  hostLabel,
  accent,
}) => {
  const safeAccent = ACCENT_CLASSES[accent] ? accent : 'cyan';
  const tokens = ACCENT_CLASSES[safeAccent];
  const Icon = PROJECT_ICONS[slug] ?? null;
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-accent={safeAccent}
        aria-label={`${title} — 새 탭에서 열림`}
        className="card-tech group relative flex flex-col rounded-xl border border-hairline bg-white/70 p-7 backdrop-blur focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 dark:bg-ink-900/60 dark:focus-visible:outline-cyan-neon"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]">
            <span className={`rounded px-1.5 py-0.5 ${tokens.badge}`}>{eyebrow}</span>
            <span className="text-zinc-500 dark:text-zinc-400">{slug}</span>
          </div>
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{idLabel}</span>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid size-12 place-items-center rounded-lg border border-hairline bg-zinc-50 dark:bg-ink-850 ${tokens.text}`}
          >
            {Icon ? <Icon className="size-6" /> : <span className="text-2xl">{emoji}</span>}
          </span>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-ink-950 dark:text-white">
              {title}
            </h3>
            <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-500">{subtitle}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-hairline pt-6">
          <code className={`font-mono text-[11px] ${tokens.text}`}>{hostLabel}</code>
          <span
            className={`inline-flex items-center gap-1 font-mono text-xs text-zinc-700 dark:text-zinc-300 ${tokens.hoverText}`}
          >
            open
            <ArrowIcon className="arrow-x" size={14} />
            <ExternalLinkIcon />
          </span>
        </div>
      </a>
    </li>
  );
};
