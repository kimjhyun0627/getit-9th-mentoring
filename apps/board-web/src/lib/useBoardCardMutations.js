import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api.js';
import { toFriendlyCardError } from './boardErrorMessages.js';
import { appendOrder } from './cardMoveStrategy.js';

/**
 * Optimistic temp id 생성기. (#242)
 *
 * 기존: `temp-${Date.now()}` — 1ms 안에 두 카드를 만들면 id 충돌 → onSuccess 매핑이
 * 잘못된 카드를 교체하는 정합성 흠. `crypto.randomUUID()` 우선, 없으면 timestamp + 강한 랜덤.
 *
 * @returns {string}
 */
const newTempId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `temp-${crypto.randomUUID()}`;
    }
  } catch {
    // fallthrough
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * 중복 id 제거 — 같은 id 가 두 번 나타나면 마지막 entry 만 남긴다. (#291)
 *
 * @template {{ id: string }} T
 * @param {T[]} list
 * @returns {T[]}
 */
const dedupById = (list) => {
  const seen = new Set();
  const out = [];
  // 뒤에서부터 훑어 마지막 entry 만 유지 (이후 reverse).
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  out.reverse();
  return out;
};

/**
 * 카드 create/move/delete/update mutation 묶음 + optimistic 처리.
 *
 * BoardViewPage 의 mutation 잡일을 한 곳에 모아 컴포넌트 본문은 UI 에 집중.
 *
 * @param {{
 *   onUpdateError: (msg: string) => void;
 *   onUpdateSuccess: () => void;
 *   projectId?: string;
 * }} handlers
 */
export const useBoardCardMutations = ({ onUpdateError, onUpdateSuccess, projectId }) => {
  const queryClient = useQueryClient();

  // #314: 자기 mutation 이 settled 된 뒤에 cards-batch 를 한 번 invalidate 한다.
  // 이걸로 다른 사용자가 추가한 카드/이동이 카운트에 반영된다. settled 시점에
  // optimistic 은 이미 real data 로 교체된 상태라 덮어쓰기 안전.
  const invalidateBatchSoon = () => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: ['cards-batch', projectId] });
  };

  const create = useMutation({
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
      if (!ctx || !created) return;
      const current = queryClient.getQueryData(['cards', ctx.columnId]) ?? [];
      queryClient.setQueryData(
        ['cards', ctx.columnId],
        current.map((c) => (c.id === ctx.tempId ? created : c)),
      );
    },
    onSettled: invalidateBatchSoon,
  });

  const move = useMutation({
    mutationFn: async ({ cardId, targetColumnId, order }) =>
      api.moveCard(
        cardId,
        order !== undefined ? { columnId: targetColumnId, order } : { columnId: targetColumnId },
      ),
    // #291: source/target 캐시를 합쳤다 다시 split 하던 기존 로직은
    // (a) 두 컬럼이 같은 카드를 동시에 들고 있는 stale 상태에서 중복 entry 생성,
    // (b) source/target 동일 컬럼일 때 sort 순서가 한 박자 미뤄지는 문제가 있었다.
    // 새 로직: source 에서 remove, target 에 insert (+ order sort), 양쪽 모두 dedup.
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

      const moved =
        sourceCards.find((c) => c.id === cardId) ?? targetCards.find((c) => c.id === cardId);
      if (!moved) {
        return { sourceColumnId, targetColumnId, sourceCards, targetCards };
      }

      const computeOrder = () => {
        if (typeof order === 'number' && Number.isFinite(order)) return order;
        const targetOthers = targetCards.filter((c) => c.id !== cardId);
        return appendOrder(targetOthers);
      };
      const newOrder = computeOrder();
      const nextCard = { ...moved, columnId: targetColumnId, order: newOrder };

      if (sourceColumnId === targetColumnId) {
        // 같은 컬럼: 자기 자신만 빼고 새 order 로 다시 삽입 후 sort.
        const without = sourceCards.filter((c) => c.id !== cardId);
        const merged = dedupById([...without, nextCard]).sort((a, b) => a.order - b.order);
        queryClient.setQueryData(['cards', sourceColumnId], merged);
      } else {
        const nextSource = dedupById(sourceCards.filter((c) => c.id !== cardId));
        const nextTarget = dedupById([
          ...targetCards.filter((c) => c.id !== cardId),
          nextCard,
        ]).sort((a, b) => a.order - b.order);
        queryClient.setQueryData(['cards', sourceColumnId], nextSource);
        queryClient.setQueryData(['cards', targetColumnId], nextTarget);
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
      const next = dedupById(
        targetCards.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)),
      ).sort((a, b) => a.order - b.order);
      queryClient.setQueryData(['cards', vars.targetColumnId], next);
    },
    onSettled: invalidateBatchSoon,
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
    onSettled: invalidateBatchSoon,
  });

  const update = useMutation({
    // #253: conflict detection — 캐시에서 카드의 expectedUpdatedAt 를 함께 보낸다.
    // BE 가 현재 row 의 updatedAt 과 비교해 다르면 409 → onError 가 친화 카피로 변환.
    mutationFn: async ({ cardId, columnId, changes }) => {
      const cards = queryClient.getQueryData(['cards', columnId]) ?? [];
      const existing = cards.find((c) => c.id === cardId);
      const payload = { ...changes };
      let ts = existing?.updatedAt;
      // #455: BE 가 expectedUpdatedAt 을 필수로 강제. 캐시 miss 면 GET /cards/:id 한 번 호출해 최신 ts 확보.
      if (!ts) {
        try {
          const fetched = await api.getCard?.(cardId);
          ts = fetched?.data?.card?.updatedAt;
        } catch {
          // graceful — fallback 도 실패하면 페이로드만 보내고 BE 가 400 으로 사유 알려준다.
        }
      }
      if (ts) {
        payload.expectedUpdatedAt =
          ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
      }
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
    onSettled: invalidateBatchSoon,
  });

  return { create, move, remove, update };
};
