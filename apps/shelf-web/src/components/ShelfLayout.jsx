import { ThemeToggle } from '@getit/theme';

/**
 * Shelf 페이지 공통 레이아웃 — editorial 시안 톤 (페이퍼/잉크).
 * - 상단 hairline 보더 + serif wordmark
 * - 본문 max-w-7xl 컨테이너
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const ShelfLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
          <a href="/" className="group flex items-center gap-3" aria-label="스마트 서재 홈">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-sm bg-foreground font-display text-sm font-bold tracking-tighter text-background"
            >
              S
            </span>
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              스마트 서재
            </span>
          </a>

          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-base transition hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-16">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-meta lg:px-10 sm:flex-row sm:items-center">
          <p className="smallcaps">© GETIT 9기 · KNU IT 학회</p>
          <p className="font-mono tracking-wider">shelf.get-it.cloud</p>
        </div>
      </footer>
    </div>
  );
};
