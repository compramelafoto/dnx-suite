# Aplicar la migración de Campos personalizados y Numeración (FOTOFFICE, etapa 0.5)

Procedimiento manual, con el mismo criterio que `MIGRACION-MOTOR-DE-ETAPAS.md`. Las tablas
van **antes** que el código: no se fusiona el PR sin haber aplicado esto en las bases donde
corre FOTOFFICE.

**Estas pantallas usan las tablas nuevas. Publicar el código antes que el SQL las rompe:**

- **Configuración → Campos y Configuración → Numeración.**
- **Las fichas de Cliente, Socio y Consulta (bloque "Más datos").**
- **Los listados de Clientes, Socios y Captación (columnas, filtros y búsqueda por campo).**
- **Captación: tablero, lista y ficha (muestran y buscan el número de cada consulta).**
- **El alta de consultas** (incluido el formulario público y la inscripción presencial a
  cursos): asignan el número de la consulta nueva.
- **La exportación de los listados** (agrega las columnas de campos personalizados).

Qué lee cada tabla:

| Tabla | Pantallas que la leen |
|---|---|
| `FotofficeCustomField`, `FotofficeCustomFieldOption` | **Configuración → Campos; "Más datos" de Cliente, Socio y Consulta; listados Clientes/Socios/Captación; exportación** |
| `FotofficeCustomValue` | **"Más datos" de las tres fichas; listados Clientes/Socios/Captación (columnas, filtros, búsqueda); exportación** |
| `FotofficeCustomValueChange` | **Historial de cambios de "Más datos" en las fichas de Cliente, Socio y Consulta** |
| `FotofficeSequence`, `FotofficeSequenceChange` | **Configuración → Numeración; alta de consultas (formulario público, panel e inscripción presencial)** |
| `FotofficeRecordNumber` | **Captación (tablero, lista, ficha); búsqueda por número; alta de consultas** |

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261004120000_fotoffice_campos_y_numeracion` |
| Archivo | `packages/db/prisma/migrations/20261004120000_fotoffice_campos_y_numeracion/migration.sql` |
| Checksum SHA-256 | `0c71aa56ca34608d67c54e33d8c4a70f50f03b6c7e22f049ca556cad57afbd86` |
| Operaciones | 7 `CREATE TABLE`, 6 índices comunes, 4 únicos comunes, 2 únicos parciales, claves foráneas, 4 `CHECK` |
| Destructivas | Ninguna. Es aditiva: no modifica ni borra columnas existentes |

Crea **siete** tablas nuevas: `FotofficeCustomField`, `FotofficeCustomFieldOption`,
`FotofficeCustomValue`, `FotofficeCustomValueChange`, `FotofficeSequence`,
`FotofficeSequenceChange` y `FotofficeRecordNumber`.

**El SQL no carga datos.** Las secuencias iniciales, el campo "Archivos del cliente" de DNX
(`ENLACE`, en Clientes) y la numeración de las consultas existentes se crean **en código**,
al abrir Configuración → Campos, Configuración → Numeración o la ficha de un cliente.

**Numeración de DNX.** El número "siguiente" de Presupuestos, Pedidos, Contratos y Proyectos
**se fija desde Alboom en la etapa 8**, no ahora. Los valores de referencia son:
Presupuestos 2025262, Pedidos 2025095, Contratos 2025094 y Proyectos 2025567 como próximos
números. **El próximo número no se puede bajar** del último usado: si se configura de más,
no hay vuelta atrás desde la pantalla.

**Dependencia.** Va después de la 0.1 (PR 277), la 0.2 (PR 281), la 0.3 (PR 286) y la 0.4
(PR 290), apilados.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261004120000_fotoffice_campos_y_numeracion/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. Orden de publicación

1. Se fusionan primero, en orden, los PR 277, 281, 286 y 290.
2. Esta rama se rebasa sobre `main` actualizado.
3. SQL en **staging** (`dnx-suite-staging`) y **prueba con `next dev` apuntando a staging**
   (sección 6).
4. SQL en **FOTOFFICE producción** (proyecto `compramelafoto`, rama `development`,
   `divine-hall-10689679` / `br-old-rain-adwthzng`).
5. Recién entonces se fusiona el PR.

## 3. En qué bases va

| Base | Proyecto / rama Neon | IDs verificados |
|---|---|---|
| Staging | `dnx-suite-staging` | — |
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Cada base necesita la tabla `Workspace` (por las claves foráneas). Las otras bases no son
urgentes: sólo `apps/fotoffice` lee estas tablas.

## 4. Procedimiento, base por base

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261004120000_fotoffice_campos_y_numeracion';
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
  '0c71aa56ca34608d67c54e33d8c4a70f50f03b6c7e22f049ca556cad57afbd86',
  now(),
  '20261004120000_fotoffice_campos_y_numeracion',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261004120000_fotoffice_campos_y_numeracion'
);
COMMIT;
```

