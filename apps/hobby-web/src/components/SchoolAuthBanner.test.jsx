/**
 * SchoolAuthBanner 단위 테스트 (#541).
 *
 * - PRD 카피 strict 렌더 확인
 * - 학교 인증 URL 확인
 * - dismiss 콜백 — 옵션
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SchoolAuthBanner } from './SchoolAuthBanner.jsx';

describe('SchoolAuthBanner (#541)', () => {
  it('PRD 카피 렌더 — 제목 / 보조 / CTA', () => {
    render(<SchoolAuthBanner />);
    expect(screen.getByText('hobby 서비스를 사용하려면 학교 인증이 필요해요')).toBeInTheDocument();
    expect(
      screen.getByText(/모집글 작성 \/ 신청은 학교 인증한 부원만 가능해요/),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /학교 인증하러 가기/ });
    expect(cta).toHaveAttribute('href', 'https://auth.get-it.cloud/me?focus=school-link');
  });

  it('role=status — 스크린 리더 친화', () => {
    render(<SchoolAuthBanner />);
    expect(screen.getByTestId('school-auth-banner')).toHaveAttribute('role', 'status');
  });

  it('onDismiss 가 주어지면 닫기 버튼 노출 + 클릭 시 콜백 호출', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<SchoolAuthBanner onDismiss={onDismiss} />);
    const closeBtn = screen.getByRole('button', { name: '안내 닫기' });
    await user.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('onDismiss 없으면 닫기 버튼 안 보임', () => {
    render(<SchoolAuthBanner />);
    expect(screen.queryByRole('button', { name: '안내 닫기' })).not.toBeInTheDocument();
  });
});
