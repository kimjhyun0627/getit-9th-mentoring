import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { BookDetailPage, trimReview } from './BookDetailPage.jsx';

const sampleBook = {
  id: 'b_1',
  isbn: '9788932917245',
  title: '소년이 온다',
  author: '한강',
  publisher: '창비',
  coverUrl: '',
  description: '광주 1980 5월의 기록.',
};

const renderAt = (path) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/book/:isbn" element={<BookDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
};

describe('BookDetailPage (/book/:isbn) — #201', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getBook').mockResolvedValue({ data: { book: sampleBook } });
    vi.spyOn(api, 'getBookOwners').mockResolvedValue({ data: { count: 3 } });
    vi.spyOn(api, 'getRecommendations').mockResolvedValue({
      data: {
        items: [
          {
            isbn: '9788936433598',
            title: '채식주의자',
            author: '한강',
            publisher: '창비',
            coverUrl: '',
          },
        ],
      },
    });
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
    // #477 — BookDetailPage 는 myShelves 대신 contains 엔드포인트로 cross-reference.
    vi.spyOn(api, 'containsInShelf').mockResolvedValue({
      data: { isbn: '9788932917245', contains: false },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('책 정보 + owners count + 추천을 렌더한다', async () => {
    renderAt('/book/9788932917245');
    expect(await screen.findByRole('heading', { name: '소년이 온다' })).toBeInTheDocument();
    expect(screen.getByText('한강')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/같은 책을 담은 사람 3명/)).toBeInTheDocument());
    expect(await screen.findByText('채식주의자')).toBeInTheDocument();
  });

  it('isbn 은 대문자로 정규화되어 API 호출', async () => {
    renderAt('/book/012345678x');
    await screen.findByRole('heading', { name: '소년이 온다' });
    expect(api.getBook).toHaveBeenCalledWith('012345678X');
  });

  it('내 서재에 없으면 "내 서재에 담기" 버튼이 노출', async () => {
    renderAt('/book/9788932917245');
    expect(await screen.findByRole('button', { name: '내 서재에 담기' })).toBeInTheDocument();
  });

  it('내 서재에 이미 있으면 "서재에 담김" 라벨로 노출', async () => {
    vi.spyOn(api, 'containsInShelf').mockResolvedValue({
      data: {
        isbn: '9788932917245',
        contains: true,
        shelf: {
          id: 's1',
          bookId: 'b_1',
          status: 'READ',
          rating: 5,
          review: '한 줄 평',
          addedAt: '2026-05-01',
          book: sampleBook,
        },
      },
    });
    renderAt('/book/9788932917245');
    expect(await screen.findByLabelText('이미 서재에 담김')).toBeInTheDocument();
    expect(screen.getByText('한 줄 평')).toBeInTheDocument();
  });

  it('404 응답이면 친화적 에러 메시지를 노출', async () => {
    const err = new Error('not found');
    err.response = { status: 404 };
    vi.spyOn(api, 'getBook').mockRejectedValueOnce(err);
    renderAt('/book/9788932917245');
    expect(await screen.findByText('그 책은 이 서가에 없습니다.')).toBeInTheDocument();
  });

  /**
   * 공유 분기 회귀 가드 (CR #353):
   *  - navigator.share 존재 → 호출 + 클립보드 미터치
   *  - navigator.share 없음 → clipboard.writeText 호출
   *  - share AbortError → 에러 토스트 노출 X
   */
  it('share text 는 url 을 포함하지 않는다 (#476 iOS 중복 노출 방지)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    try {
      renderAt('/book/9788932917245');
      const btn = await screen.findByRole('button', { name: '이 책 공유' });
      await user.click(btn);
      const call = shareSpy.mock.calls[0]?.[0];
      expect(call.url).toMatch(/\/book\/9788932917245$/);
      expect(call.text).not.toContain('http');
      expect(call.text).toContain('스마트 서재 · GETIT');
    } finally {
      delete navigator.share;
    }
  });

  it('NotAllowedError 면 명시적 차단 메시지로 분기 (#476)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const err = new Error('blocked');
    err.name = 'NotAllowedError';
    const shareSpy = vi.fn().mockRejectedValue(err);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    try {
      renderAt('/book/9788932917245');
      const btn = await screen.findByRole('button', { name: '이 책 공유' });
      await user.click(btn);
      expect(await screen.findByText(/브라우저가 공유를 차단했습니다/)).toBeInTheDocument();
    } finally {
      delete navigator.share;
    }
  });

  it('navigator.share 가 있으면 share 가 호출되고 클립보드 fallback 은 미사용', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeSpy },
      configurable: true,
    });
    try {
      renderAt('/book/9788932917245');
      const btn = await screen.findByRole('button', { name: '이 책 공유' });
      await user.click(btn);
      expect(shareSpy).toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    } finally {
      delete navigator.share;
    }
  });

  it('navigator.share 가 없으면 clipboard.writeText 로 fallback', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    delete navigator.share;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeSpy },
      configurable: true,
    });
    renderAt('/book/9788932917245');
    const btn = await screen.findByRole('button', { name: '이 책 공유' });
    await user.click(btn);
    expect(writeSpy).toHaveBeenCalled();
  });

  it('share AbortError 면 에러 토스트 노출 X', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const err = new Error('aborted');
    err.name = 'AbortError';
    const shareSpy = vi.fn().mockRejectedValue(err);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    try {
      renderAt('/book/9788932917245');
      const btn = await screen.findByRole('button', { name: '이 책 공유' });
      await user.click(btn);
      // 에러 토스트가 노출되지 않아야 함
      expect(screen.queryByText(/공유에 실패했습니다/)).not.toBeInTheDocument();
    } finally {
      delete navigator.share;
    }
  });
});

describe('trimReview (#485)', () => {
  it('80자 이내는 원본 + 줄바꿈만 공백으로 정리', () => {
    expect(trimReview('한 줄 평\n다음 줄', 80)).toBe('한 줄 평 다음 줄');
  });
  it('80자 초과 시 ellipsis 부착', () => {
    const long = '가'.repeat(120);
    const out = trimReview(long, 80);
    expect(out).toHaveLength(81); // 80 + …
    expect(out.endsWith('…')).toBe(true);
  });
  it('빈/null 입력은 빈 문자열', () => {
    expect(trimReview(null)).toBe('');
    expect(trimReview('')).toBe('');
    expect(trimReview(undefined)).toBe('');
  });
});
