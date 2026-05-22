import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { MePage } from './MePage.jsx';

/**
 * MePage TDD (Issue #539) — 학교 인증 통합 진입점.
 */

const renderMe = (initialEntry = '/me') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <MePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

const verifiedMe = {
  sub: 'u1',
  email: 'me@example.com',
  name: '김멘티',
  nickname: '멘티9',
  schoolEmail: 'me@knu.ac.kr',
  studentId: '20241234',
  schoolVerifiedAt: '2026-05-21T10:00:00Z',
};

const unverifiedMe = {
  sub: 'u1',
  email: 'me@example.com',
  name: '김멘티',
  nickname: '멘티9',
  schoolEmail: null,
  studentId: null,
  schoolVerifiedAt: null,
};

describe('MePage', () => {
  // CR minor: prototype 오염 막기. jsdom 은 scrollIntoView 미정의 → 한번 정의해서
  // vi.spyOn 이 자동 원복할 수 있게 한다.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  let scrollSpy;
  beforeEach(() => {
    vi.restoreAllMocks();
    scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로드 중에는 placeholder 를 보여준다', () => {
    vi.spyOn(api, 'me').mockReturnValue(new Promise(() => {})); // never resolves
    renderMe();
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  });

  it('미인증 사용자: 학교 메일 입력 폼이 보인다', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ data: { user: unverifiedMe } });
    renderMe();
    expect(await screen.findByLabelText('학교 메일 (@knu.ac.kr)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증 메일 발송' })).toBeInTheDocument();
  });

  it('인증 완료 사용자: 학번 + 학교 메일을 보여준다', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ data: { user: verifiedMe } });
    renderMe();
    expect(await screen.findByText(/학교 인증됨/)).toBeInTheDocument();
    expect(screen.getByText(/학번 20241234/)).toBeInTheDocument();
    expect(screen.getByText(/me@knu\.ac\.kr/)).toBeInTheDocument();
  });

  it('?focus=school-link 쿼리 진입 시 scrollIntoView 가 호출된다', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ data: { user: unverifiedMe } });
    renderMe('/me?focus=school-link');
    await screen.findByLabelText('학교 메일 (@knu.ac.kr)');
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled();
    });
  });

  it('?focus 없을 때 scrollIntoView 미호출', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ data: { user: unverifiedMe } });
    renderMe('/me');
    await screen.findByLabelText('학교 메일 (@knu.ac.kr)');
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('프로필 요약: 이름과 닉네임을 분리해서 표시한다 (Gemini medium)', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ data: { user: verifiedMe } });
    renderMe();
    // 이름 row 는 name (김멘티), 닉네임 row 는 nickname (멘티9) — 정보 중복 X.
    await screen.findByText('김멘티');
    expect(screen.getByText('멘티9')).toBeInTheDocument();
    // 닉네임 라벨 row 존재
    expect(screen.getByText('닉네임')).toBeInTheDocument();
  });
});
