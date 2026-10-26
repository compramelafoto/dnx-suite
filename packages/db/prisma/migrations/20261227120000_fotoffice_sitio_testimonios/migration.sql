-- FOTOFFICE · Testimonios del sitio (PR 3 del sitio público).
-- Sólo tablas nuevas, sin claves foráneas a tablas existentes, más la ampliación del CHECK de tipos de
-- plantilla. Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falten: el sitio muestra vacío.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md (PR 3)

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTestimonio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "extracto" TEXT,
    "autorNombre" TEXT NOT NULL,
    "autorDetalle" TEXT,
    "autorFotoUrl" TEXT,
    "autorFotoKey" TEXT,
    "autorEnlace" TEXT,
    "autorEmail" TEXT,
    "calificacion" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "consentimiento" BOOLEAN NOT NULL DEFAULT false,
    "consentimientoAt" TIMESTAMP(3),
    "consentimientoTexto" TEXT,
    "origen" TEXT NOT NULL,
    "clientId" TEXT,
    "proyectoId" TEXT,
    "trabajoId" TEXT,
    "invitacionId" TEXT,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "moderadoPorUserId" TEXT,
    "moderadoAt" TIMESTAMP(3),
    "origenExternoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeTestimonio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTestimonioInvitacion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT,
    "proyectoId" TEXT,
    "correo" TEXT,
    "nombreSugerido" TEXT,
    "detalleSugerido" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ENVIADA',
    "canal" TEXT,
    "enviadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaAt" TIMESTAMP(3),
    "venceAt" TIMESTAMP(3) NOT NULL,
    "claveIdempotencia" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "FotofficeTestimonioInvitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTestimonioAjustes" (
    "workspaceId" TEXT NOT NULL,
    "automaticoEncendido" BOOLEAN NOT NULL DEFAULT false,
    "diasDespues" INTEGER NOT NULL DEFAULT 7,
    "encendidoAt" TIMESTAMP(3),
    "avisarAlEquipo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeTestimonioAjustes_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeTestimonio_workspaceId_estado_orden_idx" ON "FotofficeTestimonio"("workspaceId", "estado", "orden");

-- CreateIndex
-- Un mismo testimonio importado no entra dos veces. Los cargados acá (origenExternoId nulo) sí conviven:
-- Postgres trata cada NULL como distinto.
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTestimonio_workspaceId_origenExternoId_key" ON "FotofficeTestimonio"("workspaceId", "origenExternoId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTestimonioInvitacion_tokenHash_key" ON "FotofficeTestimonioInvitacion"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTestimonioInvitacion_claveIdempotencia_key" ON "FotofficeTestimonioInvitacion"("claveIdempotencia");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeTestimonioInvitacion_workspaceId_estado_idx" ON "FotofficeTestimonioInvitacion"("workspaceId", "estado");

-- CHECK (se borran y se vuelven a crear para que correrlo dos veces no falle)
ALTER TABLE "FotofficeTestimonio" DROP CONSTRAINT IF EXISTS "FotofficeTestimonio_estado";
ALTER TABLE "FotofficeTestimonio" ADD CONSTRAINT "FotofficeTestimonio_estado" CHECK ("estado" IN ('PENDIENTE', 'PUBLICADO', 'RECHAZADO'));
ALTER TABLE "FotofficeTestimonio" DROP CONSTRAINT IF EXISTS "FotofficeTestimonio_origen";
ALTER TABLE "FotofficeTestimonio" ADD CONSTRAINT "FotofficeTestimonio_origen" CHECK ("origen" IN ('IMPORTADO', 'FORMULARIO', 'INVITACION', 'CARGA_MANUAL'));
ALTER TABLE "FotofficeTestimonio" DROP CONSTRAINT IF EXISTS "FotofficeTestimonio_calificacion";
ALTER TABLE "FotofficeTestimonio" ADD CONSTRAINT "FotofficeTestimonio_calificacion" CHECK ("calificacion" IS NULL OR "calificacion" BETWEEN 1 AND 5);
-- Nada se publica sin consentimiento.
ALTER TABLE "FotofficeTestimonio" DROP CONSTRAINT IF EXISTS "FotofficeTestimonio_publicado_consentimiento";
ALTER TABLE "FotofficeTestimonio" ADD CONSTRAINT "FotofficeTestimonio_publicado_consentimiento" CHECK ("estado" <> 'PUBLICADO' OR "consentimiento" = true);
ALTER TABLE "FotofficeTestimonioInvitacion" DROP CONSTRAINT IF EXISTS "FotofficeTestimonioInvitacion_estado";
ALTER TABLE "FotofficeTestimonioInvitacion" ADD CONSTRAINT "FotofficeTestimonioInvitacion_estado" CHECK ("estado" IN ('ENVIADA', 'RESPONDIDA', 'VENCIDA'));
ALTER TABLE "FotofficeTestimonioAjustes" DROP CONSTRAINT IF EXISTS "FotofficeTestimonioAjustes_diasDespues";
ALTER TABLE "FotofficeTestimonioAjustes" ADD CONSTRAINT "FotofficeTestimonioAjustes_diasDespues" CHECK ("diasDespues" BETWEEN 1 AND 60);

-- Tipo de plantilla TESTIMONIO (la invitación a dejar un testimonio). No es una columna nueva: sólo se
-- amplía la lista del CHECK que ya existía (los valores viejos siguen valiendo). La lista sale de la última
-- migración que lo tocó (20261101120000_fotoffice_etapa_7_galeria), que incluye PROYECTO aunque `TIPOS_PLANTILLA`
-- no lo tiene (se conserva por si hay filas viejas). Idempotente.
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA', 'CONTRATO', 'GALERIA', 'TESTIMONIO'));
