-- =============================================================================
-- Info Spot — rol PostgreSQL de SOLO LECTURA sobre la DB real de ComprameLaFoto
-- =============================================================================
-- ENTORNO: ejecutar SOLO en la base PostgreSQL de CLF (legacy / prod o réplica).
-- NO ejecutar en la DB CMS de Info Spot.
-- NO ejecutar sin confirmación explícita del entorno (staging vs producción).
--
-- Objetivo: credencial para CLF_READONLY_DATABASE_URL en Info Spot.
-- El usuario NO debe poder INSERT/UPDATE/DELETE/DDL ni migraciones.
--
-- Sustituir:
--   :READONLY_PASSWORD  → contraseña fuerte
--   :CLF_SCHEMA         → schema público habitual: public
--   :CLF_DB_NAME        → nombre de la base (ej. neondb)
--
-- Tras crear el rol, configurar en apps/infospot/.env.local (nunca en Git):
--   CLF_READONLY_DATABASE_URL="postgresql://infospot_clf_readonly:...@HOST/DB?sslmode=require"
-- =============================================================================

-- 1) Rol de login (ajustar password antes de ejecutar)
-- CREATE ROLE infospot_clf_readonly WITH LOGIN PASSWORD ':READONLY_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Neon / proveedores managed: a veces se crea el user desde el panel.
-- Si el rol ya existe, omitir CREATE ROLE y continuar desde GRANT.

-- 2) Conexión a la base
-- GRANT CONNECT ON DATABASE :CLF_DB_NAME TO infospot_clf_readonly;

-- 3) Uso del schema
GRANT USAGE ON SCHEMA public TO infospot_clf_readonly;

-- 4) SELECT únicamente sobre tablas necesarias para Info Spot
GRANT SELECT ON TABLE
  "Event",
  "Album",
  "Photo",
  "User"
TO infospot_clf_readonly;

-- Relaciones / tablas auxiliares si existen en el schema (ignorar error si no están):
-- GRANT SELECT ON TABLE "_AlbumToEvent" TO infospot_clf_readonly;

-- 5) Defaults para tablas futuras del schema (sigue siendo solo SELECT)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO infospot_clf_readonly;

-- 6) Verificación (como superuser / owner)
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'infospot_clf_readonly'
-- ORDER BY table_name, privilege_type;

-- 7) Prueba negativa (debe fallar):
-- SET ROLE infospot_clf_readonly;
-- INSERT INTO "Event" (/* ... */) VALUES (/* ... */);  -- EXPECT ERROR
-- RESET ROLE;

-- Revocación (si hace falta):
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM infospot_clf_readonly;
-- DROP ROLE IF EXISTS infospot_clf_readonly;
