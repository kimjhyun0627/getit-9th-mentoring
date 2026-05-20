/**
 * 보드 뷰 서브 헤더 — 큰 타이틀 + 메타 + 멤버 관리 진입점.
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
 * }} props
 */
export const BoardSubHeader = ({ project, isLoading, onOpenMembers }) => (
  <section className="border-b border-hairline">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
      <div className="flex flex-col gap-3">
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
        <button
          type="button"
          onClick={onOpenMembers}
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] lg:self-end"
        >
          멤버 관리
        </button>
      ) : null}
    </div>
  </section>
);

/**
 * @param {{ onRetry: () => void }} props
 */
export const BoardError = ({ onRetry }) => (
  <section className="mx-auto max-w-3xl px-6 py-20 lg:px-10">
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-hairline px-6 py-16 text-center"
    >
      <p className="text-sm font-medium text-foreground">보드를 불러오지 못했어요</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        네트워크 상태를 확인한 뒤 다시 시도해 주세요.
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
