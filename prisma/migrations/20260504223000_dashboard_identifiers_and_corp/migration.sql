-- CreateEnum
CREATE TYPE "VendorOnboardingStep" AS ENUM ('BASIC', 'TAX', 'INSURANCE', 'DONE');

-- CreateEnum
CREATE TYPE "IdentifierScope" AS ENUM ('PROJECT');

-- AlterTable
ALTER TABLE "LLC"
ADD COLUMN     "establishedAt" TIMESTAMP(3),
ADD COLUMN     "oneDriveFolderUrl" TEXT;

-- AlterTable
ALTER TABLE "Vendor"
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "einEnc" TEXT,
ADD COLUMN     "onboardingStep" "VendorOnboardingStep" NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "w9Url" TEXT,
ADD COLUMN     "insuranceUrl" TEXT;

-- CreateTable
CREATE TABLE "OrgTodo" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentifierDefinition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" "IdentifierScope" NOT NULL DEFAULT 'PROJECT',
    "label" TEXT NOT NULL,
    "applyToAllProjects" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentifierDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectIdentifier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlcDocument" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "llcId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlcDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlcPartner" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "llcId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ownershipBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlcPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgTodo_orgId_idx" ON "OrgTodo"("orgId");

-- CreateIndex
CREATE INDEX "OrgTodo_orgId_completedAt_idx" ON "OrgTodo"("orgId", "completedAt");

-- CreateIndex
CREATE INDEX "OrgTodo_createdByUserId_idx" ON "OrgTodo"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentifierDefinition_orgId_scope_label_key" ON "IdentifierDefinition"("orgId", "scope", "label");

-- CreateIndex
CREATE INDEX "IdentifierDefinition_orgId_idx" ON "IdentifierDefinition"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIdentifier_projectId_definitionId_key" ON "ProjectIdentifier"("projectId", "definitionId");

-- CreateIndex
CREATE INDEX "ProjectIdentifier_orgId_idx" ON "ProjectIdentifier"("orgId");

-- CreateIndex
CREATE INDEX "ProjectIdentifier_projectId_idx" ON "ProjectIdentifier"("projectId");

-- CreateIndex
CREATE INDEX "ProjectIdentifier_definitionId_idx" ON "ProjectIdentifier"("definitionId");

-- CreateIndex
CREATE INDEX "LlcDocument_orgId_idx" ON "LlcDocument"("orgId");

-- CreateIndex
CREATE INDEX "LlcDocument_llcId_createdAt_idx" ON "LlcDocument"("llcId", "createdAt");

-- CreateIndex
CREATE INDEX "LlcDocument_createdByUserId_idx" ON "LlcDocument"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LlcPartner_llcId_partnerId_key" ON "LlcPartner"("llcId", "partnerId");

-- CreateIndex
CREATE INDEX "LlcPartner_orgId_idx" ON "LlcPartner"("orgId");

-- CreateIndex
CREATE INDEX "LlcPartner_llcId_idx" ON "LlcPartner"("llcId");

-- CreateIndex
CREATE INDEX "LlcPartner_partnerId_idx" ON "LlcPartner"("partnerId");

-- AddForeignKey
ALTER TABLE "OrgTodo" ADD CONSTRAINT "OrgTodo_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgTodo" ADD CONSTRAINT "OrgTodo_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentifierDefinition" ADD CONSTRAINT "IdentifierDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentifierDefinition" ADD CONSTRAINT "IdentifierDefinition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIdentifier" ADD CONSTRAINT "ProjectIdentifier_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIdentifier" ADD CONSTRAINT "ProjectIdentifier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIdentifier" ADD CONSTRAINT "ProjectIdentifier_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "IdentifierDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlcDocument" ADD CONSTRAINT "LlcDocument_llcId_fkey" FOREIGN KEY ("llcId") REFERENCES "LLC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlcDocument" ADD CONSTRAINT "LlcDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlcPartner" ADD CONSTRAINT "LlcPartner_llcId_fkey" FOREIGN KEY ("llcId") REFERENCES "LLC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlcPartner" ADD CONSTRAINT "LlcPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
