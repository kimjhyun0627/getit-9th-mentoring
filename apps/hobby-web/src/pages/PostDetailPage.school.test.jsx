/**
 * PostDetailPage 학교 인증 가드 분기 테스트 (#541).
 *
 * 본체 PostDetailPage.test.jsx 가 300줄 cap 을 넘기지 않도록 분리 (CR review #549).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { renderAt, samplePost } from './PostDetailPage.test-helpers.jsx';

// render 는 helper 에서 import — 안 쓰지만 vitest 가 export 검증을 안 하므로 OK.
void render;

describe('PostDetailPage — 학교 인증 가드 분기 (#541)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('학교 미인증 사용자 — 신청 버튼 disabled + 학교 인증 링크', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-applicant',
      email: 'a@get-it.cloud',
      name: 'A',
      schoolVerifiedAt: null,
    });
    renderAt();
    const lockedBtn = await screen.findByTestId('apply-button-school-locked');
    expect(lockedBtn).toBeDisabled();
    expect(lockedBtn).toHaveAttribute('title', '학교 인증한 부원만 가능');
    expect(screen.queryByRole('button', { name: /신청하기/ })).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /학교 인증하러 가기/ });
    expect(link).toHaveAttribute('href', 'https://auth.get-it.cloud/me?focus=school-link');
  });

  it('학교 인증 완료 사용자 — 신청 버튼 정상 노출 (회귀)', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost() });
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-applicant',
      email: 'a@get-it.cloud',
      name: 'A',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    renderAt();
    const btn = await screen.findByRole('button', { name: /신청하기/ });
    expect(btn).toBeInTheDocument();
    expect(screen.queryByTestId('apply-button-school-locked')).not.toBeInTheDocument();
  });
});
