CREATE TYPE "VendorCommunicationType" AS ENUM ('CALL', 'TEXT', 'EMAIL');

CREATE TABLE "VendorCommunication" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "type" "VendorCommunicationType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorCommunication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VendorCommunication_orgId_createdAt_idx" ON "VendorCommunication"("orgId", "createdAt");
CREATE INDEX "VendorCommunication_vendorId_createdAt_idx" ON "VendorCommunication"("vendorId", "createdAt");
CREATE INDEX "VendorCommunication_projectId_createdAt_idx" ON "VendorCommunication"("projectId", "createdAt");
CREATE INDEX "VendorCommunication_createdByUserId_idx" ON "VendorCommunication"("createdByUserId");

ALTER TABLE "VendorCommunication" ADD CONSTRAINT "VendorCommunication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorCommunication" ADD CONSTRAINT "VendorCommunication_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorCommunication" ADD CONSTRAINT "VendorCommunication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorCommunication" ADD CONSTRAINT "VendorCommunication_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
