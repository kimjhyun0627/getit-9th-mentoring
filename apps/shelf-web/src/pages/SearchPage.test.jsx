import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { renderSearch, searchPage } from './SearchPage.testkit.jsx';

/**
 * SearchPage TDD 가드 (Issue #43).
 *
 * Acceptance:
 *  - debounce 300ms (입력 → 300ms 후 검색)
 *  - 추가 후 토스트 + 캐시 invalidate
 *  - 빈 결과 placeholder
 *
 * #217 / #236 시나리오는 별도 spec 파일 (`SearchPage.cross-reference.test.jsx`).
 */

describe('SearchPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // SearchPage 는 #217 cross-reference 위해 useMyShelves 도 호출 — 테스트별로 따로 mock 하지 않으면
    // jsdom 이 실제 네트워크 시도 → noise. 기본은 빈 서가.
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 100, total: 0 } },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('검색 입력과 헤딩을 렌더한다', () => {
    renderSearch();
    expect(screen.getByRole('searchbox', { name: /책 검색/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /책을 찾아보세요/ })).toBeInTheDocument();
  });

  it('초기 상태에서는 검색 API 를 호출하지 않는다', () => {
    const spy = vi.spyOn(api, 'searchBooks').mockResolvedValue(searchPage([]));
    renderSearch();
    expect(spy).not.toHaveBeenCalled();
  });

  it('타이핑 직후엔 검색 API 가 호출되지 않고, 300ms 후엔 호출된다 (debounce)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'searchBooks').mockResolvedValue(searchPage([]));

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    // 타이핑 직후엔 debounce 안 풀려 → 호출 X
    expect(spy).not.toHaveBeenCalled();

    // 300ms+ 지나면 호출 됨 — #527 부터 page/size 옵션도 함께 전달.
    await waitFor(
      () => {
        expect(spy).toHaveBeenCalledWith('데미안', expect.objectContaining({ page: 1, size: 30 }));
      },
      { timeout: 1500 },
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('빈 검색 결과면 placeholder 를 노출한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(searchPage([]));

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '없는책');

    expect(
      await screen.findByText(/이 서가에는 그 책이 없습니다/, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('결과 카드의 "서재에 추가" 버튼 클릭 시 addToShelf 가 호출된다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage([
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ]),
    );
    const addSpy = vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');

    const addButton = await screen.findByRole('button', { name: /데미안 서재에 추가/ });
    await user.click(addButton);

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ bookId: 'book-1' }));
    });
  });

  it('서재 추가 성공 시 토스트가 노출된다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage([
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ]),
    );
    vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/서재에 담았습니다/);
  });

  it('서재 추가 성공 시 /shelves/me 캐시를 무효화한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage([
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ]),
    );
    vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    const { queryClient } = renderSearch();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['shelves', 'me'] });
    });
  });

  it('루트 section 이 max-w-7xl + mx-auto 컨테이너로 감싸져 있다 (다크 모드 회귀 가드)', () => {
    // Issue #90: 다크 모드에서 max-w 가 사라지고 본문이 viewport 왼쪽에 붙는 회귀를 막는다.
    const { container } = renderSearch();
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.className).toMatch(/max-w-7xl/);
    expect(section?.className).toMatch(/mx-auto/);
    // 좌우 padding 도 함께 — 모바일/데스크탑 둘 다.
    expect(section?.className).toMatch(/px-6/);
  });

  it('헤딩이 토큰 기반 색(text-ink-strong)을 사용한다 (다크 모드 대비 가드)', () => {
    // 정의되지 않은 text-ink 클래스로 다크 모드에서 헤딩이 깨졌던 회귀 방지.
    renderSearch();
    const heading = screen.getByRole('heading', { name: /책을 찾아보세요/ });
    expect(heading.className).toMatch(/text-ink-strong/);
  });

  it('검색 페이지에서 status 기본값은 WANT (#298 회귀 가드)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage([
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ]),
    );
    const addSpy = vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'WANT' }));
    });
  });

  it('검색 카드에서 status 를 READ 로 선택 후 추가하면 READ 가 전달된다 (#298)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage([
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ]),
    );
    const addSpy = vi.spyOn(api, 'addToShelf').mockResolvedValue({ data: { shelf: {} } });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    // 카드가 렌더링될 때까지 대기.
    await screen.findByRole('button', { name: /데미안 서재에 추가/ });
    // 카드 내부 라디오에서 "읽은 책" 선택.
    const readRadio = screen.getByRole('radio', { name: '읽은 책' });
    await user.click(readRadio);
    await user.click(screen.getByRole('button', { name: /데미안 서재에 추가/ }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'READ' }));
    });
  });

  it('target 토글 → searchBooks 가 target opt 와 함께 호출된다 (#202)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'searchBooks').mockResolvedValue(searchPage([]));
    renderSearch();
    await user.click(screen.getByRole('radio', { name: '저자' }));
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '한강');
    await waitFor(
      () => {
        expect(spy).toHaveBeenCalledWith(
          '한강',
          expect.objectContaining({ target: 'person', page: 1, size: 30 }),
        );
      },
      { timeout: 1500 },
    );
  });

  it('검색어 입력은 100자 초과 시 잘려서 입력된다 (#232)', async () => {
    const user = userEvent.setup();
    // debounce 이후 실제 호출 발생을 막아 테스트 안정화 (CR #346).
    vi.spyOn(api, 'searchBooks').mockResolvedValue(searchPage([]));
    renderSearch();
    const input = /** @type {HTMLInputElement} */ (
      screen.getByRole('searchbox', { name: /책 검색/ })
    );
    const long = 'ㄱ'.repeat(150);
    await user.type(input, long);
    expect(input.value.length).toBe(100);
  });

  // 무한 스크롤(#525) 가드는 `SearchPage.infinite-scroll.test.jsx` 로 분리 — 본 파일
  // 300 줄 상한 + 책임 분리.

  it('서재 추가 실패(422 이미 존재) 시 안내 토스트가 노출된다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'searchBooks').mockResolvedValue(
      searchPage([
        {
          id: 'book-1',
          isbn: '9788932917245',
          title: '데미안',
          author: '헤르만 헤세',
          publisher: '민음사',
          coverUrl: null,
        },
      ]),
    );
    vi.spyOn(api, 'addToShelf').mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: 'ShelfAlreadyExists' } },
    });

    renderSearch();
    await user.type(screen.getByRole('searchbox', { name: /책 검색/ }), '데미안');
    await user.click(await screen.findByRole('button', { name: /데미안 서재에 추가/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/이미 서가에 꽂혀 있는 책/);
  });
});
