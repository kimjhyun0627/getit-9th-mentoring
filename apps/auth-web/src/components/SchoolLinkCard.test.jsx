import { ThemeProvider } from '@getit/theme';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { SchoolLinkCard } from './SchoolLinkCard.jsx';

/**
 * SchoolLinkCard TDD (Issue #539) — 4 상태 + 에러 핸들링 검증.
 */

const wrap = (ui) => <ThemeProvider>{ui}</ThemeProvider>;

const unverifiedUser = {
  schoolEmail: null,
  studentId: null,
  schoolVerifiedAt: null,
};

const verifiedUser = {
  schoolEmail: 'foo@knu.ac.kr',
  studentId: '20241234',
  schoolVerifiedAt: '2026-05-21T10:00:00Z',
};

describe('SchoolLinkCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('미인증 상태: 학교 메일 입력 폼과 발송 버튼을 보여준다', () => {
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    expect(screen.getByLabelText('학교 메일 (@knu.ac.kr)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증 메일 발송' })).toBeInTheDocument();
  });

  it('인증 완료 상태: 학교 메일 + 학번 + 다시 인증하기 버튼을 보여준다', () => {
    render(wrap(<SchoolLinkCard user={verifiedUser} />));
    expect(screen.getByText(/학교 인증됨/)).toBeInTheDocument();
    expect(screen.getByText(/학번 20241234/)).toBeInTheDocument();
    expect(screen.getByText(/foo@knu\.ac\.kr/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /학교 인증 다시 받기/ })).toBeInTheDocument();
  });

  it('다시 인증하기 버튼을 누르면 폼으로 돌아간다', async () => {
    const user = userEvent.setup();
    render(wrap(<SchoolLinkCard user={verifiedUser} />));
    await user.click(screen.getByRole('button', { name: /학교 인증 다시 받기/ }));
    expect(screen.getByLabelText('학교 메일 (@knu.ac.kr)')).toBeInTheDocument();
  });

  it('정상 발송 시 api.schoolLink 호출 + "메일을 보냈어요" 안내로 전환', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'schoolLink').mockResolvedValue({
      data: { ok: true, sent: true, email: 'fo***@knu.ac.kr' },
    });
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    await user.type(screen.getByLabelText('학교 메일 (@knu.ac.kr)'), 'foo@knu.ac.kr');
    await user.click(screen.getByRole('button', { name: '인증 메일 발송' }));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ email: 'foo@knu.ac.kr' });
    });
    expect(await screen.findByText(/메일을 보냈어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증 메일 재발송' })).toBeInTheDocument();
  });

  it('재발송 누르면 api.schoolLinkResend 호출', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'schoolLink').mockResolvedValue({
      data: { ok: true, sent: true },
    });
    const resendSpy = vi.spyOn(api, 'schoolLinkResend').mockResolvedValue({
      data: { ok: true, sent: true },
    });
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    await user.type(screen.getByLabelText('학교 메일 (@knu.ac.kr)'), 'foo@knu.ac.kr');
    await user.click(screen.getByRole('button', { name: '인증 메일 발송' }));
    await screen.findByText(/메일을 보냈어요/);
    await user.click(screen.getByRole('button', { name: '인증 메일 재발송' }));
    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith({ email: 'foo@knu.ac.kr' });
    });
  });

  it('400 InvalidSchoolEmail 응답이면 인라인 에러를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'schoolLink').mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: 'InvalidSchoolEmail' } },
    });
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    // Zod 검증을 우회하기 위해 BE 응답 시뮬 — Zod 가 먼저 차단하므로 실제 도메인 통과시킨다
    // (BE 가 다시 검증해서 InvalidSchoolEmail 반환하는 케이스를 단위 테스트).
    // Workaround: 정상 도메인 메일 입력 후 mock 에러로 BE 응답을 강제.
    await user.type(screen.getByLabelText('학교 메일 (@knu.ac.kr)'), 'foo@knu.ac.kr');
    await user.click(screen.getByRole('button', { name: '인증 메일 발송' }));
    expect(
      await screen.findByText('경북대 메일(@knu.ac.kr)만 사용할 수 있어요'),
    ).toBeInTheDocument();
  });

  it('409 SchoolEmailTaken 응답이면 인라인 에러를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'schoolLink').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: 'SchoolEmailTaken' } },
    });
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    await user.type(screen.getByLabelText('학교 메일 (@knu.ac.kr)'), 'foo@knu.ac.kr');
    await user.click(screen.getByRole('button', { name: '인증 메일 발송' }));
    expect(await screen.findByText(/다른 계정이 이미 인증한 메일/)).toBeInTheDocument();
  });

  it('429 RateLimitExceeded 응답이면 안내 메시지를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'schoolLink').mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { error: 'RateLimitExceeded' } },
    });
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    await user.type(screen.getByLabelText('학교 메일 (@knu.ac.kr)'), 'foo@knu.ac.kr');
    await user.click(screen.getByRole('button', { name: '인증 메일 발송' }));
    expect(await screen.findByText(/너무 자주 요청했어요/)).toBeInTheDocument();
  });

  it('focus=true 면 scrollIntoView 호출 + highlight 클래스 적용', async () => {
    const scrollSpy = vi.fn();
    // jsdom 은 scrollIntoView 미구현 — 명시적 prototype mock.
    Element.prototype.scrollIntoView = scrollSpy;
    render(wrap(<SchoolLinkCard user={unverifiedUser} focus />));
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled();
    });
    // highlight 적용 — data-focus attribute 로 verify.
    const section = screen.getByLabelText('학교 메일 인증 폼').closest('section');
    expect(section).toHaveAttribute('data-focus', 'true');
  });

  it('focus 가 false 면 scrollIntoView 미호출', () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(wrap(<SchoolLinkCard user={unverifiedUser} focus={false} />));
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('Zod 검증: @knu.ac.kr 아닌 도메인은 폼 인라인 에러로 차단 (BE 호출 X)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'schoolLink');
    render(wrap(<SchoolLinkCard user={unverifiedUser} />));
    await user.type(screen.getByLabelText('학교 메일 (@knu.ac.kr)'), 'foo@gmail.com');
    await user.click(screen.getByRole('button', { name: '인증 메일 발송' }));
    // Zod 메시지는 "...만 사용할 수 있습니다" 로 끝남 — 헤더 카피와 구분.
    expect(
      await screen.findByText('경북대 메일(@knu.ac.kr)만 사용할 수 있습니다'),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
