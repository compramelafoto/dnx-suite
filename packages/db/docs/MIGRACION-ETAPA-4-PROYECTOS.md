# Aplicar la migración de Etapa 4 · Proyectos (FOTOFFICE, Entrega A)

Procedimiento manual, con el mismo criterio que `MIGRACION-ETAPA-3-PEDIDOS.md`, **sin staging**: por pedido
de Daniel, el SQL va directo a la base de producción de FOTOFFICE. Las tablas van **antes** que el código:
no se fusiona el PR sin haber aplicado esto.

Qué hace esta entrega: el módulo **Proyectos** (`/proyectos`). Un producto del catálogo puede tener
**reglas** ("Proyecto que genera"): al **confirmar un pedido**, por cada ítem con regla se crea un proyecto
con su circuito de TRABAJO, su plan de fechas por etapa y sus tareas. El proyecto se ve en una lista, un
tablero y una ficha, con equipo (participantes con rol), notas, adjuntos y suspensión.

## Advertencia crítica: pantallas que ya existen leen tablas nuevas

**Confirmar un pedido (`confirmarPedido`) ahora LEE `FotofficeProductoProyecto` y puede ESCRIBIR
`FotofficeProyecto` (más sus planes de etapa, tareas y numeración)**, pero sólo cuando el módulo `projects`
está encendido en la organización. **La ficha de producto del catálogo (Ventas → Catálogo) lee
`FotofficeProductoProyecto`** para mostrar y editar "Proyecto que genera", y **la ficha del pedido lee
`FotofficeProyecto`** para listar los proyectos del pedido. Si el código se publica **antes** que el SQL,
esas lecturas fallan (`P2021`, la tabla no existe) y **confirmar pedidos y abrir productos del catálogo da
error en toda organización que ya use Pedidos o Ventas**.

Además, **el CHECK de `FotofficeMessageTemplate.entityType` se reemplaza**: se mantienen `GENERAL`,
`CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO` y `PEDIDO`, y se suma `PROYECTO`. Sin el SQL, crear una
plantilla de tipo `PROYECTO` falla.

Por eso **el SQL se aplica primero, siempre**. Con el SQL aplicado y el código viejo todavía publicado no
pasa nada: las tablas nuevas no se usan, no se suman columnas a ninguna tabla existente y el CHECK nuevo
acepta todos los valores que aceptaba el viejo.

## 1. Qué se aplica

Migración: `packages/db/prisma/migrations/20261025120000_fotoffice_etapa_4_proyectos/migration.sql`

Checksum SHA-256 (del archivo comprometido; corregido en el commit `52ce0a8d`):

```
58904b9e1b4cf75962dad91c9bc93033909385c107a8d2a24f9f46627747f1ec
```

Comprobar antes de pegar: `shasum -a 256` del `migration.sql` tiene que dar exactamente ese valor.

### Tablas nuevas (7) y quién las lee

Sólo `apps/fotoffice` las lee; las otras apps no.

| Tabla | Para qué | Pantallas y flujos que la leen o escriben |
|---|---|---|
| `FotofficeProyecto` | El proyecto: número, nombre, contacto, pedido e ítem de origen, producto, circuito, fechas (evento, base, vencimiento final), responsable, delegado, suspensión. | **Proyectos (lista, tablero y ficha), la ficha del pedido (bloque "Proyectos del pedido"), confirmar pedido (escribe), tarjetas del tablero, portal del cliente (`/portal/proyectos`).** |
| `FotofficeProductoProyecto` | Regla "Proyecto que genera" de un producto: circuito, responsable, días desde el evento, plantilla de nombre, orden. | **Ficha de producto del catálogo (Ventas → Catálogo), confirmar pedido (lee), ficha del pedido (opciones de regla).** |
| `FotofficeProyectoRol` | Roles de participante (16 de DNX, sembrados al abrir `/proyectos`). | **Ficha del proyecto → Equipo.** |
| `FotofficeProyectoParticipante` | Equipo: una persona (usuario **o** contacto) con rol y nota. | **Ficha del proyecto → Equipo.** |
| `FotofficeProyectoNota` | Notas del proyecto. | **Ficha del proyecto → Notas.** |
| `FotofficeProyectoAdjunto` | Archivos adjuntos (clave en el almacenamiento, estado, borrado diferido). | **Ficha del proyecto → Adjuntos.** |
| `FotofficeProyectoEtapaPlan` | Fecha planificada de cada etapa del circuito para cada proyecto. | **Tablero, lista (vencimientos) y ficha del proyecto (plan por etapa).** |

### Índices

