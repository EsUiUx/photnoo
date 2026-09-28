-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PhotographerStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('annual', 'monthly');

-- CreateEnum
CREATE TYPE "SubscriptionState" AS ENUM ('trial', 'pending_payment', 'active', 'soft_locked', 'dormant', 'suspended');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('instapay', 'vodafone_cash', 'bank_transfer', 'paymob');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('upload', 'top_up', 'cycle_reset');

-- CreateEnum
CREATE TYPE "GalleryState" AS ENUM ('draft', 'active', 'closed', 'purged', 'anonymised');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('uploading', 'processing', 'ready', 'rejected', 'purged');

-- CreateEnum
CREATE TYPE "AccessEventType" AS ENUM ('open', 'password_ok', 'password_fail');

-- CreateEnum
CREATE TYPE "AbuseReportStatus" AS ENUM ('open', 'actioned', 'dismissed');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'operations', 'support');

-- CreateTable
CREATE TABLE "Photographer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "studioName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'ar',
    "logoKey" TEXT,
    "status" "PhotographerStatus" NOT NULL DEFAULT 'active',
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "applicationId" UUID,

    CONSTRAINT "Photographer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "studioName" TEXT,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "portfolioUrl" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'pending',
    "decisionReason" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "grantTrial" BOOLEAN NOT NULL DEFAULT false,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "inviteUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "tier" TEXT NOT NULL,
    "allowanceBytes" BIGINT NOT NULL,
    "cycle" "BillingCycle" NOT NULL,
    "priceEgp" DECIMAL(12,2) NOT NULL,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "planId" UUID,
    "state" "SubscriptionState" NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "allowanceBytes" BIGINT NOT NULL,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountEgp" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "proofKey" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "approvedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "paymentId" UUID NOT NULL,
    "totalEgp" DECIMAL(12,2) NOT NULL,
    "vatEgp" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pdfKey" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "bytes" BIGINT NOT NULL,
    "galleryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gallery" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "state" "GalleryState" NOT NULL DEFAULT 'draft',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),
    "linkTokenHash" TEXT,
    "passwordHash" TEXT,
    "coverFileId" UUID,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "extendedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "purgedAt" TIMESTAMP(3),
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "capBytes" BIGINT NOT NULL DEFAULT 0,
    "servedBytes" BIGINT NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "lastUploadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" UUID NOT NULL,
    "galleryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "galleryId" UUID NOT NULL,
    "folderId" UUID,
    "originalName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT,
    "sha256" TEXT,
    "originalKey" TEXT NOT NULL,
    "previewKey" TEXT,
    "blurDataUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "FileStatus" NOT NULL DEFAULT 'uploading',
    "rejectReason" TEXT,
    "uploadId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessEvent" (
    "id" UUID NOT NULL,
    "galleryId" UUID NOT NULL,
    "type" "AccessEventType" NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "deviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadReceipt" (
    "id" UUID NOT NULL,
    "galleryId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "bytes" BIGINT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "deviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" UUID NOT NULL,
    "galleryId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reporterEmail" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "totpSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "reason" TEXT,
    "ip" TEXT,
    "data" JSONB,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flag" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "setById" TEXT,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Photographer_email_key" ON "Photographer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Photographer_phone_key" ON "Photographer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Photographer_applicationId_key" ON "Photographer"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_inviteTokenHash_key" ON "Application"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE INDEX "Session_photographerId_idx" ON "Session"("photographerId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "PasswordResetCode_photographerId_createdAt_idx" ON "PasswordResetCode"("photographerId", "createdAt");

-- CreateIndex
CREATE INDEX "Plan_cycle_activeFrom_idx" ON "Plan"("cycle", "activeFrom");

-- CreateIndex
CREATE INDEX "Subscription_photographerId_state_idx" ON "Subscription"("photographerId", "state");

-- CreateIndex
CREATE INDEX "Subscription_state_cycleEnd_idx" ON "Subscription"("state", "cycleEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");

-- CreateIndex
CREATE INDEX "UsageEvent_photographerId_createdAt_idx" ON "UsageEvent"("photographerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Gallery_linkTokenHash_key" ON "Gallery"("linkTokenHash");

-- CreateIndex
CREATE INDEX "Gallery_photographerId_state_createdAt_idx" ON "Gallery"("photographerId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "Gallery_state_expiresAt_idx" ON "Gallery"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_galleryId_name_key" ON "Folder"("galleryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "File_originalKey_key" ON "File"("originalKey");

-- CreateIndex
CREATE UNIQUE INDEX "File_previewKey_key" ON "File"("previewKey");

-- CreateIndex
CREATE INDEX "File_galleryId_status_idx" ON "File"("galleryId", "status");

-- CreateIndex
CREATE INDEX "File_galleryId_folderId_position_idx" ON "File"("galleryId", "folderId", "position");

-- CreateIndex
CREATE INDEX "AccessEvent_galleryId_createdAt_idx" ON "AccessEvent"("galleryId", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadReceipt_galleryId_createdAt_idx" ON "DownloadReceipt"("galleryId", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadReceipt_sessionId_fileId_createdAt_idx" ON "DownloadReceipt"("sessionId", "fileId", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseReport_status_createdAt_idx" ON "AbuseReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Photographer" ADD CONSTRAINT "Photographer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "PasswordResetCode_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadReceipt" ADD CONSTRAINT "DownloadReceipt_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadReceipt" ADD CONSTRAINT "DownloadReceipt_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

