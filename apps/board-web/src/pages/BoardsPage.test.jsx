import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BoardsPage } from './BoardsPage.jsx';

/**
 * BoardsPage TDD 가드 (Issue #49).
 * - 빈 상태 placeholder
 * - 프로젝트 카드 렌더 (이름/멤버 아바타/+ New CTA)
 * - 새 프로젝트 생성 → 보드 뷰로 이동
 * - 에러/로딩 상태
 */

const renderPage = (initialEntry = '/boards') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/boards/:id" element={<div data-testid="board-view">board view</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('BoardsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom 은 <dialog> 의 showModal/close 메소드를 구현하지 않음 → 폴리필
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

  it('헤더와 "+ New Project" CTA, 페이지 타이틀을 렌더한다', async () => {
    vi.spyOn(api, 'listProjects').mockResolvedValue({ data: { projects: [] } });
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: '내 보드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
  });

  it('프로젝트 0개면 빈 상태 placeholder + CTA를 보여준다', async () => {
    vi.spyOn(api, 'listProjects').mockResolvedValue({ data: { projects: [] } });
    renderPage();
    expect(await screen.findByText('아직 프로젝트가 없어요')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /새 프로젝트|New Project/ }).length,
    ).toBeGreaterThan(0);
  });

  it('프로젝트 목록을 카드로 렌더한다 (이름 + 설명 + 멤버 아바타)', async () => {
    vi.spyOn(api, 'listProjects').mockResolvedValue({
      data: {
        projects: [
          {
            id: 'p1',
            ownerId: 'u1',
            name: 'GETIT 9기 멘토링',
            description: '네 개 프로덕트의 공통 인증 흐름과 디자인 시스템',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-19T00:00:00.000Z',
            role: 'OWNER',
            members: [
              { userId: 'u1', name: '김진현' },
              { userId: 'u2', name: '박서연' },
            ],
          },
          {
            id: 'p2',
            ownerId: 'u9',
            name: '스마트 서재',
            description: null,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z',
            role: 'MEMBER',
            members: [{ userId: 'u9', name: '최민준' }],
          },
        ],
      },
    });
    renderPage();
    expect(await screen.findByText('GETIT 9기 멘토링')).toBeInTheDocument();
    expect(screen.getByText('스마트 서재')).toBeInTheDocument();
    expect(screen.getByText(/공통 인증 흐름/)).toBeInTheDocument();
    // 첫 카드의 멤버 그룹에 아바타 2개
    const list = screen.getByRole('list', { name: '프로젝트 목록' });
    const firstCard = within(list).getAllByRole('link')[0];
    expect(within(firstCard).getByLabelText('멤버 2명')).toBeInTheDocument();
  });

  it('카드를 누르면 /boards/:id 로 이동한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listProjects').mockResolvedValue({
      data: {
        projects: [
          {
            id: 'p1',
            ownerId: 'u1',
            name: 'GETIT 9기',
            description: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-19T00:00:00.000Z',
            role: 'OWNER',
            members: [],
          },
        ],
      },
    });
    renderPage();
    const link = await screen.findByRole('link', { name: /GETIT 9기 보드 열기/ });
    await user.click(link);
    expect(await screen.findByTestId('board-view')).toBeInTheDocument();
  });

  it('"+ New Project" 클릭 → 다이얼로그 열림 → 생성 성공 시 /boards/:id 이동', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listProjects').mockResolvedValue({ data: { projects: [] } });
    const createSpy = vi.spyOn(api, 'createProject').mockResolvedValue({
      data: {
        project: {
          id: 'new1',
          ownerId: 'u1',
          name: 'Fresh Project',
          description: null,
          createdAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      },
    });

    renderPage();
    await screen.findByText('아직 프로젝트가 없어요');

    // header 의 + New Project (CTA가 두 개라 첫 번째 선택)
    const ctas = screen.getAllByRole('button', { name: /New Project|새 프로젝트/ });
    await user.click(ctas[0]);

    expect(await screen.findByRole('heading', { name: '새 프로젝트 만들기' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('프로젝트 이름'), 'Fresh Project');
    await user.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ name: 'Fresh Project' });
    });
    expect(await screen.findByTestId('board-view')).toBeInTheDocument();
  });

  it('이름이 비어있으면 검증 에러를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listProjects').mockResolvedValue({ data: { projects: [] } });
    const createSpy = vi.spyOn(api, 'createProject');

    renderPage();
    await screen.findByText('아직 프로젝트가 없어요');
    const ctas = screen.getAllByRole('button', { name: /New Project|새 프로젝트/ });
    await user.click(ctas[0]);

    await user.click(screen.getByRole('button', { name: '만들기' }));
    expect(await screen.findByText(/프로젝트 이름이 필요합니다/)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('생성 시 500 응답이면 사용자 친화 에러를 보여주고 다이얼로그를 닫지 않는다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listProjects').mockResolvedValue({ data: { projects: [] } });
    vi.spyOn(api, 'createProject').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { error: 'InternalServerError' } },
    });

    renderPage();
    await screen.findByText('아직 프로젝트가 없어요');
    const ctas = screen.getAllByRole('button', { name: /New Project|새 프로젝트/ });
    await user.click(ctas[0]);
    await user.type(screen.getByLabelText('프로젝트 이름'), 'Bad Project');
    await user.click(screen.getByRole('button', { name: '만들기' }));

    expect(await screen.findByText(/서버 오류가 발생했어/)).toBeInTheDocument();
    // 다이얼로그는 여전히 열려있어야 함
    expect(screen.getByRole('heading', { name: '새 프로젝트 만들기' })).toBeInTheDocument();
  });

  it('목록 로드 실패 시 에러 상태 + 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(api, 'listProjects').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    renderPage();
    expect(await screen.findByText('프로젝트를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
