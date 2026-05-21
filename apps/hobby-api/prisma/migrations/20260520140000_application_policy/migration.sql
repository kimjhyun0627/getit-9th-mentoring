-- #500: 신청 정책 선택 (선착순 / 승인 게이트).
-- Post.applicationPolicy enum 추가 (default FIRST_COME — backward-compat).
-- Application.status enum 추가 (default APPROVED — 기존 row 백필).

ALTER TABLE `Post`
  ADD COLUMN `applicationPolicy` ENUM('FIRST_COME', 'APPROVAL') NOT NULL DEFAULT 'FIRST_COME';

ALTER TABLE `Application`
  ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED';

-- 기존 모임 row 는 모두 FIRST_COME 정책으로 운영됐으므로 application 도 APPROVED.
-- default 가 'APPROVED' 라 신규 컬럼은 자동 채워지지만, 명시 update 로 안전 백필.
UPDATE `Application` SET `status` = 'APPROVED' WHERE `status` IS NULL OR `status` != 'APPROVED';

-- (postId, status) 인덱스 — applicants 정렬 + 정책별 분기 조회 최적화.
CREATE INDEX `Application_postId_status_idx` ON `Application`(`postId`, `status`);
