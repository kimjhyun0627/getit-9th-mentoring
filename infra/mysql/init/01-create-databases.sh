#!/bin/bash
# Bootstrap script — runs once on first MySQL container start (volume empty).
# Creates one database per API service and grants the app user
# (from $MYSQL_USER, taken from the official entrypoint env).
set -euo pipefail

: "${MYSQL_USER:?MYSQL_USER must be set by docker-entrypoint}"

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
} | mysql --protocol=socket -uroot
