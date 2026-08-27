-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_categories_salonId_idx" ON "service_categories"("salonId");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed one category row per existing salon per legacy enum value, matching the
-- current frontend SERVICE_CATEGORY_LABELS text. MANICURE_PEDICURE becomes the
-- default category (matches its historical role as the first/most common value).
INSERT INTO "service_categories" ("id", "salonId", "name", "isDefault", "createdAt")
SELECT gen_random_uuid(), "id", 'Маникюр/педикюр', true, CURRENT_TIMESTAMP FROM "salons";

INSERT INTO "service_categories" ("id", "salonId", "name", "isDefault", "createdAt")
SELECT gen_random_uuid(), "id", 'СПА', false, CURRENT_TIMESTAMP FROM "salons";

INSERT INTO "service_categories" ("id", "salonId", "name", "isDefault", "createdAt")
SELECT gen_random_uuid(), "id", 'Массаж', false, CURRENT_TIMESTAMP FROM "salons";

-- AlterTable: add nullable categoryId to services, to be backfilled below
ALTER TABLE "services" ADD COLUMN "categoryId" TEXT;

-- Backfill services.categoryId from the legacy enum column
UPDATE "services" s
SET "categoryId" = sc."id"
FROM "service_categories" sc
WHERE sc."salonId" = s."salonId" AND sc."name" = 'Маникюр/педикюр' AND s."category" = 'MANICURE_PEDICURE';

UPDATE "services" s
SET "categoryId" = sc."id"
FROM "service_categories" sc
WHERE sc."salonId" = s."salonId" AND sc."name" = 'СПА' AND s."category" = 'SPA';

UPDATE "services" s
SET "categoryId" = sc."id"
FROM "service_categories" sc
WHERE sc."salonId" = s."salonId" AND sc."name" = 'Массаж' AND s."category" = 'MASSAGE';

-- AlterTable: enforce NOT NULL now that every row is backfilled
ALTER TABLE "services" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "services_categoryId_idx" ON "services"("categoryId");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: drop the legacy enum column now that categoryId fully replaces it
ALTER TABLE "services" DROP COLUMN "category";

-- CreateTable
CREATE TABLE "master_specializations" (
    "masterId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "master_specializations_pkey" PRIMARY KEY ("masterId","categoryId")
);

-- AddForeignKey
ALTER TABLE "master_specializations" ADD CONSTRAINT "master_specializations_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_specializations" ADD CONSTRAINT "master_specializations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill master_specializations from the legacy single-value enum column
INSERT INTO "master_specializations" ("masterId", "categoryId")
SELECT m."id", sc."id"
FROM "masters" m
JOIN "service_categories" sc
  ON sc."salonId" = m."salonId"
 AND sc."name" = CASE m."specialization"
     WHEN 'MANICURE_PEDICURE' THEN 'Маникюр/педикюр'
     WHEN 'SPA' THEN 'СПА'
     WHEN 'MASSAGE' THEN 'Массаж'
   END;

-- AlterTable: drop the legacy single-value enum column now that the join table replaces it
ALTER TABLE "masters" DROP COLUMN "specialization";

-- DropEnum
DROP TYPE "ServiceCategory";
