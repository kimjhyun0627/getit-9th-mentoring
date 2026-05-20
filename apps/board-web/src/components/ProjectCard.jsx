import { Link } from 'react-router-dom';

import { MemberAvatarGroup } from './MemberAvatarGroup.jsx';

/**
 * 프로젝트 카드 — 시안의 hairline + 인디고 액센트 스타일.
 *
 * @param {{
 *   project: {
 *     id: string;
 *     name: string;
 *     description: string | null;
 *     ownerId: string;
 *     updatedAt: string | Date;
 *   };
 *   role: 'OWNER' | 'MEMBER';
 *   members?: Array<{ userId: string; name?: string | null }>;
 * }} props
 */
export const ProjectCard = ({ project, role, members = [] }) => {
  return (
    <Link
      to={`/boards/${project.id}`}
      aria-label={`${project.name} 보드 열기`}
      className="group relative flex flex-col gap-4 rounded-lg border border-hairline bg-card p-5 transition hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-accent"
            />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {role === 'OWNER' ? 'Owner' : 'Member'}
            </span>
          </div>
          <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
            {project.name}
          </h3>
          {project.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-hairline pt-4">
        <MemberAvatarGroup members={members} size="sm" />
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
          {formatUpdated(project.updatedAt)}
        </span>
      </div>
    </Link>
  );
};

/**
 * "방금", "N분 전", "M일 전", "YYYY-MM-DD" 등으로 포맷.
 *
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
const formatUpdated = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  // 사용자 로컬 타임존 기준 YYYY-MM-DD (en-CA 로케일이 ISO 형식 보장).
  return d.toLocaleDateString('en-CA');
};
