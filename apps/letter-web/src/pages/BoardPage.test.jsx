import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BoardPage } from './BoardPage.jsx';

/**
 * BoardPage TDD 가드 (#54 + #249 + #305).
 *
 * - 세션 게이트: getMe 성공 후에만 보드 마운트 (#305)
 * - 헤더/타이틀 + 쪽지 카운트
 * - 메시지 그리드 렌더 (포스트잇)
 * - is_mine=true → "내 메시지" + 편집/삭제 노출
 * - 빈 상태 placeholder
 * - 에러/로딩 분기
 * - 작성자 정보 (authorId/author 등) 절대 노출 X (보안 가드 — FE 회귀)
 * - 본인 메시지 삭제 mutation 호출 + 옵티미스틱 제거 (#249)
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

/** 모든 테스트 공통: 세션 인증 성공으로 mock — #305 게이트 통과. */
const mockAuthed = () => {
  vi.spyOn(api, 'getMe').mockResolvedValue({ user: { sub: 'me-sub' } });
};

describe('BoardPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthed();
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
            is_mine: false,
          },
        ],
      },
    });
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: /롤링페이퍼/ }),
    ).toBeInTheDocument();
    // 메시지 목록이 로드 완료될 때까지 대기 (카드 본문이 보이면 카운트도 갱신됨).
    expect(await screen.findByText('hi')).toBeInTheDocument();
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
            is_mine: true,
          },
          {
            id: 'other1',
            content: '익명 메시지 내용',
            color: 'MINT',
            createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
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
    vi.spyOn(api, 'listMessages').mockResolvedValue({
      data: {
        items: [
          {
            id: 'x1',
            content: '깨끗한 메시지',
            color: 'PINK',
            createdAt: new Date().toISOString(),
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

  it('로딩 중에는 status placeholder 가 보인다', async () => {
    vi.spyOn(api, 'listMessages').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole('status', { name: /불러오는/ })).toBeInTheDocument();
  });

  // #305 — 세션 미인증 게이트
  it('비인증 (getMe 401) 이면 보드 데이터 안 부르고 redirect placeholder 표시 (#305)', async () => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
    const listSpy = vi.spyOn(api, 'listMessages').mockResolvedValue({ data: { items: [] } });
    renderPage();
    expect(await screen.findByText(/로그인 페이지로 이동/)).toBeInTheDocument();
    // listMessages 는 호출되면 안 됨 — 게이트가 enabled:false 로 막아야 함.
    expect(listSpy).not.toHaveBeenCalled();
  });

  // CR #335 — getMe 가 401 외 에러(네트워크/500) 면 재시도 ErrorState 노출
  it('getMe 500 이면 재시도 ErrorState 노출 (401 redirect 와 분리)', async () => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 500 } });
    vi.spyOn(api, 'listMessages').mockResolvedValue({ data: { items: [] } });
    renderPage();
    expect(await screen.findByText(/쪽지를 불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
    // redirect placeholder 텍스트는 노출되면 안 됨.
    expect(screen.queryByText(/로그인 페이지로 이동/)).not.toBeInTheDocument();
  });

  // #249 — 본인 메시지 삭제 mutation 연결
  it('본인 메시지 삭제 클릭 시 deleteMessage 호출되고 카드가 사라진다 (#249)', async () => {
    const user = userEvent.setup();
    const mineMsg = {
      id: 'mine-del',
      content: '떼어낼 메시지',
      color: 'PINK',
      createdAt: new Date().toISOString(),
      is_mine: true,
    };
    // listMessages: 첫 호출은 메시지 1개, 삭제 후 onSettled 의 invalidate
    // refetch 에는 빈 배열 반환 (서버 진실 모사).
    const listSpy = vi
      .spyOn(api, 'listMessages')
      .mockResolvedValueOnce({ data: { items: [mineMsg] } })
      .mockResolvedValue({ data: { items: [] } });
    const delSpy = vi.spyOn(api, 'deleteMessage').mockResolvedValue({ status: 204 });
    renderPage();
    expect(await screen.findByText('떼어낼 메시지')).toBeInTheDocument();

    // 휴지통 버튼 클릭
    const trash = screen.getByRole('button', { name: /이 쪽지 삭제/ });
    await user.click(trash);

    // confirm 다이얼로그 → "떼어내기" 클릭
    const confirm = await screen.findByRole('button', { name: /떼어내기/ });
    await user.click(confirm);

    expect(delSpy).toHaveBeenCalledWith('mine-del');
    // 옵티미스틱 + onSettled invalidate (refetch → 빈 배열) — 카드 최종적으로 사라짐.
    await waitFor(() => {
      expect(screen.queryByText('떼어낼 메시지')).not.toBeInTheDocument();
    });
    // listMessages 가 최소 2회 호출됨 (초기 + onSettled invalidate refetch).
    expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
