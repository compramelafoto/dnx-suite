-- Contactos DNX y agente Buscador: base de prospectos y cola de búsquedas. Tablas nuevas, sin claves
-- foráneas hacia tablas existentes. Idempotente: se puede correr dos veces.
-- Los conjuntos cerrados van en TEXT con CHECK (como el resto de FOTOFFICE) para no crear tipos en las
-- bases compartidas.

CREATE TABLE IF NOT EXISTS "DnxContacto" (
  "id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "nichos" TEXT[] NOT NULL,
  "plataformas" TEXT[] NOT NULL,
  "nombre" TEXT NOT NULL,
  "ciudad" TEXT,
  "provincia" TEXT,
  "region" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "web" TEXT,
  "instagram" TEXT,
  "facebook" TEXT,
  "email" TEXT,
  "telefono" TEXT,
  "whatsapp" TEXT,
  "googlePlaceId" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'NUEVO',
  "vinculo" TEXT,
  "vinculoId" TEXT,
  "compradorClf" BOOLEAN NOT NULL DEFAULT false,
  "creadoPor" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  "fusionadoEnId" TEXT,
  "claveDominio" TEXT,
  "claveInstagram" TEXT,
  "claveEmail" TEXT,
  "claveTelefono" TEXT,
  "claveNombreCiudad" TEXT,
  CONSTRAINT "DnxContacto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxContactoDato" (
  "id" TEXT NOT NULL,
  "contactoId" TEXT NOT NULL,
  "campo" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "fuente" TEXT NOT NULL,
  "fuenteUrl" TEXT,
  "vistoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxContactoDato_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxContactoEvento" (
  "id" TEXT NOT NULL,
  "contactoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "datos" JSONB,
  "autor" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxContactoEvento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxBuscadorTarea" (
  "id" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "provincia" TEXT NOT NULL,
  "ciudad" TEXT,
  "tipo" TEXT NOT NULL,
  "nicho" TEXT,
  "fuente" TEXT NOT NULL,
  "consulta" TEXT NOT NULL,
  "paginas" INTEGER NOT NULL DEFAULT 1,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "resultado" JSONB,
  "costoGoogleUsdMicros" INTEGER NOT NULL DEFAULT 0,
  "costoClaudeUsdMicros" INTEGER NOT NULL DEFAULT 0,
  "tomadaEn" TIMESTAMP(3),
  "hechaEn" TIMESTAMP(3),
  "prioridad" INTEGER NOT NULL,
  CONSTRAINT "DnxBuscadorTarea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DnxBuscadorRegion" (
  "region" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'EN_ESPERA',
  "iniciadaEn" TIMESTAMP(3),
  "completadaEn" TIMESTAMP(3),
  "resumenEnviadoEn" TIMESTAMP(3),
  CONSTRAINT "DnxBuscadorRegion_pkey" PRIMARY KEY ("region")
);

-- Claves foráneas (los datos y eventos se van con el contacto).
DO $$ BEGIN
  ALTER TABLE "DnxContactoDato" ADD CONSTRAINT "DnxContactoDato_contactoId_fkey"
    FOREIGN KEY ("contactoId") REFERENCES "DnxContacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContactoEvento" ADD CONSTRAINT "DnxContactoEvento_contactoId_fkey"
    FOREIGN KEY ("contactoId") REFERENCES "DnxContacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CHECK de cada conjunto cerrado.
DO $$ BEGIN
  ALTER TABLE "DnxContacto" ADD CONSTRAINT "DnxContacto_tipo_check" CHECK ("tipo" IN
    ('FOTOGRAFO', 'ESCUELA', 'CLUB', 'ORGANIZADOR_EVENTOS', 'ASOCIACION_FOTOGRAFOS', 'ORGANIZADOR_MUESTRAS',
     'EMPRESA_TURISMO', 'NEGOCIO_FOTOGRAFIA', 'OTRO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContacto" ADD CONSTRAINT "DnxContacto_estado_check" CHECK ("estado" IN
    ('NUEVO', 'REVISADO', 'CONTACTADO', 'RESPONDIO', 'SE_SUMO', 'NO_INTERESA', 'DESCARTADO', 'NO_CONTACTAR'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContacto" ADD CONSTRAINT "DnxContacto_region_check" CHECK ("region" IS NULL OR "region" IN
    ('CENTRO', 'BUENOS_AIRES_AMBA', 'CUYO', 'NOA', 'NEA', 'PATAGONIA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContacto" ADD CONSTRAINT "DnxContacto_vinculo_check" CHECK ("vinculo" IS NULL OR "vinculo" IN
    ('CONOCIDO_DNX_ESTUDIO', 'USUARIO_CLF'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContacto" ADD CONSTRAINT "DnxContacto_plataformas_check" CHECK
    ("plataformas" <@ ARRAY['CLF', 'INFOSPOT', 'MUESTRAS', 'FOTOFFICE']::TEXT[]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContactoDato" ADD CONSTRAINT "DnxContactoDato_fuente_check" CHECK ("fuente" IN
    ('SITIO_PROPIO', 'WEB_SEARCH', 'ALBOOM', 'MANUAL', 'CLF'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxContactoEvento" ADD CONSTRAINT "DnxContactoEvento_tipo_check" CHECK ("tipo" IN
    ('CREADO', 'DATO_NUEVO', 'ESTADO', 'NOTA', 'FUSIONADO', 'VINCULADO', 'CORREO_ENVIADO', 'CORREO_RECIBIDO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxBuscadorTarea" ADD CONSTRAINT "DnxBuscadorTarea_region_check" CHECK ("region" IN
    ('CENTRO', 'BUENOS_AIRES_AMBA', 'CUYO', 'NOA', 'NEA', 'PATAGONIA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxBuscadorTarea" ADD CONSTRAINT "DnxBuscadorTarea_tipo_check" CHECK ("tipo" IN
    ('FOTOGRAFO', 'ESCUELA', 'CLUB', 'ORGANIZADOR_EVENTOS', 'ASOCIACION_FOTOGRAFOS', 'ORGANIZADOR_MUESTRAS',
     'EMPRESA_TURISMO', 'NEGOCIO_FOTOGRAFIA', 'OTRO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxBuscadorTarea" ADD CONSTRAINT "DnxBuscadorTarea_fuente_check" CHECK ("fuente" IN
    ('GOOGLE_PLACES', 'WEB_SEARCH'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxBuscadorTarea" ADD CONSTRAINT "DnxBuscadorTarea_estado_check" CHECK ("estado" IN
    ('PENDIENTE', 'EN_CURSO', 'HECHA', 'FALLO', 'SALTEADA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxBuscadorRegion" ADD CONSTRAINT "DnxBuscadorRegion_region_check" CHECK ("region" IN
    ('CENTRO', 'BUENOS_AIRES_AMBA', 'CUYO', 'NOA', 'NEA', 'PATAGONIA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DnxBuscadorRegion" ADD CONSTRAINT "DnxBuscadorRegion_estado_check" CHECK ("estado" IN
    ('EN_ESPERA', 'EN_CURSO', 'COMPLETA', 'PAUSADA'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices.
CREATE UNIQUE INDEX IF NOT EXISTS "DnxContacto_googlePlaceId_key" ON "DnxContacto"("googlePlaceId");
CREATE INDEX IF NOT EXISTS "DnxContacto_claveDominio_idx" ON "DnxContacto"("claveDominio");
CREATE INDEX IF NOT EXISTS "DnxContacto_claveInstagram_idx" ON "DnxContacto"("claveInstagram");
CREATE INDEX IF NOT EXISTS "DnxContacto_claveEmail_idx" ON "DnxContacto"("claveEmail");
CREATE INDEX IF NOT EXISTS "DnxContacto_claveTelefono_idx" ON "DnxContacto"("claveTelefono");
CREATE INDEX IF NOT EXISTS "DnxContacto_claveNombreCiudad_idx" ON "DnxContacto"("claveNombreCiudad");
CREATE INDEX IF NOT EXISTS "DnxContactoDato_contactoId_campo_idx" ON "DnxContactoDato"("contactoId", "campo");
CREATE INDEX IF NOT EXISTS "DnxContactoEvento_contactoId_creadoEn_idx" ON "DnxContactoEvento"("contactoId", "creadoEn");
CREATE INDEX IF NOT EXISTS "DnxBuscadorTarea_region_estado_prioridad_idx" ON "DnxBuscadorTarea"("region", "estado", "prioridad");
-- ciudad y nicho pueden ser null: NULLS NOT DISTINCT (Postgres 15+) para que dos tareas iguales choquen.
CREATE UNIQUE INDEX IF NOT EXISTS "DnxBuscadorTarea_region_provincia_ciudad_tipo_nicho_fuente_key"
  ON "DnxBuscadorTarea"("region", "provincia", "ciudad", "tipo", "nicho", "fuente") NULLS NOT DISTINCT;

-- Las seis regiones, en el orden en que se recorren.
INSERT INTO "DnxBuscadorRegion" ("region", "orden", "estado") VALUES
  ('CENTRO', 1, 'EN_ESPERA'),
  ('BUENOS_AIRES_AMBA', 2, 'EN_ESPERA'),
  ('CUYO', 3, 'EN_ESPERA'),
  ('NOA', 4, 'EN_ESPERA'),
  ('NEA', 5, 'EN_ESPERA'),
  ('PATAGONIA', 6, 'EN_ESPERA')
ON CONFLICT ("region") DO NOTHING;
