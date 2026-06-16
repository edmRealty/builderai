#!/usr/bin/env bash
set -euo pipefail

echo "[mfcms] predeploy: prisma generate + next build"

# In Elastic Beanstalk, predeploy runs in the staging directory (typically /var/app/staging).
if [ ! -f package.json ]; then
  echo "[mfcms] ERROR: package.json not found in predeploy cwd: ${PWD}" >&2
  exit 1
fi

if [ -f .next/BUILD_ID ]; then
  echo "[mfcms] predeploy: prebuilt Next artifact detected; skipping dependency install and build"

  if [ "${RUN_DB_MIGRATIONS_ON_PREBUILT:-false}" = "true" ] && [ -n "${DATABASE_URL:-}" ] && [ "${EB_IS_COMMAND_LEADER:-true}" = "true" ]; then
    echo "[mfcms] predeploy: running migrations for prebuilt artifact"
    npm run db:deploy
  else
    echo "[mfcms] predeploy: skipping migrations for prebuilt artifact"
  fi

  exit 0
fi

# Elastic Beanstalk Node platforms often install production dependencies only.
# Next.js production builds for TS projects commonly require dev deps (typescript, postcss/tailwind, eslint plugins)
# to resolve TS path aliases and run type/lint checks.
if [ ! -d node_modules/typescript ]; then
  echo "[mfcms] predeploy: installing devDependencies (needed for next build)"
  npm install --include=dev
fi

npm run db:generate
npm run build

if [ -n "${DATABASE_URL:-}" ]; then
  if [ "${EB_IS_COMMAND_LEADER:-true}" = "true" ]; then
    echo "[mfcms] predeploy: running migrations (leader only when available)"
    npm run db:deploy

    if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
      echo "[mfcms] predeploy: seeding demo data (leader only)"
      node scripts/seed.js
    else
      echo "[mfcms] predeploy: SEED_DEMO_DATA not set; skipping seed"
    fi
  else
    echo "[mfcms] predeploy: skipping migrations (not leader)"
  fi
else
  echo "[mfcms] predeploy: DATABASE_URL not set; skipping migrations"
fi
