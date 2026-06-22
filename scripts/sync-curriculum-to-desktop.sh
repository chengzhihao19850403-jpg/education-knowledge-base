#!/usr/bin/env bash
set -euo pipefail

SERVER_HOST="${JRC_SERVER_HOST:-8.218.84.228}"
SERVER_USER="${JRC_SERVER_USER:-root}"
SERVER_PORT="${JRC_SERVER_PORT:-22}"
REMOTE_DIR="${JRC_REMOTE_CURRICULUM_DIR:-/opt/jrcedu-uploads/curriculum}"
LOCAL_DIR="${JRC_LOCAL_CURRICULUM_DIR:-${HOME}/Desktop/标准化课件标准化系统}"

mkdir -p "${LOCAL_DIR}"

if command -v rsync >/dev/null 2>&1; then
  rsync -az --partial -e "ssh -p ${SERVER_PORT}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR%/}/" "${LOCAL_DIR}/"
else
  scp -P "${SERVER_PORT}" -r "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR%/}/." "${LOCAL_DIR}/"
fi

echo "synced curriculum files to ${LOCAL_DIR}"
