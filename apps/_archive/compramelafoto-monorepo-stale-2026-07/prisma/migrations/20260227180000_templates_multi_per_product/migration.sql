-- Template: permitir varias plantillas por producto y plantilla por defecto en AlbumProduct

-- 1. Añadir nombre a Template (valores existentes = 'Plantilla principal')
ALTER TABLE "Template" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Plantilla principal';

-- 2. Añadir columna defaultTemplateId en AlbumProduct
ALTER TABLE "AlbumProduct" ADD COLUMN "defaultTemplateId" INTEGER;

-- 3. Asignar como default la plantilla que ya tenía cada producto (1:1 anterior)
UPDATE "AlbumProduct" ap
SET "defaultTemplateId" = t.id
FROM "Template" t
WHERE t."albumProductId" = ap.id;

-- 4. FK y UNIQUE para defaultTemplateId
ALTER TABLE "AlbumProduct" ADD CONSTRAINT "AlbumProduct_defaultTemplateId_fkey"
  FOREIGN KEY ("defaultTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AlbumProduct_defaultTemplateId_key" ON "AlbumProduct"("defaultTemplateId");

-- 5. Quitar unicidad de albumProductId en Template (varias plantillas por producto)
DROP INDEX "Template_albumProductId_key";
