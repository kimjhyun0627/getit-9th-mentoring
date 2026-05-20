import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState.jsx';

/**
 * EmptyState 단위 테스트 — title/description/action 조합 검증.
 */
describe('EmptyState', () => {
  it('title 과 description 을 렌더한다 (action 없음)', () => {
    render(<EmptyState title="비어있어요" description="아직 아무 것도 없어." />);
    expect(screen.getByText('비어있어요')).toBeInTheDocument();
    expect(screen.getByText('아직 아무 것도 없어.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('action prop 을 받으면 CTA 를 함께 렌더한다', () => {
    render(
      <EmptyState
        title="비어있어요"
        description="첫 항목을 만들어봐."
        action={
          <button type="button" data-testid="cta">
            만들기
          </button>
        }
      />,
    );
    expect(screen.getByText('비어있어요')).toBeInTheDocument();
    expect(screen.getByTestId('cta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '만들기' })).toBeInTheDocument();
  });

  it('action 이 null/undefined 이면 CTA 영역을 그리지 않는다', () => {
    const { rerender } = render(<EmptyState title="t" description="d" action={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<EmptyState title="t" description="d" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
