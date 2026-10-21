-- Foto carnet como archivo digital: se encuadra igual que la impresa, pero se entrega como archivo
-- y no sale por ninguna impresora. Por eso la impresora y la hoja pasan a ser opcionales, y sólo
-- pueden faltar (las dos juntas) cuando el producto se cobra por ARCHIVO, que es sólo de carnet.

ALTER TABLE "FotofficeProductoProduccion" ALTER COLUMN "salidaId" DROP NOT NULL;
ALTER TABLE "FotofficeProductoProduccion" ALTER COLUMN "tamanoHojaId" DROP NOT NULL;

ALTER TABLE "FotofficeProductoProduccion" DROP CONSTRAINT IF EXISTS "FotofficeProductoProduccion_unidad_check";
ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_unidad_check" CHECK ("unidad" IN ('HOJA','COPIA','PIEZA','ARCHIVO'));

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_archivo_check" CHECK (
    ("unidad" = 'ARCHIVO' AND "tipoPieza" = 'CARNET' AND "salidaId" IS NULL AND "tamanoHojaId" IS NULL)
    OR ("unidad" <> 'ARCHIVO' AND "salidaId" IS NOT NULL AND "tamanoHojaId" IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
