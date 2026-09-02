-- CreateTable
CREATE TABLE "master_schedules" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isWorking" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_schedules_salonId_idx" ON "master_schedules"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "master_schedules_masterId_date_key" ON "master_schedules"("masterId", "date");

-- AddForeignKey
ALTER TABLE "master_schedules" ADD CONSTRAINT "master_schedules_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_schedules" ADD CONSTRAINT "master_schedules_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
