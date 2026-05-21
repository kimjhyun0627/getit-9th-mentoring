import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { renderSearch } from './SearchPage.testkit.jsx';

/**
 * SearchPage 무한 스크롤 가드 (#525) — `SearchPage.test.jsx` 가 300 줄 상한을 넘지 않도록
 * 무한 스크롤 시나리오만 분리.
 *
 * 가드 시나리오:
 *  - sentinel intersect 시 visibleCount 가 PAGE_STEP 만큼 자동 증분된다
 *  - 기존 "더 보기" 버튼이 더 이상 렌더되지 않는다 (회귀 가드)
 */

const setupObserverMock = () => {
  const instances = [];
  class MockIO {
    constructor(cb) {
      this.cb = cb;
      this.observed = [];
      instances.push(this);
    }
    observe(el) {
      this.observed.push(el);
    }
    unobserve() {}
    disconnect() {
      this.observed = [];
    }
    trigger() {
      this.cb(this.observed.map((target) => ({ isIntersecting: true, target })));
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIO);
  return instances;
};

const makeItem = (i) => ({
  id: `book-${i}`,
  isbn: `978${String(i).padStart(10, '0')}`,
  title: `검색결과 ${i}`,
  author: '저자',
  publisher: '출판사',
  coverUrl: null,
});

describe('SearchPage — 무한 스크롤 (#525)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // SearchPage cross-reference 용 myShelves 기본 stub.
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('검색 결과 10건 초과 시 sentinel intersect → 추가 카드가 노출된다', async () => {
    const items = Array.from({ length: 25 }, (_, i) => makeItem(i + 1));
    vi.spyOn(api, 'searchBooks').mockResolvedValue({ items });
    const observerInstances = setupObserverMock();

    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    // 1페이지 (10건) 렌더 대기.
    await screen.findByRole('heading', { name: '검색결과 1' });
    expect(screen.queryByRole('heading', { name: '검색결과 11' })).not.toBeInTheDocument();
    expect(screen.getByTestId('search-sentinel')).toBeInTheDocument();

    // sentinel 진입 → visibleCount += 10.
    await act(async () => {
      observerInstances[observerInstances.length - 1]?.trigger();
    });
    expect(await screen.findByRole('heading', { name: '검색결과 20' })).toBeInTheDocument();
  });

  it('"더 보기" 버튼이 더 이상 렌더되지 않는다 (회귀 가드)', async () => {
    setupObserverMock();
    const items = Array.from({ length: 25 }, (_, i) => makeItem(i + 1));
    vi.spyOn(api, 'searchBooks').mockResolvedValue({ items });
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await screen.findByRole('heading', { name: '검색결과 1' });
    expect(screen.queryByTestId('search-load-more')).not.toBeInTheDocument();
  });
});
