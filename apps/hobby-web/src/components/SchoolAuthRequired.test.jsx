/**
 * SchoolAuthRequired 단위 테스트 (#562).
 *
 * - PRD 카피 strict 렌더 확인
 * - 학교 인증 URL 확인
 * - 가드 진입 자체 차단 안내 화면이라 dismiss 없음 (배너와 차이)
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SchoolAuthRequired } from './SchoolAuthRequired.jsx';

describe('SchoolAuthRequired (#562)', () => {
  it('PRD 카피 렌더 — 제목 / 보조 / CTA', () => {
    render(<SchoolAuthRequired />);
    expect(screen.getByText('hobby 서비스는 학교 인증 후 이용할 수 있어요')).toBeInTheDocument();
    expect(
      screen.getByText(/학교 메일\(@knu\.ac\.kr\) 한 통이면 끝나요\. 인증하고 다시 와줘!/),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /학교 인증하러 가기/ });
    expect(cta).toHaveAttribute('href', 'https://auth.get-it.cloud/me?focus=school-link');
  });

  it('진입 자체 차단 안내 화면이라 dismiss 버튼 없음 (배너와 차이)', () => {
    render(<SchoolAuthRequired />);
    expect(screen.queryByRole('button', { name: /닫기/ })).not.toBeInTheDocument();
  });

  it('testid 노출 — 가드 통합 테스트 셀렉터', () => {
    render(<SchoolAuthRequired />);
    expect(screen.getByTestId('school-auth-required')).toBeInTheDocument();
  });
});
