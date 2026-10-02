# Aplicar la migración de la Ficha estándar (FOTOFFICE, etapa 0.3)

Procedimiento manual, con el mismo criterio que `MIGRACION-LISTADO-ESTANDAR.md`. Las tablas
van **antes** que el código: no se fusiona el PR sin haber aplicado esto en las bases donde
corre FOTOFFICE. Además necesita infraestructura de adjuntos privados (sección 6).

**Las fichas de Cliente y de Socio leen estas tablas en CADA carga (notas, etiquetas,
adjuntos, vínculos y línea de tiempo). Publicar el código antes que el SQL deja rotas las dos
fichas para todos (SFPR usa Socios todos los días).** Por eso el orden de la sección 2 no es
opcional.

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261002120000_fotoffice_ficha_estandar` |
| Archivo | `packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql` |
| Checksum SHA-256 | `9abb7e52fb6c8af6cc61ed3e6b8adc414471265eb4270845935324269b81a62d` |
| Operaciones | 8 `CREATE TABLE`, índices (varios únicos, dos parciales), claves foráneas, 6 `CHECK`, 2 `INSERT` de conversión |
| Destructivas | Ninguna. Es aditiva: no modifica ni borra columnas existentes |

Crea ocho tablas nuevas: `FotofficeNoteCategory`, `FotofficeNote`, `FotofficeTag`,
`FotofficeTagAssignment`, `FotofficeAttachment`, `FotofficePersonRelation`,
`FotofficePersonEvent` y `ClientAudit`. No agrega columnas a `Workspace`, `Client` ni `Member`.

**Conversión de Observaciones.** Los dos `INSERT` del final copian `Client.notes` y
`Member.notes` (no vacíos) como una nota fijada, autor "Importado", con id `obs_c_<id>` /
`obs_m_<id>` y `ON CONFLICT ("id") DO NOTHING`, así que la migración es **idempotente**: se
puede repetir sin duplicar. Una nota de socio que tiene un cliente vinculado se cuelga de la
ficha del cliente. Las columnas `notes` **nunca se tocan**.

**Dependencia.** Va después de la etapa 0.1 (`20260930120000_fotoffice_equipo_y_modulos`) y de
la 0.2 (`20261001120000_fotoffice_listado_estandar`) sólo por orden de publicación.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. Orden de publicación

1. Se fusionan primero el PR 277 (etapa 0.1) y el PR 281 (etapa 0.2).
2. Esta rama se rebasa sobre `main` actualizado.
3. Se crean los buckets privados y su CORS (sección 6).
4. Se carga `R2_PRIVATE_BUCKET` en Vercel, en Production y en Preview.
5. SQL en **staging** (`dnx-suite-staging`) y **prueba de punta a punta con `next dev`
   apuntando a staging**: subir un adjunto, confirmarlo, descargarlo, borrarlo y restaurarlo.
   Es obligatoria: los tests automáticos usan R2 simulado y no detectan un token sin permisos
   (sección 6, punto 5). Si algún paso falla con `AccessDenied`, no seguir.
6. SQL en **FOTOFFICE producción** (`compramelafoto` / `development`), con la verificación
   de conversión del paso 3 **inmediatamente después** de aplicarlo y antes del deploy.
7. Recién entonces se fusiona el PR.

**Aplicar el SQL y publicar el código lo más cerca posible en el tiempo.** El SQL convierte
las Observaciones una sola vez. Si alguien edita una "Observaciones" con el formulario viejo
entre que se aplica el SQL y que se publica el código, esa edición **no se convierte**: volver
a correr el `INSERT` no actualiza las notas `obs_%` que ya existen (`DO NOTHING`). La
verificación de conversión (paso 3) se hace **justo después de aplicar el SQL, antes del
deploy**; se puede repetir después del deploy, pero los conteos pueden dejar de coincidir
porque la gente edita o borra notas.

## 3. En qué bases va

| Base | Proyecto / rama Neon | IDs verificados |
|---|---|---|
| Staging | `dnx-suite-staging` | — |
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |
| CompraMeLaFoto | `compramelafoto` / `production` | `divine-hall-10689679` / `production` |
| Clickatón | `clickaton-production` | `bitter-math-56019731` (rama por defecto) |
| InfoSpot | InfoSpot | `wandering-pine-79918137` (rama por defecto) |

Cada base necesita las tablas `Workspace`, `User`, `Client` y `Member` (por las claves
foráneas y la conversión). Si falta alguna, queda afuera.

**Las otras bases no son urgentes.** Sólo `apps/fotoffice` lee estas tablas. Aplicarlas ahí
sólo alinea el schema con el historial de migraciones.

## 4. Procedimiento, base por base

### Paso 0 — Comprobar el slug de DNX Estudio (sólo lectura)

Las categorías iniciales dependen de que DNX Estudio se identifique como `dnx-estudio`. Si el
slug es otro, arranca con "General" en lugar de las 13 categorías. Confirmarlo **antes** de
aplicar:

```sql
SELECT "workspaceId", "publicSlug" FROM "FotofficeWorkspaceBranding" WHERE "publicSlug" = 'dnx-estudio';
```

Debe devolver exactamente una fila. Si no, **parar** y corregir el slug antes de seguir.

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261002120000_fotoffice_ficha_estandar';
```

Si devuelve una fila, esa base ya está lista. Si no, seguir.

### Paso 2 — Aplicar y registrar, en una sola transacción

