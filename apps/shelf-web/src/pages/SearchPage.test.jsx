import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { SearchPage } from './SearchPage.jsx';

/**
 * SearchPage TDD 가드 (Issue #43).
 *
 * Acceptance:
 *  - debounce 300ms (입력 → 300ms 후 검색)
 *  - 추가 후 토스트 + 캐시 invalidate
 *  - 빈 결과 placeholder
 */

const renderSearch = () => {
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

describe('SearchPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // SearchPage 는 #217 cross-reference 위해 useMyShelves 도 호출 — 테스트별로 따로 mock 하지 않으면
    // jsdom 이 실제 네트워크 시도 → noise. 기본은 빈 서가.
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('검색 입력과 헤딩을 렌더한다', () => {
    renderSearch();
    expect(screen.getByRole('searchbox', { name: /책 검색/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /책을 찾아보세요/ })).toBeInTheDocument();
  });

  it('초기 상태에서는 검색 API 를 호출하지 않는다', () => {
    const spy = vi.spyOn(api, 'searchBooks').mockResolvedValue({ items: [] });
    renderSearch();
    expect(spy).not.toHaveBeenCalled();
  });

  it('타이핑 직후엔 검색 API 가 호출되지 않고, 300ms 후엔 호출된다 (debounce)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'searchBooks').mockResolvedValue({ items: [] });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    // 타이핑 직후엔 debounce 안 풀려 → 호출 X
    expect(spy).not.toHaveBeenCalled();

    // 300ms+ 지나면 호출 됨
    await waitFor(
      () => {
        expect(spy).toHaveBeenCalledWith('데미안');
      },
      { timeout: 1500 },
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('빈 검색 결과면 placeholder 를 노출한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({ items: [] });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '없는책');

    expect(
      await screen.findByText(/이 서가에는 그 책이 없습니다/, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('결과 카드의 "서재에 추가" 버튼 클릭 시 addToShelf 가 호출된다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ],
    });
    const addSpy = vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    const addButton = await screen.findByRole('button', { name: /데미안 서재에 추가/ });
    await user.click(addButton);

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ bookId: 'book-1' }));
    });
  });

  it('서재 추가 성공 시 토스트가 노출된다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ],
    });
    vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/서재에 담았습니다/);
  });

  it('서재 추가 성공 시 /shelves/me 캐시를 무효화한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ],
    });
    vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    const { queryClient } = renderSearch();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['shelves', 'me'] });
    });
  });

  it('루트 section 이 max-w-7xl + mx-auto 컨테이너로 감싸져 있다 (다크 모드 회귀 가드)', () => {
    // Issue #90: 다크 모드에서 max-w 가 사라지고 본문이 viewport 왼쪽에 붙는 회귀를 막는다.
    const { container } = renderSearch();
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.className).toMatch(/max-w-7xl/);
    expect(section?.className).toMatch(/mx-auto/);
    // 좌우 padding 도 함께 — 모바일/데스크탑 둘 다.
    expect(section?.className).toMatch(/px-6/);
  });

  it('헤딩이 토큰 기반 색(text-ink-strong)을 사용한다 (다크 모드 대비 가드)', () => {
    // 정의되지 않은 text-ink 클래스로 다크 모드에서 헤딩이 깨졌던 회귀 방지.
    renderSearch();
    const heading = screen.getByRole('heading', { name: /책을 찾아보세요/ });
    expect(heading.className).toMatch(/text-ink-strong/);
  });

  it('내 서재 cross-reference 로 isAdded 가 새로고침 후에도 유지된다 (#217)', async () => {
    const user = userEvent.setup();
    // 내 서재에 같은 book-1 이 이미 있음 — search 결과에서 "담김" 으로 떠야 함.
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: {
        shelves: [
          {
            id: 's1',
            bookId: 'book-1',
            status: 'WANT',
            rating: null,
            review: null,
            addedAt: '2026-05-01T00:00:00Z',
            completedAt: null,
            i_added: true,
            book: {
              id: 'book-1',
              isbn: '9788932917245',
              title: '데미안',
              author: '헤르만 헤세',
              coverUrl: null,
            },
          },
        ],
        pagination: { page: 1, pageSize: 100, total: 1 },
      },
    });
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ],
    });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    // 결과 카드가 "서재에 담김" 으로 disabled 되어 있어야 함.
    const btn = await screen.findByRole('button', { name: /데미안 서재에 담김/ });
    expect(btn).toBeDisabled();
  });

  it('422 응답(이미 존재) 직후 isAdded 가 즉시 true 가 된다 (#217 race fix)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ],
    });
    vi.spyOn(api, 'addToShelf').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'ShelfAlreadyExists' } },
    });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /데미안 서재에 담김/ })).toBeDisabled();
    });
  });

  it('book.stale=true 면 "캐시된 정보" 라벨이 노출된다 (#236)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
          stale: true,
        },
      ],
    });
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    expect(await screen.findByTestId('stale-label')).toHaveTextContent(/캐시된 정보/);
  });

  it('서재 추가 실패(422 이미 존재) 시 안내 토스트가 노출된다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({
      items: [
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ],
    });
    vi.spyOn(api, 'addToShelf').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'ShelfAlreadyExists' } },
    });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/이미 서재에 꽂혀 있는 책/);
  });
});