### Paso 3 — Verificar (sólo `SELECT`)

Justo después del SQL, las siete tablas existen y están **vacías**:

```sql
SELECT count(*) FROM "FotofficeCustomField";        -- 0
SELECT count(*) FROM "FotofficeCustomFieldOption";  -- 0
SELECT count(*) FROM "FotofficeCustomValue";        -- 0
SELECT count(*) FROM "FotofficeCustomValueChange";  -- 0
SELECT count(*) FROM "FotofficeSequence";           -- 0
SELECT count(*) FROM "FotofficeSequenceChange";     -- 0
SELECT count(*) FROM "FotofficeRecordNumber";       -- 0

SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261004120000_fotoffice_campos_y_numeracion' AND finished_at IS NOT NULL; -- 1
```

**Después de publicar el código** (las secuencias y el campo de DNX los crea el código, no
el SQL). Con el id del workspace de DNX:

```sql
SELECT "workspaceId" FROM "FotofficeWorkspaceBranding" WHERE "publicSlug" = 'dnx-estudio';
```

```sql
-- Campo "Archivos del cliente" (aparece al abrir Configuración → Campos): 1 fila
SELECT name, type FROM "FotofficeCustomField"
 WHERE "workspaceId" = '<id de DNX>' AND "entityType" = 'CLIENTE';

-- Secuencias (aparecen al abrir Configuración → Numeración o al crear una consulta)
SELECT key, prefix, "withYear", digits, "nextValue" FROM "FotofficeSequence"
 WHERE "workspaceId" = '<id de DNX>';

-- Números de consulta asignados
SELECT count(*) FROM "FotofficeRecordNumber"
 WHERE "workspaceId" = '<id de DNX>' AND "sequenceKey" = 'CONSULTA';
```

## 5. Rollback

**Primero el código, después las tablas.** Si se borran las tablas con el código nuevo
publicado, las pantallas de la sección inicial se rompen.

1. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar
   que producción ya sirve la versión anterior.
2. Recién entonces, en cada base donde se aplicó:

```sql
BEGIN;
DROP TABLE "FotofficeRecordNumber";
DROP TABLE "FotofficeSequenceChange";
DROP TABLE "FotofficeSequence";
DROP TABLE "FotofficeCustomValueChange";
DROP TABLE "FotofficeCustomValue";
DROP TABLE "FotofficeCustomFieldOption";
DROP TABLE "FotofficeCustomField";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261004120000_fotoffice_campos_y_numeracion';
COMMIT;
```

Esto borra los campos definidos, sus valores, su historial, las secuencias y los números
asignados: no tiene vuelta atrás. Las consultas y los clientes en sí no se tocan.

## 6. Prueba manual (para Daniel, en el PR)

1. En Configuración → Campos, crear un campo de tipo **Lista** (con dos o tres opciones) para
   Clientes y filtrar el listado de Clientes por ese campo.
2. Editar "Más datos" de un socio y verlo en su historial de cambios.
3. Crear una consulta nueva (formulario público o panel): recibe número; buscarla por ese
   número en Captación.
4. En Configuración → Numeración, configurar Presupuestos con un prefijo y ver la vista previa.
5. Exportar un listado con campos personalizados: las columnas salen en el archivo.

## 7. Pendiente antes de producción

Estas dos pruebas no se hicieron: las pruebas automáticas corren con una base en memoria y
no cubren el comportamiento real de Postgres. Hacerlas contra una rama real de Neon (staging)
antes de aplicar en producción:

- **(a) Concurrencia de `asignarNumero`.** Dos altas de consulta en paralelo no deben dar el
  mismo número ni fallar; y crear una consulta **mientras se enganchan las de un año
  anterior** debe numerar bien (cada año con su propia cuenta).
- **(b) Búsqueda y filtros sobre campos personalizados.** Probar con Postgres real que la
  búsqueda por texto no distingue mayúsculas de minúsculas y que los filtros de fecha
  (`valueDate`, tipo `DATE`) incluyen los bordes del rango.
