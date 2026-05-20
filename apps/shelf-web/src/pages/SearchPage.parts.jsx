/**
 * SearchPage 보조 UI — `SearchPage.jsx` 가 300 줄 상한을 넘지 않도록 분리.
 *
 * 모두 pure presentational. 부모가 state 와 핸들러를 주입한다.
 *
 * Sections:
 *  - TargetToggle (#202 검색 대상 토글)
 *  - SearchField  (#232 100자 상한 + 카운터)
 *  - PromptEmpty  (검색 전 안내)
 *  - EmptyResults (검색 결과 0건)
 *  - ResultsGrid  (#217 cross-reference 포함)
 */
import { SearchResultCard } from '../components/SearchResultCard.jsx';

import { MAX_QUERY, TARGET_OPTIONS } from './SearchPage.constants.js';

/** @typedef {import('./SearchPage.constants.js').TargetKey} TargetKey */

/**
 * 검색 대상 토글 (#202) — 제목 / 저자 / ISBN / 전체.
 *
 * @param {{ value: TargetKey; onChange: (v: TargetKey) => void }} props
 */
export const TargetToggle = ({ value, onChange }) => (
  <div
    role="radiogroup"
    aria-label="검색 대상"
    className="flex flex-wrap items-center gap-2"
    data-testid="search-target-toggle"
  >
    {TARGET_OPTIONS.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(opt.value)}
          className={
            active
              ? 'border-foreground bg-foreground text-background rounded-sm border px-3 py-1 font-serif text-[12.5px]'
              : 'border-rule-2 text-meta hover:border-foreground hover:text-ink focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm border bg-transparent px-3 py-1 font-serif text-[12.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
          }
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

/**
 * 검색 입력 — editorial 톤: hairline 강조, serif 폰트.
 *
 * BE 가 q 100자 상한이라 FE 도 동일 상한 + 80자 넘으면 카운터 노출 (#232).
 *
 * @param {{ value: string, onChange: (v: string) => void }} props
 */
export const SearchField = ({ value, onChange }) => {
  const showCounter = value.length >= 80;
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
          onChange={(e) => onChange(e.target.value.slice(0, MAX_QUERY))}
          maxLength={MAX_QUERY}
          placeholder="제목 또는 저자를 적어 보세요…"
          className="text-body w-full bg-transparent font-serif text-xl placeholder:text-hint focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-serif text-xs text-hint">두 글자 이상 입력하면 자동으로 검색됩니다.</p>
        {showCounter ? (
          <p className="num-display text-xs text-meta" data-testid="search-length-counter">
            {value.length} / {MAX_QUERY}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export const PromptEmpty = () => (
  <div className="bg-paper-2 border-rule-1 rounded-sm border border-dashed px-6 py-10 text-center">
    <p className="font-display text-ink-strong text-lg">오늘은 어떤 책을 찾고 계세요?</p>
    <p className="mt-2 font-serif text-sm text-meta">
      좋아하는 작가 이름이나 책 제목을 살짝 흘려 적어 보세요.
    </p>
  </div>
);

/** @param {{ query: string }} props */
export const EmptyResults = ({ query }) => (
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
 *   items: Array<{ id?: string; isbn?: string; title: string; author?: string | null; publisher?: string | null; coverUrl?: string | null }>,
 *   onAdd: (vars: { isbn?: string, bookId?: string }) => void,
 *   pendingKey: string | null,
 *   shelvedKeys: Set<string>,
 *   optimisticKeys: Set<string>,
 * }} props
 */
export const ResultsGrid = ({ items, onAdd, pendingKey, shelvedKeys, optimisticKeys }) => (
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
