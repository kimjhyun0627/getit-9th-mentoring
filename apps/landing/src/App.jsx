import { ThemeToggle } from '@getit/theme';

import { ProjectCard } from './components/ProjectCard.jsx';

/**
 * 4 프로젝트 메타데이터.
 * 노션 PRD 기준. 디자이너가 emoji/스크린샷 교체 예정.
 */
const PROJECTS = [
  {
    title: '취미메이트',
    href: 'https://hobby.get-it.cloud',
    emoji: '🤲',
    description: '관심사 기반 모임/소모임 매칭',
  },
  {
    title: '스마트 서재',
    href: 'https://shelf.get-it.cloud',
    emoji: '📚',
    description: '독서 진행도 + 책 추천 + 메모',
  },
  {
    title: '팀 칸반',
    href: 'https://board.get-it.cloud',
    emoji: '💻',
    description: '할 일 보드 + 협업 기능',
  },
  {
    title: '익명 롤링페이퍼',
    href: 'https://letter.get-it.cloud',
    emoji: '🎤',
    description: 'GETIT 부원끼리 익명 메시지',
  },
];

/**
 * landing 앱 루트 컴포넌트.
 * 헤더(GETIT 9기 + 토글) + 4 카드 그리드 + 푸터.
 * 임시 골격 — 디자이너 shotgun 결과로 추후 교체.
 */
export const App = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <p className="text-lg font-semibold tracking-tight">GETIT 9기</p>
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-lg hover:bg-accent" />
        </div>
      </header>

      <main className="container py-16">
        <section className="mb-12 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">9기 멘토링 프로젝트</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            GETIT 9기 멘토링 프로젝트 4개를 한 곳에서 만나보세요.
          </p>
        </section>

        <section
          aria-label="프로젝트 목록"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROJECTS.map((p) => (
            <ProjectCard key={p.href} {...p} />
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container py-8 text-sm text-muted-foreground">
          © GETIT 9기 멘토링 · 경북대학교 IT 학회
        </div>
      </footer>
    </div>
  );
};
