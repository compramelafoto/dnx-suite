-- AlterTable: Album pre-compra PRO
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "preCompraCloseAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requireClientApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "PreCompraOrderStatus" AS ENUM ('CREATED', 'PAID_HELD', 'CANCELED');
CREATE TYPE "PreCompraOrderItemStatus" AS ENUM ('WAITING_SELFIE', 'WAITING_UPLOAD', 'APPROVED_BY_MATCH', 'WAITING_SELECTION', 'READY_TO_DESIGN', 'DESIGN_SUBMITTED', 'NEEDS_CHANGES', 'APPROVED', 'EXPORTED');
CREATE TYPE "ApprovalProof" AS ENUM ('FACE_MATCH', 'SELECTION');
CREATE TYPE "PhotoClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "DesignProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'APPROVED');
CREATE TYPE "DesignRevisionCreatedBy" AS ENUM ('CLIENT', 'PHOTOGRAPHER');

-- CreateTable AlbumProduct
CREATE TABLE "AlbumProduct" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "mockupUrl" TEXT,
    "minFotos" INTEGER NOT NULL DEFAULT 1,
    "maxFotos" INTEGER NOT NULL DEFAULT 1,
    "requiresDesign" BOOLEAN NOT NULL DEFAULT false,
    "suggestionText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable PreCompraOrder
CREATE TABLE "PreCompraOrder" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerUserId" INTEGER,
    "status" "PreCompraOrderStatus" NOT NULL DEFAULT 'CREATED',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCompraOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable Subject
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "createdByOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable SubjectSelfie
CREATE TABLE "SubjectSelfie" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectSelfie_pkey" PRIMARY KEY ("id")
);

-- CreateTable PhotoFace
CREATE TABLE "PhotoFace" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "bbox" JSONB NOT NULL,
    "faceExternalId" TEXT,
    "faceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoFace_pkey" PRIMARY KEY ("id")
);

-- CreateTable FaceMatch
CREATE TABLE "FaceMatch" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "photoFaceId" INTEGER,
    "confidence" DOUBLE PRECISION,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable PhotoClaim
