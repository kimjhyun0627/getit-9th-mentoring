import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../api.js';
import { appendOrder } from '../cardMoveStrategy.js';

import { dedupById, makeInvalidateBatch } from './cardMutationHelpers.js';

/**
 * onMutate 의 optimistic 합성 로직. UI 캐시를 즉시 갱신해 DnD/이동 응답을 빠르게.
 *
 * #291: source/target 캐시를 합쳤다 다시 split 하던 기존 로직은
 *  (a) 두 컬럼이 같은 카드를 동시에 들고 있는 stale 상태에서 중복 entry 생성,
 *  (b) source/target 동일 컬럼일 때 sort 순서가 한 박자 미뤄지는 문제가 있었다.
 * 새 로직: source 에서 remove, target 에 insert (+ order sort), 양쪽 모두 dedup.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 */
const applyMoveOptimistic = (queryClient) => async (vars) => {
  const { cardId, sourceColumnId, targetColumnId, order } = vars;
  await queryClient.cancelQueries({ queryKey: ['cards', sourceColumnId] });
  if (sourceColumnId !== targetColumnId) {
    await queryClient.cancelQueries({ queryKey: ['cards', targetColumnId] });
  }
  const sourceCards = queryClient.getQueryData(['cards', sourceColumnId]) ?? [];
  const targetCards =
    sourceColumnId === targetColumnId
      ? sourceCards
      : (queryClient.getQueryData(['cards', targetColumnId]) ?? []);

  const moved =
    sourceCards.find((c) => c.id === cardId) ?? targetCards.find((c) => c.id === cardId);
  if (!moved) {
    return { sourceColumnId, targetColumnId, sourceCards, targetCards };
  }

  const targetOthers = targetCards.filter((c) => c.id !== cardId);
  const newOrder =
    typeof order === 'number' && Number.isFinite(order) ? order : appendOrder(targetOthers);
  const nextCard = { ...moved, columnId: targetColumnId, order: newOrder };

  if (sourceColumnId === targetColumnId) {
    // 같은 컬럼: 자기 자신만 빼고 새 order 로 다시 삽입 후 sort.
    const without = sourceCards.filter((c) => c.id !== cardId);
    const merged = dedupById([...without, nextCard]).sort((a, b) => a.order - b.order);
    queryClient.setQueryData(['cards', sourceColumnId], merged);
  } else {
    const nextSource = dedupById(sourceCards.filter((c) => c.id !== cardId));
    const nextTarget = dedupById([...targetOthers, nextCard]).sort((a, b) => a.order - b.order);
    queryClient.setQueryData(['cards', sourceColumnId], nextSource);
    queryClient.setQueryData(['cards', targetColumnId], nextTarget);
  }
  return { sourceColumnId, targetColumnId, sourceCards, targetCards };
};

/**
 * 카드 이동 mutation. 컬럼 간 / 같은 컬럼 reorder 모두 처리.
 *
 *  - order 가 number 면 BE 로 함께 전송 (DnD between-keys), 아니면 BE 가 끝에 append (#274).
 *  - onError 는 source/target 양쪽 캐시 롤백.
 *
 * @param {{ projectId?: string }} args
 */
export const useCardMoveMutation = ({ projectId }) => {
  const queryClient = useQueryClient();
  const invalidateBatchSoon = makeInvalidateBatch(queryClient, projectId);

  return useMutation({
    mutationFn: async ({ cardId, targetColumnId, order }) =>
      api.moveCard(
        cardId,
        order !== undefined ? { columnId: targetColumnId, order } : { columnId: targetColumnId },
      ),
    onMutate: applyMoveOptimistic(queryClient),
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(['cards', ctx.sourceColumnId], ctx.sourceCards);
      if (ctx.sourceColumnId !== ctx.targetColumnId) {
        queryClient.setQueryData(['cards', ctx.targetColumnId], ctx.targetCards);
      }
    },
    onSuccess: (res, vars) => {
      const saved = res?.data?.card;
      if (!saved) return;
      const targetCards = queryClient.getQueryData(['cards', vars.targetColumnId]) ?? [];
      const next = dedupById(
        targetCards.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)),
      ).sort((a, b) => a.order - b.order);
      queryClient.setQueryData(['cards', vars.targetColumnId], next);
    },
    onSettled: invalidateBatchSoon,
  });
};