`FotofficeProyecto`:
- `FotofficeProyecto_workspaceId_finalDueDate_idx` (workspaceId, finalDueDate)
- `FotofficeProyecto_workspaceId_clientId_idx` (workspaceId, clientId)
- `FotofficeProyecto_workspaceId_pedidoId_idx` (workspaceId, pedidoId)
- `FotofficeProyecto_workspaceId_ownerUserId_idx` (workspaceId, ownerUserId)
- `FotofficeProyecto_clientId_idx`, `FotofficeProyecto_pedidoId_idx`, `FotofficeProyecto_productId_idx`, `FotofficeProyecto_circuitId_idx`
- **Único** `FotofficeProyecto_workspaceId_number_key` (workspaceId, number)
- **Único** `FotofficeProyecto_pedidoId_pedidoItemIndex_circuitId_key` (pedidoId, pedidoItemIndex, circuitId). Evita crear dos veces el mismo proyecto al reintentar confirmar. Las columnas nulas no chocan entre sí en Postgres: los proyectos sueltos (sin pedido) no se ven afectados.

`FotofficeProductoProyecto`: `..._workspaceId_productId_order_idx` (workspaceId, productId, order), `..._productId_idx`, `..._circuitId_idx`.

`FotofficeProyectoRol`: **único** `FotofficeProyectoRol_workspaceId_name_key` (workspaceId, name).

`FotofficeProyectoParticipante`: `..._workspaceId_proyectoId_idx`, `..._workspaceId_userId_idx`, `..._proyectoId_idx`, `..._clientId_idx`, `..._roleId_idx`.

`FotofficeProyectoNota`: `..._proyectoId_createdAt_idx`, `..._workspaceId_idx`.

`FotofficeProyectoAdjunto`: **único** `..._storageKey_key`; `..._workspaceId_proyectoId_createdAt_idx`, `..._proyectoId_idx`, `..._status_purgeAfter_idx`.

`FotofficeProyectoEtapaPlan`: **único** `..._proyectoId_stageId_key` (proyectoId, stageId); `..._workspaceId_idx`, `..._stageId_idx`.

### Claves foráneas

| Tabla | Columna | Apunta a | Al borrar |
|---|---|---|---|
| `FotofficeProyecto` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeProyecto` | `clientId` | `Client` | RESTRICT |
| `FotofficeProyecto` | `pedidoId` | `FotofficePedido` | RESTRICT |
| `FotofficeProyecto` | `productId` | `Product` | SET NULL |
| `FotofficeProyecto` | `circuitId` | `FotofficeCircuit` | RESTRICT |
| `FotofficeProductoProyecto` | `workspaceId` / `productId` / `circuitId` | `Workspace` / `Product` / `FotofficeCircuit` | CASCADE |
| `FotofficeProyectoRol` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeProyectoParticipante` | `workspaceId` / `proyectoId` / `clientId` | `Workspace` / `FotofficeProyecto` / `Client` | CASCADE |
| `FotofficeProyectoParticipante` | `roleId` | `FotofficeProyectoRol` | SET NULL |
| `FotofficeProyectoNota` | `workspaceId` / `proyectoId` | `Workspace` / `FotofficeProyecto` | CASCADE |
| `FotofficeProyectoAdjunto` | `workspaceId` / `proyectoId` | `Workspace` / `FotofficeProyecto` | CASCADE |
| `FotofficeProyectoEtapaPlan` | `workspaceId` / `proyectoId` / `stageId` | `Workspace` / `FotofficeProyecto` / `FotofficeStage` | CASCADE |

(Todas con `ON UPDATE CASCADE`. Las columnas de usuario, `ownerUserId`, `userId`, etc., son enteros sin FK: la validación la hace el código.)

### Los 6 CHECK nuevos

- `FotofficeProyecto_suspendReason`: `"suspendedAt" IS NULL OR "suspendReason" IS NOT NULL` (un proyecto suspendido tiene motivo).
- `FotofficeProyecto_name`: `length(trim("name")) > 0`.
- `FotofficeProductoProyecto_daysFromEvent`: `"daysFromEvent" BETWEEN -365 AND 365`.
- `FotofficeProyectoParticipante_persona`: `("userId" IS NULL) <> ("clientId" IS NULL)` (exactamente una de las dos).
- `FotofficeProyectoNota_body`: `length(trim("body")) > 0`.
- **Reemplazado:** `FotofficeMessageTemplate_entityType`: `"entityType" IN ('GENERAL','CLIENTE','SOCIO','CONSULTA','PRESUPUESTO','PEDIDO','PROYECTO')`.

### Lo que el SQL no hace

No suma columnas a tablas existentes, no borra ni actualiza filas, no siembra roles ni reglas. Lo que no
puede chequear el SQL lo valida el código (`lib/proyectos`): que el contacto, el pedido, el producto, el
flujo (de TRABAJO) y los roles sean del mismo workspace.

