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
  // #258: batch endpoint 로 전환. 컬럼별 listCards 는 더 이상 호출 안 됨.
  vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: cardsByCol } });
};

/**
 * 외부에서 resolve/reject 을 호출할 수 있는 deferred Promise.
 * - optimistic 검증 시 "서버 즉시 응답"이 optimistic UI를 가리는 걸 방지하기 위함.
 */
const deferred = () => {
  /** @type {(value: any) => void} */
  let resolveFn = () => {};
  /** @type {(reason?: any) => void} */
  let rejectFn = () => {};
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
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
    // #356: 모든 breakpoint 가로 스크롤로 통일. flex-nowrap 으로 wrap 차단.
    // #381: board-grid-scroll 커스텀 클래스 — 스크롤바 항상 표시 + Minimalist 톤.
    expect(grid.className).toMatch(/board-grid-scroll/);
    expect(grid.className).toMatch(/flex-nowrap/);
    expect(grid.className).not.toMatch(/md:grid/);
  });

  it('"+ Add card" 클릭 → 입력 → 생성 시 optimistic 으로 즉시 보인다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    // 서버 응답을 지연시켜 optimistic 상태에서 카드가 실제로 보이는지 검증
    const d = deferred();
    const createSpy = vi.spyOn(api, 'createCard').mockReturnValue(d.promise);
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 추가/ }));
    const input = within(todoRegion).getByLabelText(/카드 제목/);
    await user.type(input, '새 카드');
    await user.click(within(todoRegion).getByRole('button', { name: /추가/ }));

    // 서버 응답 도착 전 optimistic 상태에서 카드가 보여야 한다
    expect(await within(todoRegion).findByText('새 카드')).toBeInTheDocument();

    // 이제 서버 응답을 흘려보내고 호출 인자 검증
    d.resolve({
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
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ columnId: 'c-todo', title: '새 카드' });
    });
  });

  it('카드 이동 드롭다운에서 다른 컬럼 선택 시 optimistic 으로 즉시 이동한다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    // 서버 응답을 지연시켜 "즉시 optimistic 반영" 을 정확히 검증
    const d = deferred();
    const moveSpy = vi.spyOn(api, 'moveCard').mockReturnValue(d.promise);
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    // 카드의 이동 버튼 (드롭다운)
    const moveBtn = within(todoRegion).getByRole('button', {
      name: /SSO 토큰 만료 정책 정리 다른 컬럼으로 이동/,
    });
    await user.click(moveBtn);
    // 메뉴에서 Doing 선택
    await user.click(screen.getByRole('menuitem', { name: /Doing/ }));

    const doingRegion = screen.getByRole('region', { name: /Doing 컬럼/ });
    // 서버 응답 전 optimistic: Doing 컬럼에 즉시 등장
    expect(await within(doingRegion).findByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();
    // Todo 에서는 사라짐
    expect(within(todoRegion).queryByText('SSO 토큰 만료 정책 정리')).not.toBeInTheDocument();

    // 이제 서버 응답 흘려보내고 호출 인자 검증
    d.resolve({
      data: {
        card: { ...todoCards[0], columnId: 'c-doing', order: 1500 },
      },
    });
    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledWith('k1', { columnId: 'c-doing' });
    });
  });

  it('카드 이동 실패 시 optimistic 롤백된다', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    // 실패 응답을 deferred 로 늦춰 "Done 으로 잠깐 이동(optimistic) → Todo 로 복귀" 순서를 검증
    const d = deferred();
    vi.spyOn(api, 'moveCard').mockReturnValue(d.promise);
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    const moveBtn = within(todoRegion).getByRole('button', {
      name: /SSO 토큰 만료 정책 정리 다른 컬럼으로 이동/,
    });
    await user.click(moveBtn);
    await user.click(screen.getByRole('menuitem', { name: /Done/ }));

    // 1) 먼저 optimistic 이동 확인 — Done 에 즉시 등장
    const doneRegion = screen.getByRole('region', { name: /Done 컬럼/ });
    expect(await within(doneRegion).findByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();
    // 동시에 Todo 에서는 사라짐
    expect(within(todoRegion).queryByText('SSO 토큰 만료 정책 정리')).not.toBeInTheDocument();

    // 2) 서버가 실패 응답 — 롤백되어 Todo 로 복귀, Done 에서는 사라져야 함
    d.reject({ isAxiosError: true, response: { status: 500 } });
    await waitFor(() => {
      expect(within(todoRegion).getByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();
    });
    expect(within(doneRegion).queryByText('SSO 토큰 만료 정책 정리')).not.toBeInTheDocument();
  });

  it('카드 삭제 버튼 → confirm 후 optimistic 으로 제거된다 (#219)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    // 서버 응답 지연 — optimistic 제거가 서버 응답 전 발생함을 검증
    const d = deferred();
    const deleteSpy = vi.spyOn(api, 'deleteCard').mockReturnValue(d.promise);
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(
      within(todoRegion).getByRole('button', { name: /SSO 토큰 만료 정책 정리 삭제/ }),
    );

    // confirm 다이얼로그 — jsdom 에선 <dialog> open 이 안 잡힐 수 있어 hidden: true 로 조회.
    const heading = await screen.findByRole('heading', {
      name: '카드를 삭제할까요?',
      hidden: true,
    });
    // 다이얼로그 footer 의 "삭제" 버튼 — heading 의 부모 dialog 안에서만 찾는다.
    const dialog = heading.closest('dialog');
    expect(dialog).not.toBeNull();
    expect(within(todoRegion).getByText('SSO 토큰 만료 정책 정리')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '삭제', hidden: true }));

    // 확인 후 카드가 사라져야 한다 (optimistic remove)
    await waitFor(() => {
      expect(within(todoRegion).queryByText('SSO 토큰 만료 정책 정리')).not.toBeInTheDocument();
    });

    d.resolve({ status: 204 });
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('k1');
    });
  });

  it('프로젝트 로드 실패 시 에러 상태 + 다시 시도 버튼', async () => {
    vi.spyOn(api, 'getProject').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: [] } });
    vi.spyOn(api, 'listCards').mockResolvedValue({ data: { cards: [] } });
    renderPage();
    expect(
      await screen.findByText(/보드를 불러오지 못했어/, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('컬럼 로드 실패 시 에러 상태 + 다시 시도 시 컬럼 refetch', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getProject').mockResolvedValue({ data: { project: PROJECT } });
    const columnsSpy = vi
      .spyOn(api, 'listColumns')
      .mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: {} } });
    renderPage();
    expect(
      await screen.findByText(/보드를 불러오지 못했어/, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    columnsSpy.mockClear();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => {
      expect(columnsSpy).toHaveBeenCalled();
    });
  });

  it('카드 batch 로드 실패 시에도 에러 상태 + 다시 시도 시 batch refetch (#258)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getProject').mockResolvedValue({ data: { project: PROJECT } });
    vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: COLUMNS } });
    const cardsSpy = vi
      .spyOn(api, 'listCardsBatch')
      .mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    renderPage();
    expect(
      await screen.findByText(/보드를 불러오지 못했어/, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    cardsSpy.mockClear();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => {
      expect(cardsSpy).toHaveBeenCalled();
    });
  });

  it('비멤버 403 응답은 친화 안내 + /boards 복귀 (#238)', async () => {
    vi.spyOn(api, 'getProject').mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    });
    vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: [] } });
    vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: {} } });
    renderPage();
    expect(await screen.findByText(/이 보드는 멤버만 볼 수 있어/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '프로젝트 목록으로' })).toBeInTheDocument();
  });
});
