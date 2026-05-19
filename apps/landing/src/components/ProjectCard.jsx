/**
 * @typedef {object} ProjectCardProps
 * @property {string} title - 프로젝트 이름 (한국어)
 * @property {string} href - 진입 URL (서브도메인)
 * @property {string} emoji - 임시 아이콘 (디자이너가 추후 교체)
 * @property {string} description - 한 줄 설명
 */

/**
 * 4 프로젝트 진입용 카드. 외부 서브도메인이라 `<a target="_blank">` 사용.
 * 임시 스타일 — 디자이너 shotgun 결과로 교체 예정.
 *
 * @param {ProjectCardProps} props
 */
export const ProjectCard = ({ title, href, emoji, description }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-4xl" aria-hidden="true">
        {emoji}
      </span>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <span className="mt-auto text-sm font-medium text-foreground/80 group-hover:text-foreground">
        바로 가기 →
      </span>
    </a>
  );
};
