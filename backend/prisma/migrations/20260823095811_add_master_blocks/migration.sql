-- CreateTable
CREATE TABLE "master_blocks" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_blocks_salonId_idx" ON "master_blocks"("salonId");

-- CreateIndex
CREATE INDEX "master_blocks_masterId_startTime_idx" ON "master_blocks"("masterId", "startTime");

-- AddForeignKey
ALTER TABLE "master_blocks" ADD CONSTRAINT "master_blocks_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_blocks" ADD CONSTRAINT "master_blocks_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
