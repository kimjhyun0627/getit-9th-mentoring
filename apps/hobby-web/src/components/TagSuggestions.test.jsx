import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SUGGESTED_TAGS } from '../data/tags.js';

import { TagSuggestions } from './TagSuggestions.jsx';

/**
 * #357 — 추천 태그 칩 가드.
 * 8개 카테고리 렌더 + 픽 콜백 + selected disabled + MAX 도달 시 disabled.
 */

describe('TagSuggestions', () => {
  it('SUGGESTED_TAGS 8개를 모두 렌더한다', () => {
    expect(SUGGESTED_TAGS).toHaveLength(8);
    render(<TagSuggestions value={[]} onPick={vi.fn()} />);
    for (const s of SUGGESTED_TAGS) {
      expect(screen.getByRole('button', { name: new RegExp(s.label) })).toBeInTheDocument();
    }
  });

  it('칩 클릭 시 onPick(label) 이 호출된다', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagSuggestions value={[]} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /맛집/ }));
    expect(onPick).toHaveBeenCalledWith('맛집');
  });

  it('이미 선택된 태그는 disabled 이고 aria-pressed=true 다', () => {
    render(<TagSuggestions value={['스터디']} onPick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /스터디/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('선택된 태그 칩을 다시 클릭해도 onPick 이 호출되지 않는다', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagSuggestions value={['카페']} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /카페/ }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('disabled prop 이 true 면 모든 칩이 비활성화된다 (MAX 도달)', () => {
    render(<TagSuggestions value={[]} onPick={vi.fn()} disabled />);
    for (const s of SUGGESTED_TAGS) {
      expect(screen.getByRole('button', { name: new RegExp(s.label) })).toBeDisabled();
    }
  });

  it('대소문자 무시하고 중복 판정한다', () => {
    // 추천 라벨은 한글이라 대소문자 영향은 없지만, 정규화 일관성 가드.
    render(<TagSuggestions value={['맛집']} onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /맛집/ })).toBeDisabled();
  });
});
