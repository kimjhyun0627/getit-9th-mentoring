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
 * 닉네임 검증 규칙 (Issue #538 — 학교 인증 epic).
 *
 * - 2-20자
 * - 한글(완성형) / 영문 / 숫자 / `-` / `_` 허용
 * - 트림은 호출자가 책임 (Zod 가 transform 으로 처리)
 *
 * 마이그레이션 단계에선 nullable (PRD §스키마 Phase 1) — `NicknameOptional` 사용.
 */
const nicknamePattern = /^[A-Za-z0-9가-힣\-_]+$/u;

export const NicknameValue = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(2, '닉네임은 2자 이상이어야 합니다')
      .max(20, '닉네임은 20자 이내로 입력해주세요')
      .regex(nicknamePattern, '닉네임은 한글/영문/숫자/-/_ 만 사용 가능합니다'),
  );

/**
 * Optional nickname (마이그레이션 단계 — DB 컬럼 nullable).
 *
 * - 빈 문자열 / null / undefined → 그대로 허용 (transform 없이 키 보존성 유지).
 *   - FE 에서 보내지 않으면 nickname 키 자체가 결과에 포함되지 않는다.
 *     → 다른 폼/페이지 spy 회귀 방지.
 *   - 빈 문자열은 그대로 통과 (라우터에서 `if (nickname)` 분기로 정상 무시).
 * - 값이 있으면 NicknameValue 규칙 (2-20자, 한글/영문/숫자/-_).
 */
export const NicknameOptional = z.union([NicknameValue, z.literal(''), z.null()]).optional();

/**
 * 회원가입 입력 스키마 (Phase 6c — #265 강한 비번 + #237 약관 동의 + #538 nickname).
 *
 * - acceptTerms / acceptPrivacy: 클라이언트는 boolean(true 만) 전송.
 *   필수 동의 누락 시 400 — refine 에서 검사.
 * - nickname: 마이그레이션 단계는 optional. 값이 있으면 NicknameValue 규칙 적용.
 *   `NICKNAME_ONBOARDING_ENFORCED=true` 환경에선 FE 가 항상 채워서 보낸다.
 */
export const SignupInput = z
  .object({
    email: z.string().email('올바른 이메일 형식이 아닙니다'),
    password: passwordStrong,
    passwordConfirm: z.string().min(8),
    name: z.string().min(1, '이름을 입력해주세요').max(40, '이름은 40자 이내로 입력해주세요'),
    nickname: NicknameOptional,
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
 *
 * #541 (학교 인증 epic): `schoolVerifiedAt` 옵션 필드 추가.
 *  - 학교 인증 완료한 사용자는 access token 발급/회전 시 ISO 8601 문자열로 박힘.
 *  - 미인증 / 옛 토큰은 키 자체가 없거나 null → guard 가 null treatment.
 *  - 다른 BE 앱은 DB 가 분리돼 있어 (auth-api 만 User 테이블 보유) JWT payload 로
 *    학교 인증 상태를 전파해야 함. cross-service DB join / HTTP roundtrip 회피.
 *  - access TTL (기본 15m) 동안은 stale 일 수 있으나, 학교 인증 후 verify-school
 *    이 새 토큰 재발급 / refresh 흐름이 갱신을 보장.
 *
 * letter 무한 redirect fix: `nickname` 옵션 필드 추가.
 *  - auth-api 외 BE (letter/hobby) 는 자체 User 테이블이 없어 JWT 만으로 nickname
 *    상태를 안다. `/api/me` echo 라우터가 nickname 까지 응답해야 NicknameOnboardingGuard
 *    가 무한 루프에 빠지지 않는다.
 *  - schoolVerifiedAt 과 동일한 정책: 없으면 키 누락, 빈 닉네임은 null.
 *  - access TTL 동안 stale 가능 — PATCH /api/me/nickname 이 즉시 새 토큰 발급해서 보완.
 *
 * #571 (8자리 → 10자리 학번 마이그레이션): `studentIdLegacy` 옵션 필드 추가.
 *  - DB studentId 가 정확히 8자리이면 true, 그 외 (10자리/null) 는 false 또는 키 누락.
 *  - hobby/letter BE 가 자체 User 테이블 없어 JWT echo 로만 알 수 있음 (nickname/
 *    schoolVerifiedAt 와 동일 패턴).
 *  - PATCH /api/me/student-id 가 성공하면 새 토큰에 false 로 박힘 → 다음 가드 요청부터
 *    블로킹 해제.
 */
export const JwtPayload = z.object({
  sub: z.string(),
  email: z.string().email(),
  name: z.string(),
  nickname: z.string().nullish(),
  schoolVerifiedAt: z.string().datetime().nullish(),
  studentIdLegacy: z.boolean().nullish(),
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
    nickname: NicknameOptional,
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
 * 학교 메일 인증 — 메일 발송 요청 (Issue #538).
 *
 * - `@knu.ac.kr` 도메인 강제 (대소문자 무시).
 * - 빈값/공백 trim 후 검증.
 */
export const SchoolLinkInput = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .email('올바른 이메일 형식이 아닙니다')
        .regex(/@knu\.ac\.kr$/i, '경북대 메일(@knu.ac.kr)만 사용할 수 있습니다'),
    ),
});

/**
 * 학교 메일 인증 확정 — 토큰 + 학번 (Issue #538).
 *
 * - studentId: 정확히 10자리 숫자 (KNU 학번 형식).
 */
// VerifyEmailInput 과 일관성 — generateRefreshToken 은 32+ hex 를 만든다.
export const VerifySchoolInput = z.object({
  token: z.string().min(32, '유효하지 않은 토큰입니다'),
  // Gemini #568: 다른 필드(nickname/email) 와 일관되게 trim 후 검증.
  // FE maxLength 가 약간 여유 있어서 (12) paste 앞뒤 공백도 처리.
  studentId: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().regex(/^\d{10}$/, '학번은 10자리 숫자입니다')),
});

/**
 * 학번 단독 정정 입력 (#571, 8자리 → 10자리 마이그레이션).
 *
 * 배경:
 *  - #568 로 zod 학번이 8자리 → 10자리로 정정됐지만, 그 전에 verify-school 통과한
 *    사용자 중 8자리 studentId 가 DB 에 남아 있을 수 있음.
 *  - hobby 진입 시 FE 가 blocking 모달로 10자리 재입력받음 → BE 라우트
 *    PATCH /api/me/student-id 가 검증 + DB 업데이트 + 새 토큰 발급.
 *  - 학교 인증 자체는 그대로 유지 (schoolEmail / schoolVerifiedAt 그대로), 학번만 정정.
 *
 * VerifySchoolInput.studentId 와 동일 규칙 — trim → 정확히 10자리 숫자.
 */
export const UpdateStudentIdInput = z.object({
  studentId: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().regex(/^\d{10}$/, '학번은 10자리 숫자입니다')),
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
 * @typedef {z.infer<typeof SchoolLinkInput>} SchoolLinkInputT
 * @typedef {z.infer<typeof VerifySchoolInput>} VerifySchoolInputT
 * @typedef {z.infer<typeof UpdateStudentIdInput>} UpdateStudentIdInputT
 */
