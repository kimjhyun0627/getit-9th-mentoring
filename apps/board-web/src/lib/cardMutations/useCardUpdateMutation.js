import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../api.js';
import { toFriendlyCardError } from '../boardErrorMessages.js';

import { makeInvalidateBatch } from './cardMutationHelpers.js';

/**
 * 카드 편집 payload 빌더 — expectedUpdatedAt 동봉.
 *
 *  - 캐시에서 카드의 updatedAt 을 가져와 BE conflict detection (#253) 에 사용.
 *  - 캐시 miss 시 GET /cards/:id 한 번 폴백 (#455).
 *  - 실패 시 ts 없이 보내 BE 가 400 으로 사유 알려준다.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} cardId
 * @param {string} columnId
 * @param {Record<string, unknown>} changes
 */
const buildUpdatePayload = async (queryClient, cardId, columnId, changes) => {
  const cards = queryClient.getQueryData(['cards', columnId]) ?? [];
  const existing = cards.find((c) => c.id === cardId);
  const payload = { ...changes };
  let ts = existing?.updatedAt;
  if (!ts) {
    try {
      const fetched = await api.getCard?.(cardId);
      ts = fetched?.data?.card?.updatedAt;
    } catch {
      // graceful — fallback 도 실패하면 페이로드만 보내고 BE 가 400 으로 사유 알려준다.
    }
  }
  if (ts) {
    payload.expectedUpdatedAt = ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
  }
  return payload;
};

/**
 * 카드 편집 mutation (optimistic).
 *
 *  - 캐시의 카드에 changes 즉시 머지.
 *  - onError 시 친화 에러 메시지로 변환해 콜백.
 *
 * @param {{
 *   projectId?: string;
 *   onError: (msg: string) => void;
 *   onSuccess: () => void;
 * }} args
 */
export const useCardUpdateMutation = ({ projectId, onError, onSuccess }) => {
  const queryClient = useQueryClient();
  const invalidateBatchSoon = makeInvalidateBatch(queryClient, projectId);

  return useMutation({
    mutationFn: async ({ cardId, columnId, changes }) => {
      const payload = await buildUpdatePayload(queryClient, cardId, columnId, changes);
      const res = await api.updateCard(cardId, payload);
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
      onError(toFriendlyCardError(err));
    },
    onSuccess: (saved, vars) => {
      if (!saved) return;
      const cards = queryClient.getQueryData(['cards', vars.columnId]) ?? [];
      queryClient.setQueryData(
        ['cards', vars.columnId],
        cards.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)),
      );
      onSuccess();
    },
    onSettled: invalidateBatchSoon,
  });
};
