import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BookCardSkeleton } from '../components/BookCard.jsx';
import { ToastStack } from '../components/Toast.jsx';
import { useToastQueue } from '../components/useToastQueue.js';
import { useMyShelves } from '../hooks/useShelves.js';
import { api } from '../lib/api.js';

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

  // 내 서재 cross-reference (#217 100권 한계 동일)
  const myShelves = useMyShelves({ pageSize: 100 });
  const myEntry = useMemo(
    () =>
      myShelves.data?.shelves?.find(
        (s) => s.book?.isbn === normalized || s.bookId === bookQuery.data?.id,
      ),
    [myShelves.data, normalized, bookQuery.data],
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.addToShelf({ isbn: normalized, status: 'WANT' });
      return res.data?.shelf;
    },
    onSuccess: () => {
      toastQueue.push({ message: '서재에 담았습니다.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
    },
    onError: (err) => {
      const status = err?.response?.status;
      if (status === 422) {
        toastQueue.push({ message: '이미 서재에 담긴 책이에요.', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['shelves', 'me'] });
        return;
      }
      if (status === 401) {
        toastQueue.push({ message: '로그인이 필요합니다.', variant: 'error' });
        return;
      }
      toastQueue.push({ message: '담기를 실패했어요. 잠시 후 다시.', variant: 'error' });
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
    const text = myEntry?.review
      ? `『${bookQuery.data?.title}』 — ${myEntry.review}\n${url}`
      : `『${bookQuery.data?.title}』\n${url}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: bookQuery.data?.title ?? '책', text, url });
        setCopyState('ok');
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopyState('ok');
      toastQueue.push({ message: '링크를 복사했어요.', variant: 'success' });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setCopyState('err');
      toastQueue.push({
        message: '공유가 막혔어요. 직접 주소를 복사해 주세요.',
        variant: 'error',
      });
    }
  };

  if (!normalized) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-meta">잘못된 주소예요.</p>
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
          {toFriendlyError(bookQuery.error)}
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

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  if (status === 404) return '책을 찾을 수 없어요.';
  if (status === 400) return '잘못된 ISBN 이에요.';
  if (typeof status === 'number' && status >= 500)
    return '지금은 책 정보를 가져올 수 없어요. 잠시 후 다시 시도해 주세요.';
  return '책 정보를 불러오지 못했어요.';
};
