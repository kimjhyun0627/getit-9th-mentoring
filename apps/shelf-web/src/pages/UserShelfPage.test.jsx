import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { UserShelfPage } from './UserShelfPage.jsx';

const renderAt = (path) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/u/:userId" element={<UserShelfPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
};

describe('UserShelfPage (/u/:userId) — #292', () => {
  afterEach(() => vi.restoreAllMocks());

  it('다른 유저 서재 책 목록을 렌더한다', async () => {
    vi.spyOn(api, 'listUserShelves').mockResolvedValue({
      data: {
        userId: 'alice',
        shelves: [
          {
            id: 's1',
            bookId: 'b1',
            status: 'READ',
            rating: 5,
            review: '인생책',
            addedAt: '2026-05-01',
            book: { isbn: '9788932917245', title: '소년이 온다', author: '한강', coverUrl: '' },
          },
        ],
        pagination: { page: 1, pageSize: 100, total: 1, sort: 'addedAt_desc' },
      },
    });
    renderAt('/u/alice');
    expect(await screen.findByRole('heading', { name: /@alice/ })).toBeInTheDocument();
    // 책 데이터는 비동기 — findByRole 로 대기
    expect(await screen.findByRole('heading', { name: '소년이 온다' })).toBeInTheDocument();
    expect(screen.getByText('인생책')).toBeInTheDocument();
    expect(screen.getByText(/총 1권/)).toBeInTheDocument();
  });

  it('빈 서재면 안내 문구', async () => {
    vi.spyOn(api, 'listUserShelves').mockResolvedValue({
      data: {
        userId: 'ghost',
        shelves: [],
        pagination: { page: 1, pageSize: 100, total: 0, sort: 'addedAt_desc' },
      },
    });
    renderAt('/u/ghost');
    expect(await screen.findByText('아직 첫 책이 꽂히지 않았습니다.')).toBeInTheDocument();
  });
});
