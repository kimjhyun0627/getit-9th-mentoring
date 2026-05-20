import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditShelfModal } from './EditShelfModal.jsx';

const sampleShelf = {
  id: 'shelf-1',
  bookId: 'book-1',
  status: 'READING',
  rating: 3,
  review: '여름의 첫 문장',
  addedAt: '2026-05-01T00:00:00.000Z',
  completedAt: null,
  book: {
    id: 'book-1',
    isbn: '9788932917245',
    title: '시간의 풍경',
    author: '한정원',
    coverUrl: null,
  },
};

describe('EditShelfModal', () => {
  it('open=false면 렌더하지 않는다', () => {
    const { container } = render(
      <EditShelfModal
        open={false}
        shelf={sampleShelf}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true 면 dialog + 책 정보를 렌더한다', () => {
    render(
      <EditShelfModal
        open
        shelf={sampleShelf}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('시간의 풍경');
  });

  it('저장 → onSave에 status/rating/review 전달', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EditShelfModal
        open
        shelf={sampleShelf}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />,
    );

    // status: READING → READ
    const readRadio = screen.getByLabelText('읽은 책');
    await user.click(readRadio);

    // rating: 3 → 5
    await user.click(screen.getByRole('radio', { name: '별점 5점' }));

    // 감상평 다시 입력
    const textarea = screen.getByLabelText(/한 줄 감상/);
    await user.clear(textarea);
    await user.type(textarea, '오랫동안 머문 책');

    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        status: 'READ',
        rating: 5,
        review: '오랫동안 머문 책',
      });
    });
  });

  it('서재에서 제거 → 확인 → onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <EditShelfModal
        open
        shelf={sampleShelf}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: '서재에서 제거' }));
    await user.click(screen.getByRole('button', { name: '정말 제거하기' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('Esc 키 → onClose', async () => {
    const onClose = vi.fn();
    render(
      <EditShelfModal
        open
        shelf={sampleShelf}
        onClose={onClose}
        onSave={() => {}}
        onDelete={() => {}}
      />,
    );
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('빈 감상평 저장 시 review=null', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EditShelfModal
        open
        shelf={{ ...sampleShelf, review: '' }}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ review: null }));
    });
  });
});
