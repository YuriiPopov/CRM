-- CreateTable
CREATE TABLE "service_photos" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_photos_salonId_idx" ON "service_photos"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "service_photos_serviceId_position_key" ON "service_photos"("serviceId", "position");

-- AddForeignKey
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
