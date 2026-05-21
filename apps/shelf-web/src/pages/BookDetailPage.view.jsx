import { Link } from 'react-router-dom';

import { StarRating } from '../components/StarRating.jsx';
import { upscaleCoverUrl } from '../lib/coverUrl.js';

/**
 * 책 상세 화면 본문 — 데이터 로드 후 표시 (#201).
 * BookDetailPage 의 쿼리/상태 로직과 분리되어 테스트 친화.
 *
 * @param {{
 *   book: any,
 *   ownersCount: number,
 *   recs: any[],
 *   myEntry: any,
 *   onAdd: () => void,
 *   adding: boolean,
 *   onShare: () => void,
 *   copyState: 'idle' | 'ok' | 'err',
 * }} props
 */
export const BookDetailView = ({
  book,
  ownersCount,
  recs,
  myEntry,
  onAdd,
  adding,
  onShare,
  copyState,
}) => {
  // #474 — Kakao R120x174 캐시 stale 대비 클라이언트 hi-res 변환.
  const cover = upscaleCoverUrl(book.coverUrl);
  return (
    <>
      <section className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="cover relative md:col-span-1">
          {cover ? (
            <div
              className="cover-inner"
              style={{ backgroundImage: `url("${cover}")` }}
              aria-hidden="true"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-paper-2 px-4 text-center">
              <p className="font-display text-base font-black leading-tight text-ink-strong">
                {book.title}
              </p>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <p className="smallcaps text-[11px]">{book.publisher ?? '출판사 미상'}</p>
          <h1 className="font-display mt-2 text-3xl font-black leading-[1.05] tracking-tightest md:text-5xl">
            {book.title}
          </h1>
          {book.author ? (
            <p className="text-body essay-kr mt-3 text-[15px]">{book.author}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {myEntry ? (
              <span
                aria-label="이미 서재에 담김"
                className="smallcaps border-rule-2 inline-flex items-center gap-2 border px-3 py-1.5 text-[11px]"
              >
                서재에 담김 · {statusLabel(myEntry.status)}
              </span>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                disabled={adding}
                className="smallcaps border-rule-2 hover:bg-paper-2 disabled:opacity-50 inline-flex items-center border px-3 py-1.5 text-[11px] transition-colors"
              >
                {adding ? '담는 중…' : '내 서재에 담기'}
              </button>
            )}
            <button
              type="button"
              onClick={onShare}
              className="smallcaps border-rule-2 hover:bg-paper-2 inline-flex items-center border px-3 py-1.5 text-[11px] transition-colors"
              aria-label="이 책 공유"
            >
              {copyState === 'ok' ? '복사 완료' : '공유'}
            </button>
            <span className="smallcaps text-meta text-[11px]" aria-live="polite">
              같은 책을 담은 사람 {ownersCount}명
            </span>
          </div>

          {myEntry ? (
            <div className="mt-6">
              <p className="smallcaps text-[11px]">나의 기록</p>
              <div className="mt-2">
                <StarRating value={myEntry.rating} readonly />
              </div>
              {myEntry.review ? (
                <p className="essay-kr text-body mt-3 text-[14px] leading-relaxed">
                  {myEntry.review}
                </p>
              ) : (
                <p className="text-meta mt-3 text-[12.5px]">아직 한 줄 평이 없어요.</p>
              )}
            </div>
          ) : null}

          {book.description ? (
            <>
              <div className="hairline my-8" />
              <p className="essay-kr text-body text-[14px] leading-relaxed">{book.description}</p>
            </>
          ) : null}
        </div>
      </section>

      <RecommendationGrid recs={recs} />
    </>
  );
};

const RecommendationGrid = ({ recs }) => (
  <section className="mt-16">
    <p className="smallcaps text-[11px]">같은 작가의 다른 책</p>
    <h2 className="font-display mt-2 text-2xl font-black tracking-tightest md:text-3xl">
      작가의 책장<span className="text-wine">.</span>
    </h2>
    {recs.length === 0 ? (
      <p className="text-meta mt-4 text-[13px]">추천할 책이 아직 없어요.</p>
    ) : (
      <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {recs.map((b) => {
          // #474 — 추천 그리드도 동일하게 hi-res 변환.
          const recCover = upscaleCoverUrl(b.coverUrl);
          return (
            <li key={b.isbn}>
              <Link
                to={`/book/${encodeURIComponent(b.isbn)}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)]"
              >
                <div className="cover relative">
                  {recCover ? (
                    <div
                      className="cover-inner"
                      style={{ backgroundImage: `url("${recCover}")` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-paper-2" />
                  )}
                </div>
                <p className="font-display mt-2 text-sm font-bold leading-tight">{b.title}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const statusLabel = (s) => (s === 'READ' ? '읽은 책' : s === 'READING' ? '읽는 중' : '읽고 싶은');
