import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { BoardColumn } from '../components/BoardColumn.jsx';
import { api } from '../lib/api.js';
import { appendOrder, optimisticMove } from '../lib/cardMoveStrategy.js';

/**
 * `/boards/:id` — 칸반 보드 뷰 (minimalist 시안 1:1).
 *
 * - 프로젝트 + 컬럼 + 컬럼별 카드 병렬 fetch
 * - 카드 CRUD + 컬럼 이동 (드롭다운, 드래그 X)
 * - optimistic update (mutation onMutate / onError 롤백)
 */
export const BoardViewPage = () => {
  const { id: projectId = '' } = useParams();
  const queryClient = useQueryClient();
  const [addingColumnId, setAddingColumnId] = useState(/** @type {string | null} */ (null));

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.getProject(projectId);
      return res.data?.project;
    },
    enabled: Boolean(projectId),
  });

  const columnsQuery = useQuery({
    queryKey: ['columns', projectId],
    queryFn: async () => {
      const res = await api.listColumns(projectId);
      return res.data?.columns ?? [];
    },
    enabled: Boolean(projectId),
  });

  const columns = useMemo(() => columnsQuery.data ?? [], [columnsQuery.data]);
  const cardQueries = useQueries({
    queries: columns.map((col) => ({
      queryKey: ['cards', col.id],
      queryFn: async () => {
        const res = await api.listCards(col.id);
        return res.data?.cards ?? [];
      },
      enabled: Boolean(col.id),
    })),
  });

  const cardsByColumn = useMemo(() => {
    /** @type {Record<string, Array<any>>} */
    const map = {};
    columns.forEach((col, idx) => {
      map[col.id] = cardQueries[idx]?.data ?? [];
    });
    return map;
  }, [columns, cardQueries]);

  const createMutation = useMutation({
    mutationFn: async (input) => {
      const res = await api.createCard(input);
      return res.data?.card;
    },
    onMutate: async ({ columnId, title }) => {
      setAddingColumnId(columnId);
      await queryClient.cancelQueries({ queryKey: ['cards', columnId] });
      const previous = queryClient.getQueryData(['cards', columnId]) ?? [];
      const optimistic = {
        id: `temp-${Date.now()}`,
        columnId,
        title,
        description: null,
        assigneeId: null,
        order: appendOrder(previous),
      };
      queryClient.setQueryData(['cards', columnId], [...previous, optimistic]);
      return { previous, columnId, tempId: optimistic.id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(['cards', ctx.columnId], ctx.previous);
    },
    onSuccess: (created, _vars, ctx) => {
      if (!ctx || !created) return;
      const current = queryClient.getQueryData(['cards', ctx.columnId]) ?? [];
      // 임시 카드를 서버 응답으로 교체 (invalidate 안 — refetch 가 optimistic 을 덮어쓰지 않도록)
      queryClient.setQueryData(
        ['cards', ctx.columnId],
        current.map((c) => (c.id === ctx.tempId ? created : c)),
      );
    },
    onSettled: () => {
      setAddingColumnId(null);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ cardId, targetColumnId }) =>
      api.moveCard(cardId, { columnId: targetColumnId }),
    onMutate: async ({ cardId, sourceColumnId, targetColumnId }) => {
      await queryClient.cancelQueries({ queryKey: ['cards', sourceColumnId] });
      await queryClient.cancelQueries({ queryKey: ['cards', targetColumnId] });
      const sourceCards = queryClient.getQueryData(['cards', sourceColumnId]) ?? [];
      const targetCards = queryClient.getQueryData(['cards', targetColumnId]) ?? [];
      const combined = [...sourceCards, ...targetCards];
      const next = optimisticMove(combined, cardId, targetColumnId);
      queryClient.setQueryData(
        ['cards', sourceColumnId],
        next.filter((c) => c.columnId === sourceColumnId),
      );
      queryClient.setQueryData(
        ['cards', targetColumnId],
        next.filter((c) => c.columnId === targetColumnId),
      );
      return { sourceColumnId, targetColumnId, sourceCards, targetCards };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(['cards', ctx.sourceColumnId], ctx.sourceCards);
      queryClient.setQueryData(['cards', ctx.targetColumnId], ctx.targetCards);
    },
    onSuccess: (res, vars) => {
      // 서버가 돌려준 정확한 order/columnId 로 target 컬럼 카드 정렬 (optimistic 가 끝에 붙였을 수 있어 보정)
      const saved = res?.data?.card;
      if (!saved) return;
      const targetCards = queryClient.getQueryData(['cards', vars.targetColumnId]) ?? [];
      const next = targetCards.map((c) => (c.id === saved.id ? { ...c, ...saved } : c));
      queryClient.setQueryData(['cards', vars.targetColumnId], next);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ cardId }) => api.deleteCard(cardId),
    onMutate: async ({ cardId, columnId }) => {
      await queryClient.cancelQueries({ queryKey: ['cards', columnId] });
      const previous = queryClient.getQueryData(['cards', columnId]) ?? [];
      queryClient.setQueryData(
        ['cards', columnId],
        previous.filter((c) => c.id !== cardId),
      );
      return { previous, columnId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(['cards', ctx.columnId], ctx.previous);
    },
  });

  const handleAdd = (columnId, title) => {
    createMutation.mutate({ columnId, title });
  };
  const handleMove = (cardId, sourceColumnId, targetColumnId) => {
    if (sourceColumnId === targetColumnId) return;
    moveMutation.mutate({ cardId, sourceColumnId, targetColumnId });
  };
  const handleDelete = (cardId, columnId) => {
    deleteMutation.mutate({ cardId, columnId });
  };

  const hasCardsError = cardQueries.some((q) => q.isError);
  if (projectQuery.isError || columnsQuery.isError || hasCardsError) {
    return (
      <BoardError
        onRetry={() => {
          projectQuery.refetch();
          columnsQuery.refetch();
          cardQueries.forEach((q) => q.refetch?.());
        }}
      />
    );
  }

  // 컬럼별 로딩 상태 — 전역 합산 시 한 컬럼만 로딩이어도 모든 빈 컬럼이 로딩 UI로 보임
  /** @type {Record<string, boolean>} */
  const loadingByColumnId = {};
  columns.forEach((col, idx) => {
    loadingByColumnId[col.id] = Boolean(cardQueries[idx]?.isLoading);
  });

  return (
    <>
      <SubHeader project={projectQuery.data} isLoading={projectQuery.isLoading} />
      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div
          data-testid="board-grid"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline md:grid-cols-3"
        >
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              cards={cardsByColumn[col.id] ?? []}
              otherColumns={columns.filter((c) => c.id !== col.id)}
              onAddCard={(title) => handleAdd(col.id, title)}
              onMoveCard={(cardId, targetColumnId) => handleMove(cardId, col.id, targetColumnId)}
              onDeleteCard={(cardId) => handleDelete(cardId, col.id)}
              isAddingCard={addingColumnId === col.id && createMutation.isPending}
              isLoading={
                (loadingByColumnId[col.id] ?? false) && (cardsByColumn[col.id] ?? []).length === 0
              }
            />
          ))}
        </div>
      </section>
    </>
  );
};

/**
 * 보드 서브 헤더 — 시안의 큰 타이틀 + 메타.
 *
 * @param {{ project?: { id: string; name: string; description: string | null }; isLoading?: boolean }} props
 */
const SubHeader = ({ project, isLoading }) => (
  <section className="border-b border-hairline">
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">— Project</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tightest text-foreground md:text-4xl">
        {isLoading ? '불러오는 중…' : (project?.name ?? '보드')}
      </h1>
      {project?.description ? (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      ) : null}
    </div>
  </section>
);

/**
 * @param {{ onRetry: () => void }} props
 */
const BoardError = ({ onRetry }) => (
  <section className="mx-auto max-w-3xl px-6 py-20 lg:px-10">
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-hairline px-6 py-16 text-center"
    >
      <p className="text-sm font-medium text-foreground">보드를 불러오지 못했어요</p>
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
  </section>
);
