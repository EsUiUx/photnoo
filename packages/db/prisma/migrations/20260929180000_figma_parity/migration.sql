-- CreateEnum
CREATE TYPE "GalleryTheme" AS ENUM ('light', 'dark');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('gallery_opened', 'gallery_downloaded', 'gallery_expiring', 'gallery_closed', 'gallery_ready', 'order_placed', 'payment_approved', 'payment_rejected', 'allowance_warning', 'renewal_due');

-- CreateEnum
CREATE TYPE "PrintType" AS ENUM ('album', 'frame', 'canvas', 'magazine', 'wooden', 'other');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('store', 'print');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'in_production', 'ready', 'delivered', 'cancelled');

-- AlterTable
ALTER TABLE "Gallery" ADD COLUMN     "clientId" UUID,
ADD COLUMN     "printsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Photographer" ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "behanceUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "galleryTheme" "GalleryTheme" NOT NULL DEFAULT 'light',
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyExpiring" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyFirstOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyFullDownload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOrders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "otherUrl" TEXT,
ADD COLUMN     "portfolioPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "storeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "galleryId" UUID,
    "orderId" UUID,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceEgp" DECIMAL(12,2) NOT NULL,
    "salePriceEgp" DECIMAL(12,2),
    "imageKey" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintItem" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "type" "PrintType" NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "priceEgp" DECIMAL(12,2) NOT NULL,
    "imageKey" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PrintItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "OrderKind" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "clientId" UUID,
    "galleryId" UUID,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "note" TEXT,
    "totalEgp" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "printItemId" UUID,
    "fileId" UUID,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "unitPriceEgp" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" UUID NOT NULL,
    "photographerId" UUID NOT NULL,
    "imageKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "blurDataUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "category" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotographerCounter" (
    "photographerId" UUID NOT NULL,
    "lastOrderNumber" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "PhotographerCounter_pkey" PRIMARY KEY ("photographerId")
);

-- CreateIndex
CREATE INDEX "Client_photographerId_createdAt_idx" ON "Client"("photographerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_photographerId_phone_key" ON "Client"("photographerId", "phone");

-- CreateIndex
CREATE INDEX "Notification_photographerId_createdAt_idx" ON "Notification"("photographerId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_photographerId_readAt_idx" ON "Notification"("photographerId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_photographerId_dedupeKey_key" ON "Notification"("photographerId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Product_photographerId_archivedAt_position_idx" ON "Product"("photographerId", "archivedAt", "position");

-- CreateIndex
CREATE INDEX "PrintItem_photographerId_archivedAt_type_position_idx" ON "PrintItem"("photographerId", "archivedAt", "type", "position");

-- CreateIndex
CREATE INDEX "Order_photographerId_kind_createdAt_idx" ON "Order"("photographerId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Order_photographerId_status_idx" ON "Order"("photographerId", "status");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_photographerId_number_key" ON "Order"("photographerId", "number");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_imageKey_key" ON "PortfolioItem"("imageKey");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_previewKey_key" ON "PortfolioItem"("previewKey");

-- CreateIndex
CREATE INDEX "PortfolioItem_photographerId_position_idx" ON "PortfolioItem"("photographerId", "position");

-- CreateIndex
CREATE INDEX "Gallery_clientId_idx" ON "Gallery"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Photographer_slug_key" ON "Photographer"("slug");

-- AddForeignKey
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintItem" ADD CONSTRAINT "PrintItem_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_printItemId_fkey" FOREIGN KEY ("printItemId") REFERENCES "PrintItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotographerCounter" ADD CONSTRAINT "PhotographerCounter_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "Photographer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: one managed client per (photographer, phone) from existing galleries.
INSERT INTO "Client" ("id", "photographerId", "name", "phone", "email", "createdAt", "updatedAt")
SELECT gen_random_uuid(), g."photographerId",
       (array_agg(g."clientName" ORDER BY g."createdAt" DESC) FILTER (WHERE g."clientName" IS NOT NULL))[1],
       g."clientPhone",
       (array_agg(g."clientEmail" ORDER BY g."createdAt" DESC) FILTER (WHERE g."clientEmail" IS NOT NULL))[1],
       min(g."createdAt"), now()
FROM "Gallery" g
WHERE g."clientPhone" IS NOT NULL
GROUP BY g."photographerId", g."clientPhone"
HAVING (array_agg(g."clientName") FILTER (WHERE g."clientName" IS NOT NULL))[1] IS NOT NULL;

UPDATE "Gallery" g SET "clientId" = c."id"
FROM "Client" c
WHERE c."photographerId" = g."photographerId" AND c."phone" = g."clientPhone";
