import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BoardIcon, HobbyIcon, LetterIcon, ShelfIcon } from './ProjectIcons.jsx';

/**
 * #597 — landing 카드 아이콘이 각 web 의 `public/favicon.svg` 와 동일 모티프인지
 * 검증. favicon 디자인이 정착(#534)된 이후 landing 아이콘 (#388 시점) 과 어긋났던
 * 것을 통일.
 *
 * 검증 전략:
 *   - viewBox 가 favicon 원본과 동일한지 (모티프 좌표 1:1 이식 보증).
 *   - 색이 액센트 토큰으로 잡힐 수 있도록 `stroke-current` 또는 `fill-current` 사용.
 *   - favicon path 의 핵심 fragment 가 그대로 남아있는지 (substring 매칭).
 *   - className prop 전달 / aria-hidden 인터페이스 유지 (ProjectCard 가 size-6 호출).
 */

const ICONS = [
  {
    name: 'HobbyIcon',
    Component: HobbyIcon,
    viewBox: '0 0 40 40',
    // favicon 의 어깨 곡선 path (두 사람 모티프) — 1:1 이식
    pathFragment: 'M8 30c1.5-4.5 5.5-7 9-7',
    colorClass: /fill-current/,
  },
  {
    name: 'ShelfIcon',
    Component: ShelfIcon,
    viewBox: '0 0 24 24',
    // favicon 의 기울어진 책 2 path
    pathFragment: 'M8.4 5.5 11.6 5 13 18.6l-3.2.5z',
    colorClass: /stroke-current/,
  },
  {
    name: 'BoardIcon',
    Component: BoardIcon,
    viewBox: '0 0 28 28',
    // favicon 의 외곽 둥근 박스 + 카드 — rx=6 카드 좌표가 동일
    pathFragment: null, // path 대신 rect 로 검증
    colorClass: /fill-current/,
  },
  {
    name: 'LetterIcon',
    Component: LetterIcon,
    viewBox: '0 0 32 32',
    // favicon 의 종이비행기 body path
    pathFragment: 'M27 5 5 14l8 3.5 2.5 8z',
    colorClass: /stroke-current/,
  },
];

describe('ProjectIcons — favicon 모티프 통일 (#597)', () => {
  for (const { name, Component, viewBox, pathFragment, colorClass } of ICONS) {
    describe(name, () => {
      it(`viewBox 가 favicon 원본 (${viewBox}) 과 동일하다`, () => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.getAttribute('viewBox')).toBe(viewBox);
      });

      it('aria-hidden 으로 데코레이션 처리된다', () => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        expect(svg.getAttribute('aria-hidden')).toBe('true');
      });

      it('색 클래스가 currentColor 기반이다 (wrapper 액센트 토큰 상속)', () => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        expect(svg.getAttribute('class')).toMatch(colorClass);
      });

      it('className prop 이 svg 에 전달된다 (size-6 default)', () => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        expect(svg.getAttribute('class')).toContain('size-6');
      });

      it('className override 가 적용된다', () => {
        const { container } = render(<Component className="size-8 custom" />);
        const svg = container.querySelector('svg');
        expect(svg.getAttribute('class')).toContain('size-8');
        expect(svg.getAttribute('class')).toContain('custom');
      });

      if (pathFragment) {
        it('favicon 의 핵심 path 가 그대로 이식되어 있다', () => {
          const { container } = render(<Component />);
          const paths = Array.from(container.querySelectorAll('path')).map((p) =>
            p.getAttribute('d'),
          );
          expect(paths.some((d) => d?.includes(pathFragment))).toBe(true);
        });
      }
    });
  }

  describe('BoardIcon — favicon 의 4 카드 opacity ladder', () => {
    it('카드 4개 + 외곽 박스 rect 5개를 가진다 (favicon 의 box + 4 cards)', () => {
      const { container } = render(<BoardIcon />);
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(5);
    });

    it('카드 3개에 favicon 과 동일한 fill-opacity (0.7 / 0.5 / 0.3) 가 적용된다', () => {
      const { container } = render(<BoardIcon />);
      const opacities = Array.from(container.querySelectorAll('rect'))
        .map((r) => r.getAttribute('fill-opacity'))
        .filter(Boolean);
      expect(opacities).toEqual(expect.arrayContaining(['0.7', '0.5', '0.3']));
    });
  });

  describe('HobbyIcon — favicon 의 두 사람 머리 (circle 2개)', () => {
    it('cx=15.5 / cx=24.5 의 두 circle 을 가진다', () => {
      const { container } = render(<HobbyIcon />);
      const circles = Array.from(container.querySelectorAll('circle'));
      const cxs = circles.map((c) => c.getAttribute('cx'));
      expect(cxs).toEqual(expect.arrayContaining(['15.5', '24.5']));
    });
  });
});
