import { Link } from 'react-router-dom';

import { ThemeSegmented } from './ThemeSegmented.jsx';

/**
 * board-web 공통 App 레이아웃.
 * 시안 (`docs/design/board/minimalist.html`) 의 sticky header + footer 구조 복제.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const AppLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link to="/" className="group flex items-center gap-2" aria-label="board 홈">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-[11px] font-bold tracking-tight text-background"
            >
              B
            </span>
            <span className="text-sm font-semibold tracking-tight">Board</span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
              /
            </span>
            <span className="text-sm text-muted-foreground">GETIT 9기</span>
          </Link>

          <ThemeSegmented />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-muted-foreground lg:px-10 sm:flex-row sm:items-center">
          <p>© GETIT 9기 · Board</p>
          <p className="font-mono tracking-wider text-muted-foreground/80">board.get-it.cloud</p>
        </div>
      </footer>
    </div>
  );
};
