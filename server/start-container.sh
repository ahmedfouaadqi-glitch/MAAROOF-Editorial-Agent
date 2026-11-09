#!/usr/bin/env bash
set -Eeuo pipefail

node --env-file-if-exists=.env server/browser-worker.mjs &
worker_pid=$!
node --env-file-if-exists=.env server/main.mjs &
api_pid=$!

stop_children() {
  trap - TERM INT
  kill -TERM "$api_pid" "$worker_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  wait "$worker_pid" 2>/dev/null || true
}
trap stop_children TERM INT

set +e
wait -n "$api_pid" "$worker_pid"
status=$?
set -e
stop_children
exit "$status"
