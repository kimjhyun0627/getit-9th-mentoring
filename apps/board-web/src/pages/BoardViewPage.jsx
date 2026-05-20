import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { BoardColumn } from '../components/BoardColumn.jsx';
import { BoardError, BoardSubHeader } from '../components/BoardSubHeader.jsx';
import { CardEditModal } from '../components/CardEditModal.jsx';
import { MembersDialog } from '../components/MembersDialog.jsx';
import { api } from '../lib/api.js';
import { reorderWithin } from '../lib/cardMoveStrategy.js';
import { useBoardCardMutations } from '../lib/useBoardCardMutations.js';
import { useBoardMemberMutations } from '../lib/useBoardMemberMutations.js';

/**
 * `/boards/:id` — 칸반 보드 뷰.
 *
 * - 프로젝트 + 컬럼 + 컬럼별 카드 병렬 fetch
 * - 카드 CRUD + 컬럼 간 이동 + 같은 컬럼 reorder (#214)
 * - 카드 편집 모달 (#198, #200) + 멤버 관리 (#203)
 * - optimistic update (mutation onMutate / onError 롤백) — useBoardCardMutations 위임
 */
export const BoardViewPage = () => {
  const { id: projectId = '' } = useParams();
  const [addingColumnId, setAddingColumnId] = useState(/** @type {string | null} */ (null));
  const [editingCardId, setEditingCardId] = useState(/** @type {string | null} */ (null));
  const [editServerError, setEditServerError] = useState(/** @type {string | null} */ (null));
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersError, setMembersError] = useState(/** @type {string | null} */ (null));

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

  const projectMembers = useMemo(
    () => (Array.isArray(projectQuery.data?.members) ? projectQuery.data.members : []),
    [projectQuery.data],
  );
  const memberNameByUserId = useMemo(() => {
    /** @type {Record<string, string | null>} */
    const m = {};
    for (const x of projectMembers) m[x.userId] = x.name ?? null;
    return m;
  }, [projectMembers]);

  const membersQuery = useQuery({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const res = await api.listMembers(projectId);
      return res.data?.members ?? [];
    },
    enabled: membersOpen && Boolean(projectId),
  });

  // membersQuery 실패 시 dialog 안에서 사용자 친화 카피로 안내 — 빈 목록으로 가리지 않음.
  // (조회 성공 전엔 projectQuery.members 를 fallback 으로 사용해 "멤버 없음" 오해 방지.)
  useEffect(() => {
    if (membersOpen && membersQuery.isError && !membersError) {
      setMembersError('멤버 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }, [membersOpen, membersQuery.isError, membersError]);

  const cardMut = useBoardCardMutations({
    onUpdateError: setEditServerError,
    onUpdateSuccess: () => {
      setEditingCardId(null);
      setEditServerError(null);
    },
  });
  const memberMut = useBoardMemberMutations({
    projectId,
    onError: setMembersError,
    onSuccess: () => setMembersError(null),
  });

  const findCard = (cardId) =>
    Object.values(cardsByColumn)
      .flat()
      .find((c) => c.id === cardId);

  const handleAdd = (columnId, title) => {
    setAddingColumnId(columnId);
    cardMut.create.mutate({ columnId, title }, { onSettled: () => setAddingColumnId(null) });
  };
  const handleMove = (cardId, sourceColumnId, targetColumnId) => {
    cardMut.move.mutate({ cardId, sourceColumnId, targetColumnId });
  };
  const handleDelete = (cardId, columnId) => {
    cardMut.remove.mutate({ cardId, columnId });
  };

  const handleReorder = (cardId, direction) => {
    const card = findCard(cardId);
    if (!card) return;
    const columnCards = cardsByColumn[card.columnId] ?? [];
    const result = reorderWithin(columnCards, cardId, direction);
    if (!result) return;
    cardMut.move.mutate({
      cardId,
      sourceColumnId: card.columnId,
      targetColumnId: card.columnId,
      order: result.order,
    });
  };

  const handleEdit = (cardId) => {
    setEditingCardId(cardId);
    setEditServerError(null);
  };
  const handleSaveEdit = (cardId, changes) => {
    const card = findCard(cardId);
    if (!card) return;
    cardMut.update.mutate({ cardId, columnId: card.columnId, changes });
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

  /** @type {Record<string, boolean>} */
  const loadingByColumnId = {};
  columns.forEach((col, idx) => {
    loadingByColumnId[col.id] = Boolean(cardQueries[idx]?.isLoading);
  });

  const editingCard = editingCardId ? findCard(editingCardId) : null;

  return (
    <>
      <BoardSubHeader
        project={projectQuery.data}
        isLoading={projectQuery.isLoading}
        onOpenMembers={() => {
          setMembersOpen(true);
          setMembersError(null);
        }}
      />
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
              onEditCard={handleEdit}
              onReorderCard={handleReorder}
              memberNameByUserId={memberNameByUserId}
              isAddingCard={addingColumnId === col.id && cardMut.create.isPending}
              isLoading={
                (loadingByColumnId[col.id] ?? false) && (cardsByColumn[col.id] ?? []).length === 0
              }
            />
          ))}
        </div>
      </section>

      <CardEditModal
        open={Boolean(editingCard)}
        card={editingCard ?? null}
        members={projectMembers}
        onClose={() => {
          setEditingCardId(null);
          setEditServerError(null);
        }}
        onSave={handleSaveEdit}
        submitting={cardMut.update.isPending}
        serverError={editServerError}
      />

      <MembersDialog
        open={membersOpen}
        onClose={() => {
          setMembersOpen(false);
          setMembersError(null);
        }}
        role={projectQuery.data?.role ?? 'MEMBER'}
        // 멤버 detail (role 포함) 은 GET /members 응답 우선, 실패/대기 시 projectQuery 의 멤버로 fallback.
        // projectMembers 가 role 을 들고 오면 그걸 신뢰. 없을 때만 ownerId 로 보수적 추정.
        members={
          membersQuery.isSuccess
            ? membersQuery.data
            : projectMembers.map((m) => ({
                userId: m.userId,
                role:
                  m.role === 'OWNER' || m.role === 'MEMBER'
                    ? m.role
                    : m.userId === projectQuery.data?.ownerId
                      ? 'OWNER'
                      : 'MEMBER',
                name: m.name ?? null,
              }))
        }
        currentUserId={projectQuery.data?.currentUserId ?? null}
        onInvite={(userId) => memberMut.invite.mutateAsync({ userId }).catch(() => {})}
        onRemove={(userId) => memberMut.remove.mutateAsync({ userId }).catch(() => {})}
        inviting={memberMut.invite.isPending}
        removingUserId={memberMut.remove.isPending ? memberMut.remove.variables?.userId : null}
        serverError={membersError}
      />
    </>
  );
};
