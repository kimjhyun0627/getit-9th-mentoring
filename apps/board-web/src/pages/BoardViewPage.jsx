import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BoardGrid } from '../components/BoardGrid.jsx';
import { BoardError, BoardForbidden, BoardSubHeader } from '../components/BoardSubHeader.jsx';
import { CardEditModal } from '../components/CardEditModal.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { MembersDialog } from '../components/MembersDialog.jsx';
import { ProjectSettingsDialog } from '../components/ProjectSettingsDialog.jsx';
import { api } from '../lib/api.js';
import { reorderWithin } from '../lib/cardMoveStrategy.js';
import { useBoardCardMutations } from '../lib/useBoardCardMutations.js';
import { useBoardColumnMutations } from '../lib/useBoardColumnMutations.js';
import { useBoardData } from '../lib/useBoardData.js';
import { useBoardMemberMutations } from '../lib/useBoardMemberMutations.js';
import { useBoardProjectMutations } from '../lib/useBoardProjectMutations.js';

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
  const navigate = useNavigate();
  const [addingColumnId, setAddingColumnId] = useState(/** @type {string | null} */ (null));
  const [editingCardId, setEditingCardId] = useState(/** @type {string | null} */ (null));
  const [editServerError, setEditServerError] = useState(/** @type {string | null} */ (null));
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersError, setMembersError] = useState(/** @type {string | null} */ (null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState(/** @type {string | null} */ (null));
  // 카드 삭제 confirm (#219)
  const [pendingDelete, setPendingDelete] = useState(
    /** @type {{ cardId: string; columnId: string; title: string } | null} */ (null),
  );

  const { projectQuery, columnsQuery, cardsBatchQuery, columns, cardsByColumn } =
    useBoardData(projectId);

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
      setMembersError('멤버 목록을 불러오지 못했어. 잠시 후 다시 시도해줘.');
    }
  }, [membersOpen, membersQuery.isError, membersError]);

  const cardMut = useBoardCardMutations({
    projectId,
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
  const columnMut = useBoardColumnMutations({ projectId });
  const projectMut = useBoardProjectMutations({
    projectId,
    onError: setSettingsError,
    onDeleteSuccess: () => {
      setSettingsOpen(false);
      navigate('/boards');
    },
    onUpdateSuccess: () => {
      setSettingsOpen(false);
      setSettingsError(null);
    },
  });

  const findCard = (cardId) =>
    Object.values(cardsByColumn)
      .flat()
      .find((c) => c.id === cardId);

  const handleAdd = (columnId, title) => {
    setAddingColumnId(columnId);
    cardMut.create.mutate({ columnId, title }, { onSettled: () => setAddingColumnId(null) });
  };
  // #274: 4번째 인자 order — DnD 에서는 between-keys 계산값을 BE 로 전달.
  // MoveMenu 경로는 기존처럼 order 미지정 → BE 가 끝에 append.
  const handleMove = (cardId, sourceColumnId, targetColumnId, order) => {
    cardMut.move.mutate({ cardId, sourceColumnId, targetColumnId, order });
  };
  // #219: 즉시 삭제 대신 확인 다이얼로그 후 mutate. UX-wise destructive 보호.
  const handleDelete = (cardId, columnId) => {
    const card = findCard(cardId);
    setPendingDelete({ cardId, columnId, title: card?.title ?? '' });
  };
  const handleConfirmDelete = () => {
    // 연타 가드: 진행중이면 무시. 실패 시 사용자 맥락 유지를 위해 onSuccess 에서만 다이얼로그 닫음.
    if (!pendingDelete || cardMut.remove.isPending) return;
    cardMut.remove.mutate(
      { cardId: pendingDelete.cardId, columnId: pendingDelete.columnId },
      { onSuccess: () => setPendingDelete(null) },
    );
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

  // #238: 비멤버 403 응답을 친화 카피로 안내 + /boards 복귀 동선 제공.
  const projectStatus = projectQuery.error?.response?.status;
  if (projectStatus === 403 || projectStatus === 404) {
    return <BoardForbidden status={projectStatus} onBack={() => navigate('/boards')} />;
  }

  const cardsErrored = cardsBatchQuery.isError;
  if (projectQuery.isError || columnsQuery.isError || cardsErrored) {
    return (
      <BoardError
        onRetry={() => {
          projectQuery.refetch();
          columnsQuery.refetch();
          cardsBatchQuery.refetch();
        }}
      />
    );
  }

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
        onOpenSettings={() => {
          setSettingsOpen(true);
          setSettingsError(null);
        }}
      />
      <BoardGrid
        columns={columns}
        cardsByColumn={cardsByColumn}
        addingColumnId={addingColumnId}
        isAddingCardPending={cardMut.create.isPending}
        isBoardLoading={
          projectQuery.isLoading || columnsQuery.isLoading || cardsBatchQuery.isLoading
        }
        memberNameByUserId={memberNameByUserId}
        onAddCard={handleAdd}
        onMoveCard={handleMove}
        onDeleteCard={handleDelete}
        onEditCard={handleEdit}
        onReorderCard={handleReorder}
        onCreateColumn={(name) => columnMut.create.mutate({ name })}
        onRenameColumn={(columnId, name) => columnMut.rename.mutate({ columnId, name })}
        onDeleteColumn={(columnId) => columnMut.remove.mutate({ columnId })}
        isCreateColumnPending={columnMut.create.isPending}
      />

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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="카드를 삭제할까요?"
        description={
          pendingDelete?.title
            ? `"${pendingDelete.title}" 카드가 영구 삭제돼요. 되돌릴 수 없어요.`
            : '카드가 영구 삭제돼요. 되돌릴 수 없어요.'
        }
        confirmLabel="삭제"
        destructive
        busy={cardMut.remove.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      />

      <ProjectSettingsDialog
        open={settingsOpen}
        project={projectQuery.data ?? null}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsError(null);
        }}
        onSave={(values) => projectMut.update.mutate(values)}
        onDelete={() => projectMut.remove.mutate(undefined)}
        saving={projectMut.update.isPending}
        deleting={projectMut.remove.isPending}
        serverError={settingsError}
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
        // #438: invite 실패해도 input 이 비워지는 문제 — onInvite 가 성공 여부를 반환하도록
        // 약속을 변경. catch 에서 false 를 돌려주면 MembersDialog 가 input 을 비우지 않는다.
        onInvite={(userId) =>
          memberMut.invite
            .mutateAsync({ userId })
            .then(() => true)
            .catch(() => false)
        }
        onRemove={(userId) => memberMut.remove.mutateAsync({ userId }).catch(() => {})}
        inviting={memberMut.invite.isPending}
        removingUserId={memberMut.remove.isPending ? memberMut.remove.variables?.userId : null}
        serverError={membersError}
      />
    </>
  );
};
