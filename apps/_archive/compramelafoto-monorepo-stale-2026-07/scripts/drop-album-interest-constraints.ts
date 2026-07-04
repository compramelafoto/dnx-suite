/**
 * Elimina los unique constraints/índices duplicados en AlbumInterest para que prisma db push no falle.
 * Uso: npx tsx scripts/drop-album-interest-constraints.ts
 */
import { prisma } from "../lib/prisma";

const statements = [
  'DROP INDEX IF EXISTS "AlbumInterest_selfieKey_key";',
  'DROP INDEX IF EXISTS "AlbumInterest_faceId_key";',
  'ALTER TABLE "AlbumInterest" DROP CONSTRAINT IF EXISTS "AlbumInterest_selfieKey_key";',
  'ALTER TABLE "AlbumInterest" DROP CONSTRAINT IF EXISTS "AlbumInterest_faceId_key";',
];

async function main() {
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("OK:", sql.slice(0, 50) + "...");
    } catch (e: any) {
      if (e?.message?.includes("does not exist")) {
        console.log("Skip (no existía):", sql.slice(0, 50) + "...");
      } else {
        throw e;
      }
    }
  }
  console.log("Listo. Ejecutá: npm run prisma:push");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
