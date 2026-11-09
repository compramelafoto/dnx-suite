-- Agente Vendedor: modelos de correo por grupo, hilos, correos y gasto. Tablas nuevas, sin claves
-- foráneas hacia tablas existentes. Idempotente: se puede correr dos veces. Los conjuntos cerrados van en
-- TEXT con CHECK (como el resto de FOTOFFICE).

CREATE TABLE IF NOT EXISTS "DnxVendedorModelo" (
  "id" TEXT NOT NULL,
  "grupo" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PROPUESTO',
  "asunto" TEXT NOT NULL,
  "cuerpo" TEXT NOT NULL,
  "indicaciones" TEXT NOT NULL,
  "landing" TEXT NOT NULL,
  "contactoEjemploId" TEXT,
  "telegramMessageId" TEXT,
  "correcciones" INTEGER NOT NULL DEFAULT 0,
  "aprobadoPor" TEXT,
  "aprobadoEn" TIMESTAMP(3),
  "reemplazadoEn" TIMESTAMP(3),
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxVendedorModelo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxVendedorHilo" (
  "id" TEXT NOT NULL,
  "contactoId" TEXT NOT NULL,
  "grupo" TEXT NOT NULL,
  "modeloId" TEXT,
  "token" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_ENVIO',
  "cierre" TEXT,
  "borrador" JSONB,
  "propuesta" JSONB,
  "telegramMessageId" TEXT,
  "correcciones" INTEGER NOT NULL DEFAULT 0,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "respuestasAutomaticas" INTEGER NOT NULL DEFAULT 0,
  "modoManual" BOOLEAN NOT NULL DEFAULT false,
  "recordatorioCancelado" BOOLEAN NOT NULL DEFAULT false,
  "avisoInteresadoEn" TIMESTAMP(3),
  "tomadoEn" TIMESTAMP(3),
  "enviadoEn" TIMESTAMP(3),
  "recordadoEn" TIMESTAMP(3),
  "ultimaRespuestaEn" TIMESTAMP(3),
  "registradoEn" TIMESTAMP(3),
  "viaRegistro" TEXT,
  "usuarioClfId" INTEGER,
  "rolClf" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxVendedorHilo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxVendedorCorreo" (
  "id" TEXT NOT NULL,
  "hiloId" TEXT,
  "contactoId" TEXT,
  "direccion" TEXT NOT NULL,
  "paso" TEXT,
  "resendId" TEXT,
  "messageId" TEXT,
  "de" TEXT NOT NULL,
  "para" TEXT NOT NULL,
  "asunto" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "clase" TEXT,
  "eventoId" TEXT,
  "tomadoEn" TIMESTAMP(3),
  "procesadoEn" TIMESTAMP(3),
  "entregadoEn" TIMESTAMP(3),
  "abiertoEn" TIMESTAMP(3),
  "clicEn" TIMESTAMP(3),
  "reboteEn" TIMESTAMP(3),
  "quejaEn" TIMESTAMP(3),
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxVendedorCorreo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxVendedorGasto" (
  "id" TEXT NOT NULL,
  "usdMicros" INTEGER NOT NULL,
  "motivo" TEXT NOT NULL,
  "hiloId" TEXT,
  "modeloId" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxVendedorGasto_pkey" PRIMARY KEY ("id")
);

