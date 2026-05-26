/**
 * env-validator (@getit/env-validator) — 운영 secret startup fail-fast 검증 (Issue #575).
 *
 * 두 가지 사일런트 실패 경로를 차단한다:
 *
 *  1. JWT_SECRET 이 \`.env.prod.example\` 의 known placeholder 인 채로 운영 부팅 →
 *     SSO 5 도메인이 public 으로 알려진 secret 으로 토큰 서명. 전체 위조 가능.
 *  2. SMTP_HOST 미설정인 채로 운영 부팅 → 비밀번호 재설정/학교 인증 메일이
 *     실제로 안 나가는데 UI 는 \"보냈어요\" 응답.
 *
 * 패키지 사용 모델:
 *   - 5 BE \`server.js\` 부팅 진입점에서 1회 호출.
 *   - production 위반 → throw → 컨테이너 즉시 종료. 헬스체크가 cascade 로 실패.
 *   - dev/test 위반 → warnings 배열 반환 (호출자가 \`log.warn\`).
 *
 * 비밀값 자체는 절대 메시지/로그에 노출하지 않는다. \"이름\" 과 \"결손 사유\" 만 노출.
 */

export { validateJwtSecret } from './validateJwtSecret.js';
export { validateSmtpConfig } from './validateSmtpConfig.js';
