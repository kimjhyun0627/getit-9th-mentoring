import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Toast } from '../components/Toast.jsx';
import { useMyShelves } from '../hooks/useShelves.js';
import { api } from '../lib/api.js';
import { useDebounce } from '../lib/useDebounce.js';

import {
  EmptyResults,
  PromptEmpty,
  ResultsGrid,
  SearchField,
  TargetToggle,
} from './SearchPage.parts.jsx';

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
const PAGE_STEP = 10;

/** @typedef {import('./SearchPage.constants.js').TargetKey} TargetKey */

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
  const [target, setTarget] = useState(/** @type {TargetKey} */ ('all'));
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
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
  // pageSize 100 (BE max) 으로 받아오고, 그 이상 보유 시엔 lightweight bookIds 엔드포인트
  // 도입 전까지는 100 권 이상 보유 유저는 "담김" 표시가 일부 안 보일 수 있음 — known trade-off.
  // 검색 결과 카드의 disabled 상태가 아니어도 422 응답 직후 즉시 optimistic 반영되어 회복.
  const myShelves = useMyShelves({ pageSize: 100 });
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
    queryKey: ['books', 'search', trimmed, target],
    queryFn: async () => {
      const result =
        target === 'all'
          ? await api.searchBooks(trimmed)
          : await api.searchBooks(trimmed, { target });
      return result.items ?? [];
    },
    enabled: isQueryable,
  });

  // 새 검색 / target 변경 시 페이지 카운터 리셋 (#205)
  useEffect(() => {
    setVisibleCount(PAGE_STEP);
  }, [trimmed, target]);

  useEffect(() => {
    if (search.isError) {
      setToast({ message: searchErrorMessage(search.error), variant: 'error' });
    }
  }, [search.isError, search.error]);

  const addMutation = useMutation({
    mutationFn: async (vars) => {
      // status 는 카드 라디오에서 선택 (#298). 기본값은 카드 컴포넌트가 'WANT' 로 초기화.
      const status = vars.status ?? 'WANT';
      const res = await api.addToShelf({ ...vars, status });
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

  const items = useMemo(() => /** @type {BookItem[]} */ (search.data ?? []), [search.data]);
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = items.length > visibleCount;
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
      <TargetToggle value={target} onChange={setTarget} />

      <div aria-live="polite" className="min-h-[6rem]">
        {showPrompt ? (
          <PromptEmpty />
        ) : search.isLoading ? (
          <p className="font-serif text-sm text-meta">책장을 살펴보는 중…</p>
        ) : showEmpty ? (
          <EmptyResults query={trimmed} />
        ) : (
          <>
            <ResultsGrid
              items={visibleItems}
              onAdd={handleAdd}
              pendingKey={addMutation.isPending ? pendingKey : null}
              shelvedKeys={shelvedKeys}
              optimisticKeys={optimisticKeys.current}
            />
            {hasMore ? (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_STEP)}
                  className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-5 py-2 font-serif text-sm text-ink transition hover:border-foreground hover:text-accent-wine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  data-testid="search-load-more"
                >
                  더 보기 ({items.length - visibleCount}권 남음)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};
