import { ThemeToggle } from '@getit/theme';

/**
 * shelf editorial 공통 레이아웃 — 매거진 헤더 + 이슈 바 + 본문 + colophon.
 * `apps/shelf-web/src/index.css` 의 paper/ink/wine/mustard 토큰을 사용.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const ShelfLayout = ({ children }) => {
  return (
    <div className="paper-grain flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 pb-5 pt-7 md:px-10">
        <a href="/" className="flex shrink-0 items-baseline gap-2" aria-label="스마트 서재 홈">
          <span className="font-display text-xl font-black tracking-tightest text-ink-strong">
            Shelf
          </span>
          <span className="font-serif text-sm text-meta">/</span>
          <span className="smallcaps hidden text-[11px] sm:inline">a quiet library</span>
        </a>

        <nav className="flex items-center gap-6 text-[13px] md:gap-8">
          <a href="/" className="ink-link hidden sm:inline">
            Library
          </a>
          <a href="/search" className="ink-link hidden sm:inline">
            Search
          </a>
          <ThemeToggle
            className="smallcaps inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[12px] transition hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ borderColor: 'var(--rule-2)' }}
          />
        </nav>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
        <div className="hairline-strong" />
        <div className="smallcaps flex items-center justify-between py-2.5 text-[11px]">
          <span>Vol. IX · Spring Reading</span>
          <span className="hidden md:inline">개인 도서관 · 큐레이션</span>
          <span aria-hidden="true">shelf.get-it.cloud</span>
        </div>
        <div className="hairline-strong" />
      </div>

      <main className="flex-1">{children}</main>

      <footer className="mx-auto w-full max-w-7xl px-6 pb-16 pt-10 md:px-10">
        <div className="hairline-strong mb-10" />
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 md:col-span-5">
            <p className="font-display text-2xl font-black leading-none tracking-tightest text-ink-strong md:text-3xl">
              Colophon<span className="text-wine">.</span>
            </p>
            <p className="essay-kr text-body mt-4 max-w-[34ch] text-[14px] leading-relaxed">
              이 도서관은 한 사람의 읽기와 한 사람의 손글씨로 쌓아 올려졌습니다.
            </p>
          </div>
          <div className="col-span-12 grid grid-cols-2 gap-6 text-[12.5px] md:col-span-7 md:grid-cols-3">
            <div>
              <p className="smallcaps mb-2">Imprint</p>
              <p className="text-body">경북대학교 GETIT</p>
              <p className="text-body">shelf.get-it.cloud</p>
              <p className="text-meta mt-1">9th Cohort · 2026</p>
            </div>
          </div>
        </div>
        <div className="hairline mt-10" />
        <p className="essay-kr text-meta mt-4 text-center text-[12px]">
          A library of one — curated, annotated, remembered.
        </p>
      </footer>
    </div>
  );
};
