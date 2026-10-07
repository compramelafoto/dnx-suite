-- Productos de un solo álbum: un colegio con precios propios no mezcla su lista con la del resto.
ALTER TABLE "PhotographerProduct" ADD COLUMN IF NOT EXISTS "albumId" INTEGER;
CREATE INDEX IF NOT EXISTS "PhotographerProduct_albumId_idx" ON "PhotographerProduct"("albumId");
