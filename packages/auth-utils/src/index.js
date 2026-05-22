// Browser-safe barrel only.
// signJwt / verifyJwt / requireAuth / COOKIE_NAME 등 Node.js 전용 유틸리티는
// @getit/auth-utils/server 서브패스로만 import. server 모듈은 jsonwebtoken을
// 사용하므로 client bundle에 포함되면 Buffer 미정의로 인한 런타임 크래시가
// 발생할 수 있다 (Issue #553 회귀 — PR #550).
export * from './client.js';
export * from './safeRedirect.js';
export * from './displayName.js';
export * from './onboardingRedirect.js';
