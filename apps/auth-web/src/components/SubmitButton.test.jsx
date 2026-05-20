import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SubmitButton } from './SubmitButton.jsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Issue #91 가드 — 다크 모드 primary CTA 컨트라스트.
 *
 * `bg-primary`/`text-primary-foreground`는 CSS variable로 풀린다.
 * 단위 테스트에선 jsdom이 Tailwind CSS를 로드하지 않으므로,
 * (1) 컴포넌트가 design-token 클래스 계약을 유지하는지,
 * (2) `src/index.css`의 다크 토큰이 indigo 액센트(239 84% ~58%)인지를 직접 검증한다.
 */
describe('SubmitButton', () => {
  it('design-token 클래스(bg-primary, text-primary-foreground)를 사용한다', () => {
    render(<SubmitButton>로그인</SubmitButton>);
    const button = screen.getByRole('button', { name: '로그인' });
    expect(button.className).toMatch(/\bbg-primary\b/);
    expect(button.className).toMatch(/\btext-primary-foreground\b/);
  });

  it('loading 상태에서 disabled되고 loadingText를 보여준다', () => {
    render(
      <SubmitButton loading loadingText="처리 중…">
        로그인
      </SubmitButton>,
    );
    const button = screen.getByRole('button', { name: '처리 중…' });
    expect(button).toBeDisabled();
  });
});

describe('auth-web 다크 모드 primary 토큰 (Issue #91)', () => {
  const css = readFileSync(join(__dirname, '../index.css'), 'utf8');

  const extractBlock = (selector) => {
    const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\}`);
    const match = css.match(re);
    if (!match) throw new Error(`CSS 블록을 찾을 수 없음: ${selector}`);
    return match[1];
  };

  const readVar = (block, name) => {
    const re = new RegExp(`--${name}:\\s*([^;]+);`);
    const match = block.match(re);
    return match ? match[1].trim() : null;
  };

  const darkBlock = extractBlock('.dark');

  it('다크 모드에서 --primary는 indigo 액센트를 유지한다 (흰색이 아니다)', () => {
    const darkPrimary = readVar(darkBlock, 'primary');
    expect(darkPrimary).not.toBeNull();
    // indigo hue (239 ± 5), 채도 ≥ 60%, 명도 ≥ 50% (브랜드 액센트)
    const [h, s, l] = darkPrimary.split(/\s+/).map((x) => parseFloat(x));
    expect(h).toBeGreaterThanOrEqual(234);
    expect(h).toBeLessThanOrEqual(244);
    expect(s).toBeGreaterThanOrEqual(60);
    expect(l).toBeGreaterThanOrEqual(50);
    expect(l).toBeLessThanOrEqual(75);
  });

  it('다크 모드 --primary-foreground는 흰색이다 (CTA 위 가독성)', () => {
    const darkPrimaryFg = readVar(darkBlock, 'primary-foreground');
    expect(darkPrimaryFg).toBe('0 0% 100%');
  });
});
