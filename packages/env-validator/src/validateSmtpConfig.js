/**
 * SMTP 설정 fail-fast 검증 (Issue #575).
 *
 * \`apps/auth-api/src/lib/mailer.js\` 는 \`SMTP_HOST\` 미설정 시 disabled transport
 * 로 fallback 한다 — 호출자에 throw 하지 않는다. 결과적으로 운영에서 SMTP 빠뜨려도
 * 비밀번호 재설정/학교 인증 API 는 200 응답을 내고 메일은 콘솔에만 찍힌다.
 *
 * 본 validator 는 boot 시점에서 SMTP_HOST 미설정을 production 에서 throw 로 잡는다.
 * 단 \`MAILER_DISABLED_ALLOWED=true\` 를 명시적으로 박으면 warn 으로 격하 — 운영자가
 * 의도적으로 메일 채널을 끄는 경우 (예: 외부 SMTP 일시 장애 우회) 안전망.
 *
 * 비밀값 (\`SMTP_PASS\`) 은 절대 메시지/로그에 노출하지 않는다.
 */

/**
 * 의미 있는 값인지 (빈 문자열/공백 제외).
 *
 * @param {string | undefined | null} v
 * @returns {boolean}
 */
const hasValue = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * SMTP 설정 검증.
 *
 * - \`host\` 미설정 + production + \`mailerDisabledAllowed=false\` → throw.
 * - \`host\` 미설정 + production + \`mailerDisabledAllowed=true\` → warn.
 * - \`host\` 미설정 + dev/test → warn (로컬 dev 친화).
 * - \`user\` 단독 설정 / \`pass\` 단독 설정 → warn (한 쪽만 설정한 운영 실수 표시).
 *
 * @param {{ host?: string | undefined | null, user?: string | undefined | null, pass?: string | undefined | null }} smtp
 * @param {{ env?: string | undefined, mailerDisabledAllowed?: boolean }} [opts]
 * @returns {string[]} warnings — non-throw 케이스에서만 채워짐.
 * @throws {Error} production + SMTP_HOST 미설정 + \`MAILER_DISABLED_ALLOWED\` 미옵션.
 */
export const validateSmtpConfig = (smtp, opts = {}) => {
  const isProd = opts.env === 'production';
  const allowDisabled = opts.mailerDisabledAllowed === true;
  /** @type {string[]} */
  const warnings = [];

  const hostSet = hasValue(smtp?.host);
  const userSet = hasValue(smtp?.user);
  const passSet = hasValue(smtp?.pass);

  if (!hostSet) {
    const msg =
      'SMTP_HOST is not set — mailer will run in disabled mode (password reset / ' +
      'school verify emails will NOT be delivered).';
    if (isProd && !allowDisabled) {
      throw new Error(
        `${msg} Set SMTP_HOST in .env.prod, or set MAILER_DISABLED_ALLOWED=true to opt out.`,
      );
    }
    warnings.push(msg);
    // host 가 없으면 user/pass 단독 검사는 무의미.
    return warnings;
  }

  // host 설정됐는데 user/pass 한 쪽만 있는 경우 운영 실수 가능성이 높다.
  if (userSet !== passSet) {
    warnings.push(
      'SMTP_USER and SMTP_PASS must both be set or both be empty (one without the other ' +
        'is almost always a misconfiguration).',
    );
  }

  return warnings;
};
