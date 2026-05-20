import { z } from 'zod';

/**
 * 강력한 비밀번호 정책 (Issue #265).
 * - 8자 이상
 * - 영문/숫자/특수문자 중 **2종 이상** 포함 (단순 letter-only 또는 digit-only 차단)
 *
 * UX: 8자만 넘기면 "약함" 으로라도 통과 가능하게 strict 하지 않음 — 인디케이터로 유도.
 */
const passwordStrong = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다')
  .refine((v) => {
    const cats =
      Number(/[a-zA-Z]/.test(v)) + Number(/[0-9]/.test(v)) + Number(/[^a-zA-Z0-9]/.test(v));
    return cats >= 2;
  }, '영문/숫자/특수문자 중 2종 이상을 포함해주세요');

/**
 * 로그인 입력 스키마.
 * SSO 통합 — auth.get-it.cloud/api/login 으로 전송.
 *
 * 로그인은 기존 사용자 보호 위해 강한 정책을 적용하지 않는다 (8자 min 만).
 */
export const LoginInput = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

/**
 * 회원가입 입력 스키마 (Phase 6c — #265 강한 비번 + #237 약관 동의).
 *
 * - acceptTerms / acceptPrivacy: 클라이언트는 boolean(true 만) 전송.
 *   필수 동의 누락 시 400 — refine 에서 검사.
 */
export const SignupInput = z
  .object({
    email: z.string().email('올바른 이메일 형식이 아닙니다'),
    password: passwordStrong,
    passwordConfirm: z.string().min(8),
    name: z.string().min(1, '이름을 입력해주세요').max(40, '이름은 40자 이내로 입력해주세요'),
    acceptTerms: z.boolean().optional(),
    acceptPrivacy: z.boolean().optional(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호 확인이 일치하지 않습니다',
  })
  .refine((d) => d.acceptTerms === true, {
    path: ['acceptTerms'],
    message: '이용약관에 동의해주세요',
  })
  .refine((d) => d.acceptPrivacy === true, {
    path: ['acceptPrivacy'],
    message: '개인정보 처리방침에 동의해주세요',
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
 * 비밀번호 재설정 요청 입력 — 잊은 비밀번호 찾기 (Issue #221).
 * 응답은 항상 200/일정 시간이므로 enumeration 차단.
 */
export const ForgotPasswordInput = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
});

/**
 * 비밀번호 재설정 확정 입력 (Issue #221 + #265 강한 비번).
 */
export const ResetPasswordInput = z
  .object({
    token: z.string().min(32, '유효하지 않은 토큰입니다'),
    password: passwordStrong,
    passwordConfirm: z.string().min(8),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호 확인이 일치하지 않습니다',
  });

/**
 * 프로필 수정 입력 (Issue #235).
 * 이름/이메일 변경 + 선택적 비밀번호 변경.
 * - currentPassword: 모든 변경 시 필수 (re-auth)
 * - newPassword: 옵션. 입력 시 강한 정책 적용 + newPasswordConfirm 일치 검사.
 */
export const UpdateProfileInput = z
  .object({
    name: z.string().min(1, '이름을 입력해주세요').max(40, '이름은 40자 이내로 입력해주세요'),
    email: z.string().email('올바른 이메일 형식이 아닙니다'),
    currentPassword: z.string().min(8, '현재 비밀번호를 입력해주세요'),
    newPassword: z.union([passwordStrong, z.literal('')]).optional(),
    newPasswordConfirm: z.string().optional(),
  })
  .refine(
    (d) => {
      if (!d.newPassword) return true;
      return d.newPassword === d.newPasswordConfirm;
    },
    { path: ['newPasswordConfirm'], message: '새 비밀번호 확인이 일치하지 않습니다' },
  );

/**
 * 회원 탈퇴 입력 (Issue #231).
 * - currentPassword: 재인증 (실수/세션 탈취 방어)
 * - confirm: 클라이언트에서 "탈퇴" 같은 문구 정확 입력 요구 → UI 가드용.
 */
export const DeleteAccountInput = z.object({
  currentPassword: z.string().min(8, '현재 비밀번호를 입력해주세요'),
  confirm: z.literal('탈퇴', { errorMap: () => ({ message: '"탈퇴" 를 정확히 입력해주세요' }) }),
});

/**
 * 이메일 인증 토큰 사용 입력 (Issue #226).
 * GET 으로도 받지만 BE 는 body 검증으로 통합.
 */
export const VerifyEmailInput = z.object({
  token: z.string().min(32, '유효하지 않은 토큰입니다'),
});

/**
 * @typedef {z.infer<typeof LoginInput>} LoginInputT
 * @typedef {z.infer<typeof SignupInput>} SignupInputT
 * @typedef {z.infer<typeof JwtPayload>} JwtPayloadT
 * @typedef {z.infer<typeof ForgotPasswordInput>} ForgotPasswordInputT
 * @typedef {z.infer<typeof ResetPasswordInput>} ResetPasswordInputT
 * @typedef {z.infer<typeof UpdateProfileInput>} UpdateProfileInputT
 * @typedef {z.infer<typeof DeleteAccountInput>} DeleteAccountInputT
 * @typedef {z.infer<typeof VerifyEmailInput>} VerifyEmailInputT
 */
