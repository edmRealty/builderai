-- CreateEnum
CREATE TYPE "UnitRentalStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'OFF_MARKET');

-- AlterTable
ALTER TABLE "Unit"
ADD COLUMN     "rentalStatus" "UnitRentalStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "rentCents" INTEGER,
ADD COLUMN     "marketRentCents" INTEGER,
ADD COLUMN     "availableOn" TIMESTAMP(3),
ADD COLUMN     "currentTenantName" TEXT,
ADD COLUMN     "leaseStart" TIMESTAMP(3),
ADD COLUMN     "leaseEnd" TIMESTAMP(3),
ADD COLUMN     "buildiumUnitId" TEXT;

