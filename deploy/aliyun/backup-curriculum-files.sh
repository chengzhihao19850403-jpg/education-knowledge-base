#!/usr/bin/env bash
set -euo pipefail

UPLOAD_DIR="${JRC_UPLOAD_DIR:-/opt/jrcedu-uploads}"
SOURCE_DIR="${JRC_CURRICULUM_SOURCE_DIR:-${UPLOAD_DIR}/curriculum}"
BACKUP_ROOT="${JRC_CURRICULUM_BACKUP_DIR:-/opt/jrcedu-backups/curriculum}"
RETENTION_DAYS="${JRC_CURRICULUM_BACKUP_RETENTION_DAYS:-90}"

mkdir -p "${BACKUP_ROOT}"

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "curriculum source directory does not exist: ${SOURCE_DIR}"
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
archive="${BACKUP_ROOT}/curriculum-${timestamp}.tar.gz"
manifest="${BACKUP_ROOT}/curriculum-${timestamp}.manifest.txt"

find "${SOURCE_DIR}" -type f | sort > "${manifest}"
tar -C "${UPLOAD_DIR}" -czf "${archive}" curriculum
sha256sum "${archive}" > "${archive}.sha256"

find "${BACKUP_ROOT}" -type f -name "curriculum-*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "curriculum-*.manifest.txt" -mtime +"${RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "curriculum-*.tar.gz.sha256" -mtime +"${RETENTION_DAYS}" -delete

echo "created ${archive}"
