/**
 * 보드 뷰 서브 헤더 — 큰 타이틀 + 메타 + 멤버 관리 / 설정 진입점.
 *
 * @param {{
 *   project?: {
 *     id: string;
 *     name: string;
 *     description: string | null;
 *     role?: 'OWNER'|'MEMBER'|null;
 *   };
 *   isLoading?: boolean;
 *   onOpenMembers: () => void;
 *   onOpenSettings?: () => void;
 * }} props
 */
export const BoardSubHeader = ({ project, isLoading, onOpenMembers, onOpenSettings }) => (
  <section className="border-b border-hairline">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
      <div className="flex flex-col gap-3">
        {/* #234: 브레드크럼 — Boards / 프로젝트 이름 */}
        <nav
          aria-label="브레드크럼"
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <a
            href="/boards"
            className="rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Boards
          </a>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground/80">{project?.name ?? '…'}</span>
        </nav>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">— Project</p>
        <h1
          className="text-3xl font-semibold tracking-tightest text-foreground md:text-4xl"
          aria-busy={isLoading || undefined}
        >
          {isLoading ? '보드 불러오는 중…' : (project?.name ?? '보드')}
        </h1>
        {project?.description ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>
      {project ? (
        <div className="flex flex-row items-center gap-2 self-start lg:self-end">
          <button
            type="button"
            onClick={onOpenMembers}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
          >
            멤버 관리
          </button>
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="프로젝트 설정"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
            >
              설정
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  </section>
);

/**
 * 권한 없음 / 존재하지 않는 보드 안내 (#238).
 *
 * @param {{ status: number; onBack: () => void }} props
 */
export const BoardForbidden = ({ status, onBack }) => {
  const isMissing = status === 404;
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 lg:px-10">
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-hairline px-6 py-16 text-center"
      >
        <p className="text-sm font-medium text-foreground">
          {isMissing ? '보드를 찾을 수 없어' : '이 보드는 멤버만 볼 수 있어'}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isMissing
            ? '주소를 다시 확인해보거나 프로젝트 목록에서 들어와줘.'
            : '프로젝트 만든 사람한테 멤버로 추가해달라고 부탁해줘. 멤버 관리에서 너의 userId 를 복사해서 전달하면 돼.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
        >
          프로젝트 목록으로
        </button>
      </div>
    </section>
  );
};

/**
 * @param {{ onRetry: () => void }} props
 */
export const BoardError = ({ onRetry }) => (
  <section className="mx-auto max-w-3xl px-6 py-20 lg:px-10">
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-hairline px-6 py-16 text-center"
    >
      <p className="text-sm font-medium text-foreground">보드를 불러오지 못했어</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        네트워크 상태 확인하고 다시 시도해줘.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
      >
        다시 시도
      </button>
    </div>
  </section>
);
