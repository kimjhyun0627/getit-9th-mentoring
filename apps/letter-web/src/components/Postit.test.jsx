import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Postit } from './Postit.jsx';

/**
 * Postit TDD 가드 (#54).
 *
 * 핵심:
 *  - 익명 메시지: 본문 + 시간만. 작성자 정보 노출 X.
 *  - 본인 메시지(is_mine=true): "내 메시지" 워시테이프 라벨 + 편집/삭제 버튼.
 *  - 색상 prop 에 맞는 background class (PINK/MINT/LEMON/LAVENDER).
 *  - 회전 각도는 ID 해시 기반 deterministic → CSS var `--rot` 가 -3~+3 범위.
 */
describe('Postit', () => {
  // 실시간 시계에 의존하면 "5분 전" 같은 상대시간 단언이 실행 타이밍에 따라 깜박이므로
  // 고정된 now 를 만들어 Postit 에 주입하고 createdAt 도 거기서 역산한다.
  // updatedAt 은 BE 응답에 포함되지 않으니 fixture 에서도 제외 (#251).
  const fixedNow = new Date('2026-05-20T12:00:00.000Z');
  const fiveMinutesAgo = new Date(fixedNow.getTime() - 5 * 60_000).toISOString();
  const base = {
    id: 'm1',
    content: '9기 화이팅! 한 학기 같이 잘해봐요.',
    color: 'LEMON',
    createdAt: fiveMinutesAgo,
    is_mine: false,
  };

  it('익명 메시지는 본문 + 시간만 렌더하고 작성자 정보를 노출하지 않는다', () => {
    render(<Postit message={base} now={fixedNow} />);
    expect(screen.getByText(/9기 화이팅/)).toBeInTheDocument();
    expect(screen.getByText('5분 전')).toBeInTheDocument();
    expect(screen.queryByText(/내 메시지/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /편집|삭제/ })).not.toBeInTheDocument();
  });

  it('익명 메시지의 article 에는 "내 메시지" aria-label 이 붙지 않는다', () => {
    render(<Postit message={base} now={fixedNow} />);
    const article = screen.getByRole('article');
    // aria-label 자체가 없거나 (null), 있더라도 "내 메시지" 텍스트는 포함되지 않아야 한다.
    const label = article.getAttribute('aria-label');
    expect(label ?? '').not.toMatch(/내 메시지/);
  });

  // #467 — 본인 메시지 announce 중복 차단.
  it('본인 메시지: article 에 aria-label 가 없고 badge 한 번만 announce', () => {
    render(<Postit message={{ ...base, is_mine: true }} now={fixedNow} />);
    const article = screen.getByRole('article');
    // article 자체에 aria-label="내 메시지" 가 붙으면 badge 와 더블 안내됨 → 제거 검증.
    expect(article.getAttribute('aria-label')).toBeNull();
    // visible badge 텍스트는 그대로 노출 (시각 사용자 + SR 모두 한 번 announce).
    expect(within(article).getByText('내 메시지')).toBeInTheDocument();
  });

  it('is_mine=true 면 "내 메시지" 라벨과 편집/삭제 버튼이 보인다', () => {
    render(<Postit message={{ ...base, is_mine: true }} now={fixedNow} />);
    const article = screen.getByRole('article');
    expect(article).toHaveClass('mine');
    expect(within(article).getByText('내 메시지')).toBeInTheDocument();
    expect(within(article).getByRole('button', { name: /편집/ })).toBeInTheDocument();
    expect(within(article).getByRole('button', { name: /삭제/ })).toBeInTheDocument();
  });

  it('편집 버튼 클릭 시 onEdit 콜백이 메시지와 함께 호출된다', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const mine = { ...base, is_mine: true };
    render(<Postit message={mine} onEdit={onEdit} now={fixedNow} />);

    await user.click(screen.getByRole('button', { name: /편집/ }));
    expect(onEdit).toHaveBeenCalledWith(mine);
  });

  it('삭제 버튼 클릭 시 confirm 다이얼로그가 뜨고 즉시 onDelete 가 호출되지 않는다', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const mine = { ...base, is_mine: true };
    render(<Postit message={mine} onDelete={onDelete} now={fixedNow} />);

    await user.click(screen.getByRole('button', { name: /이 쪽지 삭제/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('이 쪽지를 떼어낼까요?')).toBeInTheDocument();
  });

  it('confirm 다이얼로그에서 "그대로 두기" 클릭 시 onDelete 가 호출되지 않고 다이얼로그가 닫힌다', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const mine = { ...base, is_mine: true };
    render(<Postit message={mine} onDelete={onDelete} now={fixedNow} />);

    await user.click(screen.getByRole('button', { name: /이 쪽지 삭제/ }));
    await user.click(screen.getByRole('button', { name: /그대로 두기/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm 다이얼로그에서 "떼어내기" 클릭 시 onDelete 가 메시지와 함께 호출된다', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const mine = { ...base, is_mine: true };
    render(<Postit message={mine} onDelete={onDelete} now={fixedNow} />);

    await user.click(screen.getByRole('button', { name: /이 쪽지 삭제/ }));
    await user.click(screen.getByRole('button', { name: /떼어내기/ }));
    expect(onDelete).toHaveBeenCalledWith(mine);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm 다이얼로그에서 Escape 키로 닫고 onDelete 가 호출되지 않는다', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const mine = { ...base, is_mine: true };
    render(<Postit message={mine} onDelete={onDelete} now={fixedNow} />);

    await user.click(screen.getByRole('button', { name: /이 쪽지 삭제/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm 다이얼로그 열릴 때 "그대로 두기" 버튼으로 초기 포커스가 이동한다', async () => {
    const user = userEvent.setup();
    const mine = { ...base, is_mine: true };
    render(<Postit message={mine} now={fixedNow} />);

    await user.click(screen.getByRole('button', { name: /이 쪽지 삭제/ }));
    // destructive 가 아닌 안전한 "그대로 두기" 가 초기 포커스 — 키보드 사용자 보호.
    expect(screen.getByRole('button', { name: /그대로 두기/ })).toHaveFocus();
  });

  it('색상 prop 별로 다른 배경 클래스를 적용한다 (PINK/MINT/LEMON/LAVENDER)', () => {
    const colors = /** @type {const} */ (['PINK', 'MINT', 'LEMON', 'LAVENDER']);
    for (const color of colors) {
      const { unmount } = render(
        <Postit message={{ ...base, id: `id-${color}`, color }} now={fixedNow} />,
      );
      const article = screen.getByRole('article');
      expect(article.className).toMatch(/bg-note-/);
      unmount();
    }
  });

  it('회전 각도 CSS 변수 --rot 가 -3deg ~ 3deg 범위 안이다', () => {
    render(<Postit message={base} now={fixedNow} />);
    const article = screen.getByRole('article');
    const rot = article.style.getPropertyValue('--rot');
    const num = Number.parseFloat(rot.replace('deg', ''));
    expect(Number.isFinite(num)).toBe(true);
    expect(num).toBeGreaterThanOrEqual(-3);
    expect(num).toBeLessThanOrEqual(3);
  });

  it('같은 ID 는 항상 같은 회전 각도 (deterministic)', () => {
    const { unmount } = render(<Postit message={base} now={fixedNow} />);
    const first = screen.getByRole('article').style.getPropertyValue('--rot');
    unmount();
    render(<Postit message={base} now={fixedNow} />);
    const second = screen.getByRole('article').style.getPropertyValue('--rot');
    expect(first).toBe(second);
  });
});
