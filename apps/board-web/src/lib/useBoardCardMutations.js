import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api.js';
import { toFriendlyCardError } from './boardErrorMessages.js';
import { appendOrder, optimisticMove } from './cardMoveStrategy.js';

/**
 * 카드 create/move/delete/update mutation 묶음 + optimistic 처리.
 *
 * BoardViewPage 의 mutation 잡일을 한 곳에 모아 컴포넌트 본문은 UI 에 집중.
 *
 * @param {{ onUpdateError: (msg: string) => void; onUpdateSuccess: () => void }} handlers
 */
export const useBoardCardMutations = ({ onUpdateError, onUpdateSuccess }) => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (input) => {
      const res = await api.createCard(input);
      return res.data?.card;
    },
    onMutate: async ({ columnId, title }) => {
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
      queryClient.setQueryData(
        ['cards', ctx.columnId],
        current.map((c) => (c.id === ctx.tempId ? created : c)),
      );
    },
  });

  const move = useMutation({
    mutationFn: async ({ cardId, targetColumnId, order }) =>
      api.moveCard(
        cardId,
        order !== undefined ? { columnId: targetColumnId, order } : { columnId: targetColumnId },
      ),
    onMutate: async ({ cardId, sourceColumnId, targetColumnId, order }) => {
      await queryClient.cancelQueries({ queryKey: ['cards', sourceColumnId] });
      if (sourceColumnId !== targetColumnId) {
        await queryClient.cancelQueries({ queryKey: ['cards', targetColumnId] });
      }
      const sourceCards = queryClient.getQueryData(['cards', sourceColumnId]) ?? [];
      const targetCards =
        sourceColumnId === targetColumnId
          ? sourceCards
          : (queryClient.getQueryData(['cards', targetColumnId]) ?? []);
      const combined =
        sourceColumnId === targetColumnId ? [...sourceCards] : [...sourceCards, ...targetCards];
      const next = optimisticMove(combined, cardId, targetColumnId, order);
      if (sourceColumnId === targetColumnId) {
        queryClient.setQueryData(
          ['cards', sourceColumnId],
          next.filter((c) => c.columnId === sourceColumnId).sort((a, b) => a.order - b.order),
        );
      } else {
        queryClient.setQueryData(
          ['cards', sourceColumnId],
          next.filter((c) => c.columnId === sourceColumnId),
        );
        queryClient.setQueryData(
          ['cards', targetColumnId],
          next.filter((c) => c.columnId === targetColumnId),
        );
      }
      return { sourceColumnId, targetColumnId, sourceCards, targetCards };
    },
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
      const next = targetCards
        .map((c) => (c.id === saved.id ? { ...c, ...saved } : c))
        .sort((a, b) => a.order - b.order);
      queryClient.setQueryData(['cards', vars.targetColumnId], next);
    },
  });

  const remove = useMutation({
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

  const update = useMutation({
    mutationFn: async ({ cardId, changes }) => {
      const res = await api.updateCard(cardId, changes);
      return res.data?.card;
    },
    onMutate: async ({ cardId, columnId, changes }) => {
      await queryClient.cancelQueries({ queryKey: ['cards', columnId] });
      const previous = queryClient.getQueryData(['cards', columnId]) ?? [];
      queryClient.setQueryData(
        ['cards', columnId],
        previous.map((c) => (c.id === cardId ? { ...c, ...changes } : c)),
      );
      return { previous, columnId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(['cards', ctx.columnId], ctx.previous);
      onUpdateError(toFriendlyCardError(err));
    },
    onSuccess: (saved, vars) => {
      if (!saved) return;
      const cards = queryClient.getQueryData(['cards', vars.columnId]) ?? [];
      queryClient.setQueryData(
        ['cards', vars.columnId],
        cards.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)),
      );
      onUpdateSuccess();
    },
  });

  return { create, move, remove, update };
};
