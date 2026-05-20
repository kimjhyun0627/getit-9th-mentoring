import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BoardViewPage } from './BoardViewPage.jsx';

/**
 * Phase 6b P1 가드 — 카드 편집 모달 / 담당자 picker / 같은-컬럼 reorder / 멤버 관리.
 *
 * 관련 issue: #198 / #200 / #203 / #214 / #297
 */

const PROJECT = {
  id: 'p1',
  ownerId: 'alice',
  name: 'GETIT board',
  description: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
  role: 'OWNER',
  currentUserId: 'alice',
  members: [
    { userId: 'alice', name: null },
    { userId: 'bob', name: null },
  ],
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
    title: '카드 A',
    description: '설명 A',
    assigneeId: null,
    order: 1000,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  {
    id: 'k2',
    columnId: 'c-todo',
    title: '카드 B',
    description: null,
    assigneeId: null,
    order: 2000,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  {
    id: 'k3',
    columnId: 'c-todo',
    title: '카드 C',
    description: null,
    assigneeId: null,
    order: 3000,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
];

const cardsByCol = {
  'c-todo': todoCards,
  'c-doing': [],
  'c-done': [],
};

const stubHappyPath = () => {
  vi.spyOn(api, 'getProject').mockResolvedValue({ data: { project: PROJECT } });
  vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: COLUMNS } });
  // #258: batch endpoint 로 전환.
  vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: cardsByCol } });
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

describe('BoardViewPage P1 (Phase 6b)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.open = false;
      };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('카드 본문 클릭 → 편집 모달이 열린다 (#198)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 A 편집/ }));
    expect(await screen.findByRole('heading', { name: '카드 편집' })).toBeInTheDocument();
    expect(screen.getByLabelText('카드 제목')).toHaveValue('카드 A');
    expect(screen.getByLabelText('카드 설명')).toHaveValue('설명 A');
  });

  it('편집 모달에서 제목 수정 → PATCH 호출 + optimistic 반영 (#198)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const updateSpy = vi.spyOn(api, 'updateCard').mockResolvedValue({
      data: {
        card: {
          ...todoCards[0],
          title: '카드 A 수정',
        },
      },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 A 편집/ }));
    const titleInput = await screen.findByLabelText('카드 제목');
    await user.clear(titleInput);
    await user.type(titleInput, '카드 A 수정');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('k1', { title: '카드 A 수정' });
    });
  });

  it('편집 모달에서 담당자 변경 → PATCH 호출에 assigneeId 포함 (#200)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const updateSpy = vi.spyOn(api, 'updateCard').mockResolvedValue({
      data: {
        card: { ...todoCards[0], assigneeId: 'bob' },
      },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 A 편집/ }));
    await screen.findByRole('heading', { name: '카드 편집' });
    await user.click(screen.getByRole('button', { name: /담당자 선택/ }));
    await user.click(screen.getByRole('option', { name: /bob/ }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('k1', { assigneeId: 'bob' });
    });
  });

  it('같은 컬럼 안에서 위/아래 버튼으로 reorder → moveCard 호출에 order 포함 (#214)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const moveSpy = vi.spyOn(api, 'moveCard').mockResolvedValue({
      data: { card: { ...todoCards[1], order: 500 } },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    // 카드 B 위로 이동 → A 와 B 사이 = 1500 이 아니라 A 앞 = 0... 실제로는 A 위로 이동
    await user.click(within(todoRegion).getByRole('button', { name: /카드 B 위로 이동/ }));
    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalled();
    });
    const [calledCardId, payload] = moveSpy.mock.calls[0];
    expect(calledCardId).toBe('k2');
    expect(payload.columnId).toBe('c-todo');
    // A 위로 이동 → A 의 order(1000) 보다 작음
    expect(payload.order).toBeLessThan(1000);
  });

  it('맨 위 카드의 "위로 이동" 버튼은 disabled (#214)', async () => {
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    const upBtn = within(todoRegion).getByRole('button', { name: /카드 A 위로 이동/ });
    expect(upBtn).toBeDisabled();
  });

  it('맨 아래 카드의 "아래로 이동" 버튼은 disabled (#214)', async () => {
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    const downBtn = within(todoRegion).getByRole('button', { name: /카드 C 아래로 이동/ });
    expect(downBtn).toBeDisabled();
  });

  it('SubHeader 의 "멤버 관리" 버튼 → MembersDialog 열림 (#203)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
          { userId: 'bob', role: 'MEMBER', name: null, joinedAt: '2026-05-02T00:00:00.000Z' },
        ],
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    expect(await screen.findByRole('heading', { name: '멤버 관리' })).toBeInTheDocument();
    expect(await screen.findByLabelText('초대할 userId')).toBeInTheDocument();
  });

  it('OWNER 가 새 userId 입력 후 초대 → POST /members 호출 (#203)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
        ],
      },
    });
    const inviteSpy = vi.spyOn(api, 'inviteMember').mockResolvedValue({
      data: { member: { userId: 'carol' } },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    await user.type(await screen.findByLabelText('초대할 userId'), 'carol');
    await user.click(screen.getByRole('button', { name: '초대' }));
    await waitFor(() => {
      expect(inviteSpy).toHaveBeenCalledWith('p1', { userId: 'carol' });
    });
  });

  it('MEMBER role 일 때 초대 입력 폼은 없고 본인 탈퇴 버튼만 보인다 (#203)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getProject').mockResolvedValue({
      data: { project: { ...PROJECT, role: 'MEMBER', currentUserId: 'bob' } },
    });
    vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: COLUMNS } });
    vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: {} } });
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
          { userId: 'bob', role: 'MEMBER', name: null, joinedAt: '2026-05-02T00:00:00.000Z' },
        ],
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    await screen.findByRole('heading', { name: '멤버 관리' });
    expect(screen.queryByLabelText('초대할 userId')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bob 탈퇴/ })).toBeInTheDocument();
    // alice (OWNER) 추방 버튼은 없음 — MEMBER 는 다른 사람 못 추방
    expect(screen.queryByRole('button', { name: /alice 추방/ })).not.toBeInTheDocument();
  });
});
