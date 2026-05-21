import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BookCardSkeleton } from '../components/BookCard.jsx';
import { ToastStack } from '../components/Toast.jsx';
import { useToastQueue } from '../components/useToastQueue.js';
import { api } from '../lib/api.js';
import { addBookError, bookError } from '../lib/error-messages.js';

import { BookDetailView } from './BookDetailPage.view.jsx';

/**
 * 책 상세 — /book/:isbn (#201).
 *
 * 데이터:
 *  - GET /books/:isbn — 캐시 hit + 외부 fallback
 *  - GET /books/:isbn/owners — 동일 책 보유 유저 카운트 (#292 연계)
 *  - GET /books/:isbn/recommendations — 같은 작가 추천 (#209)
 *  - GET /shelves/me — 내가 이미 담았는지 cross-reference
 *
 * 액션:
 *  - 내 서재에 담기 (POST /shelves) — 422 (이미 존재) graceful 처리
 *  - 공유 (#207) — Web Share API 우선, 없으면 클립보드. 한 줄 평 + URL 포함.
 */
export const BookDetailPage = () => {
  const { isbn = '' } = useParams();
  const normalized = isbn.toUpperCase();
  const queryClient = useQueryClient();
  const toastQueue = useToastQueue({ max: 3, duration: 2400 });

  const bookQuery = useQuery({
    queryKey: ['book', normalized],
    queryFn: async () => {
      const res = await api.getBook(normalized);
      return res.data?.book;
    },
    enabled: normalized.length > 0,
    retry: false,
  });

  const ownersQuery = useQuery({
    queryKey: ['book-owners', normalized],
    queryFn: async () => (await api.getBookOwners(normalized)).data?.count ?? 0,
    enabled: bookQuery.isSuccess,
    retry: false,
  });

  const recsQuery = useQuery({
    queryKey: ['book-recs', normalized],
    queryFn: async () => (await api.getRecommendations(normalized)).data?.items ?? [],
    enabled: bookQuery.isSuccess,
    retry: false,
  });

  // 내 서재 보유 lookup — #477 lightweight contains 엔드포인트 (O(1)).
  // 100건 myShelves 페이지 한계 우회. shelf 본문 (별점/리뷰) 도 같이 받아 옴.
  const containsQuery = useQuery({
    queryKey: ['shelf-contains', normalized],
    queryFn: async () => (await api.containsInShelf({ isbn: normalized })).data,
    enabled: normalized.length > 0,
    retry: false,
  });
  const myEntry = containsQuery.data?.contains ? containsQuery.data.shelf : null;

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.addToShelf({ isbn: normalized, status: 'WANT' });
      return res.data?.shelf;
    },
    onSuccess: () => {
      toastQueue.push({ message: '서재에 담았습니다.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['shelf-contains', normalized] });
    },
    onError: (err) => {
      const status = err?.response?.status;
      // 422 는 결과적으로 "이미 담겨 있음" 이 진실 → success 톤으로 안내하고 refetch.
      if (status === 422) {
        toastQueue.push({ message: '이미 서가에 꽂혀 있는 책입니다.', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
        queryClient.invalidateQueries({ queryKey: ['shelf-contains', normalized] });
        return;
      }
      toastQueue.push({ message: addBookError(err), variant: 'error' });
    },
  });

  const [copyState, setCopyState] = useState(/** @type {'idle'|'ok'|'err'} */ ('idle'));
  useEffect(() => {
    if (copyState === 'idle') return undefined;
    const id = setTimeout(() => setCopyState('idle'), 1800);
    return () => clearTimeout(id);
  }, [copyState]);

  const handleShare = async () => {
    const url = `${window.location.origin}/book/${encodeURIComponent(normalized)}`;
    const title = bookQuery.data?.title ?? '책';
    // #485 — 80자 + 시그니처 + Editorial 톤. 200자 review 가 share UI 에서 잘리던 문제 해소.
    const trimmedReview = trimReview(myEntry?.review, 80);
    // #476 — Web Share 의 text 에는 url 을 끼워넣지 않는다 (iOS Safari url 중복 노출 방지).
    const shareText = trimmedReview
      ? `『${title}』\n"${trimmedReview}"\n— 스마트 서재 · GETIT`
      : `『${title}』\n— 스마트 서재 · GETIT`;
    // 클립보드 fallback 시에는 url 까지 한 덩어리로 복사 (받는 사람이 링크 못 따라가면 의미 X).
    const clipboardText = `${shareText}\n${url}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text: shareText, url });
        setCopyState('ok');
        return;
      }
      await navigator.clipboard.writeText(clipboardText);
      setCopyState('ok');
      toastQueue.push({ message: '링크를 복사했습니다.', variant: 'success' });
    } catch (err) {
      // AbortError — 사용자가 share 시트를 직접 닫음. 정상 흐름.
      if (err?.name === 'AbortError') return;
      setCopyState('err');
      // NotAllowedError — non-https / non-user-gesture. 브라우저 제약 명시 분기.
      const message =
        err?.name === 'NotAllowedError'
          ? '브라우저가 공유를 차단했습니다. 직접 주소를 복사해 주세요.'
          : '공유에 실패했습니다. 직접 주소를 복사해 주세요.';
      toastQueue.push({ message, variant: 'error' });
    }
  };

  if (!normalized) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-meta">잘못된 주소입니다.</p>
      </section>
    );
  }

  return (
    <article
      aria-busy={bookQuery.isLoading}
      className="mx-auto w-full max-w-5xl px-6 py-12 md:px-10"
    >
      <ToastStack items={toastQueue.items} onDismiss={toastQueue.dismiss} />

      <p className="smallcaps mb-4 text-[11px]">
        <Link to="/" className="ink-link">
          ← 도서관으로
        </Link>
      </p>

      {bookQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <BookCardSkeleton className="md:col-span-1" />
          <div className="md:col-span-2" aria-busy="true">
            <div className="h-8 w-3/4 bg-paper-2 book-skeleton-shimmer" />
            <div className="mt-4 h-4 w-1/3 bg-paper-2 book-skeleton-shimmer" />
            <div className="mt-8 h-20 w-full bg-paper-2 book-skeleton-shimmer" />
          </div>
        </div>
      ) : bookQuery.isError ? (
        <p role="alert" className="text-destructive font-serif">
          {bookError(bookQuery.error)}
        </p>
      ) : bookQuery.data ? (
        <BookDetailView
          book={bookQuery.data}
          ownersCount={ownersQuery.data ?? 0}
          recs={recsQuery.data ?? []}
          myEntry={myEntry}
          onAdd={() => addMutation.mutate()}
          adding={addMutation.isPending}
          onShare={handleShare}
          copyState={copyState}
        />
      ) : null}
    </article>
  );
};

/**
 * 한 줄 평 share trim — 80자 + 1자 ellipsis (#485).
 * 줄바꿈은 한 칸 공백으로 정리해 share UI 의 한 줄 노출 보장.
 *
 * @param {string | null | undefined} review
 * @param {number} max
 * @returns {string}
 */
export const trimReview = (review, max = 80) => {
  if (!review) return '';
  const oneLine = review.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max).trimEnd()}…`;
};
