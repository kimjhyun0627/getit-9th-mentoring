import { ThemeToggle } from '@getit/theme';

/**
 * Sticky 상단 헤더. 1px hairline 하단 보더 + backdrop-blur.
 * 좌: "G9" 모노그램 + "GETIT 9기" 로고.
 * 우: ThemeToggle.
 */
export const Header = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <a href="/" className="group flex items-center gap-2" aria-label="GETIT 9기 홈">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-[11px] font-bold tracking-tight text-background"
          >
            G9
          </span>
          <span className="text-sm font-semibold tracking-tight">GETIT 9기</span>
        </a>

        <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-base transition hover:bg-foreground/[0.04]" />
      </div>
    </header>
  );
};
