-- 1) Quitar default
ALTER TABLE "ZipGenerationJob"
  ALTER COLUMN "photoIds" DROP DEFAULT;

-- 2) Cambiar tipo de text[] a int[]
ALTER TABLE "ZipGenerationJob"
  ALTER COLUMN "photoIds"
  TYPE INTEGER[]
  USING "photoIds"::INTEGER[];

-- 3) Volver a setear default vacío correctamente
ALTER TABLE "ZipGenerationJob"
  ALTER COLUMN "photoIds"
  SET DEFAULT '{}';
