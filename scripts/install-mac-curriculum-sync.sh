#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SCRIPT="${SCRIPT_DIR}/sync-curriculum-to-desktop.sh"
INSTALL_DIR="${HOME}/.jrcedu"
INSTALLED_SCRIPT="${INSTALL_DIR}/sync-curriculum-to-desktop.sh"
PLIST_PATH="${HOME}/Library/LaunchAgents/cn.jrcwork.curriculum-sync.plist"
LOG_DIR="${HOME}/Library/Logs/jrcedu"

mkdir -p "${INSTALL_DIR}" "${HOME}/Library/LaunchAgents" "${LOG_DIR}"
install -m 0755 "${SOURCE_SCRIPT}" "${INSTALLED_SCRIPT}"

cat > "${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>cn.jrcwork.curriculum-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${INSTALLED_SCRIPT}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>JRC_SYNC_BATCH_MODE</key>
    <string>1</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/curriculum-sync.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/curriculum-sync.err.log</string>
</dict>
</plist>
EOF

launchctl unload "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl load "${PLIST_PATH}"

echo "installed Mac curriculum sync: ${PLIST_PATH}"
echo "local folder: ${HOME}/Desktop/标准化课件标准化系统"
echo "automatic sync schedule: weekly, Monday 03:30."
echo "automatic sync needs SSH key login. Manual sync can run ${INSTALLED_SCRIPT} and enter the server password."
