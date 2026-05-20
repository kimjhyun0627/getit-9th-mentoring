import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BookCard } from '../components/BookCard.jsx';
import { Toast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { useDebounce } from '../lib/useDebounce.js';

/**
 * @typedef {{
 *   id?: string,
 *   isbn?: string,
 *   title: string,
 *   author?: string | null,
 *   publisher?: string | null,
 *   coverUrl?: string | null,
 * }} BookItem
 */

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

/**
 * 추가 실패를 사용자 친화 메시지로 매핑.
 *
 * @param {unknown} err
 * @returns {string}
 */
const addErrorMessage = (err) => {
  const status = err?.response?.status;
  if (status === 422) return '이미 서재에 있는 책이에요';
  if (status === 401) return '로그인이 필요해요';
  if (status === 404) return '책 정보를 찾지 못했어요';
  if (typeof status === 'number' && status >= 500) return '잠시 후 다시 시도해주세요';
  return '서재 추가에 실패했어요';
};

/**
 * 검색 실패를 사용자 친화 메시지로 매핑.
 *
 * @param {unknown} err
 * @returns {string}
 */
const searchErrorMessage = (err) => {
  const status = err?.response?.status;
  if (status === 503) return '도서 검색 서비스가 잠시 불안정해요';
  if (status === 400) return '검색어를 다시 확인해주세요';
  return '검색 중 문제가 생겼어요';
};

/**
 * SearchPage — 책 검색 + 서재 추가 (Issue #43).
 *
 * Flow:
 *  1. input 변경 → useDebounce 300ms
 *  2. debouncedQuery 길이 ≥ 2 → useQuery 발사
 *  3. BookCard "서재에 추가" → useMutation POST /shelves
 *  4. 성공: toast + /shelves/me invalidate + 해당 카드 added 표시
 *  5. 실패: 친화 메시지 toast
 */
export const SearchPage = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  const [toast, setToast] = useState(
    /** @type {{ message: string, variant: 'success'|'error' } | null} */ (null),
  );
  const addedKeys = useRef(new Set());
  const [, forceRerender] = useState(0);

  const queryClient = useQueryClient();

  const trimmed = debouncedQuery.trim();
  const isQueryable = trimmed.length >= MIN_QUERY;

  const search = useQuery({
    queryKey: ['books', 'search', trimmed],
    queryFn: async () => {
      const res = await api.searchBooks(trimmed);
      return res.data?.items ?? [];
    },
    enabled: isQueryable,
  });

  useEffect(() => {
    if (search.isError) {
      setToast({ message: searchErrorMessage(search.error), variant: 'error' });
    }
  }, [search.isError, search.error]);

  const addMutation = useMutation({
    mutationFn: async (vars) => {
      const res = await api.addToShelf({ ...vars, status: 'WANT' });
      return res.data?.shelf;
    },
    onSuccess: (_data, vars) => {
      const key = vars.bookId ?? vars.isbn;
      if (key) {
        addedKeys.current.add(key);
        forceRerender((n) => n + 1);
      }
      setToast({ message: '서재에 담았어요', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
    },
    onError: (err) => {
      setToast({ message: addErrorMessage(err), variant: 'error' });
    },
  });

  const handleAdd = useCallback(
    (vars) => {
      if (addMutation.isPending) return;
      addMutation.mutate(vars);
    },
    [addMutation],
  );

  const handleDismissToast = useCallback(() => setToast(null), []);

  const items = /** @type {BookItem[]} */ (search.data ?? []);
  const showEmpty = isQueryable && !search.isLoading && !search.isError && items.length === 0;
  const showPrompt = !isQueryable;
  const pendingKey = addMutation.variables?.bookId ?? addMutation.variables?.isbn ?? null;

  return (
    <section className="flex flex-col gap-10">
      <Toast
        message={toast?.message ?? null}
        variant={toast?.variant ?? 'success'}
        onDismiss={handleDismissToast}
      />

      <header className="flex flex-col gap-3">
        <p className="smallcaps text-xs">VOL. I · 서재 검색</p>
        <h1 className="font-display text-4xl font-semibold tracking-hero text-ink sm:text-5xl">
          책을 찾아보세요
        </h1>
        <p className="font-serif text-base text-meta">
          제목, 저자, ISBN 으로 검색해서 마음에 드는 책을 서재에 담아두세요.
        </p>
      </header>

      <SearchField value={query} onChange={setQuery} />

      <div aria-live="polite" className="min-h-[6rem]">
        {showPrompt ? (
          <PromptEmpty />
        ) : search.isLoading ? (
          <p className="font-serif text-sm text-meta">책장을 살펴보는 중…</p>
        ) : showEmpty ? (
          <EmptyResults query={trimmed} />
        ) : (
          <ResultsGrid
            items={items}
            onAdd={handleAdd}
            pendingKey={addMutation.isPending ? pendingKey : null}
            addedKeys={addedKeys.current}
          />
        )}
      </div>
    </section>
  );
};

/**
 * 검색 입력 — editorial 톤: hairline 강조, serif 폰트.
 *
 * @param {{ value: string, onChange: (v: string) => void }} props
 */
const SearchField = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="search" className="smallcaps text-[11px]">
        Search
      </label>
      <div className="flex items-end gap-3 border-b border-foreground pb-2">
        <input
          id="search"
          type="search"
          role="searchbox"
          aria-label="책 검색"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="제목, 저자, ISBN…"
          className="w-full bg-transparent font-serif text-xl text-ink placeholder:text-hint focus:outline-none"
        />
      </div>
      <p className="font-serif text-xs text-hint">두 글자 이상 입력하면 자동으로 검색돼요.</p>
    </div>
  );
};

const PromptEmpty = () => (
  <div className="rounded-sm border border-dashed border-border bg-band/40 px-6 py-10 text-center">
    <p className="font-display text-lg text-ink">오늘은 어떤 책을 찾고 계세요?</p>
    <p className="mt-2 font-serif text-sm text-meta">
      좋아하는 작가 이름이나 책 제목을 살짝 흘려 적어 보세요.
    </p>
  </div>
);

/** @param {{ query: string }} props */
const EmptyResults = ({ query }) => (
  <div className="rounded-sm border border-dashed border-border bg-band/40 px-6 py-10 text-center">
    <p className="font-display text-lg text-ink">책장에 비춰진 책이 없네요</p>
    <p className="mt-2 font-serif text-sm text-meta">
      <span className="text-ink">&ldquo;{query}&rdquo;</span> 로는 결과가 비어 있어요. 다른 키워드도
      시도해 보세요.
    </p>
  </div>
);

/**
 * @param {{
 *   items: BookItem[],
 *   onAdd: (vars: { isbn?: string, bookId?: string }) => void,
 *   pendingKey: string | null,
 *   addedKeys: Set<string>,
 * }} props
 */
const ResultsGrid = ({ items, onAdd, pendingKey, addedKeys }) => (
  <ul
    className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    data-testid="results-grid"
  >
    {items.map((book) => {
      const key = book.id ?? book.isbn ?? book.title;
      return (
        <li key={key}>
          <BookCard
            book={book}
            onAdd={onAdd}
            isPending={pendingKey === (book.id ?? book.isbn)}
            isAdded={addedKeys.has(book.id ?? book.isbn ?? '')}
          />
        </li>
      );
    })}
  </ul>
);
