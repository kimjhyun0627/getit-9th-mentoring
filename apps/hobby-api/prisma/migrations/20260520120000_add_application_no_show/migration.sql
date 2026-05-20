-- #247: 노쇼 신고 + 패널티 카운트.
-- Application 에 noShow boolean 컬럼 추가 + (userId, noShow) 인덱스.
-- 누적 노쇼 카운트는 별도 User 모델 없이 application 그룹핑으로 산출.

ALTER TABLE `Application` ADD COLUMN `noShow` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Application_userId_noShow_idx` ON `Application`(`userId`, `noShow`);
