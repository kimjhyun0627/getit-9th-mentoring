import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../components/EmptyState.jsx';
import { NewProjectDialog } from '../components/NewProjectDialog.jsx';
import { ProjectCard } from '../components/ProjectCard.jsx';
import { api } from '../lib/api.js';

/**
 * `/boards` — 내가 OWNER 또는 MEMBER인 프로젝트 목록 + 새 프로젝트 CTA.
 *
 * - TanStack Query `['projects']` 캐시
 * - 401 발생 시 axios interceptor가 처리 (main.jsx 에서 등록)
 * - 새 프로젝트 생성 성공 → /boards/:id 로 이동 (board view)
 */
export const BoardsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState(/** @type {string | null} */ (null));

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.listProjects();
      return res.data?.projects ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input) => {
      const res = await api.createProject(input);
      return res.data?.project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setOpen(false);
      setServerError(null);
      if (project?.id) navigate(`/boards/${project.id}`);
    },
    onError: (err) => {
      setServerError(toFriendlyError(err));
    },
  });

  const handleCreate = async (values) => {
    setServerError(null);
    await createMutation.mutateAsync(values).catch(() => {
      /* serverError state로 표시 — rethrow 안 함 */
    });
  };

  return (
    <>
      <SubHeader onNewProject={() => setOpen(true)} />

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        {projectsQuery.isLoading ? (
          <LoadingGrid />
        ) : projectsQuery.isError ? (
          <ErrorState onRetry={() => projectsQuery.refetch()} />
        ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
          <ProjectGrid projects={projectsQuery.data} />
        ) : (
          <EmptyState
            title="아직 프로젝트가 없어요"
            description="첫 프로젝트를 만들면 Todo · Doing · Done 컬럼이 자동으로 만들어집니다."
            action={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                + 새 프로젝트
              </button>
            }
          />
        )}
      </section>

      <NewProjectDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setServerError(null);
        }}
        onCreate={handleCreate}
        submitting={createMutation.isPending}
        serverError={serverError}
      />
    </>
  );
};

/**
 * Sub-header — 시안의 큰 타이틀 + CTA 패턴.
 *
 * @param {{ onNewProject: () => void }} props
 */
const SubHeader = ({ onNewProject }) => (
  <section className="border-b border-hairline">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">— Projects</p>
        <h1 className="text-3xl font-semibold tracking-tightest text-foreground md:text-4xl">
          내 보드
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          내가 OWNER 이거나 멤버로 속한 프로젝트들. 카드를 눌러 보드로 이동해.
        </p>
      </div>
      <button
        type="button"
        onClick={onNewProject}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 lg:self-end"
      >
        <span aria-hidden="true">+</span>
        New Project
      </button>
    </div>
  </section>
);

/**
 * @param {{ projects: Array<{ id: string; name: string; description: string | null; ownerId: string; updatedAt: string; role?: 'OWNER'|'MEMBER'; members?: Array<{userId: string; name?: string|null}> }> }} props
 */
const ProjectGrid = ({ projects }) => (
  <ul aria-label="프로젝트 목록" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {projects.map((p) => (
      <li key={p.id} className="contents">
        <ProjectCard
          project={p}
          role={p.role ?? 'MEMBER'}
          members={Array.isArray(p.members) ? p.members : []}
        />
      </li>
    ))}
  </ul>
);

const LoadingGrid = () => (
  <div
    role="status"
    aria-label="프로젝트 불러오는 중"
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {['a', 'b', 'c'].map((slot) => (
      <div
        key={slot}
        className="h-40 animate-pulse rounded-lg border border-hairline bg-foreground/[0.02]"
      />
    ))}
  </div>
);

/**
 * @param {{ onRetry: () => void }} props
 */
const ErrorState = ({ onRetry }) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center gap-3 rounded-lg border border-hairline px-6 py-16 text-center"
  >
    <p className="text-sm font-medium text-foreground">프로젝트를 불러오지 못했어요</p>
    <p className="text-xs leading-relaxed text-muted-foreground">
      네트워크 상태를 확인한 뒤 다시 시도해줘.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04]"
    >
      다시 시도
    </button>
  </div>
);

/**
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{ response?: { status?: number } }} */ (err)?.response?.status;
  if (status === 400) return '입력을 확인해줘 (이름이 비어있거나 너무 길어)';
  if (status === 401) return '로그인이 필요해. 잠시 후 로그인 페이지로 이동할게.';
  if (status === 429) return '잠시 후 다시 시도해줘 (요청이 너무 많아).';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했어. 잠시 후 다시 시도해줘.';
  return '프로젝트 생성에 실패했어. 입력을 확인하고 다시 시도해줘.';
};
