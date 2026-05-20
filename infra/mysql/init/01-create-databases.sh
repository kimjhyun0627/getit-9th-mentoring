#!/bin/bash
# Bootstrap script — runs once on first MySQL container start (volume empty).
# Creates one database per API service and grants the app user
# (from $MYSQL_USER, taken from the official entrypoint env).
#
# NOTE: docker-entrypoint.sh sets up `root@localhost` with $MYSQL_ROOT_PASSWORD
# before running /docker-entrypoint-initdb.d/*. We must authenticate as root
# explicitly, otherwise `mysql -uroot` (no password) fails with:
#   ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: NO)
#
# We use --defaults-extra-file with a temp my.cnf instead of `-p"$PASS"` on the
# command line — that avoids the "password on the command line" warning and
# keeps the secret out of `ps`.
set -euo pipefail

: "${MYSQL_USER:?MYSQL_USER must be set by docker-entrypoint}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD must be set by docker-entrypoint}"

# Temp credential file readable only by current user; cleaned up on exit.
# trap is registered *immediately* after mktemp so a failure in `chmod` (or
# any subsequent command) still removes the file.
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"

# my.cnf [client] section parses `\` as an escape char and `"` as a string
# delimiter. Escape both before writing so the password MySQL actually receives
# matches MYSQL_ROOT_PASSWORD byte-for-byte. Quoting handles spaces / `#` too.
escaped_password=${MYSQL_ROOT_PASSWORD//\\/\\\\}
escaped_password=${escaped_password//\"/\\\"}

cat >"$CNF" <<EOF
[client]
user=root
password="${escaped_password}"
EOF
unset escaped_password

# All 5 service-specific DBs. Adding a new app: append here.
DATABASES=(auth hobby shelf board letter)

# Build SQL, then pipe into the local mysql client the entrypoint already started.
{
  for db in "${DATABASES[@]}"; do
    echo "CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  done
  for db in "${DATABASES[@]}"; do
    echo "GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${MYSQL_USER}'@'%';"
  done
  echo "FLUSH PRIVILEGES;"
} | mysql --defaults-extra-file="$CNF" --protocol=socket
