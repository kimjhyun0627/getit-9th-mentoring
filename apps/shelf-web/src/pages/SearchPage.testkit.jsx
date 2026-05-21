/**
 * SearchPage 테스트 공용 헬퍼 — render + 기본 mock setup.
 *
 * 본 파일은 테스트 셋업만 — 직접 spec 정의 없음.
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchPage } from './SearchPage.jsx';

/**
 * SearchPage 를 isolated QueryClient + MemoryRouter 로 렌더.
 *
 * @returns {{ queryClient: QueryClient } & ReturnType<typeof render>}
 */
export const renderSearch = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/search']}>
          <SearchPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
};

/** 검색 결과로 자주 쓰는 책 1건 — 데미안. */
export const DEMIAN = {
  id: 'book-1',
  isbn: '9788932917245',
  title: '데미안',
  author: '헤르만 헤세',
  publisher: '민음사',
  coverUrl: null,
};

/**
 * `api.searchBooks` 모킹 응답 헬퍼 (#527) — pagination meta 포함.
 *
 * `useInfiniteQuery` 가 `getNextPageParam` 으로 lastPage.isEnd 를 검사하므로
 * 테스트에서 무한 루프 회피하려면 isEnd 가 명시되어야 함. 명시하지 않으면 true 기본 (1페이지에서 끝).
 *
 * @param {Array<Record<string, unknown>>} items
 * @param {{ page?: number; size?: number; isEnd?: boolean; totalCount?: number }} [opts]
 */
export const searchPage = (items, opts = {}) => ({
  items,
  page: opts.page ?? 1,
  size: opts.size ?? 30,
  isEnd: opts.isEnd ?? true,
  totalCount: opts.totalCount ?? items.length,
});
