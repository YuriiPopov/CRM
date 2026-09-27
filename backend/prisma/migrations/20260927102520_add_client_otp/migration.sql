-- CreateTable
CREATE TABLE "client_otps" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_otps_salonId_phone_idx" ON "client_otps"("salonId", "phone");

-- AddForeignKey
ALTER TABLE "client_otps" ADD CONSTRAINT "client_otps_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
