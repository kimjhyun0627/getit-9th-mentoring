import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SearchResultCard } from '../components/SearchResultCard.jsx';
import { Toast } from '../components/Toast.jsx';
import { useMyShelves } from '../hooks/useShelves.js';
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
  if (status === 422) return '이미 서재에 꽂혀 있는 책입니다.';
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 404) return '그 책의 정보를 찾지 못했습니다.';
  if (typeof status === 'number' && status >= 500) return '잠시 후 다시 담아 주세요.';
  return '책을 서재에 담는 데 실패했습니다. 잠시 후 다시 시도해 주세요.';
};

/**
 * 검색 실패를 사용자 친화 메시지로 매핑.
 *
 * @param {unknown} err
 * @returns {string}
 */
const searchErrorMessage = (err) => {
  const status = err?.response?.status;
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 503) return '도서 정보를 잠시 불러올 수 없습니다. 잠시 후 다시 펼쳐 주세요.';
  if (status === 400) return '검색어를 다시 살펴봐 주세요.';
  return '검색 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
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
  // 낙관 추가 직후 즉시 UI 반영용. 새로고침 시 휘발되어도 OK —
  // 서버 truth (myShelves) 가 cross-reference 로 isAdded 를 다시 채운다.
  const optimisticKeys = useRef(new Set());
  const [, forceRerender] = useState(0);

  const queryClient = useQueryClient();

  // 내 서재 — search 결과와 cross-reference 로 isAdded 영속 (#217).
  const myShelves = useMyShelves();
  const shelvedKeys = useMemo(() => {
    const set = new Set();
    for (const s of myShelves.data?.shelves ?? []) {
      if (s.bookId) set.add(s.bookId);
      if (s.book?.isbn) set.add(s.book.isbn);
    }
    return set;
  }, [myShelves.data]);

  const trimmed = debouncedQuery.trim();
  const isQueryable = trimmed.length >= MIN_QUERY;

  const search = useQuery({
    queryKey: ['books', 'search', trimmed],
    queryFn: async () => {
      const result = await api.searchBooks(trimmed);
      return result.items ?? [];
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
        optimisticKeys.current.add(key);
        forceRerender((n) => n + 1);
      }
      setToast({ message: '서재에 담았습니다.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
    },
    onError: (err, vars) => {
      // 422 (이미 존재) 도 결과적으로 "담겨 있음" 이 진실 → optimistic key 추가해 UI 즉시 갱신.
      // 서버 truth 가 다음 refetch 에서 확정.
      if (err?.response?.status === 422) {
        const key = vars.bookId ?? vars.isbn;
        if (key) {
          optimisticKeys.current.add(key);
          forceRerender((n) => n + 1);
        }
        queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
      }
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
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-12 md:px-10 md:pb-20 md:pt-16">
      <Toast
        message={toast?.message ?? null}
        variant={toast?.variant ?? 'success'}
        onDismiss={handleDismissToast}
      />

      <header className="flex flex-col gap-3">
        <p className="smallcaps text-xs">Vol. IX · 서재 검색</p>
        <h1 className="font-display text-ink-strong text-4xl font-semibold tracking-hero sm:text-5xl">
          책을 찾아보세요
        </h1>
        <p className="font-serif text-base text-meta">
          제목이나 저자로 찾아, 마음에 드는 책을 서재에 담아두세요.
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
            shelvedKeys={shelvedKeys}
            optimisticKeys={optimisticKeys.current}
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
      <div className="border-rule-2 flex items-end gap-3 border-b pb-2">
        <input
          id="search"
          type="search"
          role="searchbox"
          aria-label="책 검색"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="제목 또는 저자를 적어 보세요…"
          className="text-body w-full bg-transparent font-serif text-xl placeholder:text-hint focus:outline-none"
        />
      </div>
      <p className="font-serif text-xs text-hint">두 글자 이상 입력하면 자동으로 검색됩니다.</p>
    </div>
  );
};

const PromptEmpty = () => (
  <div className="bg-paper-2 border-rule-1 rounded-sm border border-dashed px-6 py-10 text-center">
    <p className="font-display text-ink-strong text-lg">오늘은 어떤 책을 찾고 계세요?</p>
    <p className="mt-2 font-serif text-sm text-meta">
      좋아하는 작가 이름이나 책 제목을 살짝 흘려 적어 보세요.
    </p>
  </div>
);

/** @param {{ query: string }} props */
const EmptyResults = ({ query }) => (
  <div className="bg-paper-2 border-rule-1 rounded-sm border border-dashed px-6 py-10 text-center">
    <p className="font-display text-ink-strong text-lg">이 서가에는 그 책이 없습니다.</p>
    <p className="mt-2 font-serif text-sm text-meta">
      <span className="text-ink-strong">&ldquo;{query}&rdquo;</span>로는 찾지 못했습니다. 제목
      일부나 저자 이름으로 다시 시도해 보세요.
    </p>
  </div>
);

/**
 * @param {{
 *   items: BookItem[],
 *   onAdd: (vars: { isbn?: string, bookId?: string }) => void,
 *   pendingKey: string | null,
 *   shelvedKeys: Set<string>,
 *   optimisticKeys: Set<string>,
 * }} props
 */
const ResultsGrid = ({ items, onAdd, pendingKey, shelvedKeys, optimisticKeys }) => (
  <ul
    className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    data-testid="results-grid"
  >
    {items.map((book, idx) => {
      const identity = book.id ?? book.isbn ?? null;
      // 식별자 없으면 동명 도서 충돌 막으려고 index 합성키 사용.
      const key = identity ?? `${book.title}-${idx}`;
      // 영속 truth 우선 (myShelves) + 낙관 보조 (옵티미스틱 직후).
      const isAdded =
        identity !== null &&
        (shelvedKeys.has(identity) ||
          (book.isbn && shelvedKeys.has(book.isbn)) ||
          (book.id && shelvedKeys.has(book.id)) ||
          optimisticKeys.has(identity));
      return (
        <li key={key}>
          <SearchResultCard
            book={book}
            onAdd={onAdd}
            isPending={identity !== null && pendingKey === identity}
            isAdded={Boolean(isAdded)}
          />
        </li>
      );
    })}
  </ul>
);