```sql
BEGIN;
-- pegar acá el contenido completo de migration.sql

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
  gen_random_uuid()::text,
  '9abb7e52fb6c8af6cc61ed3e6b8adc414471265eb4270845935324269b81a62d',
  now(),
  '20261002120000_fotoffice_ficha_estandar',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261002120000_fotoffice_ficha_estandar'
);
COMMIT;
```

### Paso 3 — Verificar (justo después del SQL, antes del deploy; repetible después)

```sql
-- Las ocho tablas existen y responden (0 filas en las que no son de conversión)
SELECT count(*) FROM "FotofficeNoteCategory";
SELECT count(*) FROM "FotofficeTag";
SELECT count(*) FROM "FotofficeTagAssignment";
SELECT count(*) FROM "FotofficeAttachment";
SELECT count(*) FROM "FotofficePersonRelation";
SELECT count(*) FROM "FotofficePersonEvent";
SELECT count(*) FROM "ClientAudit";

-- Conversión: cada cliente y cada socio con notes no vacío tiene su nota obs_
SELECT
  (SELECT count(*) FROM "FotofficeNote" WHERE id LIKE 'obs\_c\_%') AS notas_de_clientes,
  (SELECT count(*) FROM "Client" WHERE notes IS NOT NULL AND btrim(notes) <> '') AS clientes_con_notes,
  (SELECT count(*) FROM "FotofficeNote" WHERE id LIKE 'obs\_m\_%') AS notas_de_socios,
  (SELECT count(*) FROM "Member" WHERE notes IS NOT NULL AND btrim(notes) <> '') AS socios_con_notes;
-- notas_de_clientes = clientes_con_notes y notas_de_socios = socios_con_notes

SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261002120000_fotoffice_ficha_estandar' AND finished_at IS NOT NULL; -- 1
```

Comportamiento nuevo a tener presente: **las importaciones por CSV ahora crean una nota fijada
"Importado"** con las observaciones del archivo (en vez de sólo llenar `notes`).

## 5. Rollback

**Primero el código, después las tablas.** Si se borran las tablas con el código nuevo
publicado, las dos fichas se rompen.

1. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar
   que producción ya sirve la versión sin ficha estándar.
2. Recién entonces, en cada base donde se aplicó:

```sql
BEGIN;
DROP TABLE "FotofficePersonEvent";
DROP TABLE "FotofficePersonRelation";
DROP TABLE "FotofficeAttachment";
DROP TABLE "FotofficeTagAssignment";
DROP TABLE "FotofficeTag";
DROP TABLE "FotofficeNote";
DROP TABLE "FotofficeNoteCategory";
DROP TABLE "ClientAudit";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261002120000_fotoffice_ficha_estandar';
COMMIT;
```

Esto borra notas, etiquetas, vínculos, registros de adjuntos y la línea de tiempo creados
después de la migración: no tiene vuelta atrás. Las columnas `notes` nunca se tocaron, así que
las Observaciones originales siguen intactas. Los archivos ya subidos quedan en el bucket
privado (borrar el prefijo `adjuntos/` a mano si se quiere limpiar).

## 6. Infraestructura de adjuntos privados (lo hace Daniel)

Nada de esto lo hace el código ni el asistente.

1. **Crear dos buckets en R2, sin dominio público** (ni `r2.dev` ni dominio propio):
   `fotoffice-private-prod` y `fotoffice-private-staging`. Las descargas van siempre por enlace
   firmado de 300 segundos.
2. **CORS en cada bucket** (la subida se hace directa desde el navegador con un `PUT`):

```json
[{
  "AllowedOrigins": ["<dominio de producción de FOTOFFICE>", "<dominio de staging>"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["content-type"],
  "MaxAgeSeconds": 3600
}]
```

   Los dominios reales **no están en el repositorio** (no figuran en `apps/fotoffice`,
   `.env.example` ni `vercel.json`): completarlos desde la configuración de dominios del
   proyecto en Vercel. Idealmente el bucket de producción lleva sólo el dominio de producción y
   el de staging sólo el de staging/desarrollo local.
3. **Variable `R2_PRIVATE_BUCKET`** en el proyecto Vercel de FOTOFFICE, en Production
   (`fotoffice-private-prod`) y en Preview (`fotoffice-private-staging`). También en
   `.env.local` para `next dev`. Las credenciales de R2 son las mismas que ya usa la app, pero ver el punto 5.
4. **Comprobar el CORS con un preflight** (así se verificó `fotorank-private-prod`):

```bash
curl -si -X OPTIONS "https://<cuenta>.r2.cloudflarestorage.com/<bucket>/adjuntos/prueba" \
  -H "Origin: <dominio permitido>" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" | head
```

   Debe responder `204` con `Access-Control-Allow-Methods: PUT`.

5. **Confirmar que el token de API de R2 existente tiene lectura y escritura sobre
   `fotoffice-private-prod` y `fotoffice-private-staging`.** Los tokens de R2 pueden estar
   limitados a buckets específicos: si el actual lo está, cada `PUT`, `HEAD` y `GET` falla con
   `AccessDenied` aunque `adjuntosR2Configurado()` devuelva `true` (sólo mira que las variables
   existan). Si está limitado, ampliar el token o crear uno nuevo y cargarlo en Vercel.

### Pendiente conocido (no bloquea)

Al **borrar un workspace** (súper admin) las filas de `FotofficeAttachment` se borran en
cascada, pero los objetos bajo `adjuntos/<workspaceId>/` quedan huérfanos en el bucket
privado. Hay que borrar ese prefijo a mano. Seguimiento futuro: purga automática al borrar el
workspace.
