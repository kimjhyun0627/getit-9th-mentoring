import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { ApplicantsPage } from './ApplicantsPage.jsx';

/**
 * ApplicantsPage TDD 가드 — #430.
 *
 * 시나리오:
 *  - 로딩/SSO redirect 안내
 *  - 403 / 404 / 500 분기
 *  - 신청자 체크박스 선택 + 일괄 신고 → mutation payload 검증
 *  - 422 PostNotEnded 시 안내
 *  - success 시 selected 초기화 + 쿼리 invalidate
 */

const renderPage = ({ loggedIn = true, postId = 'post-1' } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (loggedIn) {
    queryClient.setQueryData(['me'], { id: 'owner-1', email: 'o@x.com', name: 'Owner' });
  }
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/posts/${postId}/applicants`]}>
          <Routes>
            <Route path="/posts/:id/applicants" element={<ApplicantsPage />} />
            <Route path="/posts/:id" element={<div data-testid="post-detail">상세</div>} />
            <Route path="/" element={<div data-testid="home">홈</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
};

const sampleApplicants = [
  {
    id: 'app-1',
    userId: 'alice',
    createdAt: '2026-05-01T03:00:00.000Z',
    noShow: false,
    noShowCount: 0,
  },
  {
    id: 'app-2',
    userId: 'bob',
    createdAt: '2026-05-02T03:00:00.000Z',
    noShow: false,
    noShowCount: 1,
  },
  {
    id: 'app-3',
    userId: 'carol',
    createdAt: '2026-05-03T03:00:00.000Z',
    noShow: true,
    noShowCount: 2,
  },
];

describe('ApplicantsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // me 캐시는 setQueryData 로 직접 주입하지만, 401 분기 테스트는 mock 으로 reject.
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'owner-1', email: 'o@x.com', name: 'Owner' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로딩 중 안내 노출', () => {
    vi.spyOn(api, 'listApplicants').mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/신청자 가져오는 중/)).toBeInTheDocument();
  });

  it('401 미인증 → "로그인 페이지로 이동 중…" 안내 (#430)', async () => {
    // me 조회를 401 reject 로 override. useRequireAuth 가 is401 분기 → SSO redirect 메시지.
    vi.spyOn(api, 'getMe').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });
    // window.location.href 할당이 jsdom 에서 실제 navigation 시도하지 않게 stub.
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, href: 'http://localhost/posts/post-1/applicants' };
    try {
      renderPage({ loggedIn: false });
      expect(await screen.findByText(/로그인 페이지로 이동 중/)).toBeInTheDocument();
    } finally {
      window.location = originalLocation;
    }
  });

  it('403 → "방장만 볼 수 있어"', async () => {
    vi.spyOn(api, 'listApplicants').mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { error: 'Forbidden' } },
    });
    renderPage();
    expect(await screen.findByText(/방장만 볼 수 있어/)).toBeInTheDocument();
  });

  it('404 → "모임을 찾지 못했어"', async () => {
    vi.spyOn(api, 'listApplicants').mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: 'PostNotFound' } },
    });
    renderPage();
    expect(await screen.findByText(/모임을 찾지 못했어/)).toBeInTheDocument();
  });

  it('500/네트워크 → 빈 목록 아닌 에러 안내 (#348)', async () => {
    vi.spyOn(api, 'listApplicants').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    renderPage();
    expect(await screen.findByText(/신청자 정보를 불러오지 못했어/)).toBeInTheDocument();
  });

  it('신청자 0명 → "아직 신청한 사람이 없어"', async () => {
    vi.spyOn(api, 'listApplicants').mockResolvedValue({ items: [], total: 0 });
    renderPage();
    expect(await screen.findByText(/아직 신청한 사람이 없어/)).toBeInTheDocument();
  });

  it('체크박스 선택 + 일괄 신고 → mutation 호출 시 선택한 userIds 만 payload', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listApplicants').mockResolvedValue({
      items: sampleApplicants,
      total: sampleApplicants.length,
    });
    const reportSpy = vi.spyOn(api, 'reportNoShows').mockResolvedValue({ ok: true });
    renderPage();

    // alice + bob 만 체크. carol 은 이미 noShow → 비활성.
    const alice = await screen.findByLabelText('alice 선택');
    const bob = screen.getByLabelText('bob 선택');
    const carol = screen.getByLabelText('carol 선택');
    expect(carol).toBeDisabled();
    await user.click(alice);
    await user.click(bob);

    // 신고 버튼 라벨에 (2명)
    const reportBtn = screen.getByRole('button', { name: /노쇼 신고 \(2명\)/ });
    await user.click(reportBtn);

    // ConfirmDialog 의 신고하기 클릭
    const confirmBtn = await screen.findByRole('button', { name: '신고하기' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(reportSpy).toHaveBeenCalledTimes(1);
    });
    const [postId, userIds] = reportSpy.mock.calls[0];
    expect(postId).toBe('post-1');
    expect([...userIds].sort()).toEqual(['alice', 'bob']);
  });

  it('아무도 선택 안 한 상태에선 신고 버튼 disabled', async () => {
    vi.spyOn(api, 'listApplicants').mockResolvedValue({
      items: sampleApplicants,
      total: 3,
    });
    renderPage();
    const btn = await screen.findByRole('button', { name: /노쇼 신고 \(0명\)/ });
    expect(btn).toBeDisabled();
  });

  it('422 PostNotEnded → "모임이 끝난 뒤에 신고할 수 있어"', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listApplicants').mockResolvedValue({
      items: sampleApplicants,
      total: 3,
    });
    vi.spyOn(api, 'reportNoShows').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'PostNotEnded' } },
    });
    renderPage();

    await user.click(await screen.findByLabelText('alice 선택'));
    await user.click(screen.getByRole('button', { name: /노쇼 신고 \(1명\)/ }));
    await user.click(await screen.findByRole('button', { name: '신고하기' }));

    expect(await screen.findByText(/모임이 끝난 뒤에 신고할 수 있어/)).toBeInTheDocument();
  });

  it('429 → "잠시 후 다시 시도해줘"', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listApplicants').mockResolvedValue({
      items: sampleApplicants,
      total: 3,
    });
    vi.spyOn(api, 'reportNoShows').mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 },
    });
    renderPage();

    await user.click(await screen.findByLabelText('alice 선택'));
    await user.click(screen.getByRole('button', { name: /노쇼 신고 \(1명\)/ }));
    await user.click(await screen.findByRole('button', { name: '신고하기' }));

    expect(await screen.findByText(/잠시 후 다시 시도/)).toBeInTheDocument();
  });

  it('success 시 selected 초기화 + applicants 쿼리 invalidate', async () => {
    const user = userEvent.setup();
    let call = 0;
    vi.spyOn(api, 'listApplicants').mockImplementation(async () => {
      call += 1;
      return { items: sampleApplicants, total: 3 };
    });
    vi.spyOn(api, 'reportNoShows').mockResolvedValue({ ok: true });
    renderPage();

    await user.click(await screen.findByLabelText('alice 선택'));
    await user.click(screen.getByRole('button', { name: /노쇼 신고 \(1명\)/ }));
    await user.click(await screen.findByRole('button', { name: '신고하기' }));

    // selected 초기화 → 버튼 라벨이 (0명) 으로 돌아옴
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /노쇼 신고 \(0명\)/ })).toBeInTheDocument();
    });
    // refetch 가 일어남 (invalidate)
    await waitFor(() => {
      expect(call).toBeGreaterThanOrEqual(2);
    });
  });

  it('신고 취소 (cancel) 시 mutation 호출 안 됨', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listApplicants').mockResolvedValue({
      items: sampleApplicants,
      total: 3,
    });
    const reportSpy = vi.spyOn(api, 'reportNoShows').mockResolvedValue({ ok: true });
    renderPage();

    await user.click(await screen.findByLabelText('alice 선택'));
    await user.click(screen.getByRole('button', { name: /노쇼 신고 \(1명\)/ }));
    await user.click(await screen.findByRole('button', { name: '취소' }));

    // 다이얼로그가 닫혔는지
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(reportSpy).not.toHaveBeenCalled();
  });
});
