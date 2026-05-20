import { About } from './components/About.jsx';
import { CardGrid } from './components/CardGrid.jsx';
import { Footer } from './components/Footer.jsx';
import { Header } from './components/Header.jsx';
import { Hero } from './components/Hero.jsx';
import { OnboardingBubble } from './components/OnboardingBubble.jsx';
import { Team } from './components/Team.jsx';

/**
 * Landing 앱 루트.
 * Tech-Dark 시안 (ink-950 베이스 + cyan/magenta/lime/amber 네온 분배) 구현.
 * 다크 모드 기본 + 라이트 토글 가능 (`packages/theme` 사용).
 *
 * 섹션 순서: Header → Hero → CardGrid(#projects) → Team(#team, #222) → About(#about) → Footer.
 * 첫 방문자 (#361) → OnboardingBubble (다크/라이트 토글 위치 힌트).
 */
export const App = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <CardGrid />
        <Team />
        <About />
      </main>
      <Footer />
      <OnboardingBubble />
    </div>
  );
};
