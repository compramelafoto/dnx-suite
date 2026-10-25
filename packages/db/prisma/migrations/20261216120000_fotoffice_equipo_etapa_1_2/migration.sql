-- FOTOFFICE · Equipo, etapas 1 y 2: fichas de empleada, horario semanal, valor de la jornada,
-- cambios puntuales, correcciones de la jornada, días para revisar, ajustes, repertorio de
-- mensajes y mensajes mostrados. Sólo tablas nuevas: no toca ninguna tabla existente ni lleva
-- claves foráneas hacia ellas (las únicas son entre estas tablas nuevas). Idempotente: se puede
-- correr dos veces sin error.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoFicha" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "apodo" TEXT,
    "fechaNacimiento" TEXT,
    "jornadaMinutos" INTEGER NOT NULL DEFAULT 300,
    "sabadosAlternados" BOOLEAN NOT NULL DEFAULT false,
    "sabadoReferencia" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEquipoFicha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoFranja" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "inicioMin" INTEGER NOT NULL,
    "finMin" INTEGER NOT NULL,

    CONSTRAINT "FotofficeEquipoFranja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoValorJornada" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "desde" TEXT NOT NULL,
    "valorArs" DECIMAL(12,2) NOT NULL,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeEquipoValorJornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoCambio" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'OTRO',
    "inicioMin" INTEGER,
    "finMin" INTEGER,
    "nota" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeEquipoCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoCorreccion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "entradaMin" INTEGER,
    "salidaMin" INTEGER,
    "nota" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeEquipoCorreccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoMarca" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeEquipoMarca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEquipoAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoPieza" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clave" TEXT,
    "momento" TEXT NOT NULL,
    "parte" TEXT NOT NULL,
    "ocasion" TEXT,
    "texto" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEquipoPieza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeEquipoMensaje" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "momento" TEXT NOT NULL,
    "combinacion" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ocasion" TEXT,
    "cerradoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeEquipoMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoFicha_membershipId_key" ON "FotofficeEquipoFicha"("membershipId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeEquipoFicha_workspaceId_activa_idx" ON "FotofficeEquipoFicha"("workspaceId", "activa");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoFicha_workspaceId_userId_key" ON "FotofficeEquipoFicha"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeEquipoFranja_fichaId_diaSemana_idx" ON "FotofficeEquipoFranja"("fichaId", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoValorJornada_fichaId_desde_key" ON "FotofficeEquipoValorJornada"("fichaId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoCambio_fichaId_fecha_key" ON "FotofficeEquipoCambio"("fichaId", "fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeEquipoCorreccion_workspaceId_userId_fecha_idx" ON "FotofficeEquipoCorreccion"("workspaceId", "userId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoMarca_workspaceId_userId_fecha_motivo_key" ON "FotofficeEquipoMarca"("workspaceId", "userId", "fecha", "motivo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoAjustes_workspaceId_key" ON "FotofficeEquipoAjustes"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeEquipoPieza_workspaceId_momento_parte_idx" ON "FotofficeEquipoPieza"("workspaceId", "momento", "parte");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoPieza_workspaceId_clave_key" ON "FotofficeEquipoPieza"("workspaceId", "clave");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeEquipoMensaje_workspaceId_userId_createdAt_idx" ON "FotofficeEquipoMensaje"("workspaceId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquipoMensaje_workspaceId_userId_fecha_momento_key" ON "FotofficeEquipoMensaje"("workspaceId", "userId", "fecha", "momento");
-- AddForeignKey (entre tablas nuevas; sólo si todavía no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEquipoFranja_fichaId_fkey') THEN
    ALTER TABLE "FotofficeEquipoFranja" ADD CONSTRAINT "FotofficeEquipoFranja_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FotofficeEquipoFicha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEquipoValorJornada_fichaId_fkey') THEN
    ALTER TABLE "FotofficeEquipoValorJornada" ADD CONSTRAINT "FotofficeEquipoValorJornada_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FotofficeEquipoFicha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEquipoCambio_fichaId_fkey') THEN
    ALTER TABLE "FotofficeEquipoCambio" ADD CONSTRAINT "FotofficeEquipoCambio_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "FotofficeEquipoFicha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
