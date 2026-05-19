import { PROJECTS } from '../data/projects.js';

import { ProjectCard } from './ProjectCard.jsx';

/**
 * Projects 섹션 (Tech-Dark) — 2×2 카드 그리드.
 * - 배경: scene-dark (radial 글로우 + 48px 그리드)
 * - 마커: `[02] services` mono + cyan prefix
 * - 우상단: dotted divider + "04 modules"
 * - 그리드: 1 col(mobile) → 2 col(md+). lg에서도 2 col 유지 (시안 패턴)
 *
 * landing(self) 카드는 제외 — 4 프로젝트만 노출.
 */
export const CardGrid = () => {
  return (
    <section id="projects" className="scene-dark relative overflow-hidden border-t border-hairline">
      <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28 lg:px-10">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
              <span className="text-cyan-700 dark:text-cyan-neon">[02]</span> services
            </p>
            <h2 className="font-mono text-3xl font-semibold tracking-tight text-ink-950 md:text-4xl dark:text-white">
              네 개의 모듈.
            </h2>
          </div>
          <div
            aria-hidden="true"
            className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:flex dark:text-zinc-500"
          >
            <div className="divider-mono w-24 text-zinc-300 dark:text-zinc-700" />
            <span>04 modules</span>
          </div>
        </div>

        <ul aria-label="프로젝트 목록" className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {PROJECTS.map((project) => (
            <ProjectCard key={project.href} {...project} />
          ))}
        </ul>
      </div>
    </section>
  );
};
