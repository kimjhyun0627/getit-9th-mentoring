import { PROJECTS } from '../data/projects.js';

import { ProjectCard } from './ProjectCard.jsx';

/**
 * Projects 섹션 + 4 카드 그리드.
 * 1px hairline 트릭:
 *  - 컨테이너 background를 hairline 톤으로 깔고
 *  - gap-px 로 카드 사이를 1px 만큼 띄우면
 *  - 카드(bg-background)가 hairline 위에 떠 보이며 분리선이 1px 라인처럼 보임.
 */
export const CardGrid = () => {
  return (
    <section id="projects" className="border-t border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 md:py-28">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              — Projects
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              네 개의 제품.
            </h2>
          </div>
          <p className="text-sm text-muted-foreground md:max-w-xs md:text-right">
            SSO 하나로 네 서비스를 자유롭게 오갈 수 있어요.
          </p>
        </div>

        <ul
          aria-label="프로젝트 목록"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROJECTS.map((project) => (
            <ProjectCard key={project.href} {...project} />
          ))}
        </ul>
      </div>
    </section>
  );
};
