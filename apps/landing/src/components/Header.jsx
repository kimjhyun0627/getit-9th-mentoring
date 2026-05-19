import { ThemeToggle } from '@getit/theme';

const AUTH_LOGIN_URL = 'https://auth.get-it.cloud/login?redirect=https://get-it.cloud';

/**
 * Sticky 상단 헤더. 1px hairline 하단 보더 + backdrop-blur.
 * - 좌: "G9" 모노그램 + "GETIT 9기" 로고 + nav (Projects, About, md+ only).
 * - 우: ThemeToggle + Sign in 버튼 (auth.get-it.cloud 로 redirect).
 */
export const Header = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-8">
          <a href="/" className="group flex items-center gap-2" aria-label="GETIT 9기 홈">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-[11px] font-bold tracking-tight text-background"
            >
              G9
            </span>
            <span className="text-sm font-semibold tracking-tight">GETIT 9기</span>
          </a>

          <nav aria-label="주요 섹션" className="hidden items-center gap-6 md:flex">
            <a
              href="#projects"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              Projects
            </a>
            <a
              href="#about"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              About
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-foreground transition hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <a
            href={AUTH_LOGIN_URL}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          >
            Sign in
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
