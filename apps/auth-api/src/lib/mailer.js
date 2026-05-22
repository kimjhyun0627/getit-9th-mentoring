/**
 * Mailer — 비밀번호 재설정/이메일 인증 메일 발송 (Issue #338, #226).
 *
 * 정책:
 *  - SMTP_HOST 미설정 → "disabled" 모드. 메일은 console.log 로 흘리고 큐에만 저장.
 *  - SMTP_HOST 설정 → nodemailer + STARTTLS 로 발송 (운영). 모듈 lazy import 로
 *    nodemailer 가 미설치되어 있어도 부팅이 깨지지 않는다 (warn 로그 + disabled fallback).
 *  - 실제 운영 SMTP 채널 (Postmark/SES) 연결은 별도 phase. 본 phase 는 STARTTLS stub.
 *
 * 모든 발송은 fire-and-forget — 호출자는 await 하지만 에러는 swallow 해서
 * "메일 발송 실패 = 가입/리셋 실패" 가 되지 않도록 한다 (보안/enumeration 측면에서도
 * 응답 형태가 변하지 않아야 함).
 */
import pino from 'pino';

const log = pino({ name: 'auth-mailer' });

/**
 * 모듈 전역 nodemailer transport 캐시. null 이면 아직 시도 안 함.
 *
 * @type {{ ready: boolean, send: (m: Mail) => Promise<void> } | null}
 */
let cachedTransport = null;

/**
 * @typedef {object} Mail
 * @property {string} to
 * @property {string} subject
 * @property {string} text
 * @property {string} [html]
 * @property {Record<string,string>} [headers]
 */

/**
 * 메일 발송이 활성화돼 있는지 (운영 SMTP 채널 연결 여부).
 *
 * `SMTP_HOST` 가 설정되고 nodemailer 가 성공적으로 로드되면 true.
 *
 * @returns {boolean}
 */
export const isMailerEnabled = () =>
  Boolean(process.env.SMTP_HOST) && cachedTransport?.ready === true;

/**
 * 테스트용 — transport 캐시 초기화.
 *
 * @internal
 */
export const __resetMailerForTests = () => {
  cachedTransport = null;
};

/**
 * SMTP transport 를 lazy 로 준비. SMTP_HOST 미설정/nodemailer 미설치 시
 * disabled transport (콘솔 + 큐 stub) 를 캐시한다.
 *
 * @returns {Promise<{ ready: boolean, send: (m: Mail) => Promise<void> }>}
 */
const getTransport = async () => {
  if (cachedTransport) return cachedTransport;
  if (!process.env.SMTP_HOST) {
    cachedTransport = disabledTransport('SMTP_HOST not set');
    return cachedTransport;
  }
  try {
    const nodemailer = await import('nodemailer');
    const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // STARTTLS: 587 → secure:false + requireTLS:true. 465 → secure:true.
      secure: port === 465,
      requireTLS: port !== 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      tls: { minVersion: 'TLSv1.2' },
    });
    cachedTransport = {
      ready: true,
      send: async (m) => {
        await transporter.sendMail({
          from: process.env.SMTP_FROM ?? 'GETIT/9 <noreply@get-it.cloud>',
          to: m.to,
          subject: m.subject,
          text: m.text,
          html: m.html,
          headers: m.headers,
        });
      },
    };
    log.info({ host: process.env.SMTP_HOST, port }, 'mailer transport ready (STARTTLS)');
    return cachedTransport;
  } catch (err) {
    log.warn({ err: String(err) }, 'nodemailer init failed — falling back to disabled mode');
    cachedTransport = disabledTransport('nodemailer not installed or failed to init');
    return cachedTransport;
  }
};

/**
 * 메일 본문에서 verify/reset 토큰을 마스킹한다.
 * - `?token=<...>` / `&token=<...>` 쿼리값 → `****` 로 치환.
 * - URL path 의 마지막 segment 가 hex 토큰처럼 보이면 → `****`.
 * disabled transport 로그에 raw 토큰이 흘러나가는 사고 방지 (CR #546).
 *
 * @param {string} body
 * @returns {string}
 */
