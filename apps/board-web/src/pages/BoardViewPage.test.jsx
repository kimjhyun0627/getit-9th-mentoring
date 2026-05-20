import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BoardViewPage } from './BoardViewPage.jsx';

/**
 * BoardViewPage TDD 가드 (Issue #50).
 * - 헤더 / 통계 / 3 컬럼 렌더
 * - 카드 생성 / 이동 (드롭다운) / 삭제 + optimistic update
 * - light/dark 토글 + 반응형 (기본 grid 클래스 검증)
 * - 에러 / 로딩 상태
 */

const PROJECT = {
  id: 'p1',
  ownerId: 'u1',
  name: 'GETIT 9기 멘토링',
  description: '네 개 프로덕트 통합 SSO',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
};

const COLUMNS = [
  { id: 'c-todo', projectId: 'p1', name: 'Todo', order: 1000 },
  { id: 'c-doing', projectId: 'p1', name: 'Doing', order: 2000 },
  { id: 'c-done', projectId: 'p1', name: 'Done', order: 3000 },
];

const todoCards = [
  {
    id: 'k1',
    columnId: 'c-todo',
    title: 'SSO 토큰 만료 정책 정리',
    description: 'refresh / access 분리',
    assigneeId: null,
    order: 1000,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
];
const doingCards = [
  {
    id: 'k2',
    columnId: 'c-doing',
    title: '랜딩 minimalist 시안',
    description: null,
    assigneeId: 'u2',
    order: 1000,
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
  },
];
const doneCards = [
  {
    id: 'k3',
    columnId: 'c-done',
    title: '레포 모노레포 초기화',
    description: null,
    assigneeId: null,
    order: 1000,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
];

const cardsByCol = {
  'c-todo': todoCards,
  'c-doing': doingCards,
  'c-done': doneCards,
};

const stubHappyPath = () => {
  vi.spyOn(api, 'getProject').mockResolvedValue({ data: { project: PROJECT } });
  vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: COLUMNS } });
  vi.spyOn(api, 'listCards').mockImplementation((columnId) =>
    Promise.resolve({ data: { cards: cardsByCol[columnId] ?? [] } }),
  );
};

const renderPage = (initialEntry = '/boards/p1') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/boards/:id" element={<BoardViewPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('BoardViewPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('프로젝트 이름과 3 컬럼(Todo/Doing/Done) 헤더를 보여준다', async () => {
    stubHappyPath();
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'GETIT 9기 멘토링' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: /Todo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Doing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Done/i })).toBeInTheDocument();
  });

  it('각 컬럼에 카드를 렌더하고 Done은 line-through, Doing은 인디고 인디케이터를 가진다', async () => {
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    expect(within(todoRegion).getByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();

    const doneRegion = screen.getByRole('region', { name: /Done 컬럼/ });
    const doneTitle = within(doneRegion).getByText('레포 모노레포 초기화');
    // Done 카드 제목은 line-through 클래스를 갖는다
    expect(doneTitle.className).toMatch(/line-through/);

    const doingRegion = screen.getByRole('region', { name: /Doing 컬럼/ });
    // Doing 컬럼 카드에는 인디고 인디케이터 (data-indigo-indicator)
    expect(within(doingRegion).getByTestId('doing-indicator')).toBeInTheDocument();
  });

  it('hairline divider 그리드 (gap-px + bg-hairline) 가 적용된다', async () => {
    stubHappyPath();
    renderPage();
    const grid = await screen.findByTestId('board-grid');
    expect(grid.className).toMatch(/gap-px/);
    expect(grid.className).toMatch(/bg-hairline/);
    // 반응형: 모바일 1열, md 이상 3열
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-3/);
  });

  it('"+ Add card" 클릭 → 입력 → 생성 시 optimistic 으로 즉시 보인다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const createSpy = vi.spyOn(api, 'createCard').mockResolvedValue({
      data: {
        card: {
          id: 'new-k',
          columnId: 'c-todo',
          title: '새 카드',
          description: null,
          assigneeId: null,
          order: 2000,
          createdAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /Add card/i }));
    const input = within(todoRegion).getByLabelText(/카드 제목/);
    await user.type(input, '새 카드');
    await user.click(within(todoRegion).getByRole('button', { name: /추가/ }));

    // optimistic: 응답 도착 전이라도 보여야 함 (createSpy 는 resolved 지만 RTL은 micro-task 이후 관찰)
    expect(await within(todoRegion).findByText('새 카드')).toBeInTheDocument();
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ columnId: 'c-todo', title: '새 카드' });
    });
  });

  it('카드 이동 드롭다운에서 다른 컬럼 선택 시 optimistic 으로 즉시 이동한다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const moveSpy = vi.spyOn(api, 'moveCard').mockResolvedValue({
      data: {
        card: { ...todoCards[0], columnId: 'c-doing', order: 1500 },
      },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    // 카드의 이동 버튼 (드롭다운)
    const moveBtn = within(todoRegion).getByRole('button', {
      name: /SSO 토큰 만료 정책 정리 이동/,
    });
    await user.click(moveBtn);
    // 메뉴에서 Doing 선택
    await user.click(screen.getByRole('menuitem', { name: 'Doing' }));

    const doingRegion = screen.getByRole('region', { name: /Doing 컬럼/ });
    // optimistic: Doing 컬럼에 즉시 등장
    expect(await within(doingRegion).findByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();
    // Todo 에서는 사라짐
    expect(within(todoRegion).queryByText('SSO 토큰 만료 정책 정리')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledWith('k1', { columnId: 'c-doing' });
    });
  });

  it('카드 이동 실패 시 optimistic 롤백된다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'moveCard').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    const moveBtn = within(todoRegion).getByRole('button', {
      name: /SSO 토큰 만료 정책 정리 이동/,
    });
    await user.click(moveBtn);
    await user.click(screen.getByRole('menuitem', { name: 'Done' }));

    // 잠시 후 롤백되어 Todo 에 다시 나타남
    await waitFor(() => {
      expect(within(todoRegion).getByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();
    });
  });

  it('카드 삭제 버튼 클릭 시 optimistic 으로 제거된다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const deleteSpy = vi.spyOn(api, 'deleteCard').mockResolvedValue({ status: 204 });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(
      within(todoRegion).getByRole('button', { name: /SSO 토큰 만료 정책 정리 삭제/ }),
    );

    await waitFor(() => {
      expect(within(todoRegion).queryByText('SSO 토큰 만료 정책 정리')).not.toBeInTheDocument();
    });
    expect(deleteSpy).toHaveBeenCalledWith('k1');
  });

  it('프로젝트 로드 실패 시 에러 상태 + 다시 시도 버튼', async () => {
    vi.spyOn(api, 'getProject').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: [] } });
    vi.spyOn(api, 'listCards').mockResolvedValue({ data: { cards: [] } });
    renderPage();
    expect(await screen.findByText(/보드를 불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
