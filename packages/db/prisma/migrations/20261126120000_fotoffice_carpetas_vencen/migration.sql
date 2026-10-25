-- FOTOFFICE: las carpetas de trabajos con archivos y sin vencimiento vencen dentro de 30 días
-- (un mes de aviso: nada se borra de golpe). Idempotente: sólo toca las que siguen sin fecha.
UPDATE "FotofficeProyecto" p
SET "carpetaVence" = NOW() + INTERVAL '30 days'
WHERE p."carpetaVence" IS NULL
  AND EXISTS (SELECT 1 FROM "FotofficeArchivoTrabajo" a WHERE a."proyectoId" = p."id");
