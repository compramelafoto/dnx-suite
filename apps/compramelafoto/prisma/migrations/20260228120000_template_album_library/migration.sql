-- Plantillas del álbum: el fotógrafo guarda plantillas primero (biblioteca del álbum) y luego las asigna a productos.
-- 1. Añadir albumId a Template
ALTER TABLE "Template" ADD COLUMN "albumId" INTEGER;

-- 2. Rellenar desde el producto asociado
UPDATE "Template" t
SET "albumId" = p."albumId"
FROM "AlbumProduct" p
WHERE p.id = t."albumProductId";

-- 3. Hacer albumId obligatorio (todas las filas existentes tienen producto)
ALTER TABLE "Template" ALTER COLUMN "albumId" SET NOT NULL;

-- 4. Hacer albumProductId opcional (plantillas de biblioteca no tienen producto)
ALTER TABLE "Template" ALTER COLUMN "albumProductId" DROP NOT NULL;

-- 5. FK y índice
ALTER TABLE "Template" ADD CONSTRAINT "Template_albumId_fkey"
  FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Template_albumId_idx" ON "Template"("albumId");
