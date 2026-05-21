import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../api.js';

import { makeInvalidateBatch } from './cardMutationHelpers.js';

/**
 * 카드 삭제 mutation (optimistic). onError 시 이전 캐시로 롤백.
 *
 * @param {{ projectId?: string }} args
 */
export const useCardRemoveMutation = ({ projectId }) => {
  const queryClient = useQueryClient();
  const invalidateBatchSoon = makeInvalidateBatch(queryClient, projectId);

  return useMutation({
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
    onSettled: invalidateBatchSoon,
  });
};
