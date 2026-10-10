-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_user_id_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "next_send_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WaitlistLead" ADD COLUMN     "start_token" TEXT;

-- CreateIndex
CREATE INDEX "User_next_send_at_idx" ON "User"("next_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistLead_start_token_key" ON "WaitlistLead"("start_token");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

