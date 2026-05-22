-- School auth (Issue #536/#537) — Add User.nickname/studentId/schoolEmail/schoolVerifiedAt
-- + new SchoolVerifyToken table.
-- Backfills are safe: all new columns NULL for existing rows.
-- MySQL: unique index allows multiple NULLs, so schoolEmail/nickname uniqueness only
-- enforced when set.

ALTER TABLE `User`
    ADD COLUMN `nickname`         VARCHAR(191) NULL,
    ADD COLUMN `studentId`        VARCHAR(191) NULL,
    ADD COLUMN `schoolEmail`      VARCHAR(191) NULL,
    ADD COLUMN `schoolVerifiedAt` DATETIME(3)  NULL;

CREATE UNIQUE INDEX `User_nickname_key`    ON `User`(`nickname`);
CREATE UNIQUE INDEX `User_schoolEmail_key` ON `User`(`schoolEmail`);

-- CreateTable
CREATE TABLE `SchoolVerifyToken` (
    `id`         VARCHAR(191) NOT NULL,
    `userId`     VARCHAR(191) NOT NULL,
    `email`      VARCHAR(191) NOT NULL,
    `tokenHash`  VARCHAR(191) NOT NULL,
    `studentId`  VARCHAR(191) NULL,
    `expiresAt`  DATETIME(3)  NOT NULL,
    `consumedAt` DATETIME(3)  NULL,
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SchoolVerifyToken_tokenHash_key`(`tokenHash`),
    INDEX `SchoolVerifyToken_userId_idx`(`userId`),
    INDEX `SchoolVerifyToken_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SchoolVerifyToken`
    ADD CONSTRAINT `SchoolVerifyToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
