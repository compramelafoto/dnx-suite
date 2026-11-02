-- Se aplica DESPUÉS de publicar el código de la v2: la versión anterior todavía lee estas
-- columnas, y Prisma pide todas las columnas del modelo en cada consulta.

-- AlterTable
ALTER TABLE "LiveRaffle" DROP COLUMN "oneWinPerPerson";

-- AlterTable
ALTER TABLE "LiveRafflePrize" DROP COLUMN "absentEntrantIds",
DROP COLUMN "drawnAt",
DROP COLUMN "winnerEntrantId";
