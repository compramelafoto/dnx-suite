-- Alta sin aprobación, formulario corto y renovación sin deuda. Todo apagado por defecto.
-- AlterTable
ALTER TABLE "MemberCategory" ADD COLUMN     "selfRenew" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MembershipDuesSettings" ADD COLUMN     "applicationCategoryId" TEXT,
ADD COLUMN     "autoApproveApplications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "simpleApplicationForm" BOOLEAN NOT NULL DEFAULT false;

