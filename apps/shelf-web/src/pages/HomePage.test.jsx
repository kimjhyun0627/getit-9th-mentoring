import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { HomePage } from './HomePage.jsx';

const shelves = [
  {
    id: 'shelf-1',
    bookId: 'book-1',
    status: 'READ',
    rating: 5,
    review: '읽기의 계절 감상',
    addedAt: '2026-04-10T00:00:00.000Z',
    completedAt: '2026-04-12T00:00:00.000Z',
    book: {
      id: 'book-1',
      isbn: '9788900000001',
      title: '읽기의 계절',
      author: '김연수',
      coverUrl: null,
    },
  },
  {
    id: 'shelf-2',
    bookId: 'book-2',
    status: 'READING',
    rating: 0,
    review: null,
    addedAt: '2026-05-01T00:00:00.000Z',
    completedAt: null,
    book: {
      id: 'book-2',
      isbn: '9788900000002',
      title: '여름의 문장',
      author: '박서영',
      coverUrl: null,
    },
  },
  {
    id: 'shelf-3',
    bookId: 'book-3',
    status: 'WANT',
    rating: 0,
    review: null,
    addedAt: '2026-05-05T00:00:00.000Z',
    completedAt: null,
    book: {
      id: 'book-3',
      isbn: '9788900000003',
      title: '빛이 머무는 방',
      author: '정세랑',
      coverUrl: null,
    },
  },
];

const renderHome = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <HomePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('서재 목록 fetch 후 책 카드들을 렌더한다', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 100, total: 3 } },
    });
    renderHome();
    expect(await screen.findByRole('heading', { name: '읽기의 계절' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '여름의 문장' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '빛이 머무는 방' })).toBeInTheDocument();
  });

  it('hero에 "나의 도서관" 헤딩이 있다', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 100, total: 3 } },
    });
    renderHome();
    expect(await screen.findByRole('heading', { name: /나의 도서관/ })).toBeInTheDocument();
  });

  it('필터 탭: Reading 만 보이게 1권만 남는다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 100, total: 3 } },
    });
    renderHome();
    await screen.findByRole('heading', { name: '읽기의 계절' });
    await user.click(screen.getByRole('button', { name: /^Reading/ }));
    expect(screen.getByRole('heading', { name: '여름의 문장' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '읽기의 계절' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '빛이 머무는 방' })).not.toBeInTheDocument();
  });

  it('서재 비어 있으면 empty placeholder 노출', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
    renderHome();
    expect(await screen.findByText(/서가가 비어 있어/)).toBeInTheDocument();
  });

  it('책 카드 클릭 → 편집 모달 오픈', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 100, total: 3 } },
    });
    renderHome();
    const card = await screen.findByRole('button', { name: /읽기의 계절 편집/ });
    await user.click(card);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('편집 저장 → updateShelf API 호출', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 100, total: 3 } },
    });
    const updateSpy = vi
      .spyOn(api, 'updateShelf')
      .mockResolvedValue({ data: { shelf: { ...shelves[0], rating: 4 } } });
    renderHome();
    const card = await screen.findByRole('button', { name: /읽기의 계절 편집/ });
    await user.click(card);
    await user.click(screen.getByRole('radio', { name: '별점 4점' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('book-1', expect.objectContaining({ rating: 4 }));
    });
  });

  it('500 응답 시 에러 메시지', async () => {
    vi.spyOn(api, 'listMyShelves').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { error: 'InternalError' } },
    });
    renderHome();
    expect(await screen.findByText(/서버 오류가 발생했어요/)).toBeInTheDocument();
  });
});
