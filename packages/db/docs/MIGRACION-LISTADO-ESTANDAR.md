# Aplicar la migración del Listado estándar (FOTOFFICE, etapa 0.2)

Procedimiento manual, con el mismo criterio que `MIGRACION-EQUIPO-Y-MODULOS.md`. Las tablas
van **antes** que el código: no se fusiona el PR sin haber aplicado esto en las bases donde
corre FOTOFFICE.

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261001120000_fotoffice_listado_estandar` |
| Archivo | `packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql` |
| Checksum SHA-256 | `bff90e0ca96d3a1da7e21b0f1df9409f2e1c72c4bdea413971ff85c4ceae3316` |
| Operaciones | 2 `CREATE TABLE`, 3 `CREATE INDEX` (uno único parcial), 4 claves foráneas |
| Destructivas | Ninguna. Es puramente aditiva |

Crea dos tablas nuevas y nada más: `FotofficeListView` (filtros recordados y vistas
guardadas) y `FotofficeListActivity` (registro de exportaciones y acciones en lote). No
toca `Workspace`, `WorkspaceMembership` ni `WorkspaceFeatureModule`.

**Dependencia.** No depende por SQL de la migración 0.1 (`20260930120000_fotoffice_equipo_y_modulos`):
sólo va después por orden de publicación.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. En qué bases va

Orden: primero staging, después FOTOFFICE y por último las demás bases que comparten el schema.

| Base | Proyecto / rama Neon |
|---|---|
| Staging | `dnx-suite-staging` |
| FOTOFFICE (producción real) | `divine-hall-10689679` / `br-old-rain-adwthzng` (`development`) |
| CompraMeLaFoto | `compramelafoto` / `production` |
| Clickatón | `clickaton-production` |
| InfoSpot | **A verificar al momento de aplicar** |

Cada base necesita las tablas `Workspace` y `User` (por las claves foráneas). Si falta
alguna, queda afuera.

## 3. Procedimiento, base por base

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261001120000_fotoffice_listado_estandar';
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
  'bff90e0ca96d3a1da7e21b0f1df9409f2e1c72c4bdea413971ff85c4ceae3316',
  now(),
  '20261001120000_fotoffice_listado_estandar',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261001120000_fotoffice_listado_estandar'
);
COMMIT;
```

El checksum es el `shasum -a 256` del archivo (equivale a `sha256sum`), no se inventa.

### Paso 3 — Verificar

```sql
SELECT count(*) FROM "FotofficeListView";      -- 0, sin error
SELECT count(*) FROM "FotofficeListActivity";  -- 0, sin error
SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261001120000_fotoffice_listado_estandar' AND finished_at IS NOT NULL; -- 1
```

## 4. Rollback

```sql
BEGIN;
DROP TABLE "FotofficeListActivity";
DROP TABLE "FotofficeListView";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261001120000_fotoffice_listado_estandar';
COMMIT;
```
