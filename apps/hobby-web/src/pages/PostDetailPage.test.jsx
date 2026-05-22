import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { renderAt, samplePost } from './PostDetailPage.test-helpers.jsx';

describe('PostDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('상세 데이터를 렌더한다 — 제목/본문/정원 시각화', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ capacity: 4, currentCapacity: 2 }),
    });
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
    renderAt();

    expect(await screen.findByRole('heading', { name: /북문 마라탕/ })).toBeInTheDocument();
    expect(screen.getByText(/오늘 18시 라화방/)).toBeInTheDocument();
    // capacity 시각화: aria-label에 "n/m" 카운트가 노출.
    const meter = screen.getByTestId('capacity-meter');
    expect(meter).toHaveAttribute('aria-label', expect.stringMatching(/2 ?\/ ?4/));
    // 채워진 dot 2개, 빈 dot 2개.
    expect(meter.querySelectorAll('[data-filled="true"]').length).toBe(2);
    expect(meter.querySelectorAll('[data-filled="false"]').length).toBe(2);
  });

  it('비로그인 — openChatUrl 응답이 없으면 링크가 보이지 않는다', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost({ status: 'RECRUITING' }) });
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
    renderAt();

    await screen.findByRole('heading', { name: /북문 마라탕/ });
    expect(screen.queryByTestId('open-chat-link')).not.toBeInTheDocument();
  });

  it('FULL 상태 — 서버가 openChatUrl 을 내려주면 링크가 노출된다', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({
        status: 'FULL',
        currentCapacity: 4,
        capacity: 4,
        openChatUrl: 'https://open.kakao.com/o/sXXXXXX',
      }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'u-applicant' });
    renderAt();

    const link = await screen.findByTestId('open-chat-link');
    expect(link).toHaveAttribute('href', 'https://open.kakao.com/o/sXXXXXX');
  });

  it('방장 — RECRUITING 이어도 openChatUrl 이 응답에 포함되면 노출된다', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({
        status: 'RECRUITING',
        openChatUrl: 'https://open.kakao.com/o/oOWN',
      }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'u-owner' });
    renderAt();

    const link = await screen.findByTestId('open-chat-link');
    expect(link).toHaveAttribute('href', 'https://open.kakao.com/o/oOWN');
    // 방장에게는 "신청" 버튼이 아닌 "방장 안내" 가 노출.
    expect(screen.queryByRole('button', { name: /^신청하기$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/이 모임의 방장이야/)).toBeInTheDocument();
  });

  it('신청 클릭 → applyPost 호출 + 카운트 optimistic 증가 + 버튼이 "취소" 로 토글', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ capacity: 4, currentCapacity: 2 }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-applicant',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    const applySpy = vi.spyOn(api, 'applyPost').mockResolvedValue({
      application: {
        id: 'app-1',
        postId: 'p1',
        userId: 'u-applicant',
        createdAt: '2026-05-19T09:00:00+09:00',
      },
    });

    renderAt();

    const applyBtn = await screen.findByRole('button', { name: /^신청하기$/ });
    await user.click(applyBtn);

    await waitFor(() => expect(applySpy).toHaveBeenCalledWith('p1'));
    // optimistic — 카운트가 3/4 로 즉시 갱신.
    await waitFor(() => {
      expect(screen.getByTestId('capacity-meter')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/3 ?\/ ?4/),
      );
    });
    // 버튼이 "신청 취소" 로 바뀜.
    expect(await screen.findByRole('button', { name: /신청 취소/ })).toBeInTheDocument();
  });

  it('신청 실패 시 — 카운트 롤백 + 에러 메시지', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ capacity: 4, currentCapacity: 3 }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-applicant',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    vi.spyOn(api, 'applyPost').mockRejectedValue({
      response: { status: 422, data: { error: 'PostFull' } },
    });

    renderAt();
    await user.click(await screen.findByRole('button', { name: /^신청하기$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/정원이 마감/);
    // 롤백된 카운트.
    const meter = screen.getByTestId('capacity-meter');
    expect(meter).toHaveAttribute('aria-label', expect.stringMatching(/3 ?\/ ?4/));
  });

  it('신청 취소 — cancelApplication 호출 + 카운트 감소 + 다시 "신청" 토글', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ capacity: 4, currentCapacity: 2 }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-applicant',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    vi.spyOn(api, 'applyPost').mockResolvedValue({
      application: { id: 'app-1', postId: 'p1', userId: 'u-applicant', createdAt: '' },
    });
    const cancelSpy = vi.spyOn(api, 'cancelApplication').mockResolvedValue();

    renderAt();
    await user.click(await screen.findByRole('button', { name: /^신청하기$/ }));
    await screen.findByRole('button', { name: /신청 취소/ });
    await user.click(screen.getByRole('button', { name: /신청 취소/ }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith('app-1'));
    await waitFor(() => {
      expect(screen.getByTestId('capacity-meter')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/2 ?\/ ?4/),
      );
    });
    expect(await screen.findByRole('button', { name: /^신청하기$/ })).toBeInTheDocument();
  });

  it('reload 후에도 myApplication 응답이 있으면 "신청 취소" 버튼 노출 (#212)', async () => {
    // reload 시뮬레이션: 처음부터 GET /api/posts/:id 응답에 myApplication 포함.
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({
        capacity: 4,
        currentCapacity: 3,
        // @ts-expect-error 응답 shape 확장
        myApplication: { id: 'app-existing', createdAt: '2026-05-19T08:00:00.000Z' },
      }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'u-applicant' });
    renderAt();
    expect(await screen.findByRole('button', { name: /신청 취소/ })).toBeInTheDocument();
  });

  it('#310 — me query 로딩 동안엔 신청 버튼 대신 placeholder 가 노출된다', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({ post: samplePost({ status: 'RECRUITING' }) });
    // me 는 영원히 pending 상태로 둠 — race 시뮬레이션
    vi.spyOn(api, 'getMe').mockImplementation(() => new Promise(() => {}));
    renderAt();

    await screen.findByRole('heading', { name: /북문 마라탕/ });
    expect(screen.getByTestId('apply-section-placeholder')).toBeInTheDocument();
    // 신청 버튼 자체가 렌더되지 않아야 함 (깜빡임 방지)
    expect(screen.queryByRole('button', { name: /^신청하기$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /로그인하고 신청하기/ })).not.toBeInTheDocument();
  });

  it('#310 — CLOSED 게시글은 신청 영역이 "모집 종료" 안내로 대체된다', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ status: 'CLOSED', currentCapacity: 2 }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'u-applicant' });
    renderAt();

    expect(await screen.findByTestId('apply-section-closed')).toHaveTextContent(/모집 종료/);
    expect(screen.queryByRole('button', { name: /^신청하기$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /정원 마감/ })).not.toBeInTheDocument();
  });

  it('#310 — FULL 게시글은 신청 버튼이 "정원 마감" disabled 상태', async () => {
    vi.spyOn(api, 'getPost').mockResolvedValue({
      post: samplePost({ status: 'FULL', currentCapacity: 4, capacity: 4 }),
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-applicant',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    renderAt();

    const fullBtn = await screen.findByRole('button', { name: /정원 마감/ });
    expect(fullBtn).toBeDisabled();
    // CLOSED placeholder 는 안 나옴
    expect(screen.queryByTestId('apply-section-closed')).not.toBeInTheDocument();
  });

  it('404 — 게시글이 없으면 안내 메시지', async () => {
    vi.spyOn(api, 'getPost').mockRejectedValue({ response: { status: 404 } });
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
    renderAt('missing');

    expect(await screen.findByRole('alert')).toHaveTextContent(/모임을 찾을 수 없/);
  });

  // #500/#506 — 정책별 신청자 상태 분기.
  describe('APPROVAL 정책 상태 분기 (#500)', () => {
    it('PENDING — 방장 승인 대기 안내 + 신청 취소 버튼', async () => {
      vi.spyOn(api, 'getPost').mockResolvedValue({
        post: samplePost({
          applicationPolicy: 'APPROVAL',
          myApplication: {
            id: 'app-1',
            status: 'PENDING',
            createdAt: '2026-05-19T08:00:00+09:00',
          },
        }),
      });
      vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'u-applicant' });
      renderAt();
      expect(await screen.findByTestId('apply-section-pending')).toBeInTheDocument();
      expect(screen.getByText(/방장 승인 대기 중/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /신청 취소/ })).toBeInTheDocument();
    });

    it('REJECTED — 거절 안내 + 신청 버튼 X', async () => {
      vi.spyOn(api, 'getPost').mockResolvedValue({
        post: samplePost({
          applicationPolicy: 'APPROVAL',
          myApplication: {
            id: 'app-1',
            status: 'REJECTED',
            createdAt: '2026-05-19T08:00:00+09:00',
          },
        }),
      });
      vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'u-applicant' });
      renderAt();
      expect(await screen.findByTestId('apply-section-rejected')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /신청하기/ })).not.toBeInTheDocument();
    });

    it('APPROVAL 정책 + 미신청 — 신청 버튼 라벨 "승인 요청"', async () => {
      vi.spyOn(api, 'getPost').mockResolvedValue({
        post: samplePost({ applicationPolicy: 'APPROVAL' }),
      });
      vi.spyOn(api, 'getMe').mockResolvedValue({
        id: 'u-applicant',
        schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      });
      renderAt();
      const btn = await screen.findByRole('button', { name: /승인 요청/ });
      expect(btn).toBeInTheDocument();
    });

    // #541 학교 인증 가드 분기 테스트는 PostDetailPage.school.test.jsx 로 분리.
  });
});
