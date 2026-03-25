-- AlterTable
ALTER TABLE "Testimonial" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Testimonial_isApproved_idx" ON "Testimonial"("isApproved");
