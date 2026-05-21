import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { renderSearch, searchPage } from './SearchPage.testkit.jsx';

/**
 * SearchPage 무한 스크롤 가드 (#527) — `SearchPage.test.jsx` 가 300 줄 상한을 넘지 않도록
 * 무한 스크롤 시나리오만 분리.
 *
 * 가드 시나리오 (#527 부터 진짜 페이지네이션):
 *  - sentinel intersect 시 BE `fetchNextPage` 가 호출되고 누적 items 가 늘어난다
 *  - 마지막 페이지(isEnd=true) 도달 시 sentinel intersect 가 발사되지 않는다
 *  - 기존 "더 보기" 버튼이 더 이상 렌더되지 않는다 (회귀 가드)
 *  - getNextPageParam: lastPage.isEnd ? undefined : page+1
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

describe('SearchPage — 무한 스크롤 (#527)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sentinel intersect → 다음 페이지 BE fetch + 누적 노출', async () => {
    // 1페이지: 30건 isEnd=false, 2페이지: 5건 isEnd=true
    const page1 = Array.from({ length: 30 }, (_, i) => makeItem(i + 1));
    const page2 = Array.from({ length: 5 }, (_, i) => makeItem(i + 31));
    const spy = vi.spyOn(api, 'searchBooks').mockImplementation(async (_q, opts = {}) => {
      if (opts.page === 2) return searchPage(page2, { page: 2, size: 30, isEnd: true });
      return searchPage(page1, { page: 1, size: 30, isEnd: false, totalCount: 35 });
    });
    const observerInstances = setupObserverMock();

    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    // 1페이지 (30건) 렌더 대기.
    await screen.findByRole('heading', { name: '검색결과 1' });
    expect(screen.queryByRole('heading', { name: '검색결과 31' })).not.toBeInTheDocument();
    expect(screen.getByTestId('search-sentinel')).toBeInTheDocument();

    // sentinel intersect → page=2 fetch.
    await act(async () => {
      observerInstances[observerInstances.length - 1]?.trigger();
    });
    expect(await screen.findByRole('heading', { name: '검색결과 31' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '검색결과 35' })).toBeInTheDocument();

    // BE 가 page=2 옵션과 함께 호출되었는지 확인.
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('데미안', expect.objectContaining({ page: 2, size: 30 }));
    });
  });

  it('마지막 페이지 도달 (isEnd=true) → "모두 보여드렸어요" 노출', async () => {
    setupObserverMock();
    const items = Array.from({ length: 5 }, (_, i) => makeItem(i + 1));
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage(items, { page: 1, size: 30, isEnd: true, totalCount: 5 }),
    );
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    await screen.findByRole('heading', { name: '검색결과 1' });
    expect(await screen.findByText(/모두 보여드렸어요/)).toBeInTheDocument();
  });

  // Gemini #528: 카카오 cap=50. 51 페이지 요청을 미리 잠궈서 BE 400 노출을 차단.
  it('50 페이지 도달하면 isEnd=false 라도 다음 페이지를 요청하지 않는다', async () => {
    setupObserverMock();
    const items = Array.from({ length: 30 }, (_, i) => makeItem(i + 1));
    const spy = vi.spyOn(api, 'searchBooks').mockResolvedValue(
      // page=50 + isEnd=false 흉내 — FE 가드가 page=51 요청을 막아야 함.
      searchPage(items, { page: 50, size: 30, isEnd: false, totalCount: 9999 }),
    );
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await screen.findByRole('heading', { name: '검색결과 1' });
    // 첫 호출만 발생. 추가 호출이 없는지 잠깐 대기 후 검증.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(spy).toHaveBeenCalledTimes(1);
    // 종료 안내 노출 (cap 도달 → "모두 보여드렸어요").
    expect(await screen.findByText(/모두 보여드렸어요/)).toBeInTheDocument();
  });

  it('"더 보기" 버튼이 더 이상 렌더되지 않는다 (회귀 가드)', async () => {
    setupObserverMock();
    const items = Array.from({ length: 25 }, (_, i) => makeItem(i + 1));
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage(items, { page: 1, size: 30, isEnd: true, totalCount: 25 }),
    );
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await screen.findByRole('heading', { name: '검색결과 1' });
    expect(screen.queryByTestId('search-load-more')).not.toBeInTheDocument();
  });
});
