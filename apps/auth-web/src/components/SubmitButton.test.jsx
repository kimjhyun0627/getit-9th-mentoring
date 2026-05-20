import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SubmitButton } from './SubmitButton.jsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Tech-Dark 토큰 가드 (Issue #172, supersedes #91).
 *
 * `bg-primary`/`text-primary-foreground`는 CSS variable로 풀린다.
 * 단위 테스트에선 jsdom이 Tailwind CSS를 로드하지 않으므로,
 * (1) 컴포넌트가 design-token 클래스 계약을 유지하는지,
 * (2) `src/index.css`의 다크 토큰이 cyan-neon (187 92% 53%)인지를 검증한다.
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

describe('auth-web Tech-Dark primary 토큰 (Issue #172)', () => {
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

  it('다크 모드 --primary는 cyan-neon 액센트 (hue ≈ 187, 네온 컬러)', () => {
    const darkPrimary = readVar(darkBlock, 'primary');
    expect(darkPrimary).not.toBeNull();
    // cyan hue (187 ± 5), 채도 ≥ 80%, 명도 45–65% (네온 액센트)
    const [h, s, l] = darkPrimary.split(/\s+/).map((x) => parseFloat(x));
    expect(h).toBeGreaterThanOrEqual(182);
    expect(h).toBeLessThanOrEqual(192);
    expect(s).toBeGreaterThanOrEqual(80);
    expect(l).toBeGreaterThanOrEqual(45);
    expect(l).toBeLessThanOrEqual(65);
  });

  it('다크 모드 --primary-foreground는 ink-950 톤 (네온 위 짙은 글씨로 강한 대비)', () => {
    const darkPrimaryFg = readVar(darkBlock, 'primary-foreground');
    expect(darkPrimaryFg).not.toBeNull();
    const [h, s, l] = darkPrimaryFg.split(/\s+/).map((x) => parseFloat(x));
    // 명도 ≤ 10% (잉크 톤), 채도는 낮은 편 (≤ 20%)
    expect(l).toBeLessThanOrEqual(10);
    expect(s).toBeLessThanOrEqual(20);
    // hue 200–260 사이 (ink-zinc 계열)
    expect(h).toBeGreaterThanOrEqual(200);
    expect(h).toBeLessThanOrEqual(260);
  });
});
