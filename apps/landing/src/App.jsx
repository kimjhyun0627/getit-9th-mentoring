import { About } from './components/About.jsx';
import { CardGrid } from './components/CardGrid.jsx';
import { Footer } from './components/Footer.jsx';
import { Header } from './components/Header.jsx';
import { Hero } from './components/Hero.jsx';
import { OnboardingBubble } from './components/OnboardingBubble.jsx';
import { Team } from './components/Team.jsx';
import { MePage } from './pages/MePage.jsx';

/**
 * Landing 앱 루트.
 * Tech-Dark 시안 (ink-950 베이스 + cyan/magenta/lime/amber 네온 분배) 구현.
 * 다크 모드 기본 + 라이트 토글 가능 (`packages/theme` 사용).
 *
 * 섹션 순서: Header → Hero → CardGrid(#projects) → Team(#team, #222) → About(#about) → Footer.
 * 첫 방문자 (#361) → OnboardingBubble (다크/라이트 토글 위치 힌트).
 *
 * 라우팅 (school-auth #547):
 *  - `/me` → MePage (자체 Header/Footer 포함, self-contained).
 *  - 그 외 → 기존 home (Hero + CardGrid + Team + About).
 *  - react-router-dom 도입 안 함 — 단일 추가 라우트 + nginx SPA fallback 만으로 충분.
 *  - SSR/jsdom 안전: `typeof window === 'undefined'` 시 home 으로 폴백.
 */
export const App = () => {
  const pathname =
    typeof window !== 'undefined' && window.location ? window.location.pathname : '/';

  // 끝 슬래시 정규화 — `/me/` 같은 입력도 같은 페이지로.
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/me') {
    return <MePage />;
  }

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
