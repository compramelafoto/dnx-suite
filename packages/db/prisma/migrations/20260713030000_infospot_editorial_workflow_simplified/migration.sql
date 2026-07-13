-- ETAPA 15: Simplificación del workflow editorial InfoSpot
-- Solo staging / entornos no productivos en esta rama. No aplicar a producción
-- hasta un release explícito. Seguro de ejecutar múltiples veces (UPDATE sin filas = no-op).

-- 1. Convertir READY_TO_PUBLISH → IN_REVIEW (alias legado)
UPDATE "InfoSpotArticle" SET status = 'IN_REVIEW' WHERE status = 'READY_TO_PUBLISH';
UPDATE "InfoSpotEvent"   SET status = 'IN_REVIEW' WHERE status = 'READY_TO_PUBLISH';

-- 2. Despublicar contenido DEMO que estaba PUBLISHED (dependía del gate contentTag=REAL
--    para no aparecer; al eliminar ese filtro quedaría público incorrectamente).
UPDATE "InfoSpotArticle"
  SET status = 'UNPUBLISHED',
      "unpublishedAt" = COALESCE("unpublishedAt", NOW())
  WHERE status = 'PUBLISHED' AND "contentTag" = 'DEMO';

UPDATE "InfoSpotEvent"
  SET status = 'UNPUBLISHED',
      "unpublishedAt" = COALESCE("unpublishedAt", NOW())
  WHERE status = 'PUBLISHED' AND "contentTag" = 'DEMO';
