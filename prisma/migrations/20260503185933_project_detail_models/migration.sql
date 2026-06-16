-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "paidToDateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLoanCents" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "baths" DOUBLE PRECISION,
    "sqft" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPartner" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ownershipBps" INTEGER NOT NULL DEFAULT 0,
    "initialInvestmentCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhoto" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCustomSection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCustomSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCustomSectionItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCustomSectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unit_orgId_idx" ON "Unit"("orgId");

-- CreateIndex
CREATE INDEX "Unit_projectId_idx" ON "Unit"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_projectId_unitNumber_key" ON "Unit"("projectId", "unitNumber");

-- CreateIndex
CREATE INDEX "Partner_orgId_idx" ON "Partner"("orgId");

-- CreateIndex
CREATE INDEX "ProjectPartner_orgId_idx" ON "ProjectPartner"("orgId");

-- CreateIndex
CREATE INDEX "ProjectPartner_projectId_idx" ON "ProjectPartner"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPartner_partnerId_idx" ON "ProjectPartner"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPartner_projectId_partnerId_key" ON "ProjectPartner"("projectId", "partnerId");

-- CreateIndex
CREATE INDEX "ProjectPhoto_orgId_idx" ON "ProjectPhoto"("orgId");

-- CreateIndex
CREATE INDEX "ProjectPhoto_projectId_createdAt_idx" ON "ProjectPhoto"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectCustomSection_orgId_idx" ON "ProjectCustomSection"("orgId");

-- CreateIndex
CREATE INDEX "ProjectCustomSection_projectId_idx" ON "ProjectCustomSection"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCustomSectionItem_orgId_idx" ON "ProjectCustomSectionItem"("orgId");

-- CreateIndex
CREATE INDEX "ProjectCustomSectionItem_sectionId_idx" ON "ProjectCustomSectionItem"("sectionId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPartner" ADD CONSTRAINT "ProjectPartner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPartner" ADD CONSTRAINT "ProjectPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhoto" ADD CONSTRAINT "ProjectPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomSection" ADD CONSTRAINT "ProjectCustomSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomSectionItem" ADD CONSTRAINT "ProjectCustomSectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProjectCustomSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