CREATE TABLE "PhotoClaim" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "PhotoClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable PreCompraOrderItem
CREATE TABLE "PreCompraOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "albumProductId" INTEGER NOT NULL,
    "subjectId" INTEGER,
    "status" "PreCompraOrderItemStatus" NOT NULL DEFAULT 'WAITING_SELFIE',
    "approvalProof" "ApprovalProof",
    "approvedAt" TIMESTAMP(3),
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCompraOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable Selection
CREATE TABLE "Selection" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable SelectionPhoto
CREATE TABLE "SelectionPhoto" (
    "id" SERIAL NOT NULL,
    "selectionId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "position" INTEGER DEFAULT 0,
    "subjectId" INTEGER,

    CONSTRAINT "SelectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable Template
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "albumProductId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "greenColorHex" TEXT NOT NULL DEFAULT '#00ff00',
    "tolerance" INTEGER NOT NULL DEFAULT 30,
    "widthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "safeAreaConfigJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable TemplateSlot
CREATE TABLE "TemplateSlot" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "bbox" JSONB NOT NULL,
    "maskPngUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable DesignProject
CREATE TABLE "DesignProject" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    "status" "DesignProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable DesignRevision
CREATE TABLE "DesignRevision" (
    "id" SERIAL NOT NULL,
    "designProjectId" INTEGER NOT NULL,
    "createdBy" "DesignRevisionCreatedBy" NOT NULL DEFAULT 'CLIENT',
    "dataJson" JSONB,
    "exportedJpgUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignRevision_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "Template_albumProductId_key" ON "Template"("albumProductId");
CREATE UNIQUE INDEX "Selection_orderItemId_key" ON "Selection"("orderItemId");
CREATE UNIQUE INDEX "DesignProject_orderItemId_key" ON "DesignProject"("orderItemId");
CREATE UNIQUE INDEX "DesignProject_currentRevisionId_key" ON "DesignProject"("currentRevisionId");
CREATE UNIQUE INDEX "FaceMatch_subjectId_photoId_key" ON "FaceMatch"("subjectId", "photoId");

-- Indexes
CREATE INDEX "AlbumProduct_albumId_idx" ON "AlbumProduct"("albumId");
CREATE INDEX "PreCompraOrder_albumId_idx" ON "PreCompraOrder"("albumId");
CREATE INDEX "PreCompraOrder_buyerEmail_idx" ON "PreCompraOrder"("buyerEmail");
CREATE INDEX "PreCompraOrder_buyerUserId_idx" ON "PreCompraOrder"("buyerUserId");
CREATE INDEX "Subject_albumId_idx" ON "Subject"("albumId");
CREATE INDEX "Subject_createdByOrderId_idx" ON "Subject"("createdByOrderId");
CREATE INDEX "SubjectSelfie_subjectId_idx" ON "SubjectSelfie"("subjectId");
CREATE INDEX "SubjectSelfie_orderId_idx" ON "SubjectSelfie"("orderId");
CREATE INDEX "PhotoFace_photoId_idx" ON "PhotoFace"("photoId");
CREATE INDEX "FaceMatch_subjectId_idx" ON "FaceMatch"("subjectId");
CREATE INDEX "FaceMatch_photoId_idx" ON "FaceMatch"("photoId");
CREATE INDEX "FaceMatch_photoFaceId_idx" ON "FaceMatch"("photoFaceId");
CREATE INDEX "PhotoClaim_photoId_idx" ON "PhotoClaim"("photoId");
CREATE INDEX "PhotoClaim_subjectId_idx" ON "PhotoClaim"("subjectId");
CREATE INDEX "PhotoClaim_orderId_idx" ON "PhotoClaim"("orderId");
CREATE INDEX "PhotoClaim_status_idx" ON "PhotoClaim"("status");
CREATE INDEX "PreCompraOrderItem_orderId_idx" ON "PreCompraOrderItem"("orderId");
CREATE INDEX "PreCompraOrderItem_albumProductId_idx" ON "PreCompraOrderItem"("albumProductId");
CREATE INDEX "PreCompraOrderItem_subjectId_idx" ON "PreCompraOrderItem"("subjectId");
CREATE INDEX "PreCompraOrderItem_status_idx" ON "PreCompraOrderItem"("status");
CREATE INDEX "Selection_orderItemId_idx" ON "Selection"("orderItemId");
CREATE INDEX "SelectionPhoto_selectionId_idx" ON "SelectionPhoto"("selectionId");
CREATE INDEX "SelectionPhoto_photoId_idx" ON "SelectionPhoto"("photoId");
CREATE INDEX "Template_albumProductId_idx" ON "Template"("albumProductId");
CREATE INDEX "TemplateSlot_templateId_idx" ON "TemplateSlot"("templateId");
CREATE INDEX "DesignProject_orderItemId_idx" ON "DesignProject"("orderItemId");
CREATE INDEX "DesignProject_templateId_idx" ON "DesignProject"("templateId");
CREATE INDEX "DesignProject_status_idx" ON "DesignProject"("status");
CREATE INDEX "DesignRevision_designProjectId_idx" ON "DesignRevision"("designProjectId");

-- FKs
ALTER TABLE "AlbumProduct" ADD CONSTRAINT "AlbumProduct_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreCompraOrder" ADD CONSTRAINT "PreCompraOrder_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_createdByOrderId_fkey" FOREIGN KEY ("createdByOrderId") REFERENCES "PreCompraOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubjectSelfie" ADD CONSTRAINT "SubjectSelfie_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectSelfie" ADD CONSTRAINT "SubjectSelfie_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PreCompraOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoFace" ADD CONSTRAINT "PhotoFace_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceMatch" ADD CONSTRAINT "FaceMatch_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceMatch" ADD CONSTRAINT "FaceMatch_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceMatch" ADD CONSTRAINT "FaceMatch_photoFaceId_fkey" FOREIGN KEY ("photoFaceId") REFERENCES "PhotoFace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoClaim" ADD CONSTRAINT "PhotoClaim_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoClaim" ADD CONSTRAINT "PhotoClaim_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoClaim" ADD CONSTRAINT "PhotoClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PreCompraOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreCompraOrderItem" ADD CONSTRAINT "PreCompraOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PreCompraOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreCompraOrderItem" ADD CONSTRAINT "PreCompraOrderItem_albumProductId_fkey" FOREIGN KEY ("albumProductId") REFERENCES "AlbumProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreCompraOrderItem" ADD CONSTRAINT "PreCompraOrderItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "PreCompraOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelectionPhoto" ADD CONSTRAINT "SelectionPhoto_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelectionPhoto" ADD CONSTRAINT "SelectionPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelectionPhoto" ADD CONSTRAINT "SelectionPhoto_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_albumProductId_fkey" FOREIGN KEY ("albumProductId") REFERENCES "AlbumProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateSlot" ADD CONSTRAINT "TemplateSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "PreCompraOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "DesignRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesignRevision" ADD CONSTRAINT "DesignRevision_designProjectId_fkey" FOREIGN KEY ("designProjectId") REFERENCES "DesignProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
