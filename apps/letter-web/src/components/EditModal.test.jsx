import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { EditModal } from './EditModal.jsx';

/**
 * EditModal TDD 가드 (#249 + #487).
 *
 * 핵심:
 *  - initial value (color/content) 로 폼 채워짐
 *  - 변경 없으면 no-op
 *  - #487 — 변경된 필드만 mini-diff PATCH
 */

const renderEdit = ({
  message = { id: 'msg1', content: '원본', color: 'PINK' },
  onClose = vi.fn(),
  onSuccess = vi.fn(),
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <EditModal open message={message} onClose={onClose} onSuccess={onSuccess} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onClose, onSuccess, queryClient, message };
};

describe('EditModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('open + message 면 dialog 가 보이고 initial 값으로 채워진다', () => {
    renderEdit();
    expect(screen.getByRole('dialog', { name: /메시지 수정/ })).toBeInTheDocument();
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByLabelText('내용')).value).toBe('원본');
  });

  // #487 — 변경 없이 제출하면 PATCH 호출 X (no-op).
  it('변경 없이 "고치기" 클릭 → updateMessage 호출 X', async () => {
    const user = userEvent.setup();
    const patchSpy = vi.spyOn(api, 'updateMessage');
    const { onClose } = renderEdit();
    await user.click(screen.getByRole('button', { name: /고치기/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patchSpy).not.toHaveBeenCalled();
  });

  // #487 — content 만 바꿨으면 patch body 에 content 만 (color 누락).
  it('content 만 바꾸면 mini-diff PATCH (content 만 전달) (#487)', async () => {
    const user = userEvent.setup();
    const patchSpy = vi.spyOn(api, 'updateMessage').mockResolvedValue({
      data: { message: { id: 'msg1', content: '다듬음', color: 'PINK', is_mine: true } },
    });
    renderEdit();
    const ta = screen.getByLabelText('내용');
    await user.clear(ta);
    await user.type(ta, '다듬음');
    await user.click(screen.getByRole('button', { name: /고치기/ }));

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    const [id, body] = patchSpy.mock.calls[0];
    expect(id).toBe('msg1');
    expect(body).toEqual({ content: '다듬음' });
    expect(body.color).toBeUndefined();
  });

  // #487 — color 만 바꿨으면 patch body 에 color 만.
  it('color 만 바꾸면 mini-diff PATCH (color 만 전달) (#487)', async () => {
    const user = userEvent.setup();
    const patchSpy = vi.spyOn(api, 'updateMessage').mockResolvedValue({
      data: { message: { id: 'msg1', content: '원본', color: 'MINT', is_mine: true } },
    });
    renderEdit();
    await user.click(screen.getByRole('radio', { name: /MINT/i }));
    await user.click(screen.getByRole('button', { name: /고치기/ }));

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    const [, body] = patchSpy.mock.calls[0];
    expect(body).toEqual({ color: 'MINT' });
    expect(body.content).toBeUndefined();
  });
});
