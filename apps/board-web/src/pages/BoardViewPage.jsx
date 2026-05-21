import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BoardGrid } from '../components/BoardGrid.jsx';
import { BoardError, BoardForbidden, BoardSubHeader } from '../components/BoardSubHeader.jsx';
import { CardEditModal } from '../components/CardEditModal.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { ProjectSettingsDialog } from '../components/ProjectSettingsDialog.jsx';
import { useBoardColumnMutations } from '../lib/useBoardColumnMutations.js';
import { useBoardData } from '../lib/useBoardData.js';

import { BoardMembersDialogContainer } from './board-view/BoardMembersDialogContainer.jsx';
import { useCardActions } from './board-view/useCardActions.js';
import { useMembersDialog } from './board-view/useMembersDialog.js';
import { useProjectSettingsDialog } from './board-view/useProjectSettingsDialog.js';

/**
 * `/boards/:id` — 칸반 보드 뷰.
 *
 *  - 데이터 fetch / 카드 액션 / 멤버 다이얼로그 / 설정 다이얼로그는 모두 hook 으로 분리.
 *  - 본 컴포넌트는 데이터 -> UI 조합 + 에러/금지 상태 분기만 담당.
 *
 *  관련 issue:
 *  - 카드 CRUD + DnD (#198, #200, #214, #274)
 *  - 권한/에러 안내 (#238, #258)
 *  - 멤버 다이얼로그 (#203, #403, #438)
 *  - 카드 삭제 confirm (#219)
 */
export const BoardViewPage = () => {
  const { id: projectId = '' } = useParams();
  const navigate = useNavigate();

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

  const cards = useCardActions({ projectId, cardsByColumn });
  const members = useMembersDialog({ projectId });
  const settings = useProjectSettingsDialog({
    projectId,
    onDeleteSuccess: () => navigate('/boards'),
  });
  const columnMut = useBoardColumnMutations({ projectId });

  // #238: 비멤버 403/404 응답을 친화 카피로 안내 + /boards 복귀 동선 제공.
  const projectStatus = projectQuery.error?.response?.status;
  if (projectStatus === 403 || projectStatus === 404) {
    return <BoardForbidden status={projectStatus} onBack={() => navigate('/boards')} />;
  }

  if (projectQuery.isError || columnsQuery.isError || cardsBatchQuery.isError) {
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

  return (
    <>
      <BoardSubHeader
        project={projectQuery.data}
        isLoading={projectQuery.isLoading}
        onOpenMembers={members.openMembers}
        onOpenSettings={settings.openSettings}
      />
      <BoardGrid
        columns={columns}
        cardsByColumn={cardsByColumn}
        addingColumnId={cards.addingColumnId}
        isAddingCardPending={cards.cardMut.create.isPending}
        isBoardLoading={
          projectQuery.isLoading || columnsQuery.isLoading || cardsBatchQuery.isLoading
        }
        memberNameByUserId={memberNameByUserId}
        onAddCard={cards.handleAdd}
        onMoveCard={cards.handleMove}
        onDeleteCard={cards.handleDelete}
        onEditCard={cards.handleEdit}
        onReorderCard={cards.handleReorder}
        onCreateColumn={(name) => columnMut.create.mutate({ name })}
        onRenameColumn={(columnId, name) => columnMut.rename.mutate({ columnId, name })}
        onDeleteColumn={(columnId) => columnMut.remove.mutate({ columnId })}
        isCreateColumnPending={columnMut.create.isPending}
      />

      <CardEditModal
        open={Boolean(cards.editingCard)}
        card={cards.editingCard ?? null}
        members={projectMembers}
        onClose={cards.closeEditModal}
        onSave={cards.handleSaveEdit}
        submitting={cards.cardMut.update.isPending}
        serverError={cards.editServerError}
      />

      <ConfirmDialog
        open={Boolean(cards.pendingDelete)}
        title="카드를 삭제할까요?"
        description={
          cards.pendingDelete?.title
            ? `"${cards.pendingDelete.title}" 카드가 영구 삭제돼요. 되돌릴 수 없어요.`
            : '카드가 영구 삭제돼요. 되돌릴 수 없어요.'
        }
        confirmLabel="삭제"
        destructive
        busy={cards.cardMut.remove.isPending}
        onConfirm={cards.handleConfirmDelete}
        onClose={cards.closeDeleteDialog}
      />

      <ProjectSettingsDialog
        open={settings.settingsOpen}
        project={projectQuery.data ?? null}
        onClose={settings.closeSettings}
        onSave={(values) => settings.projectMut.update.mutate(values)}
        onDelete={() => settings.projectMut.remove.mutate(undefined)}
        saving={settings.projectMut.update.isPending}
        deleting={settings.projectMut.remove.isPending}
        serverError={settings.settingsError}
      />

      <BoardMembersDialogContainer
        open={members.membersOpen}
        onClose={members.closeMembers}
        project={projectQuery.data}
        projectMembers={projectMembers}
        membersQuery={members.membersQuery}
        memberMut={members.memberMut}
        serverError={members.membersError}
      />
    </>
  );
};
