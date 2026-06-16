# AWS deployment (web-based)

This app is a Next.js + Prisma + Postgres web app. In AWS, the simplest hosting paths are:

1) **AWS Amplify Hosting (Next.js SSR)** – quickest “connect repo → get URL”.
2) **AWS App Runner (container)** – simple container hosting (good when you want full control).

This folder documents both options.

## Required environment variables (all hosts)

- `APP_URL` (e.g., `https://mfcms-staging.example.com`)
- `DATABASE_URL` (Postgres connection string)
- `SESSION_SECRET` (32+ chars; used for session + field encryption)
- `PASSWORD_PEPPER` (random secret; used when hashing passwords)

Optional (Phase 1 scaffold already supports these configs; delivery wiring comes next):

- Email: `EMAIL_FROM`, `RESEND_API_KEY` or `SENDGRID_API_KEY`
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`

## Option A — AWS Amplify Hosting (recommended for quick web testing)

1. Put the app in its own Git repository (or point Amplify to the `mfcms/` folder as app root).
2. Create an **RDS Postgres** instance (dev/staging) and allow inbound from Amplify (VPC config as needed).
3. Create a new Amplify app → connect your repo/branch.
4. In Amplify → **Environment variables**, set `APP_URL`, `DATABASE_URL`, `SESSION_SECRET`, `PASSWORD_PEPPER`.
5. Build settings:
   - Amplify usually auto-detects Next.js and works with the default build.
   - If you want an explicit build spec, copy `amplify.yml` (at repo root) into your repo and adjust `appRoot` if needed.
6. Run DB migrations:
   - Recommended: run once from your laptop/CI against the RDS instance:
     - `npm run db:deploy`

## Option B — AWS App Runner (container)

App Runner exposes your app on the port it provides via the `PORT` environment variable (default port is 8080). The app’s `npm run start` command already respects `PORT`.

1. Build & push the container to ECR:
   - `docker build -t mfcms .`
   - Tag and push to ECR.
2. Create an App Runner service from the ECR image.
3. Add runtime env vars: `APP_URL`, `DATABASE_URL`, `SESSION_SECRET`, `PASSWORD_PEPPER`.
4. Configure a VPC connector if your RDS is private.

### Migrations

The container entrypoint runs `prisma migrate deploy` automatically on startup **if** `DATABASE_URL` is set.

For production, you’ll likely change this to a one-off migration step (to avoid multi-instance race conditions).

