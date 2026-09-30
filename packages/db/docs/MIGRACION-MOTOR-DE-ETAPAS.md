# Aplicar la migración del Motor de etapas (FOTOFFICE, etapa 0.4)

Procedimiento manual, con el mismo criterio que `MIGRACION-FICHA-ESTANDAR.md`. Las tablas
van **antes** que el código: no se fusiona el PR sin haber aplicado esto en las bases donde
corre FOTOFFICE.

**Captación (tablero, lista, informe y ficha), el inicio ("Mis tareas") y el alta de
consultas usan estas tablas. Publicar el código antes que el SQL rompe esas pantallas.** El
alta de consultas no se rompe, porque el motor nunca hace fallar `createServiceLead`, pero la
consulta queda sin recorrido hasta que alguien abra el tablero. Por eso el orden de la
sección 2 no es opcional.

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261003120000_fotoffice_motor_de_etapas` |
| Archivo | `packages/db/prisma/migrations/20261003120000_fotoffice_motor_de_etapas/migration.sql` |
| Checksum SHA-256 | `a1cdb0ca82a7e353d2150a4ac6a69d6f7bc4fd351292769461bc6bb3d9c3be9b` |
| Operaciones | 9 `CREATE TABLE`, 8 índices comunes, 6 únicos (dos parciales), claves foráneas, 3 `CHECK` |
| Destructivas | Ninguna. Es aditiva: no modifica ni borra columnas existentes (ni en `ServiceSalesLead`) |

Crea nueve tablas nuevas: `FotofficeCircuit`, `FotofficeStage`, `FotofficeStageTaskTemplate`,
`FotofficeStageRule`, `FotofficeLossReason`, `FotofficeJourney`, `FotofficeJourneyStep`,
`FotofficeTask` y `FotofficeProcessedEvent`.

**El SQL no carga datos.** Las semillas (circuitos y motivos de pérdida) y el enganche de las
consultas existentes corren **en código**, al abrir Captación o Configuración → Circuitos:

- `asegurarCircuitos` crea los circuitos y motivos que falten del workspace (en DNX: 21
  circuitos y 6 motivos de pérdida).
- `engancharConsultas` crea un recorrido (en el circuito de venta predeterminado) por cada
  consulta existente que no lo tenga. Procesa **como máximo 150 por llamada** y muestra un
  aviso "quedan N": hay que **recargar la página hasta que diga 0**.

**Concurrencia.** El enganche toma un bloqueo consultivo de Postgres (advisory lock) por
consulta, para que dos pestañas abiertas a la vez no creen recorridos duplicados. Eso supone
que la transacción corre en aislamiento `READ COMMITTED` (el predeterminado de Postgres y de
Prisma): **no cambiar el nivel de aislamiento de esa transacción.**

**Rutas.** `/captacion` (tablero), `/captacion/lista`, `/captacion/informe` y
`/captacion/[id]` (ficha). `/dashboard/service-leads` redirige a `/captacion`;
`/dashboard/service-leads/forms` no cambia.

**Dependencia.** Va después de la 0.1 (PR 277), la 0.2 (PR 281) y la 0.3 (PR 286), apilados.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261003120000_fotoffice_motor_de_etapas/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. Orden de publicación

1. Se fusionan primero, en orden, el PR 277 (0.1), el PR 281 (0.2) y el PR 286 (0.3).
2. Esta rama se rebasa sobre `main` actualizado.
3. SQL en **staging** (`dnx-suite-staging`) y **prueba con `next dev` apuntando a staging**:
   abrir Captación, mover una consulta, tildar una tarea (sección 6).
4. SQL en **FOTOFFICE producción** (`compramelafoto` / `development`), con la verificación
   del paso 3 de la sección 4 inmediatamente después.
5. Recién entonces se fusiona el PR.

## 3. En qué bases va

| Base | Proyecto / rama Neon | IDs verificados |
|---|---|---|
| Staging | `dnx-suite-staging` | — |
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |
| CompraMeLaFoto | `compramelafoto` / `production` | `divine-hall-10689679` / `production` |
| Clickatón | `clickaton-production` | `bitter-math-56019731` (rama por defecto) |
| InfoSpot | InfoSpot | `wandering-pine-79918137` (rama por defecto) |

Cada base necesita la tabla `Workspace` (por las claves foráneas). **Las otras bases no son
urgentes:** sólo `apps/fotoffice` lee estas tablas; aplicarlas ahí sólo alinea el schema con
el historial de migraciones.

## 4. Procedimiento, base por base

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261003120000_fotoffice_motor_de_etapas';
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
  'a1cdb0ca82a7e353d2150a4ac6a69d6f7bc4fd351292769461bc6bb3d9c3be9b',
  now(),
  '20261003120000_fotoffice_motor_de_etapas',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261003120000_fotoffice_motor_de_etapas'
);
COMMIT;
```

