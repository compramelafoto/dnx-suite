-- Contactos DNX: nuevo tipo ESCUELA_FOTOGRAFIA (escuelas, institutos y cursos de fotografía; distinto de
-- ESCUELA, que son colegios). Rehace los CHECK de tipo de contactos y de tareas del Buscador.
-- Idempotente: se puede correr dos veces.
ALTER TABLE "DnxContacto" DROP CONSTRAINT IF EXISTS "DnxContacto_tipo_check";
ALTER TABLE "DnxContacto" ADD CONSTRAINT "DnxContacto_tipo_check" CHECK ("tipo" IN
  ('FOTOGRAFO', 'ESCUELA', 'CLUB', 'ORGANIZADOR_EVENTOS', 'ASOCIACION_FOTOGRAFOS', 'ORGANIZADOR_MUESTRAS',
   'EMPRESA_TURISMO', 'NEGOCIO_FOTOGRAFIA', 'ESCUELA_FOTOGRAFIA', 'OTRO'));

ALTER TABLE "DnxBuscadorTarea" DROP CONSTRAINT IF EXISTS "DnxBuscadorTarea_tipo_check";
ALTER TABLE "DnxBuscadorTarea" ADD CONSTRAINT "DnxBuscadorTarea_tipo_check" CHECK ("tipo" IN
  ('FOTOGRAFO', 'ESCUELA', 'CLUB', 'ORGANIZADOR_EVENTOS', 'ASOCIACION_FOTOGRAFOS', 'ORGANIZADOR_MUESTRAS',
   'EMPRESA_TURISMO', 'NEGOCIO_FOTOGRAFIA', 'ESCUELA_FOTOGRAFIA', 'OTRO'));
