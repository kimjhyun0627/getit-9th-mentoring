/**
 * cardMoveStrategy 단위 테스트.
 *
 * - appendOrder / optimisticMove / betweenOrder / reorderWithin 검증.
 * - 같은-컬럼 reorder (#214) 회귀 가드 — early-return 으로 막혀 있던 동작.
 */
import { describe, expect, it } from 'vitest';

import {
  appendOrder,
  betweenOrder,
  computeDropOrder,
  optimisticMove,
  ORDER_GAP,
  reorderWithin,
} from './cardMoveStrategy.js';

describe('appendOrder', () => {
  it('빈 배열이면 GAP', () => {
    expect(appendOrder([])).toBe(ORDER_GAP);
  });
  it('마지막 order + GAP', () => {
    expect(appendOrder([{ order: 1000 }, { order: 2000 }])).toBe(3000);
  });
});

describe('betweenOrder', () => {
  it('두 값 사이는 평균', () => {
    expect(betweenOrder(1000, 2000)).toBe(1500);
  });
  it('prev 만 있으면 prev + GAP', () => {
    expect(betweenOrder(1000, null)).toBe(2000);
  });
  it('next 만 있으면 next - GAP', () => {
    expect(betweenOrder(null, 2000)).toBe(1000);
  });
  it('둘 다 null 이면 GAP', () => {
    expect(betweenOrder(null, null)).toBe(ORDER_GAP);
  });
});

describe('reorderWithin', () => {
  const cards = [
    { id: 'a', columnId: 'col', order: 1000 },
    { id: 'b', columnId: 'col', order: 2000 },
    { id: 'c', columnId: 'col', order: 3000 },
  ];

  it("'down' 으로 b 를 아래로 이동 → b 와 c 사이의 order 가 아니라 c 다음으로", () => {
    // b(idx 1) → down: 새 위치는 c 다음 (맨 끝). 새 order = 3000 + GAP
    const next = reorderWithin(cards, 'b', 'down');
    expect(next.order).toBe(4000);
  });

  it("'up' 으로 c 를 위로 이동 → a 와 b 사이 = 1500", () => {
    // c(idx 2) → up: 새 위치는 b 위 (a, b 사이)
    const next = reorderWithin(cards, 'c', 'up');
    expect(next.order).toBe(1500);
  });

  it("'up' 으로 a (이미 맨 위) 이동 → null (no-op)", () => {
    expect(reorderWithin(cards, 'a', 'up')).toBeNull();
  });

  it("'down' 으로 c (이미 맨 아래) 이동 → null (no-op)", () => {
    expect(reorderWithin(cards, 'c', 'down')).toBeNull();
  });

  it('존재하지 않는 카드 → null', () => {
    expect(reorderWithin(cards, 'zzz', 'up')).toBeNull();
  });
});

describe('computeDropOrder (#395 같은 컬럼 DnD reorder)', () => {
  const cards = [
    { id: 'a', columnId: 'col', order: 1000 },
    { id: 'b', columnId: 'col', order: 2000 },
    { id: 'c', columnId: 'col', order: 3000 },
  ];

  it('같은 컬럼: a 를 c 위로 드롭 (아래로 이동) → c 다음', () => {
    const order = computeDropOrder({
      activeCardId: 'a',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col',
      targetCards: cards,
      overCardId: 'c',
    });
    // a 가 원래 idx 0, c 가 idx 2 → 아래로 이동 → c 뒤. 자기 제외 sorted = [b,c]. c 뒤 = 3000+1000=4000.
    expect(order).toBe(4000);
  });

  it('같은 컬럼: c 를 a 위로 드롭 (위로 이동) → a 앞', () => {
    const order = computeDropOrder({
      activeCardId: 'c',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col',
      targetCards: cards,
      overCardId: 'a',
    });
    // 위로 이동 → a 앞 = null/1000 → 1000 - 1000 = 0.
    expect(order).toBe(0);
  });

  it('같은 컬럼: a 를 b 위로 드롭 (아래로 1칸) → b 뒤 = b 와 c 사이', () => {
    const order = computeDropOrder({
      activeCardId: 'a',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col',
      targetCards: cards,
      overCardId: 'b',
    });
    // a 자기 제외 sorted = [b,c]. b 뒤 = (2000+3000)/2 = 2500.
    expect(order).toBe(2500);
  });

  it('#428 같은 컬럼: 자기 자신 위에 드롭 → 끝에 append 로 잘못 흐름 (BoardDndContext early-return 으로 막아야)', () => {
    // computeDropOrder 만 단독으로 보면 self-drop 시 자기 제외 → 끝 append 가 된다.
    // 이게 시각적 no-op 처럼 보여야 정상이므로, BoardDndContext 가 active.id===over.id 를 early return.
    const order = computeDropOrder({
      activeCardId: 'b',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col',
      targetCards: cards,
      overCardId: 'b',
    });
    // 자기 제외 [a,c] → c 뒤 = 4000. 호출되면 잘못된 위치. handler 측 early-return 으로 호출 자체를 막는 것이 옳다.
    expect(order).toBe(4000);
  });

  it('컬럼 본체 드롭 → 끝에 append', () => {
    const order = computeDropOrder({
      activeCardId: 'a',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col',
      targetCards: cards,
      overCardId: null,
    });
    expect(order).toBe(4000);
  });

  it('다른 컬럼 → over 카드 앞', () => {
    const target = [{ id: 'x', columnId: 'col2', order: 5000 }];
    const order = computeDropOrder({
      activeCardId: 'a',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col2',
      targetCards: target,
      overCardId: 'x',
    });
    expect(order).toBe(4000);
  });

  it('다른 컬럼 빈 컬럼 → GAP', () => {
    const order = computeDropOrder({
      activeCardId: 'a',
      sourceColumnId: 'col',
      sourceCards: cards,
      targetColumnId: 'col2',
      targetCards: [],
      overCardId: null,
    });
    expect(order).toBe(ORDER_GAP);
  });
});

describe('optimisticMove — same column reorder', () => {
  it('같은 컬럼 안에서 order 명시하면 그대로 적용 (#214 회귀 가드)', () => {
    const cards = [
      { id: 'a', columnId: 'col', order: 1000 },
      { id: 'b', columnId: 'col', order: 2000 },
      { id: 'c', columnId: 'col', order: 3000 },
    ];
    const next = optimisticMove(cards, 'c', 'col', 1500);
    const c = next.find((x) => x.id === 'c');
    expect(c.order).toBe(1500);
    expect(c.columnId).toBe('col');
  });

  it('다른 컬럼 이동 (기존 동작) — append', () => {
    const cards = [
      { id: 'a', columnId: 'col1', order: 1000 },
      { id: 'b', columnId: 'col2', order: 1000 },
    ];
    const next = optimisticMove(cards, 'a', 'col2');
    const a = next.find((x) => x.id === 'a');
    expect(a.columnId).toBe('col2');
    expect(a.order).toBe(2000);
  });
});
