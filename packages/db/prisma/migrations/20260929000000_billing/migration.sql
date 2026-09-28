/*
  Warnings:

  - Added the required column `photographerId` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kind` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `photographerId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `planId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('new', 'renewal', 'upgrade');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "photographerId" UUID NOT NULL,
ADD COLUMN     "periodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "declaredAmountEgp" DECIMAL(12,2),
ADD COLUMN     "kind" "PaymentKind" NOT NULL,
ADD COLUMN     "photographerId" UUID NOT NULL,
ADD COLUMN     "planId" UUID NOT NULL,
ADD COLUMN     "proofMime" TEXT,
ADD COLUMN     "proofName" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "method" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'awaiting_proof';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "nextPlanId" UUID,
ADD COLUMN     "priceEgp" DECIMAL(12,2),
ADD COLUMN     "renewalPaidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BillingNotice" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingNotice_subscriptionId_kind_cycleEnd_key" ON "BillingNotice"("subscriptionId", "kind", "cycleEnd");

-- CreateIndex
CREATE INDEX "Invoice_photographerId_issuedAt_idx" ON "Invoice"("photographerId", "issuedAt");

-- CreateIndex
CREATE INDEX "Payment_photographerId_createdAt_idx" ON "Payment"("photographerId", "createdAt");

-- CreateIndex
CREATE INDEX "Plan_tier_cycle_idx" ON "Plan"("tier", "cycle");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_nextPlanId_fkey" FOREIGN KEY ("nextPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingNotice" ADD CONSTRAINT "BillingNotice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
