#!/usr/bin/env bash
set -euo pipefail

echo "[mfcms] confighook predeploy: rebuild after env/config changes"

# Keep config-deploy behavior aligned with normal deploy behavior.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${DIR}/../../../" && pwd)"

HOOK="${APP_ROOT}/.platform/hooks/predeploy/01_build.sh"
if [ -f "${HOOK}" ]; then
  bash "${HOOK}"
else
  echo "[mfcms] ERROR: expected hook not found: ${HOOK}" >&2
  exit 1
fi
