import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { api } from '../lib/api.js';

import { BoardViewPage } from './BoardViewPage.jsx';

/**
 * BoardViewPage P1 테스트 공용 fixtures + helper.
 *
 * 파일당 300줄 가이드 준수를 위해 fixtures/유틸을 별도 파일로 분리 (CR #403).
 */

export const PROJECT = {
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

export const COLUMNS = [
  { id: 'c-todo', projectId: 'p1', name: 'Todo', order: 1000 },
  { id: 'c-doing', projectId: 'p1', name: 'Doing', order: 2000 },
  { id: 'c-done', projectId: 'p1', name: 'Done', order: 3000 },
];

export const todoCards = [
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

export const cardsByCol = {
  'c-todo': todoCards,
  'c-doing': [],
  'c-done': [],
};

export const stubHappyPath = () => {
  vi.spyOn(api, 'getProject').mockResolvedValue({ data: { project: PROJECT } });
  vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: COLUMNS } });
  // #258: batch endpoint 로 전환.
  vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: cardsByCol } });
};

export const installDialogPolyfill = () => {
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
};

export const renderPage = (initialEntry = '/boards/p1') => {
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
