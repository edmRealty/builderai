CREATE TYPE "BankCommunicationType" AS ENUM ('CALL', 'TEXT', 'EMAIL');

CREATE TABLE "BankCommunication" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "type" "BankCommunicationType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankCommunication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankCommunication_orgId_createdAt_idx" ON "BankCommunication"("orgId", "createdAt");
CREATE INDEX "BankCommunication_bankId_createdAt_idx" ON "BankCommunication"("bankId", "createdAt");
CREATE INDEX "BankCommunication_projectId_createdAt_idx" ON "BankCommunication"("projectId", "createdAt");
CREATE INDEX "BankCommunication_createdByUserId_idx" ON "BankCommunication"("createdByUserId");

ALTER TABLE "BankCommunication" ADD CONSTRAINT "BankCommunication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankCommunication" ADD CONSTRAINT "BankCommunication_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankCommunication" ADD CONSTRAINT "BankCommunication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankCommunication" ADD CONSTRAINT "BankCommunication_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
