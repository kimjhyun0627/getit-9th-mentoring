import { About } from './components/About.jsx';
import { CardGrid } from './components/CardGrid.jsx';
import { Footer } from './components/Footer.jsx';
import { Header } from './components/Header.jsx';
import { Hero } from './components/Hero.jsx';

/**
 * Landing 앱 루트.
 * Minimalist 시안 (zinc 베이스 + 인디고 단일 액센트) 1:1 구현.
 * ThemeProvider는 main.jsx에서 마운트.
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
