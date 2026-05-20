import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { CreatePostPage } from './CreatePostPage.jsx';

/**
 * CreatePostPage TDD 가드 (Issue #38).
 * 검증 에러 표시 + submit + 성공 redirect + 서버 에러 매핑.
 */

const renderPage = (initialEntry = '/new') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/new" element={<CreatePostPage />} />
            <Route path="/posts/:id" element={<div data-testid="post-detail">상세</div>} />
            <Route path="/login" element={<div data-testid="login-page">로그인</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

/** datetime-local input 형식 (YYYY-MM-DDTHH:mm) — 6시간 뒤. */
const futureLocal = () => {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

describe('CreatePostPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('필수 필드와 submit 버튼을 렌더한다', () => {
    renderPage();
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
    expect(screen.getByLabelText('본문')).toBeInTheDocument();
    expect(screen.getByLabelText('모임 일시')).toBeInTheDocument();
    expect(screen.getByLabelText('장소')).toBeInTheDocument();
    expect(screen.getByLabelText('정원')).toBeInTheDocument();
    expect(screen.getByLabelText(/오픈채팅/)).toBeInTheDocument();
    expect(screen.getByLabelText('태그')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /모임 만들기/ })).toBeInTheDocument();
  });

  it('빈 입력으로 submit 시 검증 에러를 보여준다', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));
    expect(await screen.findByText(/제목은 2자 이상/)).toBeInTheDocument();
    expect(await screen.findByText(/본문을 입력하세요/)).toBeInTheDocument();
    expect(await screen.findByText(/장소를 입력하세요/)).toBeInTheDocument();
  });

  it('카카오 오픈채팅이 아닌 URL이면 에러를 보여준다', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/오픈채팅/), 'https://example.com/abc');
    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));
    expect(await screen.findByText(/카카오 오픈채팅 URL.*만 허용/)).toBeInTheDocument();
  });

  it('과거 시각이면 에러를 보여준다', async () => {
    const user = userEvent.setup();
    renderPage();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const localPast = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T${pad(past.getHours())}:${pad(past.getMinutes())}`;
    await user.type(screen.getByLabelText('모임 일시'), localPast);
    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));
    expect(await screen.findByText(/과거 시각은 입력할 수 없습니다/)).toBeInTheDocument();
  });

  it('정상 입력 시 api.createPost 를 ISO 시각 + 정수 capacity 로 호출한다', async () => {
    const user = userEvent.setup();
    const createSpy = vi
      .spyOn(api, 'createPost')
      .mockResolvedValue({ data: { post: { id: 'abc123' } } });
    renderPage();

    await user.type(screen.getByLabelText('제목'), '북문 마라탕 같이 갈 사람');
    await user.type(screen.getByLabelText('본문'), '오늘 18시 북문 라화방에서 보자.');
    await user.type(screen.getByLabelText('모임 일시'), futureLocal());
    await user.type(screen.getByLabelText('장소'), '북문 라화방');
    await user.clear(screen.getByLabelText('정원'));
    await user.type(screen.getByLabelText('정원'), '4');
    await user.type(screen.getByLabelText(/오픈채팅/), 'https://open.kakao.com/o/abc123');
    // 태그 입력
    const tagInput = screen.getByLabelText('태그');
    await user.type(tagInput, '마라탕');
    await user.keyboard('{Enter}');
    await user.type(tagInput, '북문');
    await user.keyboard('{Enter}');

    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
    const arg = createSpy.mock.calls[0][0];
    expect(arg.title).toBe('북문 마라탕 같이 갈 사람');
    expect(arg.capacity).toBe(4);
    expect(arg.tags).toEqual(['마라탕', '북문']);
    expect(arg.openChatUrl).toBe('https://open.kakao.com/o/abc123');
    expect(arg.body).toContain('라화방');
    expect(arg.body).toContain('북문 라화방');
    // ISO 8601 with offset
    expect(arg.meetAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})$/,
    );
    expect(new Date(arg.meetAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('성공 시 /posts/:id 로 이동한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createPost').mockResolvedValue({
      data: { post: { id: 'new-post-id' } },
    });
    renderPage();

    await user.type(screen.getByLabelText('제목'), '테스트 모임');
    await user.type(screen.getByLabelText('본문'), '본문 내용입니다.');
    await user.type(screen.getByLabelText('모임 일시'), futureLocal());
    await user.type(screen.getByLabelText('장소'), '북문');
    await user.clear(screen.getByLabelText('정원'));
    await user.type(screen.getByLabelText('정원'), '3');
    await user.type(screen.getByLabelText(/오픈채팅/), 'https://open.kakao.com/o/xyz');

    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));

    expect(await screen.findByTestId('post-detail')).toBeInTheDocument();
  });

  it('401 응답이면 친절한 에러 메시지를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createPost').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: 'Unauthorized' } },
    });
    renderPage();

    await user.type(screen.getByLabelText('제목'), '테스트 모임');
    await user.type(screen.getByLabelText('본문'), '본문 내용입니다.');
    await user.type(screen.getByLabelText('모임 일시'), futureLocal());
    await user.type(screen.getByLabelText('장소'), '북문');
    await user.clear(screen.getByLabelText('정원'));
    await user.type(screen.getByLabelText('정원'), '3');
    await user.type(screen.getByLabelText(/오픈채팅/), 'https://open.kakao.com/o/xyz');

    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));

    expect(await screen.findByText(/로그인이 필요|로그인이 만료/)).toBeInTheDocument();
  });

  it('429 응답이면 잠시 후 재시도 안내를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createPost').mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 },
    });
    renderPage();

    await user.type(screen.getByLabelText('제목'), '테스트 모임');
    await user.type(screen.getByLabelText('본문'), '본문 내용입니다.');
    await user.type(screen.getByLabelText('모임 일시'), futureLocal());
    await user.type(screen.getByLabelText('장소'), '북문');
    await user.clear(screen.getByLabelText('정원'));
    await user.type(screen.getByLabelText('정원'), '3');
    await user.type(screen.getByLabelText(/오픈채팅/), 'https://open.kakao.com/o/xyz');

    await user.click(screen.getByRole('button', { name: /모임 만들기/ }));

    expect(await screen.findByText(/잠시 후 다시 시도/)).toBeInTheDocument();
  });
});
