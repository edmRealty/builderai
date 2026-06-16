# MFCMS

Multi-Family Construction Management Platform (MVP scaffold).

## What’s implemented (scaffold)
- Next.js 15 + Tailwind UI
- Prisma schema for Org/LLC/Projects/Commitments/Draws/Banks/Loans/Permits/Updates/Vendor invoice requests
- Password auth + MFA (TOTP) enforcement for Admin/Banker
- Core pages: setup, login, MFA setup/verify, dashboard, projects, project detail, vendors, banks, users, banker portal, reports, notifications
- Vendor public invoice submission page (metadata-only in this MVP scaffold)
- Master spreadsheet import/export (Projects + LLC EIN + PA tax # + city number): `/app/master-sheet`

## Local dev
1. Copy env:
   - `cp .env.example .env`
2. Start Postgres (recommended via Docker):
   - `docker compose up -d db`
3. Install deps:
   - `npm install`
4. Generate Prisma client:
   - `npm run db:generate`
5. Run migrations:
   - `npm run db:migrate`
6. Start dev server:
   - `npm run dev`

Open: http://127.0.0.1:3010

## Seed demo data
Populate the database with 15 demo LLCs and 20 demo projects (plus vendors, commitments, permits, banks, loans, and draws):
- `npm run db:seed`

Tip: if you want to identify the source of any Node.js deprecation warnings, run `npm run dev:trace-deprecations`.
If you just want to hide deprecation warnings while you test, run `npm run dev:no-deprecation`.

If you want to skip MFA enrollment while testing locally, set `MFA_DISABLED=true` in your `.env` and restart `npm run dev`.

## Notes
- QuickBooks Online OAuth, webhooks, and the QuickBooks Desktop Windows sync agent are scaffolded at the data-model level; implementation wiring is next.
- File uploads (invoices, W-9, COI, lien waivers, plans) are planned via object storage + signed URLs; this scaffold stores metadata and links first.

## Docker (optional)
Build + run the web app in a container (useful for AWS App Runner / ECS style hosting):
- `docker build -t mfcms .`
- `docker run --rm -p 3010:3010 --env-file .env mfcms`

## AWS hosting
See `deploy/aws/README.md`.
