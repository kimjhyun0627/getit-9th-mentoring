-- Add `userNickname` snapshot to BookShelf (#561).
-- 작성 시점 JWT nickname/name 을 캡처해 browse 부원 디렉토리 (`/api/shelves/browse`)
-- 가 auth-api DB 에 join 없이 nickname 노출.
-- 기존 row 는 NULL — browse 가 NULL 자동 제외. PATCH 시 backfill.
ALTER TABLE `BookShelf`
  ADD COLUMN `userNickname` VARCHAR(191) NULL AFTER `userId`;

-- browse 필터 `userNickname IS NOT NULL` 가 index 타도록.
-- CR #564: 데이터 규모 시 in-memory aggregate OOM 위험 — 후속 PR 에서 groupBy 전환.
CREATE INDEX `BookShelf_userNickname_idx` ON `BookShelf` (`userNickname`);
