# Aplicar la migración de Equipo y Módulos (FOTOFFICE, etapa 0.1)

Procedimiento manual, con el mismo criterio que `MIGRACION-COBERTURAS.md`. Las tablas van
**antes** que el código: no se fusiona el PR sin haber aplicado esto en las bases donde
corre FOTOFFICE.

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20260930120000_fotoffice_equipo_y_modulos` |
| Archivo | `packages/db/prisma/migrations/20260930120000_fotoffice_equipo_y_modulos/migration.sql` |
| Checksum SHA-256 | `c4b04be4c4bc2ef1eefd1a5a037f85e980784d5081b73bdf2ced6531aa097c88` |
| Operaciones | 1 `ALTER TYPE … ADD VALUE`, 1 `ALTER TABLE … ADD COLUMN`, 2 `CREATE TABLE`, 4 `CREATE INDEX`, 4 claves foráneas |
| Destructivas | Ninguna. Es puramente aditiva |

No agrega columnas a `Workspace`, `WorkspaceMembership` ni `WorkspaceFeatureModule`, que
leen todas las apps con el mismo cliente Prisma.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20260930120000_fotoffice_equipo_y_modulos/migration.sql
```

Si no da el checksum de la tabla, **parar**: el archivo cambió después de escribir este documento.

## 2. En qué bases va

| Base | Proyecto / rama Neon |
|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` |
| CompraMeLaFoto | `compramelafoto` / `production` |
| Clickatón | `clickaton-production` |
| Staging | `dnx-suite-staging` |
| InfoSpot | **A verificar al momento de aplicar** |

InfoSpot: hay que comprobar si su base tiene las tablas `Workspace` y
`FotofficeWorkspaceBranding` (y `User`, por las claves foráneas). Si falta alguna, queda
afuera, como pasó con Coberturas. No se pudo verificar al escribir esto (sin acceso a la base).

## 3. Procedimiento, base por base

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20260930120000_fotoffice_equipo_y_modulos';
```

Si devuelve una fila, esa base ya está lista. Si no, seguir.

### Paso 2 — Aplicar en dos partes

**Parte A.** Correr esta sentencia **sola** (`ADD VALUE` de un enum no debe compartir
transacción con nada que use el valor nuevo):

```sql
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'COLLABORATOR';
```

**Parte B.** Todo el resto de `migration.sql` (desde el punto 2 en adelante) junto con el
registro, en una sola transacción:

```sql
BEGIN;
-- pegar acá el contenido de migration.sql SIN la sentencia ALTER TYPE (secciones 2, 3 y 4)

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
  gen_random_uuid()::text,
  'c4b04be4c4bc2ef1eefd1a5a037f85e980784d5081b73bdf2ced6531aa097c88',
  now(),
  '20260930120000_fotoffice_equipo_y_modulos',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260930120000_fotoffice_equipo_y_modulos'
);
COMMIT;
```

El checksum es el `shasum -a 256` del archivo, no se inventa.

### Paso 3 — Verificar

```sql
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('WorkspaceInvitation','WorkspaceAdminEvent')) AS tablas,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name='FotofficeWorkspaceBranding' AND column_name='organizationType') AS columna,
  (SELECT count(*) FROM "_prisma_migrations"
    WHERE migration_name='20260930120000_fotoffice_equipo_y_modulos' AND finished_at IS NOT NULL) AS registrada;

SELECT unnest(enum_range(NULL::"WorkspaceRole"));
```

Esperado: 2 tablas, 1 columna, 1 registrada, y `COLLABORATOR` en la lista del enum.

## 4. Rollback

```sql
BEGIN;
DROP TABLE "WorkspaceInvitation";
DROP TABLE "WorkspaceAdminEvent";
ALTER TABLE "FotofficeWorkspaceBranding" DROP COLUMN "organizationType";
DELETE FROM "_prisma_migrations" WHERE migration_name='20260930120000_fotoffice_equipo_y_modulos';
COMMIT;
```

El valor `COLLABORATOR` del enum **no se puede quitar** en Postgres; es inofensivo si nada lo usa.
