-- Bootstrap script — runs once on first MySQL container start (volume empty).
-- Creates one database per API service and grants the app user.
-- The user (MYSQL_USER from env) was already created with full privs on its
-- default DB by the official image; here we extend grants to all 5 DBs.

CREATE DATABASE IF NOT EXISTS auth   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hobby  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS shelf  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS board  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS letter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- App user — comes from MYSQL_USER / MYSQL_PASSWORD env vars (already created
-- by docker-entrypoint). Grant CRUD across all 5 DBs.
GRANT ALL PRIVILEGES ON `auth`.*   TO 'getit'@'%';
GRANT ALL PRIVILEGES ON `hobby`.*  TO 'getit'@'%';
GRANT ALL PRIVILEGES ON `shelf`.*  TO 'getit'@'%';
GRANT ALL PRIVILEGES ON `board`.*  TO 'getit'@'%';
GRANT ALL PRIVILEGES ON `letter`.* TO 'getit'@'%';

FLUSH PRIVILEGES;
