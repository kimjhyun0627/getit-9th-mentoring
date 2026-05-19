import { ThemeToggle } from '@getit/theme';

/**
 * Auth 페이지 공통 레이아웃.
 * Landing과 같은 톤: hairline 보더 + zinc 베이스 + 카드 무그림자.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
          <a
            href="https://get-it.cloud"
            className="group flex items-center gap-2"
            aria-label="GETIT 9기 홈"
          >
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-[11px] font-bold tracking-tight text-background"
            >
              G9
            </span>
            <span className="text-sm font-semibold tracking-tight">GETIT 9기</span>
          </a>

          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-base transition hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:py-20">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-hairline bg-card p-8 sm:p-10">{children}</div>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-muted-foreground lg:px-10 sm:flex-row sm:items-center">
          <p>© GETIT 9기 멘토링 · 경북대학교 IT 학회</p>
          <p className="font-mono tracking-wider text-muted-foreground/80">auth.get-it.cloud</p>
        </div>
      </footer>
    </div>
  );
};
