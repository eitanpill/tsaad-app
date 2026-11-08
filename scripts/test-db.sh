#!/usr/bin/env bash
# Throwaway local Postgres 16 for DB integration tests.
#
#   scripts/test-db.sh run -- npx vitest run     # start, migrate, run command with DATABASE_URL, stop, clean up
#   scripts/test-db.sh start                     # start + migrate, print `export DATABASE_URL=...`
#   scripts/test-db.sh stop <datadir>            # stop and remove a cluster started with `start`
#
# Postgres refuses to run as root, so when started as root the cluster runs as the
# unprivileged user $TEST_DB_USER (default: postgres; created if missing).
# Listens on 127.0.0.1 only, trust auth, in a temp dir. Nothing outside localhost is touched.
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
TEST_DB_USER="${TEST_DB_USER:-postgres}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${TEST_DB_NAME:-tsaad_test}"

as_pg() {
  if [ "$(id -u)" = "0" ]; then
    runuser -u "$TEST_DB_USER" -- "$@"
  else
    "$@"
  fi
}

free_port() {
  node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

start() {
  [ -x "$PG_BIN/initdb" ] || { echo "initdb not found in $PG_BIN" >&2; exit 1; }
  if [ "$(id -u)" = "0" ] && ! id "$TEST_DB_USER" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$TEST_DB_USER"
  fi
  DATA_PARENT="$(mktemp -d /tmp/tsaad-testdb.XXXXXX)"
  [ "$(id -u)" = "0" ] && chown "$TEST_DB_USER" "$DATA_PARENT"
  chmod 700 "$DATA_PARENT"
  DATA_DIR="$DATA_PARENT/data"
  PORT="$(free_port)"
  as_pg "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust -E UTF8 >/dev/null
  as_pg "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_PARENT/pg.log" -w \
    -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$DATA_PARENT -c fsync=off" start >/dev/null
  as_pg "$PG_BIN/createdb" -h 127.0.0.1 -p "$PORT" -U postgres "$DB_NAME"
  DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/$DB_NAME"
  (cd "$ROOT_DIR" && DATABASE_URL="$DATABASE_URL" npx drizzle-kit migrate >/dev/null)
}

stop() {
  local parent="$1"
  as_pg "$PG_BIN/pg_ctl" -D "$parent/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$parent"
}

case "${1:-}" in
  run)
    shift; [ "${1:-}" = "--" ] && shift
    start
    trap 'stop "$DATA_PARENT"' EXIT
    echo "test db: $DATABASE_URL (migrated)" >&2
    cd "$ROOT_DIR"
    DATABASE_URL="$DATABASE_URL" "$@"
    ;;
  start)
    start
    echo "export DATABASE_URL=$DATABASE_URL"
    echo "# stop with: scripts/test-db.sh stop $DATA_PARENT" >&2
    ;;
  stop)
    stop "${2:?data parent dir required}"
    ;;
  *)
    sed -n '2,10p' "$0"; exit 2 ;;
esac
