-- Socio de la semana: cuándo se le avisó que complete su perfil. Una columna nueva, opcional, en una
-- tabla que ya existe; no toca datos. Se aplica ANTES de desplegar el código que la usa, y después:
--   npx prisma migrate resolve --applied 20261007000000_fotoffice_aviso_socio_de_la_semana

-- AlterTable
ALTER TABLE "MemberSpotlight" ADD COLUMN     "nudgeSentAt" TIMESTAMP(3);

