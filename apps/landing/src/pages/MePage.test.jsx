import { ThemeProvider } from '@getit/theme';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MePage } from './MePage.jsx';

/**
 * school-auth #547 — landing `/me` 마이페이지.
 *
 *  - 비로그인: shelf RequireSignIn 패턴 (로그인 CTA → auth-web /login?redirect=).
 *  - 로그인 + nickname null: "닉네임을 설정해주세요" + onboarding 진입 카드 (landing은 강제 redirect X — PRD).
 *  - 로그인 + 학교 인증됨: "학교 인증 완료" + 학번 노출.
 *  - 로그인 + 미인증: "학교 미인증" + "학교 인증하기" 버튼 (→ auth-web /me?focus=school-link).
 *  - 가입 일자: createdAt 을 YYYY-MM-DD 한국어 포맷 표시.
 */

const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';

const mockFetchMe = (status, body) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
};

const renderMe = () =>
  render(
    <ThemeProvider>
      <MePage />
    </ThemeProvider>,
  );

describe('MePage 비로그인', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('401 이면 "로그인이 필요해요" + "로그인하러 가기" CTA 가 노출된다', async () => {
    mockFetchMe(401, { error: 'Unauthorized' });
    renderMe();
    await screen.findByText(/로그인이 필요해요/);
    const cta = screen.getByRole('link', { name: /로그인하러 가기/ });
    expect(cta).toBeInTheDocument();
    // redirect= 쿼리에 현재 페이지 (=/me) 가 포함되어 auth 인증 후 돌아온다.
    expect(cta).toHaveAttribute('href', expect.stringContaining(`${AUTH_ORIGIN}/login`));
    expect(cta).toHaveAttribute('href', expect.stringContaining('redirect='));
  });

  it('5xx 등 fail-soft 케이스에서도 비로그인 카드를 노출한다', async () => {
    mockFetchMe(503, { error: 'BackendDown' });
    renderMe();
    await screen.findByText(/로그인이 필요해요/);
  });
});

describe('MePage 로그인 + nickname null (onboarding 카드)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('nickname 이 null 이면 "닉네임을 설정해주세요" + onboarding 진입 카드 표시', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        email: 'a@b.com',
        name: '홍길동',
        nickname: null,
        schoolVerifiedAt: null,
        studentId: null,
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    await screen.findByText(/닉네임을 설정해주세요/);
    const cta = screen.getByRole('link', { name: /닉네임 설정하기/ });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute(
      'href',
      expect.stringContaining(`${AUTH_ORIGIN}/onboarding/nickname`),
    );
    // landing 도메인으로 돌아오는 redirect 쿼리. Gemini (#551): origin 동적 사용 →
    // 테스트는 jsdom 의 location.origin (http://localhost) 를 받는다.
    expect(cta).toHaveAttribute('href', expect.stringContaining('redirect='));
    const decoded = decodeURIComponent(cta.getAttribute('href') ?? '');
    expect(decoded).toContain(`${window.location.origin}/me`);
  });

  it('nickname 이 빈 문자열이어도 onboarding 카드를 노출한다 (정규화)', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        nickname: '   ',
        schoolVerifiedAt: null,
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    await screen.findByText(/닉네임을 설정해주세요/);
  });
});

