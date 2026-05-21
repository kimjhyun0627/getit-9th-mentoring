import { Link } from 'react-router-dom';

import { BrandMark } from './BrandMark.jsx';
import { CandleToggle } from './CandleToggle.jsx';

/**
 * 롤링페이퍼 공통 레이아웃 — Warm 톤 (warm.html 기준).
 * - Light: cream 베이지 벽지 + peachDk 액센트
 * - Dark: mocha 짙은 브라운 + rose 액센트
 *
 * 화이트보드 영역은 자식 컴포넌트가 wall-bg 위에 그린다.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const LetterLayout = ({ children }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 wall-bg opacity-90" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-7 sm:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="롤링페이퍼 홈">
          <BrandMark className="h-7 w-7 sm:h-8 sm:w-8" />
          {/*
            #457 — 헤더 로고 'G'만 font-hand 로 split 되던 문제 해결.
            BoardPage TitleStrip (#407) 와 동일 패턴 적용:
            'GETIT' 5글자를 라틴 폰트로 명시해 통일하고, '롤링페이퍼' 는 sans 유지.
            sageDk/sageW 색상 액센트로 브랜드 강조 유지.
          */}
          <span className="text-lg font-semibold tracking-tight sm:text-xl">
            <span className="[font-family:Inter,system-ui,-apple-system,sans-serif] text-sageDk dark:text-sageW">
              GETIT
            </span>{' '}
            롤링페이퍼
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* 필수 internal 클래스(candle-toggle / inline-flex / 사이즈)는 컴포넌트가 보존. 외관만 오버라이드. */}
          <CandleToggle className="bg-white shadow-sm ring-1 ring-ink/10 dark:bg-mocha2 dark:ring-beige/20" />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-32 pt-10 sm:px-8">{children}</main>

      <footer className="relative z-10 mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-2 text-xs text-ink2 sm:flex-row sm:items-center dark:text-beige2">
          <p>© 2026 GETIT 9기 · letter.get-it.cloud</p>
          <p className="font-hand text-sm">
            이름은 다른 부원에게 표시되지 않아요 · 본인만 편집/삭제 가능
          </p>
        </div>
      </footer>
    </div>
  );
};
