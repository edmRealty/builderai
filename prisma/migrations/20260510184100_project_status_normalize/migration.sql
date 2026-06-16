UPDATE "Project" SET "status" = 'COMPLETED_FOR_SALE' WHERE "status" IN ('COMPLETED', 'FOR_SALE');
UPDATE "Project" SET "status" = 'COMPLETED_FOR_RENT' WHERE "status" = 'RENTAL_READY';
