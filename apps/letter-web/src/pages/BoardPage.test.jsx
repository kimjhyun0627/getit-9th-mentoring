import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BoardPage } from './BoardPage.jsx';

/**
 * BoardPage TDD 가드 (#54).
 *
 * - 헤더/타이틀 + 쪽지 카운트
 * - 메시지 그리드 렌더 (포스트잇)
 * - is_mine=true → "내 메시지" + 편집/삭제 노출
 * - 빈 상태 placeholder
 * - 에러/로딩 분기
 * - 작성자 정보 (authorId/author 등) 절대 노출 X (보안 가드 — FE 회귀)
 */

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/board']}>
          <BoardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('BoardPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('헤더 타이틀과 부제, 쪽지 개수 카운트를 렌더한다', async () => {
    vi.spyOn(api, 'listMessages').mockResolvedValue({
      data: {
        items: [
          {
            id: 'a',
            content: 'hi',
            color: 'PINK',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            is_mine: false,
          },
        ],
      },
    });
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: /롤링페이퍼/ }),
    ).toBeInTheDocument();
    // 카운트는 `총 <span>1</span>장의 쪽지가 붙어있어요` 처럼 노드가 쪼개져 있어
    // 부모 div 의 정규화된 textContent 전체로 검증
    // (CR Round 3: `'1'` 단독 매칭은 시간 표기 등과 오탐 가능 → 카운트 문구 전체로 정밀화).
    await screen.findByRole('heading', { level: 1, name: /롤링페이퍼/ });
    const countWrap = screen
      .getAllByText(/장의 쪽지가 붙어있어요/)
      .map((el) => el.closest('div'))
      .find((el) => /총\s*1\s*장의 쪽지가 붙어있어요/.test(el?.textContent ?? ''));
    expect(countWrap).toBeTruthy();
  });

  it('메시지 0개면 빈 상태 placeholder + CTA 가 보인다', async () => {
    vi.spyOn(api, 'listMessages').mockResolvedValue({ data: { items: [] } });
    renderPage();
    expect(await screen.findByText(/아직 쪽지가 없어요/)).toBeInTheDocument();
    // FAB ("메시지 남기기") 는 항상 노출 (작성 진입점).
    expect(screen.getByRole('button', { name: /메시지 남기기/ })).toBeInTheDocument();
  });

  it('메시지 목록을 포스트잇 article 로 렌더한다 (is_mine 분기)', async () => {
    vi.spyOn(api, 'listMessages').mockResolvedValue({
      data: {
        items: [
          {
            id: 'mine1',
            content: '내 메시지 내용',
            color: 'LEMON',
            createdAt: new Date(Date.now() - 60_000).toISOString(),
            updatedAt: new Date(Date.now() - 60_000).toISOString(),
            is_mine: true,
          },
          {
            id: 'other1',
            content: '익명 메시지 내용',
            color: 'MINT',
            createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
            is_mine: false,
          },
        ],
      },
    });
    renderPage();
    expect(await screen.findByText('내 메시지 내용')).toBeInTheDocument();
    expect(screen.getByText('익명 메시지 내용')).toBeInTheDocument();

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);

    const mine = articles.find((a) => a.getAttribute('aria-label') === '내 메시지');
    expect(mine).toBeDefined();
    expect(within(/** @type {HTMLElement} */ (mine)).getByText('내 메시지')).toBeInTheDocument();
    expect(
      within(/** @type {HTMLElement} */ (mine)).getByRole('button', { name: /편집/ }),
    ).toBeInTheDocument();
    // CR Round 3: 삭제 버튼 회귀 가드 (편집만 검증하면 삭제 사라져도 통과).
    expect(
      within(/** @type {HTMLElement} */ (mine)).getByRole('button', { name: /삭제/ }),
    ).toBeInTheDocument();

    const other = articles.find((a) => a.getAttribute('aria-label') !== '내 메시지');
    expect(other).toBeDefined();
    expect(
      within(/** @type {HTMLElement} */ (other)).queryByText('내 메시지'),
    ).not.toBeInTheDocument();
  });

  it('익명 메시지 영역에 author/authorId 같은 작성자 정보가 절대 노출되지 않는다', async () => {
    // 보안 회귀 가드: 백엔드가 실수로 authorId 를 흘려도, FE 가 노출하면 안 됨.
    // (Postit 컴포넌트가 message.author* 를 읽지 않으므로 본문에 나타날 수 없음을 확인.)
    vi.spyOn(api, 'listMessages').mockResolvedValue({
      data: {
        items: [
          {
            id: 'x1',
            content: '깨끗한 메시지',
            color: 'PINK',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            is_mine: false,
            // 가상의 흘러나온 필드 — FE 가 무시해야 함
            authorId: 'user-leak-id',
            author: { id: 'user-leak-id', name: '진짜이름' },
          },
        ],
      },
    });
    renderPage();
    expect(await screen.findByText('깨끗한 메시지')).toBeInTheDocument();
    expect(screen.queryByText(/user-leak-id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/진짜이름/)).not.toBeInTheDocument();
  });

  it('목록 로드 실패 시 에러 상태 + 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(api, 'listMessages').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    renderPage();
    expect(await screen.findByText(/쪽지를 불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
  });

  it('로딩 중에는 status placeholder 가 보인다', () => {
    vi.spyOn(api, 'listMessages').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /불러오는/ })).toBeInTheDocument();
  });
});