-- CHECK de cada conjunto cerrado.
DO $$ BEGIN
  ALTER TABLE "DnxVendedorModelo" ADD CONSTRAINT "DnxVendedorModelo_grupo_check" CHECK ("grupo" IN
    ('FOTOGRAFO:ESCOLAR', 'FOTOGRAFO:DEPORTIVA', 'FOTOGRAFO:TURISTICA', 'FOTOGRAFO:SOCIAL', 'FOTOGRAFO:EVENTOS', 'FOTOGRAFO:FOTO_CARNET', 'FOTOGRAFO:CORPORATIVA', 'FOTOGRAFO:MASCOTAS_NEWBORN_FAMILIA', 'FOTOGRAFO:GENERAL', 'ESCUELA', 'ESCUELA_FOTOGRAFIA', 'CLUB', 'ORGANIZADOR_EVENTOS', 'ASOCIACION_FOTOGRAFOS', 'ORGANIZADOR_MUESTRAS', 'EMPRESA_TURISMO', 'NEGOCIO_FOTOGRAFIA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorModelo" ADD CONSTRAINT "DnxVendedorModelo_estado_check" CHECK ("estado" IN
    ('PROPUESTO', 'APROBADO', 'DESCARTADO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorHilo" ADD CONSTRAINT "DnxVendedorHilo_grupo_check" CHECK ("grupo" IN
    ('FOTOGRAFO:ESCOLAR', 'FOTOGRAFO:DEPORTIVA', 'FOTOGRAFO:TURISTICA', 'FOTOGRAFO:SOCIAL', 'FOTOGRAFO:EVENTOS', 'FOTOGRAFO:FOTO_CARNET', 'FOTOGRAFO:CORPORATIVA', 'FOTOGRAFO:MASCOTAS_NEWBORN_FAMILIA', 'FOTOGRAFO:GENERAL', 'ESCUELA', 'ESCUELA_FOTOGRAFIA', 'CLUB', 'ORGANIZADOR_EVENTOS', 'ASOCIACION_FOTOGRAFOS', 'ORGANIZADOR_MUESTRAS', 'EMPRESA_TURISMO', 'NEGOCIO_FOTOGRAFIA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorHilo" ADD CONSTRAINT "DnxVendedorHilo_estado_check" CHECK ("estado" IN
    ('PENDIENTE_ENVIO', 'ENVIADO', 'RECORDADO', 'RESPONDIO', 'ESPERA_DANIEL', 'CERRADO', 'BAJA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorHilo" ADD CONSTRAINT "DnxVendedorHilo_cierre_check" CHECK ("cierre" IS NULL OR "cierre" IN
    ('REBOTE', 'QUEJA', 'NO_INTERESA', 'BAJA', 'BAJA_CLF', 'YA_ERA_USUARIO', 'FALLO', 'MANUAL'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorHilo" ADD CONSTRAINT "DnxVendedorHilo_viaRegistro_check" CHECK ("viaRegistro" IS NULL OR "viaRegistro" IN
    ('COOKIE', 'EMAIL'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorCorreo" ADD CONSTRAINT "DnxVendedorCorreo_direccion_check" CHECK ("direccion" IN
    ('SALIDA', 'ENTRADA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorCorreo" ADD CONSTRAINT "DnxVendedorCorreo_paso_check" CHECK ("paso" IS NULL OR "paso" IN
    ('PRIMERO', 'RECORDATORIO', 'RESPUESTA', 'REENVIO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorCorreo" ADD CONSTRAINT "DnxVendedorCorreo_clase_check" CHECK ("clase" IS NULL OR "clase" IN
    ('INTERESADO', 'CAPACITACION', 'NO_INTERESA', 'BAJA', 'DELICADA', 'AUTOMATICA', 'REBOTE'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxVendedorGasto" ADD CONSTRAINT "DnxVendedorGasto_motivo_check" CHECK ("motivo" IN
    ('MODELO', 'CORREO', 'RECORDATORIO', 'CLASIFICACION', 'CORRECCION'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices.
CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorHilo_contactoId_key" ON "DnxVendedorHilo"("contactoId");
CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorHilo_token_key" ON "DnxVendedorHilo"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorCorreo_resendId_key" ON "DnxVendedorCorreo"("resendId");
CREATE INDEX IF NOT EXISTS "DnxVendedorModelo_grupo_estado_idx" ON "DnxVendedorModelo"("grupo", "estado");
CREATE INDEX IF NOT EXISTS "DnxVendedorHilo_estado_idx" ON "DnxVendedorHilo"("estado");
CREATE INDEX IF NOT EXISTS "DnxVendedorHilo_telegramMessageId_idx" ON "DnxVendedorHilo"("telegramMessageId");
CREATE INDEX IF NOT EXISTS "DnxVendedorCorreo_direccion_creadoEn_idx" ON "DnxVendedorCorreo"("direccion", "creadoEn");
CREATE INDEX IF NOT EXISTS "DnxVendedorCorreo_messageId_idx" ON "DnxVendedorCorreo"("messageId");
CREATE INDEX IF NOT EXISTS "DnxVendedorCorreo_hiloId_idx" ON "DnxVendedorCorreo"("hiloId");
CREATE INDEX IF NOT EXISTS "DnxVendedorGasto_creadoEn_idx" ON "DnxVendedorGasto"("creadoEn");

-- Un solo modelo propuesto por grupo, y un solo modelo vigente (aprobado y no reemplazado) por grupo.
CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorModelo_grupo_propuesto_key"
  ON "DnxVendedorModelo"("grupo") WHERE "estado" = 'PROPUESTO';
CREATE UNIQUE INDEX IF NOT EXISTS "DnxVendedorModelo_grupo_vigente_key"
  ON "DnxVendedorModelo"("grupo") WHERE "estado" = 'APROBADO' AND "reemplazadoEn" IS NULL;
