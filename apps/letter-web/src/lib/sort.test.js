/**
 * sortMessages — 정렬 헬퍼 회귀 테스트 (#307).
 */
import { describe, expect, it } from 'vitest';

import { sortMessages } from './sort.js';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];

describe('sortMessages', () => {
  it('latest 모드는 입력 그대로 반환 (BE 의 createdAt desc 신뢰)', () => {
    expect(sortMessages(items, 'latest')).toBe(items);
  });

  it('random 모드는 같은 seed 면 deterministic', () => {
    const a = sortMessages(items, 'random', 42).map((m) => m.id);
    const b = sortMessages(items, 'random', 42).map((m) => m.id);
    expect(a).toEqual(b);
  });

  it('random 모드는 입력을 mutate 하지 않는다', () => {
    const ids = items.map((m) => m.id);
    sortMessages(items, 'random', 7);
    expect(items.map((m) => m.id)).toEqual(ids);
  });

  it('random 모드는 같은 항목을 모두 포함 (loss 없음)', () => {
    const out = sortMessages(items, 'random', 99);
    expect(out.length).toBe(items.length);
    expect(out.map((m) => m.id).sort()).toEqual(items.map((m) => m.id).sort());
  });

  it('빈 배열 / 비배열 안전 처리', () => {
    expect(sortMessages([], 'random', 1)).toEqual([]);
    // @ts-expect-error — 의도적 invalid 입력.
    expect(sortMessages(null, 'random', 1)).toEqual([]);
  });
});
