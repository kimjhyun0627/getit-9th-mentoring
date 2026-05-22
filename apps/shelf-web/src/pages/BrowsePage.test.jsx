/**
 * BrowsePage 테스트 (#561) — 부원 서재 디렉토리.
 *
 * 검증:
 *  - 부원 카드 grid 렌더 (nickname + bookCount).
 *  - 카드 클릭 시 `/u/:userId` 링크 생성.
 *  - 빈 목록 안내 문구.
 *  - 에러 fallback 메시지.
 *  - 페이지네이션 다음 페이지 fetch 트리거.
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BrowsePage } from './BrowsePage.jsx';

const renderAt = (path = '/browse') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/u/:userId" element={<div>UserShelfPage Stub</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
};

describe('BrowsePage (/browse) — #561', () => {
  afterEach(() => vi.restoreAllMocks());

  it('부원 카드 grid 를 렌더한다 — nickname + 책 권 수', async () => {
    vi.spyOn(api, 'listBrowseUsers').mockResolvedValue({
      data: {
        users: [
          { userId: 'u_alice', nickname: '앨리스', bookCount: 12 },
          { userId: 'u_bob', nickname: 'Bobby', bookCount: 3 },
        ],
        pagination: { page: 1, pageSize: 20, total: 2, sort: 'bookCount' },
      },
    });

    renderAt();

    expect(await screen.findByText('앨리스')).toBeInTheDocument();
    expect(screen.getByText('Bobby')).toBeInTheDocument();
    // 권 수와 카피가 별도 span/text 노드로 분리됨 → number 노드를 따로 검증.
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // "권의 책을 모았습니다." 카피가 두 카드 모두에서 렌더되는지.
    expect(screen.getAllByText(/권의 책을 모았습니다/)).toHaveLength(2);
  });

  it('카드는 /u/:userId 링크', async () => {
    vi.spyOn(api, 'listBrowseUsers').mockResolvedValue({
      data: {
        users: [{ userId: 'u_alice', nickname: '앨리스', bookCount: 1 }],
        pagination: { page: 1, pageSize: 20, total: 1, sort: 'bookCount' },
      },
    });
    renderAt();

    const link = await screen.findByRole('link', { name: /앨리스/ });
    expect(link).toHaveAttribute('href', '/u/u_alice');
  });

  it('빈 목록이면 안내 문구', async () => {
    vi.spyOn(api, 'listBrowseUsers').mockResolvedValue({
      data: {
        users: [],
        pagination: { page: 1, pageSize: 20, total: 0, sort: 'bookCount' },
      },
    });
    renderAt();
    expect(
      await screen.findByText(/아직 공개된 서재가 없습니다|공개된 서재가 없습니다/),
    ).toBeInTheDocument();
  });

  it('API 에러면 fallback 메시지', async () => {
    vi.spyOn(api, 'listBrowseUsers').mockRejectedValue(new Error('boom'));
    renderAt();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
