#!/bin/sh
set -e

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Running database migrations (prisma migrate deploy)…"
  npm run db:deploy

  if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
    echo "Seeding demo data…"
    node scripts/seed.js
  fi
fi

echo "Starting web server…"
exec npm run start