### Paso 3 — Verificar (sólo `SELECT`)

Justo después del SQL, las nueve tablas existen y están **vacías**:

```sql
SELECT count(*) FROM "FotofficeCircuit";          -- 0
SELECT count(*) FROM "FotofficeStage";            -- 0
SELECT count(*) FROM "FotofficeStageTaskTemplate"; -- 0
SELECT count(*) FROM "FotofficeStageRule";        -- 0
SELECT count(*) FROM "FotofficeLossReason";       -- 0
SELECT count(*) FROM "FotofficeJourney";          -- 0
SELECT count(*) FROM "FotofficeJourneyStep";      -- 0
SELECT count(*) FROM "FotofficeTask";             -- 0
SELECT count(*) FROM "FotofficeProcessedEvent";   -- 0

SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261003120000_fotoffice_motor_de_etapas' AND finished_at IS NOT NULL; -- 1
```

Después de abrir Captación en DNX (y recargar hasta que no diga "quedan N"):

```sql
-- 21 circuitos y 6 motivos de pérdida en DNX
SELECT count(*) FROM "FotofficeCircuit"    WHERE "workspaceId" = '<id de DNX>';   -- 21
SELECT count(*) FROM "FotofficeLossReason" WHERE "workspaceId" = '<id de DNX>';   -- 6

-- un recorrido de venta por consulta existente: los dos números deben coincidir
SELECT
  (SELECT count(*) FROM "ServiceSalesLead" WHERE "workspaceId" = '<id de DNX>') AS consultas,
  (SELECT count(*) FROM "FotofficeJourney" j
     JOIN "FotofficeCircuit" c ON c.id = j."circuitId"
    WHERE j."workspaceId" = '<id de DNX>' AND j."subjectType" = 'CAPTACION' AND c.kind = 'VENTA') AS recorridos;
```

Si `recorridos` es menor, todavía quedan consultas por enganchar: recargar Captación.

## 5. Rollback

**Primero el código, después las tablas.** Si se borran las tablas con el código nuevo
publicado, Captación y el inicio se rompen.

1. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar
   que producción ya sirve la versión sin motor de etapas.
2. Recién entonces, en cada base donde se aplicó:

```sql
BEGIN;
DROP TABLE "FotofficeProcessedEvent";
DROP TABLE "FotofficeTask";
DROP TABLE "FotofficeJourneyStep";
DROP TABLE "FotofficeJourney";
DROP TABLE "FotofficeLossReason";
DROP TABLE "FotofficeStageRule";
DROP TABLE "FotofficeStageTaskTemplate";
DROP TABLE "FotofficeStage";
DROP TABLE "FotofficeCircuit";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261003120000_fotoffice_motor_de_etapas';
COMMIT;
```

Esto borra circuitos, etapas, recorridos, tareas e historial creados después de la
migración: no tiene vuelta atrás. `ServiceSalesLead.status` nunca dejó de actualizarse, así
que la Captación vieja sigue funcionando con los estados de siempre.

## 6. Prueba manual (para Daniel, en el PR)

1. Abrir Captación en DNX: se cargan los circuitos; recargar hasta que no diga "quedan N".
2. Arrastrar una consulta a otra etapa. Usar también "Mover a…" (dos pasos).
3. Marcar una consulta como ganada: pide confirmación.
4. Marcar otra como perdida: exige elegir un motivo.
5. Tildar tareas de una consulta. Con tareas obligatorias pendientes, el movimiento se frena;
   como dueño, "Pasar igual" deja avanzar.
6. Abrir la ficha: ver la proyección y el historial.
7. En Configuración → Circuitos, reordenar etapas: ninguna consulta debe cambiar de etapa.
8. En el inicio, ver "Mis tareas".
9. Mandar una consulta nueva desde el formulario público: entra sola en la primera etapa.
