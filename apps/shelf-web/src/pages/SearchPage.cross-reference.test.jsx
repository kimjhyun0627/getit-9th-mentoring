/**
 * SearchPage cross-reference + stale 시나리오 — #217 / #236 가드.
 *
 * 메인 spec (`SearchPage.test.jsx`) 와 분리해 300줄 제한 유지.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { DEMIAN, renderSearch } from './SearchPage.testkit.jsx';

const shelfRow = (overrides) => ({
  id: 's1',
  bookId: 'book-1',
  status: 'WANT',
  rating: null,
  review: null,
  addedAt: '2026-05-01T00:00:00Z',
  completedAt: null,
  i_added: true,
  book: { ...DEMIAN, coverUrl: null },
  ...overrides,
});

describe('SearchPage cross-reference + stale', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('내 서재 cross-reference 로 isAdded 가 새로고침 후에도 유지된다 (#217)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: {
        shelves: [shelfRow()],
        pagination: { page: 1, pageSize: 100, total: 1 },
      },
    });
    vi.spyOn(api, 'searchBooks').mockResolvedValue({ items: [DEMIAN] });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    const btn = await screen.findByRole('button', { name: /데미안 서재에 담김/ });
    expect(btn).toBeDisabled();
  });

  it('422 응답(이미 존재) 직후 isAdded 가 즉시 true 가 된다 (#217 race fix)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue({ items: [DEMIAN] });
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
      items: [{ ...DEMIAN, stale: true }],
    });
    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    expect(await screen.findByTestId('stale-label')).toHaveTextContent(/캐시된 정보/);
  });
});
