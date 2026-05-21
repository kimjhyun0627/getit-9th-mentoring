import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../api.js';
import { appendOrder } from '../cardMoveStrategy.js';

import { makeInvalidateBatch, newTempId } from './cardMutationHelpers.js';

/**
 * 카드 생성 mutation (optimistic).
 *
 *  - onMutate: 컬럼 끝에 temp id 카드 즉시 push.
 *  - onSuccess: 서버가 돌려준 real id 로 temp 카드 교체.
 *  - onError: 이전 캐시로 롤백.
 *
 * @param {{ projectId?: string }} args
 */
export const useCardCreateMutation = ({ projectId }) => {
  const queryClient = useQueryClient();
  const invalidateBatchSoon = makeInvalidateBatch(queryClient, projectId);

  return useMutation({
    mutationFn: async (input) => {
      const res = await api.createCard(input);
      return res.data?.card;
    },
    onMutate: async ({ columnId, title }) => {
      await queryClient.cancelQueries({ queryKey: ['cards', columnId] });
      const previous = queryClient.getQueryData(['cards', columnId]) ?? [];
      const optimistic = {
        id: newTempId(),
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
      if (!ctx) return;
      const current = queryClient.getQueryData(['cards', ctx.columnId]) ?? [];
      if (!created) {
        // 성공이지만 빈 바디 — optimistic temp 카드 그대로 두면 가짜 카드가 남아.
        // invalidate 가 안 닿는 케이스 대비해 여기서 temp 만 정리.
        queryClient.setQueryData(
          ['cards', ctx.columnId],
          current.filter((c) => c.id !== ctx.tempId),
        );
        return;
      }
      queryClient.setQueryData(
        ['cards', ctx.columnId],
        current.map((c) => (c.id === ctx.tempId ? created : c)),
      );
    },
    onSettled: invalidateBatchSoon,
  });
};
