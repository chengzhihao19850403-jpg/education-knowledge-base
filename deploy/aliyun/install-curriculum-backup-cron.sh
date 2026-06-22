#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/jrcedu}"
SCRIPT_SOURCE="${APP_DIR}/deploy/aliyun/backup-curriculum-files.sh"
SCRIPT_TARGET="/usr/local/bin/jrcedu-backup-curriculum-files"
CRON_FILE="/etc/cron.d/jrcedu-curriculum-backup"
LOG_FILE="/var/log/jrcedu-curriculum-backup.log"

if [[ ! -f "${SCRIPT_SOURCE}" ]]; then
  echo "missing backup script: ${SCRIPT_SOURCE}" >&2
  exit 1
fi

install -m 0755 "${SCRIPT_SOURCE}" "${SCRIPT_TARGET}"
mkdir -p /opt/jrcedu-backups/curriculum
chmod 750 /opt/jrcedu-backups /opt/jrcedu-backups/curriculum
touch "${LOG_FILE}"
chmod 640 "${LOG_FILE}"

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
10 3 * * * root ${SCRIPT_TARGET} >> ${LOG_FILE} 2>&1
EOF

chmod 644 "${CRON_FILE}"
"${SCRIPT_TARGET}"

echo "installed daily curriculum backup cron: ${CRON_FILE}"
