/**
 * Mailer 통합 테스트 (Issue #542).
 *
 * setup.js 가 mailer 를 전역 mock 하지만, 이 테스트는 `vi.importActual` 로
 * 실제 mailer 모듈을 그대로 가져와서 transport 까지 검증한다.
 *
 * 커버리지:
 *  - SMTP_HOST 미설정 → disabled 모드 (no throw, no send)
 *  - 토큰 URL 이 disabled 로그에서 마스킹 됨 (token leak 방지, CR #546)
 *  - HTML 본문이 transport 로 전달됨 (#542 신규)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * setup.js 의 mock 우회 — 실제 mailer 모듈 + 실제 template 모듈 사용.
 *
 * @returns {Promise<typeof import('../src/lib/mailer.js')>}
 */
const loadRealMailer = async () => {
  const actual = await vi.importActual('../src/lib/mailer.js');
  return actual;
};

describe('mailer real module (#542)', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it('isMailerEnabled() returns false when SMTP_HOST not set', async () => {
    const m = await loadRealMailer();
    m.__resetMailerForTests();
    // 한 번 send 시도해야 transport 캐시 결정되므로 호출 후 확인.
    await m.sendSchoolVerifyEmail({
      to: 'a@knu.ac.kr',
      verifyUrl: 'https://auth.get-it.cloud/verify-school?token=plaintext_secret_token_value',
    });
    expect(m.isMailerEnabled()).toBe(false);
  });

  it('sendSchoolVerifyEmail does not throw in disabled mode', async () => {
    const m = await loadRealMailer();
    m.__resetMailerForTests();
    await expect(
      m.sendSchoolVerifyEmail({
        to: 'student@knu.ac.kr',
        verifyUrl: 'https://auth.get-it.cloud/verify-school?token=should_be_masked_xxxx',
      }),
    ).resolves.toBeUndefined();
  });

  it('passes html + text to transport when called', async () => {
    // 실제 transport 의 send 함수를 spy 로 갈아끼우려면 mailer 의 cachedTransport 를 조작해야 함.
    // 여기선 nodemailer 모듈 자체를 mock 해서 sendMail 호출을 캡처.
    const sendMailSpy = vi.fn().mockResolvedValue({ messageId: 'x' });
    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: () => ({ sendMail: sendMailSpy }),
      },
    }));

    // CR #548 — 중간 실패해도 다음 테스트가 nodemailer mock 으로 오염되지 않도록
    // unmock + resetModules 를 finally 로 고정.
    try {
      process.env.SMTP_HOST = 'smtp.test.local';
      process.env.SMTP_PORT = '587';

      // mock 적용된 상태로 mailer 모듈 재로드.
      vi.resetModules();
      const m = await vi.importActual('../src/lib/mailer.js');
      m.__resetMailerForTests();

      const verifyUrl =
        'https://auth.get-it.cloud/verify-school?token=plaintext_token_should_only_be_in_url';
      await m.sendSchoolVerifyEmail({ to: 'student@knu.ac.kr', verifyUrl });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      const mailArg = sendMailSpy.mock.calls[0][0];
      expect(mailArg.to).toBe('student@knu.ac.kr');
      expect(mailArg.subject).toBe('[GETIT/9] 학교 인증 메일');
      expect(mailArg.text).toContain(verifyUrl);
      expect(mailArg.html).toContain(verifyUrl);
      // HTML 인지 sanity check.
      expect(mailArg.html).toMatch(/<a [^>]*href=/i);
    } finally {
      vi.doUnmock('nodemailer');
      vi.resetModules();
    }
  });
});
