-- AlterTable
ALTER TABLE "Gallery" ADD COLUMN     "linkLockedUntil" TIMESTAMP(3),
ADD COLUMN     "linkTokenEnc" TEXT;

-- CreateTable
CREATE TABLE "ClientSession" (
    "id" UUID NOT NULL,
    "galleryId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "deviceType" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSession_tokenHash_key" ON "ClientSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientSession_galleryId_idx" ON "ClientSession"("galleryId");

-- CreateIndex
CREATE INDEX "AccessEvent_galleryId_type_ip_createdAt_idx" ON "AccessEvent"("galleryId", "type", "ip", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientSession" ADD CONSTRAINT "ClientSession_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