## 2. Orden de publicación (sin staging)

1. SQL de esta migración en **FOTOFFICE producción**.
2. Verificar (sección 4, paso 3).
3. Recién entonces se fusiona el PR y se publica el código. **No hay variables de entorno nuevas.**
4. Daniel, como administrador de la plataforma, enciende **Proyectos** en DNX Estudio (sección 5).
5. Daniel configura "Proyecto que genera" en los productos del catálogo (sección 5).
6. Prueba en producción (sección 7).

## 3. En qué base va

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Las otras bases no son urgentes: sólo `apps/fotoffice` lee estas tablas.

## 4. Procedimiento

### Paso 0 — Nadie tiene Proyectos encendido

```sql
SELECT count(*) AS encendidos
FROM "WorkspaceFeatureModule"
WHERE "moduleKey" = 'projects' AND enabled = true;
```

Tiene que dar **0**. Si da más, esa organización verá Proyectos apenas se publique: aplicar el SQL antes de publicar.

### Paso 1 — Comprobar qué está aplicado

```sql
SELECT migration_name FROM "_prisma_migrations"
 WHERE migration_name IN ('20261022120000_fotoffice_etapa_3_pedidos','20261025120000_fotoffice_etapa_4_proyectos');
```

- Tiene que aparecer la de Etapa 3 (Pedidos): esta migración usa `FotofficePedido`. Si no aparece, aplicarla primero con su documento.
- Si ya aparece `20261025120000_...`, la base está lista: parar.

Guardar antes del SQL el conteo de plantillas, para comparar después:

```sql
SELECT "entityType", count(*) FROM "FotofficeMessageTemplate" GROUP BY 1 ORDER BY 1;
```

### Paso 2 — Aplicar y registrar, a mano, en una sola transacción

```sql
BEGIN;
-- pegar acá el contenido completo de migration.sql

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
  gen_random_uuid()::text,
  '58904b9e1b4cf75962dad91c9bc93033909385c107a8d2a24f9f46627747f1ec',
  now(),
  '20261025120000_fotoffice_etapa_4_proyectos',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261025120000_fotoffice_etapa_4_proyectos'
);
COMMIT;
```

Si algo falla, la transacción entera se deshace (no queda nada a medias). Es la manera manual + registro
con checksum que se usa en FOTOFFICE (no se corre `migrate deploy`).

### Paso 3 — Verificar (sólo `SELECT`)

```sql
-- Las 7 tablas existen y están vacías
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN (
  'FotofficeProyecto','FotofficeProductoProyecto','FotofficeProyectoRol','FotofficeProyectoParticipante',
  'FotofficeProyectoNota','FotofficeProyectoAdjunto','FotofficeProyectoEtapaPlan'); -- 7 filas

SELECT
  (SELECT count(*) FROM "FotofficeProyecto")        AS proyectos,  -- 0
  (SELECT count(*) FROM "FotofficeProductoProyecto") AS reglas,    -- 0
  (SELECT count(*) FROM "FotofficeProyectoRol")      AS roles;     -- 0

-- Los 5 CHECK de las tablas nuevas
SELECT conname FROM pg_constraint
 WHERE contype = 'c' AND conrelid IN (
   '"FotofficeProyecto"'::regclass, '"FotofficeProductoProyecto"'::regclass,
   '"FotofficeProyectoParticipante"'::regclass, '"FotofficeProyectoNota"'::regclass)
 ORDER BY 1; -- 5 filas

-- Los 3 índices únicos principales
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
  'FotofficeProyecto_workspaceId_number_key',
  'FotofficeProyecto_pedidoId_pedidoItemIndex_circuitId_key',
  'FotofficeProyectoEtapaPlan_proyectoId_stageId_key'); -- 3 filas

-- Claves foráneas de las 7 tablas
SELECT count(*) FROM pg_constraint
 WHERE contype = 'f' AND conrelid IN (
  '"FotofficeProyecto"'::regclass, '"FotofficeProductoProyecto"'::regclass, '"FotofficeProyectoRol"'::regclass,
  '"FotofficeProyectoParticipante"'::regclass, '"FotofficeProyectoNota"'::regclass,
  '"FotofficeProyectoAdjunto"'::regclass, '"FotofficeProyectoEtapaPlan"'::regclass); -- 20

-- El CHECK reemplazado: una sola fila, con PROYECTO y los otros 6 valores
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';

-- Las plantillas de antes siguen igual (comparar con el SELECT del paso 1)
SELECT "entityType", count(*) FROM "FotofficeMessageTemplate" GROUP BY 1 ORDER BY 1;

-- La migración quedó registrada con el checksum correcto
SELECT checksum FROM "_prisma_migrations"
 WHERE migration_name = '20261025120000_fotoffice_etapa_4_proyectos' AND finished_at IS NOT NULL;
-- 58904b9e1b4cf75962dad91c9bc93033909385c107a8d2a24f9f46627747f1ec
```

