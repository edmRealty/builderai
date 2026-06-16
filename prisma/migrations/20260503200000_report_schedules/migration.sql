-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PORTFOLIO_KPIS', 'COMMITMENT_SUMMARY', 'DRAW_PIPELINE', 'EXCEPTION_AGING', 'PERMIT_ABATEMENT_EXPIRATIONS');

-- CreateEnum
CREATE TYPE "ReportCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "cadence" "ReportCadence" NOT NULL,
    "recipients" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_orgId_idx" ON "ReportSchedule"("orgId");

-- CreateIndex
CREATE INDEX "ReportSchedule_active_idx" ON "ReportSchedule"("active");

-- CreateIndex
CREATE INDEX "ReportSchedule_reportType_idx" ON "ReportSchedule"("reportType");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

