-- Georreferenciar las direcciones del módulo de coberturas.
--
-- Una dirección bien escrita igual es ambigua: un predio puede tener tres accesos y la entrada
-- estar por el fondo. El punto que la organización confirma en el mapa del formulario público es
-- lo que saca la duda, y viaja después a la cobertura, que es lo que mira quien va a cubrir.
--
-- **Ninguna columna es obligatoria, y es a propósito.** Hay 66 solicitudes y 51 coberturas
-- cargadas sin estos datos, y sobre todo: si Nominatim no encuentra el lugar —pasa en pueblos
-- chicos— el pedido tiene que poder enviarse igual. La dirección escrita a mano sigue siendo el
-- dato; el punto es la precisión. Por eso no hay DEFAULT ni NOT NULL: las filas viejas quedan
-- exactamente como están y no hay nada que rellenar a mano.
--
-- `geohash` se guarda además de lat/lon porque es lo que hace barata la búsqueda por cercanía
-- («qué coberturas hay cerca de esta persona»): comparar un prefijo de texto con índice, en vez
-- de calcular la distancia contra cada fila. Lo calcula `@repo/geo` con precisión 7 (≈150 m), la
-- misma que ya usan InfoSpot y CompraMeLaFoto.

ALTER TABLE "CoverageRequest"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "geohash" TEXT;

ALTER TABLE "Coverage"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "geohash" TEXT;

CREATE INDEX "CoverageRequest_geohash_idx" ON "CoverageRequest"("geohash");
CREATE INDEX "Coverage_geohash_idx" ON "Coverage"("geohash");