## 5. Encender Proyectos en DNX Estudio y configurar

El módulo `projects` pasa a **disponible**, con la ruta `/proyectos` y **dependencia de Pedidos**
(`orders`). **No se enciende solo en ninguna organización.** Sólo el administrador de la plataforma
enciende o apaga módulos.

Después de publicar, **Daniel**:

1. Entra a DNX Estudio → Configuración → Módulos (o Administración → Workspaces → DNX Estudio) y enciende
   **Proyectos**. Pedidos ya está encendido; si no lo estuviera, la pantalla pide encenderlo antes.
2. Abre **`/proyectos`** por primera vez: ahí se **siembran los 16 roles de participante de DNX** (con los
   nombres de la configuración real). Es idempotente: no duplica.
3. En **Configuración → Comisión directiva** (roles), da **"Ver"** en Proyectos a quien debe leer y
   **"Gestionar"** a quien crea, edita y mueve proyectos.
4. **Configura "Proyecto que genera"** en cada producto del catálogo que corresponda (Ventas → Catálogo →
   ficha del producto): circuito de TRABAJO, responsable, días desde el evento y plantilla de nombre.
   **Sin reglas no se crea ningún proyecto al confirmar un pedido.**

## 6. Rollback

**Primero el código, después las tablas.** Con el código nuevo publicado y las tablas borradas, confirmar
pedidos y abrir productos del catálogo dan error.

1. Apagar **Proyectos** en DNX (Configuración → Módulos).
2. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar que
   producción ya sirve la versión anterior.
3. Recién entonces, en orden seguro para las claves foráneas:

```sql
BEGIN;
-- Las plantillas de tipo PROYECTO no caben en el CHECK anterior: se borran antes de volver a él.
DELETE FROM "FotofficeMessageTemplate" WHERE "entityType" = 'PROYECTO';
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO'));

DROP TABLE "FotofficeProyectoEtapaPlan";
DROP TABLE "FotofficeProyectoAdjunto";
DROP TABLE "FotofficeProyectoNota";
DROP TABLE "FotofficeProyectoParticipante";
DROP TABLE "FotofficeProyectoRol";
DROP TABLE "FotofficeProyecto";
DROP TABLE "FotofficeProductoProyecto";

DELETE FROM "_prisma_migrations" WHERE migration_name = '20261025120000_fotoffice_etapa_4_proyectos';
COMMIT;
```

**Advertencia: pérdida de datos sin vuelta atrás.** Si ya hay proyectos, este rollback **borra los
proyectos, su equipo, notas, adjuntos (los registros; los archivos quedan huérfanos en el almacenamiento),
planes de etapa y las reglas de los productos**, y las plantillas de tipo `PROYECTO`. No se borran
pedidos, productos, contactos ni circuitos. La numeración de proyectos (fila en Numeración) y los
valores de campos personalizados de proyectos quedan sin referencia. Si hay proyectos con datos reales,
**hacer antes un respaldo o una rama de Neon** de la base.

## 7. Prueba en producción (para Daniel, en el PR)

Todo en **DNX Estudio**, con datos de prueba que después se cancelan.

1. **Regla en un producto:** Ventas → Catálogo → un producto de prueba → "Proyecto que genera": elegir un
   circuito de TRABAJO, responsable y días desde el evento. Guardar.
2. **Pedido de prueba:** crear un presupuesto con ese producto, aceptarlo y **confirmar el pedido**.
3. **Ver el proyecto:** en la ficha del pedido aparece el bloque de proyectos; entrar a `/proyectos` y
   abrir el proyecto. Tiene que mostrar el **plan de etapas con fechas** y sus **tareas**.
4. **Mover etapas:** en el tablero, arrastrar la tarjeta a otra etapa (y volver).
5. **Tildar tareas** de la ficha y comprobar que el avance se actualiza.
6. **Equipo, nota y adjunto:** agregar un participante con rol (un usuario y un contacto), una nota y un
   adjunto; descargar el adjunto y borrarlo.
7. **Suspender y reanudar:** suspender con motivo (se ve el estado), reanudar.
8. **Finalizar** el proyecto (última etapa) y comprobar que queda como terminado.
9. **Limpiar:** cancelar el pedido de prueba y archivar/cancelar el proyecto de prueba; quitar la regla
   del producto de prueba.
10. Comprobar que **confirmar un pedido de un producto sin regla** sigue funcionando igual y no crea proyectos.
