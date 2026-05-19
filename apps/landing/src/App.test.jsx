import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { App } from './App.jsx';

describe('App (landing)', () => {
  it('헤더에 "GETIT 9기" 텍스트를 렌더한다', () => {
    render(<App />);
    expect(screen.getByText('GETIT 9기')).toBeInTheDocument();
  });

  it('4개 프로젝트 카드를 모두 렌더한다', () => {
    render(<App />);
    const titles = ['취미메이트', '스마트 서재', '팀 칸반', '익명 롤링페이퍼'];
    for (const title of titles) {
      expect(screen.getByRole('heading', { name: title, level: 2 })).toBeInTheDocument();
    }
  });

  it('ThemeToggle 버튼이 aria-label과 함께 존재한다', () => {
    render(<App />);
    // 초기 resolved=light 이므로 "다크모드로 전환" 라벨이 노출됨.
    const toggle = screen.getByRole('button', { name: /다크모드로 전환|라이트모드로 전환/ });
    expect(toggle).toBeInTheDocument();
  });
});
