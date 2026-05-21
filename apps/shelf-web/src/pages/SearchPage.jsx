import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ToastStack } from '../components/Toast.jsx';
import { useToastQueue } from '../components/useToastQueue.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { useMyShelves } from '../hooks/useShelves.js';
import { api } from '../lib/api.js';
import { addBookError, searchError } from '../lib/error-messages.js';
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
// 무한 스크롤 한 페이지 크기 (#527). 카카오 API max 는 size=50.
// 30 이면 4-col grid 첫 페이지로 7-8 행이 자연스럽게 차고, 추가 fetch 2-3 회면
// 100권 도달 → 사용자 신고("10개밖에 안 들고온다") 즉시 해소.
const PAGE_SIZE = 30;

/** @typedef {import('./SearchPage.constants.js').TargetKey} TargetKey */

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
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  // 다중 토스트 스택 — 빠른 연속 추가 시 같은 메시지 머지 + 카운터 (#294).
  const toastQueue = useToastQueue({ max: 3, duration: 2400 });
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

  // #527: useInfiniteQuery — 카카오 page/size 를 BE 로 그대로 흘려보내 진짜 페이지네이션.
  // PR #526 의 client-side slice 는 BE 가 10개만 받아오던 한계 때문에 무용지물이었음.
  const search = useInfiniteQuery({
    queryKey: ['books', 'search', trimmed, target],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const opts = { page: pageParam, size: PAGE_SIZE };
      if (target !== 'all') opts.target = /** @type {Exclude<TargetKey, 'all'>} */ (target);
      return api.searchBooks(trimmed, opts);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.isEnd) return undefined;
      // Gemini #528: 카카오 cap=50. 51 페이지를 추가 요청하면 BE 가 400 으로 거절 →
      // 사용자에게 에러 토스트가 노출됨. FE 에서 미리 잠그고 "모두 보여드렸어요" 로 종료.
      const next = (lastPage.page ?? 0) + 1;
      if (next > 50) return undefined;
      return next;
    },
    enabled: isQueryable,
  });

  useEffect(() => {
    if (search.isError) {
      toastQueue.push({ message: searchError(search.error), variant: 'error' });
    }
    // toastQueue 는 객체라 매 렌더 동일성이 깨지지만 push 는 setState 호출이라 stable.
    // 안전을 위해 의존성에 메서드만 포함.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toastQueue.push({ message: '서재에 담았습니다.', variant: 'success' });
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
      toastQueue.push({ message: addBookError(err), variant: 'error' });
    },
  });

  const handleAdd = useCallback(
    (vars) => {
      if (addMutation.isPending) return;
      addMutation.mutate(vars);
    },
    [addMutation],
  );

  const handleDismissToast = useCallback((id) => toastQueue.dismiss(id), [toastQueue]);

  const items = useMemo(
    () =>
      /** @type {BookItem[]} */ (
        (search.data?.pages ?? []).flatMap((p) => /** @type {BookItem[]} */ (p?.items ?? []))
      ),
    [search.data],
  );
  const showEmpty = isQueryable && !search.isLoading && !search.isError && items.length === 0;
  const showPrompt = !isQueryable;
  const pendingKey = addMutation.variables?.bookId ?? addMutation.variables?.isbn ?? null;

  // 무한 스크롤 sentinel (#527) — sentinel intersect 시 BE 에 다음 page fetch.
  // 카카오 API 가 페이지 종료를 알려주므로 (`isEnd`) hasNextPage 가 source of truth.
  // CR #528: 실패 상태에서는 sentinel 자동 fetch 를 멈춰야 요청 루프 방지. 재시도는
  // 버튼으로만 허용.
  const setSentinel = useInfiniteScroll({
    onIntersect: () => {
      if (search.hasNextPage && !search.isFetchingNextPage && !search.isFetchNextPageError) {
        search.fetchNextPage();
      }
    },
    enabled: search.hasNextPage && !search.isFetchingNextPage && !search.isFetchNextPageError,
  });

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-12 md:px-10 md:pb-20 md:pt-16">
      <ToastStack items={toastQueue.items} onDismiss={handleDismissToast} />

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
              items={items}
              onAdd={handleAdd}
              pendingKey={addMutation.isPending ? pendingKey : null}
              shelvedKeys={shelvedKeys}
              optimisticKeys={optimisticKeys.current}
            />
            <div
              ref={setSentinel}
              data-testid="search-sentinel"
              className="mt-10 flex justify-center"
              aria-live="polite"
            >
              {search.isFetchingNextPage ? (
                <p className="font-serif text-sm text-meta">더 불러오는 중…</p>
              ) : search.isFetchNextPageError ? (
                <button
                  type="button"
                  onClick={() => search.fetchNextPage()}
                  className="rounded-sm border border-rule-2 px-3 py-1 font-serif text-xs text-meta transition hover:border-foreground hover:text-ink"
                >
                  더 불러오지 못했어요 (다시 시도)
                </button>
              ) : !search.hasNextPage && items.length > 0 ? (
                <p className="essay-kr text-[13px] text-meta">모두 보여드렸어요</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
