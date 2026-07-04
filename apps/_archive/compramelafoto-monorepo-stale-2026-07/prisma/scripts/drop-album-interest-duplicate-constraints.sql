-- Elimina los unique constraints/índices que ya existen en la DB para que prisma db push no falle.
-- Ejecutar antes de: npm run prisma:push

-- En PostgreSQL un UNIQUE constraint crea un índice; a veces el objeto existe como índice.
DROP INDEX IF EXISTS "AlbumInterest_selfieKey_key";
DROP INDEX IF EXISTS "AlbumInterest_faceId_key";
ALTER TABLE "AlbumInterest" DROP CONSTRAINT IF EXISTS "AlbumInterest_selfieKey_key";
ALTER TABLE "AlbumInterest" DROP CONSTRAINT IF EXISTS "AlbumInterest_faceId_key";
