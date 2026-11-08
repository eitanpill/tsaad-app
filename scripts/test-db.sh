#!/usr/bin/env bash
# Throwaway local Postgres 16 for DB integration tests.
#
#   scripts/test-db.sh run -- npx vitest run     # start, migrate, run command with DATABASE_URL, stop, clean up
#   scripts/test-db.sh start                     # start + migrate, print `export DATABASE_URL=...`
#   scripts/test-db.sh stop <datadir>            # stop and remove a cluster started with `start`
#
# Postgres refuses to run as root, so when started as root the cluster runs as the
# unprivileged user $TEST_DB_USER (default: postgres; created if missing).
# Listens on 127.0.0.1 only (random password over TCP; the unix socket lives in a 0700
# temp dir), in a temp dir under /tmp. Nothing outside localhost is touched.
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

DATA_PARENT=""

start() {
  [ -x "$PG_BIN/initdb" ] || { echo "initdb not found in $PG_BIN" >&2; exit 1; }
  if [ "$(id -u)" = "0" ] && ! id "$TEST_DB_USER" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$TEST_DB_USER"
  fi
  DATA_PARENT="$(mktemp -d /tmp/tsaad-testdb.XXXXXX)"
  chmod 700 "$DATA_PARENT"
  if [ "$(id -u)" = "0" ]; then chown "$TEST_DB_USER" "$DATA_PARENT"; fi
  DATA_DIR="$DATA_PARENT/data"
  PORT="$(free_port)"
  local pw
  pw="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  (umask 077; printf '%s\n' "$pw" > "$DATA_PARENT/pwfile")
  if [ "$(id -u)" = "0" ]; then chown "$TEST_DB_USER" "$DATA_PARENT/pwfile"; fi
  as_pg "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres --auth-local=trust --auth-host=scram-sha-256 \
    --pwfile="$DATA_PARENT/pwfile" -E UTF8 >/dev/null
  rm -f "$DATA_PARENT/pwfile"
  as_pg "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_PARENT/pg.log" -w \
    -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$DATA_PARENT -c fsync=off" start >/dev/null
  as_pg "$PG_BIN/createdb" -h "$DATA_PARENT" -p "$PORT" -U postgres "$DB_NAME"
  DATABASE_URL="postgres://postgres:$pw@127.0.0.1:$PORT/$DB_NAME"
  (cd "$ROOT_DIR" && DATABASE_URL="$DATABASE_URL" npx drizzle-kit migrate >/dev/null)
}

stop() {
  local parent="$1"
  # Only ever remove a directory this script created.
  if ! [[ "$parent" =~ ^/tmp/tsaad-testdb\.[A-Za-z0-9]{6}$ ]]; then
    echo "refusing to remove '$parent': not a tsaad-testdb temp dir" >&2; return 1
  fi
  [ -d "$parent" ] && [ ! -L "$parent" ] || { echo "no such test db dir: $parent" >&2; return 1; }
  as_pg "$PG_BIN/pg_ctl" -D "$parent/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$parent"
}

case "${1:-}" in
  run)
    shift; [ "${1:-}" = "--" ] && shift
    # Trap first, so a failure during start/migrate still stops and removes the cluster.
    trap '[ -n "$DATA_PARENT" ] && stop "$DATA_PARENT"' EXIT
    start
    echo "test db: postgres://postgres:***@127.0.0.1:$PORT/$DB_NAME (migrated)" >&2
    cd "$ROOT_DIR"
    DATABASE_URL="$DATABASE_URL" TSAAD_TEST_DB=1 "$@"
    ;;
  start)
    start
    echo "export DATABASE_URL='$DATABASE_URL' TSAAD_TEST_DB=1"
    echo "# stop with: scripts/test-db.sh stop $DATA_PARENT" >&2
    ;;
  stop)
    stop "${2:?data parent dir required}"
    ;;
  *)
    sed -n '2,11p' "$0"; exit 2 ;;
esac
