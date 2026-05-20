import { describe, expect, it } from 'vitest';

import {
  applyErrorMessage,
  cancelErrorMessage,
  fetchErrorMessage,
} from './PostDetailPage.errors.js';

const axiosErr = (status, code) => ({ response: { status, data: code ? { error: code } : {} } });

describe('PostDetailPage.errors', () => {
  describe('fetchErrorMessage', () => {
    it('404 → 모임 없음 안내', () => {
      const msg = fetchErrorMessage(axiosErr(404));
      expect(msg).toMatch(/모임을 찾을 수 없/);
      expect(msg).toMatch(/사라졌나봐/);
    });
    it('401 → 로그인 필요', () => {
      expect(fetchErrorMessage(axiosErr(401))).toMatch(/로그인/);
    });
    it('알 수 없는 에러 → 재시도 안내', () => {
      expect(fetchErrorMessage(new Error('boom'))).toMatch(/잠시 후 다시/);
    });
  });

  describe('applyErrorMessage', () => {
    it('PostFull → 마감 안내', () => {
      expect(applyErrorMessage(axiosErr(422, 'PostFull'))).toMatch(/정원이 마감/);
    });
    it('AlreadyApplied → 중복 신청 안내', () => {
      expect(applyErrorMessage(axiosErr(409, 'AlreadyApplied'))).toMatch(/이미 신청/);
    });
    it('OwnerCannotApply → 방장 본인 안내', () => {
      expect(applyErrorMessage(axiosErr(409, 'OwnerCannotApply'))).toMatch(/만든 모임/);
    });
    it('PostNotOpen → 마감/취소 안내', () => {
      expect(applyErrorMessage(axiosErr(422, 'PostNotOpen'))).toMatch(/신청을 받지 않/);
    });
    it('err 가 null/undefined 면 null 반환 (alert 미표시)', () => {
      expect(applyErrorMessage(null)).toBeNull();
      expect(applyErrorMessage(undefined)).toBeNull();
    });
  });

  describe('cancelErrorMessage', () => {
    it('403 → 본인 신청 안내', () => {
      expect(cancelErrorMessage(axiosErr(403))).toMatch(/본인 신청/);
    });
    it('404 → 이미 취소된 신청', () => {
      expect(cancelErrorMessage(axiosErr(404))).toMatch(/이미 취소/);
    });
    it('err 가 null 이면 null', () => {
      expect(cancelErrorMessage(null)).toBeNull();
    });
  });
});
