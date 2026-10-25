-- Etapa E FOTOFFICE: histórico de Caja (spec 2026-10-15, sección 7.6). Crea `FotofficeHistoricoLote` (un lote por
-- workspace y mes, con estado BORRADOR | CONFIRMADO | DESCARTADO), `FotofficeHistoricoMovimiento` (los movimientos
-- importados del libro viejo y los estimados, con su clase y rubro) y `FotofficeHistoricoMapeo` (concepto → rubro
-- aprendido al confirmar). Índices, claves foráneas en cascada y CHECK. Idempotente: se puede correr dos veces.
-- Sólo crea tablas nuevas: no toca ninguna existente, no borra ni actualiza filas. NO toca `CashMovement`: el
-- histórico no cambia saldos, turnos ni arqueos.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción y se registra con
-- `prisma migrate resolve --applied 20261214120000_fotoffice_historico_caja`.
-- Lo que el SQL no puede chequear lo valida el código (`apps/fotoffice/lib/historico-caja`): la forma de `resumen`,
-- que la clase coincida con el primer dígito del código de rubro y que los motivos de revisión sean conocidos.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeHistoricoLote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "archivo" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "filas" INTEGER NOT NULL,
    "ingresosArs" DECIMAL(14,2) NOT NULL,
    "egresosArs" DECIMAL(14,2) NOT NULL,
    "estimadosArs" DECIMAL(14,2) NOT NULL,
    "filasRevisar" INTEGER NOT NULL DEFAULT 0,
    "resumen" JSONB NOT NULL DEFAULT '{}',
    "avisos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmadoPorUserId" INTEGER,
    "confirmadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeHistoricoLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeHistoricoMovimiento" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "turno" TEXT,
    "medio" TEXT,
    "conceptoOriginal" TEXT NOT NULL,
    "conceptoNormalizado" TEXT NOT NULL,
    "importeArs" DECIMAL(14,2) NOT NULL,
    "clase" TEXT NOT NULL,
    "rubroCodigo" TEXT,
    "rubroNombre" TEXT,
    "regla" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'CSV',
    "estimado" BOOLEAN NOT NULL DEFAULT false,
    "revisar" BOOLEAN NOT NULL DEFAULT false,
    "motivosRevision" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referenciaOrigen" TEXT,
    "filaOrigen" INTEGER,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeHistoricoMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeHistoricoMapeo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "signo" TEXT,
    "montoMinimoArs" DECIMAL(14,2),
    "clase" TEXT NOT NULL,
    "rubroCodigo" TEXT NOT NULL,
    "rubroNombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeHistoricoMapeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeHistoricoLote_workspaceId_estado_idx" ON "FotofficeHistoricoLote"("workspaceId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeHistoricoLote_workspaceId_mes_key" ON "FotofficeHistoricoLote"("workspaceId", "mes");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeHistoricoMovimiento_workspaceId_fecha_idx" ON "FotofficeHistoricoMovimiento"("workspaceId", "fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeHistoricoMovimiento_workspaceId_clase_fecha_idx" ON "FotofficeHistoricoMovimiento"("workspaceId", "clase", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeHistoricoMovimiento_loteId_orden_key" ON "FotofficeHistoricoMovimiento"("loteId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeHistoricoMapeo_workspaceId_clave_key" ON "FotofficeHistoricoMapeo"("workspaceId", "clave");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoLote_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeHistoricoLote" ADD CONSTRAINT "FotofficeHistoricoLote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_loteId_fkey') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "FotofficeHistoricoLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMapeo_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeHistoricoMapeo" ADD CONSTRAINT "FotofficeHistoricoMapeo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- CHECK (Prisma no los expresa)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoLote_mes_check') THEN
    ALTER TABLE "FotofficeHistoricoLote" ADD CONSTRAINT "FotofficeHistoricoLote_mes_check" CHECK ("mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoLote_estado_check') THEN
    ALTER TABLE "FotofficeHistoricoLote" ADD CONSTRAINT "FotofficeHistoricoLote_estado_check" CHECK ("estado" IN ('BORRADOR', 'CONFIRMADO', 'DESCARTADO'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoLote_filas_check') THEN
    ALTER TABLE "FotofficeHistoricoLote" ADD CONSTRAINT "FotofficeHistoricoLote_filas_check" CHECK ("filas" >= 0 AND "filasRevisar" >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoLote_confirmado_check') THEN
    ALTER TABLE "FotofficeHistoricoLote" ADD CONSTRAINT "FotofficeHistoricoLote_confirmado_check" CHECK (("estado" = 'CONFIRMADO') = ("confirmadoAt" IS NOT NULL));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_importe_check') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_importe_check" CHECK ("importeArs" <> 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_clase_check') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_clase_check" CHECK ("clase" IN ('INGRESO', 'COSTO_VARIABLE', 'GASTO_FIJO', 'RETIRO_DUENO', 'MOVIMIENTO_INTERNO', 'SIN_CLASIFICAR'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_medio_check') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_medio_check" CHECK ("medio" IS NULL OR "medio" IN ('EFECTIVO', 'DIGITAL'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_origen_check') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_origen_check" CHECK ("origen" IN ('CSV', 'EXTRACTO', 'ESTIMADO') AND "estimado" = ("origen" = 'ESTIMADO'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMovimiento_orden_check') THEN
    ALTER TABLE "FotofficeHistoricoMovimiento" ADD CONSTRAINT "FotofficeHistoricoMovimiento_orden_check" CHECK ("orden" >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMapeo_signo_check') THEN
    ALTER TABLE "FotofficeHistoricoMapeo" ADD CONSTRAINT "FotofficeHistoricoMapeo_signo_check" CHECK ("signo" IS NULL OR "signo" IN ('+', '-'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMapeo_clase_check') THEN
    ALTER TABLE "FotofficeHistoricoMapeo" ADD CONSTRAINT "FotofficeHistoricoMapeo_clase_check" CHECK ("clase" IN ('INGRESO', 'COSTO_VARIABLE', 'GASTO_FIJO', 'RETIRO_DUENO', 'MOVIMIENTO_INTERNO'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeHistoricoMapeo_monto_check') THEN
    ALTER TABLE "FotofficeHistoricoMapeo" ADD CONSTRAINT "FotofficeHistoricoMapeo_monto_check" CHECK ("montoMinimoArs" IS NULL OR "montoMinimoArs" > 0);
  END IF;
END $$;
