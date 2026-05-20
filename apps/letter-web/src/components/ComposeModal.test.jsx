import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { ComposeModal } from './ComposeModal.jsx';

/**
 * ComposeModal TDD 가드 (Issue #55).
 *
 * Acceptance:
 *  1. 색 미선택 시 에러
 *  2. 빈 내용 검증
 *  3. 모달 외부 클릭 닫기
 *  4. mutation 호출 — 성공 시 onSuccess + invalidate
 *
 * createMessage 는 `api.createMessage` 를 spy 로 가로채 검증.
 */

const renderModal = ({ onClose = vi.fn(), onSuccess = vi.fn() } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ComposeModal open onClose={onClose} onSuccess={onSuccess} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onClose, onSuccess, invalidateSpy, queryClient };
};

describe('ComposeModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('open=true 면 dialog 와 색 선택 + 내용 입력 + 제출 버튼이 보인다', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /메시지 작성/ })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /포스트잇 색/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /PINK/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /MINT/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /LEMON/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /LAVENDER/i })).toBeInTheDocument();
    expect(screen.getByLabelText('내용')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /붙이기|등록/ })).toBeInTheDocument();
  });

  it('open=false 면 아무것도 렌더되지 않는다', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ComposeModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('내용 빈 채 제출 → 빈 내용 에러를 보여준다', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(api, 'createMessage');
    renderModal();

    // 색만 선택, 내용은 비어있는 채로 제출.
    await user.click(screen.getByRole('radio', { name: /PINK/i }));
    await user.click(screen.getByRole('button', { name: /붙이기|등록/ }));

    expect(await screen.findByText(/한 줄 적어주세요/)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('색 미선택으로 제출 → 색 선택 에러를 보여준다', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(api, 'createMessage');
    renderModal();

    await user.type(screen.getByLabelText('내용'), '안녕!');
    await user.click(screen.getByRole('button', { name: /붙이기|등록/ }));

    expect(await screen.findByText(/포스트잇 색을 골라주세요/)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('모달 외부(backdrop) 클릭 시 onClose 가 호출된다', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const backdrop = screen.getByTestId('compose-modal-backdrop');
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('모달 내부 클릭은 onClose 를 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape 키로 닫을 수 있다', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('정상 입력 시 createMessage 가 정확한 body 로 호출된다', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(api, 'createMessage').mockResolvedValue({
      data: { message: { id: 'm1', content: '안녕!', color: 'MINT', is_mine: true } },
    });
    renderModal();

    await user.click(screen.getByRole('radio', { name: /MINT/i }));
    await user.type(screen.getByLabelText('내용'), '안녕!');
    await user.click(screen.getByRole('button', { name: /붙이기|등록/ }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
    expect(createSpy).toHaveBeenCalledWith({ content: '안녕!', color: 'MINT' });
  });

  it('성공 시 onSuccess 호출 + 메시지 쿼리 invalidate + onClose', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createMessage').mockResolvedValue({
      data: { message: { id: 'm1', content: '안녕!', color: 'PINK', is_mine: true } },
    });
    const { onClose, onSuccess, invalidateSpy } = renderModal();

    await user.click(screen.getByRole('radio', { name: /PINK/i }));
    await user.type(screen.getByLabelText('내용'), '안녕!');
    await user.click(screen.getByRole('button', { name: /붙이기|등록/ }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['messages'] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('401 응답이면 친절한 에러 메시지', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createMessage').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });
    renderModal();

    await user.click(screen.getByRole('radio', { name: /PINK/i }));
    await user.type(screen.getByLabelText('내용'), '안녕!');
    await user.click(screen.getByRole('button', { name: /붙이기|등록/ }));

    expect(await screen.findByText(/로그인.*만료|로그인이 필요/)).toBeInTheDocument();
  });

  it('500 응답이면 친절한 서버 에러 메시지', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createMessage').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });
    renderModal();

    await user.click(screen.getByRole('radio', { name: /PINK/i }));
    await user.type(screen.getByLabelText('내용'), '안녕!');
    await user.click(screen.getByRole('button', { name: /붙이기|등록/ }));

    expect(
      await screen.findByText(/서버가 잠깐 쉬는 중|잠시 후 다시 붙여주세요/),
    ).toBeInTheDocument();
  });
});
