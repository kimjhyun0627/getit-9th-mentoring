-- #529 — Mixed Content 핫픽스.
-- 카카오는 thumbnail fname 쿼리를 `http://t1.daumcdn.net/...` (HTTP) 로 박아 응답한다.
-- PR #509 이후 백필된 Book.coverUrl row 중 일부가 그대로 http://... 로 저장됐다.
-- shelf-web 은 HTTPS 페이지 → 브라우저 콘솔에 Mixed Content 경고가 뜬다.
-- daumcdn 등 모든 책 표지 CDN 은 https 정상 지원 → 일괄 https 로 백필.
--
-- SUBSTRING(coverUrl, 8) 는 MySQL 1-indexed 라 `http://` (7글자) 다음 1번째 글자부터.
UPDATE `Book` SET `coverUrl` = CONCAT('https://', SUBSTRING(`coverUrl`, 8)) WHERE `coverUrl` LIKE 'http://%';
