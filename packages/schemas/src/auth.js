import { z } from 'zod';

/**
 * 로그인 입력 스키마.
 * SSO 통합 — auth.get-it.cloud/api/login 으로 전송.
 */
export const LoginInput = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

/**
 * 회원가입 입력 스키마.
 */
export const SignupInput = LoginInput.extend({
  name: z.string().min(1, '이름을 입력해주세요').max(40, '이름은 40자 이내로 입력해주세요'),
  passwordConfirm: z.string().min(8),
}).refine((d) => d.password === d.passwordConfirm, {
  path: ['passwordConfirm'],
  message: '비밀번호 확인이 일치하지 않습니다',
});

/**
 * JWT payload 스키마 — 모든 BE에서 검증.
 */
export const JwtPayload = z.object({
  sub: z.string(),
  email: z.string().email(),
  name: z.string(),
  iat: z.number(),
  exp: z.number(),
});

/**
 * @typedef {z.infer<typeof LoginInput>} LoginInputT
 * @typedef {z.infer<typeof SignupInput>} SignupInputT
 * @typedef {z.infer<typeof JwtPayload>} JwtPayloadT
 */
