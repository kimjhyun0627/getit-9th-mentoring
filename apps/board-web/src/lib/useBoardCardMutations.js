import { useCardCreateMutation } from './cardMutations/useCardCreateMutation.js';
import { useCardMoveMutation } from './cardMutations/useCardMoveMutation.js';
import { useCardRemoveMutation } from './cardMutations/useCardRemoveMutation.js';
import { useCardUpdateMutation } from './cardMutations/useCardUpdateMutation.js';

/**
 * 카드 create/move/delete/update mutation 묶음 + optimistic 처리.
 *
 * BoardViewPage 의 mutation 잡일을 한 곳에 모아 컴포넌트 본문은 UI 에 집중.
 * 각 mutation 의 구체 로직은 `./cardMutations/*` 로 분리됨 — 이 파일은 얇은 facade.
 *
 * @param {{
 *   onUpdateError: (msg: string) => void;
 *   onUpdateSuccess: () => void;
 *   projectId?: string;
 * }} handlers
 */
export const useBoardCardMutations = ({ onUpdateError, onUpdateSuccess, projectId }) => {
  const create = useCardCreateMutation({ projectId });
  const move = useCardMoveMutation({ projectId });
  const remove = useCardRemoveMutation({ projectId });
  const update = useCardUpdateMutation({
    projectId,
    onError: onUpdateError,
    onSuccess: onUpdateSuccess,
  });

  return { create, move, remove, update };
};
