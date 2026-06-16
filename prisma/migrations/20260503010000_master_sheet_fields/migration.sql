-- Add fields required for master project spreadsheet

ALTER TABLE "LLC" ADD COLUMN IF NOT EXISTS "paTaxNumberEnc" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "cityNumber" TEXT;