describe('MePage 로그인 + 닉네임 있음', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('닉네임을 본문 카드에서 표시한다', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        email: 'a@b.com',
        name: '홍길동',
        nickname: '길동이',
        schoolVerifiedAt: null,
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    // Header + MeContent 양쪽에 닉네임이 보이므로 findAllByText 로 잡고 본문 노드를
    // 확인 (`me-nickname-title`).
    await screen.findByText(/2026-05-01/);
    const nicknameHeading = screen.getByRole('heading', { level: 2 });
    expect(nicknameHeading).toHaveAttribute('id', 'me-nickname-title');
    expect(nicknameHeading.textContent).toContain('길동이');
    // onboarding 카드는 노출되지 않는다.
    expect(screen.queryByText(/닉네임을 설정해주세요/)).toBeNull();
  });

  it('가입 일자 createdAt 을 YYYY-MM-DD 한국어 포맷으로 표시한다', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        nickname: '길동이',
        schoolVerifiedAt: null,
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    await screen.findByText(/2026-05-01/);
  });

  it('createdAt 이 invalid 면 "—" 로 표시한다 (graceful fallback)', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        nickname: '길동이',
        schoolVerifiedAt: null,
        createdAt: 'not-a-date',
      },
    });
    renderMe();
    // me-school-status 노출 = 본문 렌더 완료. 그 후 joined-at 검사.
    await screen.findByTestId('me-school-status');
    const joined = screen.getByTestId('me-joined-at');
    expect(joined.textContent).toContain('—');
  });
});

describe('MePage 학교 인증 상태', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('인증됨이면 "학교 인증 완료" + 학번 10자리를 노출한다', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        nickname: '길동이',
        schoolVerifiedAt: '2026-05-21T10:00:00Z',
        studentId: '2024111234',
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    const status = await screen.findByTestId('me-school-status');
    expect(status.textContent).toContain('학교 인증 완료');
    expect(status.textContent).toContain('2024111234');
    // 인증된 사용자는 "학교 인증하기" 버튼이 보이지 않는다.
    expect(screen.queryByRole('link', { name: /학교 인증하기/ })).toBeNull();
  });

  it('미인증이면 "학교 미인증" + "학교 인증하기" 버튼 노출', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        nickname: '길동이',
        schoolVerifiedAt: null,
        studentId: null,
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    const status = await screen.findByTestId('me-school-status');
    expect(status.textContent).toContain('학교 미인증');
    const verifyCta = screen.getByRole('link', { name: /학교 인증하기/ });
    expect(verifyCta).toHaveAttribute('href', `${AUTH_ORIGIN}/me?focus=school-link`);
  });

  it('인증됨 + studentId 가 빈 문자열이면 학번이 em dash 로 폴백 (CR Minor #551)', async () => {
    mockFetchMe(200, {
      user: {
        sub: 'u1',
        nickname: '길동이',
        schoolVerifiedAt: '2026-05-21T10:00:00Z',
        studentId: '   ', // 공백 — useSession 정규화를 우회한 케이스 가드.
        createdAt: '2026-05-01T09:00:00Z',
      },
    });
    renderMe();
    const status = await screen.findByTestId('me-school-status');
    expect(status.textContent).toContain('학교 인증 완료');
    expect(status.textContent).toContain('—');
  });
});

describe('MePage 로딩 상태', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('useSession 로딩 중에는 비로그인/로그인 어느 쪽도 단정하지 않는다', async () => {
    // pending — resolve 안 함
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderMe();
    // 로딩 placeholder 가 노출되고, 단정형 카드는 둘 다 미렌더.
    expect(screen.getByTestId('me-loading')).toBeInTheDocument();
    expect(screen.queryByText(/로그인이 필요해요/)).toBeNull();
    expect(screen.queryByTestId('me-school-status')).toBeNull();
    // waitFor 강제 사용해 microtask flush.
    await waitFor(() => expect(screen.getByTestId('me-loading')).toBeInTheDocument());
  });
});

describe('MePage 헤더 통합 — 페이지 자체에 헤더/푸터 포함', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('상단 헤더(GETIT 9기 홈)와 본문 마이페이지 헤딩이 함께 렌더된다', async () => {
    mockFetchMe(401, { error: 'Unauthorized' });
    renderMe();
    expect(screen.getByLabelText('GETIT 9기 홈')).toBeInTheDocument();
    const main = await screen.findByRole('main');
    expect(within(main).getByRole('heading', { name: /마이페이지/ })).toBeInTheDocument();
  });
});
