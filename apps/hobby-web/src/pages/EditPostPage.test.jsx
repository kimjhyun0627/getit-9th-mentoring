import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { computePatchDiff } from './EditPostPage.diff.js';
import { EditPostPage } from './EditPostPage.jsx';

/**
 * EditPostPage TDD 가드 — #431.
 *
 * - prefill: GET 응답으로 form 채워짐
 * - PATCH diff: 변경 필드만 body 포함
 * - 비방장 / CLOSED 분기
 * - 성공 시 PostDetail 로 redirect
 * - 422 CapacityBelowApplicants 안내
 */

const futureIso = (offsetHours = 24) =>
  new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();

const samplePost = (overrides = {}) => ({
  id: 'post-1',
  ownerId: 'alice',
  title: '북문 마라탕',
  body: '오늘 18시 라화방.',
  meetAt: futureIso(24),
  capacity: 4,
  currentCapacity: 1,
  status: 'RECRUITING',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  tags: [{ id: 't1', name: '마라탕' }],
  openChatUrl: 'https://open.kakao.com/o/abc123',
  ...overrides,
});

const renderPage = ({ meId = 'alice', postId = 'post-1' } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], { id: meId, email: `${meId}@x.com`, name: meId });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/posts/${postId}/edit`]}>
          <Routes>
            <Route path="/posts/:id/edit" element={<EditPostPage />} />
            <Route path="/posts/:id" element={<div data-testid="post-detail">상세</div>} />
            <Route path="/" element={<div data-testid="home">홈</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('computePatchDiff', () => {
  const initial = samplePost({
    title: 'old',
    body: 'old body',
    meetAt: '2026-12-01T00:00:00.000Z',
    capacity: 4,
    openChatUrl: 'https://open.kakao.com/o/abc',
    tags: [
      { id: 't1', name: 'a' },
      { id: 't2', name: 'b' },
    ],
  });

  it('변경 없음 → {} 반환', () => {
    const values = {
      title: 'old',
      body: 'old body',
      meetAtLocal: '', // 별도 케이스에서 검증
      capacity: 4,
      openChatUrl: 'https://open.kakao.com/o/abc',
      tags: ['a', 'b'],
    };
    // meetAt 비교를 위해 inital.meetAt 의 로컬 변환을 그대로 사용
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(initial.meetAt);
    values.meetAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diff = computePatchDiff(values, initial);
    expect(diff).toEqual({});
  });

  it('title 만 변경 → patch 에 title 만 포함', () => {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(initial.meetAt);
    const meetAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diff = computePatchDiff(
      {
        title: 'new title',
        body: 'old body',
        meetAtLocal,
        capacity: 4,
        openChatUrl: 'https://open.kakao.com/o/abc',
        tags: ['a', 'b'],
      },
      initial,
    );
    expect(diff).toEqual({ title: 'new title' });
    expect(diff.capacity).toBeUndefined();
    expect(diff.body).toBeUndefined();
  });

  it('tags 순서 다르면 변경으로 본다', () => {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(initial.meetAt);
    const meetAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diff = computePatchDiff(
      {
        title: 'old',
        body: 'old body',
        meetAtLocal,
        capacity: 4,
        openChatUrl: 'https://open.kakao.com/o/abc',
        tags: ['b', 'a'],
      },
      initial,
    );
    expect(diff).toEqual({ tags: ['b', 'a'] });
  });

  it('openChatUrl null vs "" 동일 취급', () => {
    const noOpenChat = samplePost({ openChatUrl: null });
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(noOpenChat.meetAt);
    const meetAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diff = computePatchDiff(
      {
        title: noOpenChat.title,
        body: noOpenChat.body,
        meetAtLocal,
        capacity: noOpenChat.capacity,
        openChatUrl: '',
        tags: noOpenChat.tags.map((t) => t.name),
      },
      noOpenChat,
    );
    expect(diff.openChatUrl).toBeUndefined();
  });

  it('initial 이 null 이면 {} 반환', () => {
    expect(computePatchDiff(/** @type {any} */ ({}), null)).toEqual({});
  });
});

describe('EditPostPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'alice', email: 'a@x.com', name: 'Alice' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET 응답으로 폼 prefill', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    renderPage();
    expect(await screen.findByDisplayValue('북문 마라탕')).toBeInTheDocument();
    expect(screen.getByDisplayValue('오늘 18시 라화방.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://open.kakao.com/o/abc123')).toBeInTheDocument();
  });

  it('비방장 → "방장만 수정할 수 있어"', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ ownerId: 'bob' }),
    });
    renderPage({ meId: 'alice' });
    expect(await screen.findByText(/방장만 수정할 수 있어/)).toBeInTheDocument();
  });

  it('CLOSED 모임 → "종료된 모임은 수정할 수 없어"', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ status: 'CLOSED' }),
    });
    renderPage();
    expect(await screen.findByText(/종료된 모임은 수정할 수 없어/)).toBeInTheDocument();
  });

  it('title 만 변경하고 submit → PATCH body 에 title 만 포함', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    const updateSpy = vi.spyOn(api, 'updatePost').mockResolvedValue({ post: samplePost() });
    renderPage();

    const titleInput = await screen.findByDisplayValue('북문 마라탕');
    await user.clear(titleInput);
    await user.type(titleInput, '북문 라화방 마라탕 모임');

    await user.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    const [postId, patch] = updateSpy.mock.calls[0];
    expect(postId).toBe('post-1');
    expect(patch).toEqual({ title: '북문 라화방 마라탕 모임' });
    // capacity / body / meetAt / openChatUrl / tags 미포함
    expect(patch.capacity).toBeUndefined();
    expect(patch.body).toBeUndefined();
    expect(patch.meetAt).toBeUndefined();
    expect(patch.openChatUrl).toBeUndefined();
    expect(patch.tags).toBeUndefined();
  });

  it('정원만 변경 → PATCH body 에 capacity 만', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    const updateSpy = vi.spyOn(api, 'updatePost').mockResolvedValue({ post: samplePost() });
    renderPage();

    const capacityInput = await screen.findByDisplayValue('4');
    await user.clear(capacityInput);
    await user.type(capacityInput, '6');

    await user.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    expect(updateSpy.mock.calls[0][1]).toEqual({ capacity: 6 });
  });

  it('변경 없이 submit → PATCH 호출 안 함 + redirect', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    const updateSpy = vi.spyOn(api, 'updatePost').mockResolvedValue({ post: samplePost() });
    renderPage();

    await screen.findByDisplayValue('북문 마라탕');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    expect(await screen.findByTestId('post-detail')).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('성공 시 /posts/:id 로 redirect', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    vi.spyOn(api, 'updatePost').mockResolvedValue({ post: samplePost() });
    renderPage();

    const titleInput = await screen.findByDisplayValue('북문 마라탕');
    await user.clear(titleInput);
    await user.type(titleInput, '새 제목');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    expect(await screen.findByTestId('post-detail')).toBeInTheDocument();
  });

  it('422 CapacityBelowApplicants → "이미 신청한 사람보다..."', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    vi.spyOn(api, 'updatePost').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'CapacityBelowApplicants' } },
    });
    renderPage();

    const capacityInput = await screen.findByDisplayValue('4');
    await user.clear(capacityInput);
    await user.type(capacityInput, '2');

    await user.click(screen.getByRole('button', { name: /저장/ }));

    expect(await screen.findByText(/이미 신청한 사람보다 정원을 낮출 수 없어/)).toBeInTheDocument();
  });

  it('429 → "잠시 후 다시 시도"', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    vi.spyOn(api, 'updatePost').mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 },
    });
    renderPage();

    const titleInput = await screen.findByDisplayValue('북문 마라탕');
    await user.clear(titleInput);
    await user.type(titleInput, '새 제목');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    expect(await screen.findByText(/잠시 후 다시 시도/)).toBeInTheDocument();
  });
});
