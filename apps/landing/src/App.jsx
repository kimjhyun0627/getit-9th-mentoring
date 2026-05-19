import { About } from './components/About.jsx';
import { CardGrid } from './components/CardGrid.jsx';
import { Footer } from './components/Footer.jsx';
import { Header } from './components/Header.jsx';
import { Hero } from './components/Hero.jsx';

/**
 * Landing 앱 루트.
 * Tech-Dark 시안 (ink-950 베이스 + cyan/magenta/lime/amber 네온 분배) 구현.
 * 다크 모드 기본 + 라이트 토글 가능 (`packages/theme` 사용).
 *
 * 섹션 순서: Header → Hero → CardGrid(#projects) → About(#about) → Footer.
 */
export const App = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <CardGrid />
        <About />
      </main>
      <Footer />
    </div>
  );
};