const redactTokenInBody = (body) => {
  if (typeof body !== 'string') return body;
  return body
    .replace(/([?&](?:token|t|verifyToken|resetToken)=)[^\s&]+/gi, '$1****')
    .replace(/\/(verify|reset)[^?\s]*\/[A-Za-z0-9_-]{16,}/g, '/$1.../****');
};

/**
 * Disabled transport — 본문은 마스킹해서 로그에 남긴다 (token leak 방지).
 *
 * @param {string} reason
 * @returns {{ ready: false, send: (m: Mail) => Promise<void> }}
 */
const disabledTransport = (reason) => ({
  ready: false,
  send: async (m) => {
    log.warn(
      { reason, to: m.to, subject: m.subject, body: redactTokenInBody(m.text) },
      '[mailer DISABLED] would send',
    );
  },
});

/**
 * 비밀번호 재설정 메일 발송 (Issue #338).
 *
 * 운영 SMTP 미설정 시 disabled 모드로 동작 — 에러 안 던지고 콘솔만.
 *
 * @param {{ to: string, resetUrl: string }} args
 * @returns {Promise<void>}
 */
export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  try {
    const t = await getTransport();
    await t.send({
      to,
      subject: '[GETIT/9] 비밀번호 재설정 안내',
      text: [
        '안녕하세요, GETIT 9기입니다.',
        '',
        '아래 링크에서 새 비밀번호를 설정해주세요. (15분 후 만료)',
        resetUrl,
        '',
        '본인이 요청하지 않았다면 이 메일을 무시해주세요.',
      ].join('\n'),
    });
  } catch (err) {
    // 호출자는 enumeration 방어를 위해 항상 200 응답 — 발송 실패도 silent.
    log.error({ err: String(err) }, 'password reset email send failed');
  }
};

/**
 * 이메일 인증 메일 발송 (Issue #226).
 *
 * @param {{ to: string, verifyUrl: string }} args
 * @returns {Promise<void>}
 */
export const sendVerifyEmail = async ({ to, verifyUrl }) => {
  try {
    const t = await getTransport();
    await t.send({
      to,
      subject: '[GETIT/9] 이메일 인증을 완료해주세요',
      text: [
        '안녕하세요, GETIT 9기입니다.',
        '',
        '아래 링크를 눌러 이메일 인증을 완료해주세요. (24시간 후 만료)',
        verifyUrl,
        '',
        '본인이 가입하지 않았다면 이 메일을 무시해주세요.',
      ].join('\n'),
    });
  } catch (err) {
    log.error({ err: String(err) }, 'verify email send failed');
  }
};

/**
 * 학교 메일 인증 메일 발송 (Issue #538).
 *
 * - 30분 TTL.
 * - 클릭 → `auth-web/verify-school?token=...` 페이지에서 학번 입력.
 *
 * 운영 SMTP 미설정 시 disabled 모드로 동작 — 에러 안 던지고 콘솔만.
 *
 * @param {{ to: string, verifyUrl: string }} args
 * @returns {Promise<void>}
 */
export const sendSchoolVerifyEmail = async ({ to, verifyUrl }) => {
  try {
    const t = await getTransport();
    await t.send({
      to,
      subject: '[GETIT/9] 학교 인증 메일',
      text: [
        '안녕하세요, GETIT 9기입니다.',
        '',
        '아래 링크를 눌러 학교 인증을 완료해주세요. (30분 후 만료)',
        verifyUrl,
        '',
        '학번 8자리 입력까지 마쳐야 인증이 완료됩니다.',
        '',
        '본인이 요청하지 않았다면 이 메일을 무시해주세요.',
      ].join('\n'),
    });
  } catch (err) {
    log.error({ err: String(err) }, 'school verify email send failed');
  }
};
