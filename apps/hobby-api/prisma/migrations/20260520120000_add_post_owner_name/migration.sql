-- Add `ownerName` snapshot to Post (#210).
-- 작성 시점 JWT `name` claim 을 캡처해 카드/상세에서 방장 표시.
-- 기존 row 는 NULL — FE 가 '익명' fallback.
ALTER TABLE `Post`
  ADD COLUMN `ownerName` VARCHAR(191) NULL AFTER `ownerId`;
