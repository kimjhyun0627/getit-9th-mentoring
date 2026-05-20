/**
 * BookCard — 검색 결과 1건. editorial: 표지 + 제목 + 저자 + "서재에 추가" 액션.
 *
 * Pure presentational. 부모가 onAdd / isPending / addedKey 를 주입한다.
 *
 * @param {{
 *   book: {
 *     id?: string,
 *     isbn?: string,
 *     title: string,
 *     author?: string | null,
 *     publisher?: string | null,
 *     coverUrl?: string | null,
 *   },
 *   onAdd: (book: { isbn?: string, bookId?: string }) => void,
 *   isPending?: boolean,
 *   isAdded?: boolean,
 * }} props
 */
export const BookCard = ({ book, onAdd, isPending = false, isAdded = false }) => {
  const canAdd = Boolean(book.id || book.isbn);
  const buttonLabel = isAdded ? '서재에 담김' : isPending ? '담는 중…' : '서재에 추가';

  const handleClick = () => {
    if (isPending || isAdded || !canAdd) return;
    if (book.id) {
      onAdd({ bookId: book.id });
    } else if (book.isbn) {
      onAdd({ isbn: book.isbn });
    }
  };

  return (
    <article className="group flex flex-col gap-3" data-testid="book-card">
      <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-band ring-1 ring-border">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-3xl text-hint">
            ?
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-semibold leading-snug text-ink line-clamp-2">
          {book.title}
        </h3>
        {book.author ? (
          <p className="font-serif text-sm text-meta line-clamp-1">{book.author}</p>
        ) : null}
        {book.publisher ? <p className="smallcaps text-[11px]">{book.publisher}</p> : null}
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || isAdded || !canAdd}
        aria-label={`${book.title} ${buttonLabel}`}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-background px-3 py-2 font-serif text-xs text-ink transition hover:border-foreground hover:text-accent-wine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {buttonLabel}
      </button>
    </article>
  );
};
