/**
 * PostDetailPage 테스트용 공용 헬퍼 — samplePost / renderAt.
 *
 * 분리 이유: 본체 테스트 파일이 300줄 cap 을 넘지 않도록 + 신규 #541 테스트 파일도
 * 같은 setup 을 재사용하도록 (CR review #549).
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PostDetailPage } from './PostDetailPage.jsx';

/**
 * 표본 게시글 객체 — 필요한 필드만 override.
 *
 * @param {object} [over]
 * @returns {object}
 */
export const samplePost = (over = {}) => ({
  id: over.id ?? 'p1',
  ownerId: over.ownerId ?? 'u-owner',
  title: over.title ?? '북문 마라탕 같이 갈 사람!',
  body: over.body ?? '오늘 18시 라화방. 매운맛 가능한 사람 환영.',
  meetAt: over.meetAt ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
  capacity: over.capacity ?? 4,
  currentCapacity: over.currentCapacity ?? 2,
  status: over.status ?? 'RECRUITING',
  createdAt: '2026-05-19T08:00:00+09:00',
  updatedAt: '2026-05-19T08:00:00+09:00',
  tags: over.tags ?? [{ id: 't1', name: '마라탕' }],
  applicationPolicy: over.applicationPolicy ?? 'FIRST_COME',
  ...(over.openChatUrl !== undefined ? { openChatUrl: over.openChatUrl } : {}),
  ...(over.myApplication !== undefined ? { myApplication: over.myApplication } : {}),
});

/**
 * PostDetailPage 를 MemoryRouter + QueryClient + ThemeProvider 로 감싸 렌더한다.
 *
 * @param {string} [postId]
 * @returns {ReturnType<typeof render>}
 */
export const renderAt = (postId = 'p1') => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/posts/${postId}`]}>
          <Routes>
            <Route path="/posts/:id" element={<PostDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};
