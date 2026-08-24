-- AlterTable
ALTER TABLE "master_blocks" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "master_blocks" ADD CONSTRAINT "master_blocks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
