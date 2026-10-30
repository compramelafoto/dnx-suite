-- Preparar para laboratorio: destino de la preparación, y medida, plazo y papel por pieza;
-- el ítem del pedido recuerda de qué pieza salió.
ALTER TABLE "FotofficePreparacionImpresion" ADD COLUMN IF NOT EXISTS "destino" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "FotofficePiezaImpresion" ADD COLUMN IF NOT EXISTS "medida" TEXT;
ALTER TABLE "FotofficePiezaImpresion" ADD COLUMN IF NOT EXISTS "plazo" TEXT;
ALTER TABLE "FotofficePiezaImpresion" ADD COLUMN IF NOT EXISTS "papel" TEXT;
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN IF NOT EXISTS "piezaId" TEXT;
CREATE INDEX IF NOT EXISTS "FotofficePrintOrderItem_piezaId_idx" ON "FotofficePrintOrderItem"("piezaId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficePreparacionImpresion_destino_check') THEN
    ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_destino_check" CHECK ("destino" IN ('LOCAL','LABORATORIO'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficePiezaImpresion_plazo_check') THEN
    ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_plazo_check" CHECK ("plazo" IS NULL OR "plazo" IN ('MANANA','SEMANA'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficePiezaImpresion_papel_check') THEN
    ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_papel_check" CHECK ("papel" IS NULL OR "papel" IN ('MATE','BRILLO'));
  END IF;
END $$;

