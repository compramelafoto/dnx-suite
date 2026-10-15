# Aplicar la migración del Listado estándar (FOTOFFICE, etapa 0.2)

Estado: aplicada en producción el 02/10/2026; código publicado el 06/10/2026 (PR 277)

Procedimiento manual, con el mismo criterio que `MIGRACION-EQUIPO-Y-MODULOS.md`. Las tablas
van **antes** que el código: no se fusiona el PR sin haber aplicado esto en las bases donde
corre FOTOFFICE. **No hay staging:** FOTOFFICE va directo a producción.

**`<Listado>` lee y escribe `FotofficeListView` en CADA carga de `/clientes`, `/members` y
`/caja/movimientos`. Publicar el código antes que el SQL deja esas tres páginas rotas para
todos (SFPR usa Socios todos los días).** El código ya se defiende: si la tabla falla, la
lista se dibuja igual. Pero sin las tablas no se recuerdan los filtros, no se pueden guardar
vistas, y exportar o aplicar un lote falla al registrar la actividad (en un lote, los cambios
ya quedaron hechos y la persona ve "No se pudo completar la acción"). Por eso el orden de la
sección 2 no es opcional.

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

## 2. Orden de publicación

1. Se fusiona primero el PR 277 (etapa 0.1, `MIGRACION-EQUIPO-Y-MODULOS.md`).
2. Esta rama se rebasa sobre `main` actualizado.
3. SQL en **FOTOFFICE producción** (`compramelafoto` / `development`), con la verificación
   de la sección 4.
4. Recién entonces se fusiona el PR.
5. Con el código publicado, probar las tres páginas (`/clientes`, `/members`,
   `/caja/movimientos`) en producción: filtros recordados, guardar/renombrar/borrar vista,
   exportar y un lote.

## 3. En qué bases va

| Base | Proyecto / rama Neon | IDs verificados |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |
| CompraMeLaFoto | `compramelafoto` / `production` | `divine-hall-10689679` / `production` |
| Clickatón | `clickaton-production` | `bitter-math-56019731` (rama por defecto) |
| InfoSpot | InfoSpot | `wandering-pine-79918137` (rama por defecto) |

InfoSpot: verificado el 29/09/2026 (consulta de sólo lectura a `information_schema`): tiene
`Workspace`, `User` y `_prisma_migrations`, así que puede recibir la migración.

Cada base necesita las tablas `Workspace` y `User` (por las claves foráneas). Si falta
alguna, queda afuera.

**Las otras bases (CompraMeLaFoto, Clickatón, InfoSpot) no son urgentes.** Ninguna otra app
lee estas tablas (verificado: sólo `apps/fotoffice` usa `fotofficeListView` y
`fotofficeListActivity`), y el cliente Prisma no exige tablas que nunca consulta. Aplicarlas
ahí sólo hace falta para que el schema quede alineado con el historial de migraciones; se
pueden hacer después, cuando convenga.

## 4. Procedimiento, base por base

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

## 5. Rollback

**Primero el código, después las tablas.** Si se borran las tablas con el código nuevo
publicado, las tres listas pierden filtros y vistas, y exportar y los lotes fallan.

1. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y
   confirmar que producción ya sirve la versión sin listado estándar.
2. Recién entonces, en cada base donde se aplicó:

```sql
BEGIN;
DROP TABLE "FotofficeListActivity";
DROP TABLE "FotofficeListView";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261001120000_fotoffice_listado_estandar';
COMMIT;
```

Esto borra las vistas guardadas y el registro de actividad: no tiene vuelta atrás.
