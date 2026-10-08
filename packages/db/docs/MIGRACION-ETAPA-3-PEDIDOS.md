# Aplicar la migración de Etapa 3 · Pedidos y cobros (FOTOFFICE, Entrega A)

Procedimiento manual, con el mismo criterio que `MIGRACION-ETAPA-2-PRESUPUESTOS.md`, **sin staging**:
por pedido de Daniel, el SQL va directo a la base de producción de FOTOFFICE. Las tablas y columnas van
**antes** que el código: no se fusiona el PR sin haber aplicado esto.

Qué hace esta entrega: el módulo **Pedidos** (`/pedidos`). Un presupuesto aceptado se **confirma** como
pedido con su **plan de cuotas**; se **cobra** (efectivo, transferencia, Mercado Pago, tarjeta u otro) y
cada cobro genera un **recibo X** ("Documento no válido como factura") y un **ingreso en Caja**; el
cliente ve su pedido y su recibo en **enlaces públicos**. Más las **opciones de pago** en Configuración →
Presupuestos y los **rubros de dos niveles** (con el plan de cuentas de DNX) en Caja → Rubros.

## Advertencia crítica: pantallas que ya existen leen columnas nuevas

**El editor del presupuesto, la ficha del presupuesto y la página pública del presupuesto
(`/w/<slug>/presupuesto/<token>`) leen `FotofficePresupuestoVersion.paymentOptions` y
`.chosenPaymentOptionId`, y Configuración → Presupuestos lee `FotofficePresupuestoAjustes.paymentOptions`.
El catálogo (ficha de producto) lee `FotofficeProductoCatalogo.incomeCategoryId`.** Prisma selecciona
todas las columnas del modelo: si el código se publica **antes** que el SQL, esas pantallas **dan error**
(`P2022`, la columna no existe) en toda organización que ya use Presupuestos o Ventas, y **los
presupuestos ya enviados dejan de poder abrirse y aceptarse para el cliente**.

Por eso **el SQL se aplica primero, siempre**. Con el SQL aplicado y el código viejo todavía publicado
no pasa nada: las columnas nuevas admiten nulo, las tablas nuevas no se usan y el CHECK nuevo acepta
todos los valores que acepta el viejo.

Qué lee cada tabla o columna (las otras apps no las leen; sólo `apps/fotoffice`):

| Tabla / columna | Pantallas y flujos que la leen o escriben |
|---|---|
| `FotofficePresupuestoVersion.paymentOptions` y `.chosenPaymentOptionId` (**existentes en pantallas ya publicadas**) | **Editor y ficha del presupuesto (`/presupuestos/<id>`: opciones de pago de la versión); página pública del presupuesto (el cliente elige el plan y lo acepta); aceptación; confirmación del pedido (toma la opción elegida)** |
| `FotofficePresupuestoAjustes.paymentOptions` (**existente en pantalla ya publicada**) | **Configuración → Presupuestos (opciones de pago por omisión, lee y guarda); Nuevo presupuesto (las copia a la versión)** |
| `FotofficeProductoCatalogo.incomeCategoryId` (**existente en pantalla ya publicada**) | **Ventas → Catálogo → ficha del producto (rubro de ingreso; `lib/catalogo/perfil.ts`); editor del presupuesto (rubro de cada ítem); confirmación del pedido (rubro del pedido)** |
| `FotofficePedido` | **Pedidos → lista (`/pedidos`) y ficha (`/pedidos/<id>`); botón "Confirmar pedido" de la ficha del presupuesto; tarjeta de pedidos de la ficha de la consulta y del contacto; página pública del pedido (`/w/<slug>/pedido/<token>`, o `/pedido/<token>` en dominio propio); envío del enlace por correo o WhatsApp; Caja (origen de los ingresos)** |
| `FotofficePedidoCuota` | **Ficha del pedido (plan de cuotas, editar el plan, saldo y vencidas); lista de Pedidos (próximo vencimiento y saldo); página pública del pedido (cuotas y estado); cobro (imputación a cuotas)** |
| `FotofficeCobro` | **Ficha del pedido (cobros, anulación); recibo imprimible (`/w/<slug>/recibo/<token>`); página pública del pedido (pagos realizados); numeración `RECIBO`; Caja (`sourceModule = "pedidos"`, `sourceRef` = id del cobro)** |
| `FotofficeCobroImputacion` | **Ficha del pedido (a qué cuota se imputó cada cobro); recibo (detalle de cuotas pagadas); cálculo del saldo y de lo vencido** |
| `FotofficeRubro` | **Caja → Rubros (árbol de dos niveles y "Cargar plan de cuentas de DNX"; requiere el permiso de configurar Caja); selectores de rubro del catálogo, del presupuesto y del pedido** |
| `FotofficeMessageTemplate` (sólo el CHECK, R13) | **Configuración → Plantillas (tipo "Pedidos" y siembra de las plantillas de enlace del pedido y de recibo de pago); ficha del pedido (Enviar enlace / Enviar recibo)** |

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261022120000_fotoffice_etapa_3_pedidos` |
| Archivo | `packages/db/prisma/migrations/20261022120000_fotoffice_etapa_3_pedidos/migration.sql` |
| Checksum SHA-256 | `0cb8afd5aafc20331cb7b2f5017b477f6ad0867d0f757e3e65c47337b91b3187` |
| Operaciones | 5 `CREATE TABLE`, 4 columnas nuevas que admiten nulo, índices comunes y únicos, claves foráneas, 13 `CHECK` nuevos y **el reemplazo de un `CHECK` existente** (ver abajo) |
| Destructivas | Ninguna. No borra nada ni actualiza filas. `CashCategory`, `CashMovement`, `Product`, `Client` y `Workspace` no reciben columnas (las claves foráneas nacen en las tablas nuevas o apuntan a ellas) |

### Tablas nuevas (5)

- **`FotofficePedido`**: `id`, `workspaceId`, `number`, `presupuestoId`, `acceptedVersionId`,
  `consultaLeadId`, `clientId`, `status` (por omisión `CONFIRMADO`), `cancelReason`, `items` JSONB,
  `totals` JSONB, `totalArs` DECIMAL(12,2), `paymentOption` JSONB, `eventDate` DATE, `eventLabel`,
  `incomeCategoryId`, `ownerUserId`, `accessTokenHash`, `createdByUserId`, `createdAt`, `updatedAt`.
  - Únicos: `(workspaceId, number)`, `presupuestoId` y `accessTokenHash`.
  - Índices: `(workspaceId, status)`, `(workspaceId, clientId)`, `(workspaceId, consultaLeadId)`,
    `(workspaceId, eventDate)`, `consultaLeadId`, `clientId`, `acceptedVersionId`, `incomeCategoryId`.
  - FK: `Workspace` (CASCADE), `FotofficePresupuesto` (RESTRICT), `FotofficePresupuestoVersion`
    (SET NULL), `ServiceSalesLead` (RESTRICT), `Client` (RESTRICT), `CashCategory` (SET NULL).
- **`FotofficePedidoCuota`**: `id`, `workspaceId`, `pedidoId`, `position`, `dueDate` DATE,
  `amountArs` DECIMAL(12,2), `suggestedMethod`, `createdAt`, `updatedAt`.
  - Índices: `(pedidoId, position)`, `(workspaceId, dueDate)`.
  - FK: `Workspace` (CASCADE), `FotofficePedido` (CASCADE).
- **`FotofficeCobro`**: `id`, `workspaceId`, `pedidoId`, `clientId`, `paidAt`, `method`,
  `amountArs`, `feeArs`, `netArs` (DECIMAL(12,2)), `providerPaymentRef`, `cashMovementId`,
  `attachmentId`, `receiptNumber`, `receiptTokenHash`, `voidedAt`, `voidReason`,
  `voidCashMovementId`, `idempotencyKey`, `createdByUserId`, `createdAt`, `updatedAt`.
  - Únicos: `providerPaymentRef`, `cashMovementId`, `receiptTokenHash`, `voidCashMovementId`,
    `(workspaceId, receiptNumber)` y `(workspaceId, idempotencyKey)`.
  - Índices: `(workspaceId, paidAt)`, `(workspaceId, clientId)`, `pedidoId`, `clientId`, `attachmentId`.
  - FK: `Workspace` (CASCADE), `FotofficePedido` (RESTRICT), `Client` (RESTRICT), `CashMovement` x2
    (`cashMovementId` y `voidCashMovementId`, SET NULL), `FotofficeAttachment` (SET NULL).
- **`FotofficeCobroImputacion`**: `id`, `workspaceId`, `cobroId`, `cuotaId`, `amountArs`
  DECIMAL(12,2), `createdAt`.
  - Único: `(cobroId, cuotaId)`. Índices: `cuotaId`, `workspaceId`.
  - FK: `Workspace` (CASCADE), `FotofficeCobro` (CASCADE), `FotofficePedidoCuota` (RESTRICT).
- **`FotofficeRubro`**: `id`, `workspaceId`, `categoryId`, `parentCategoryId`, `code`, `createdAt`,
  `updatedAt`.
  - Único: `categoryId`. Índices: `workspaceId`, `parentCategoryId`.
  - FK: `Workspace` (CASCADE), `CashCategory` por `categoryId` (CASCADE) y por `parentCategoryId`
    (SET NULL).

### Columnas nuevas en tablas existentes (4, todas nulas)

| Columna | Tipo |
|---|---|
| `FotofficePresupuestoVersion.paymentOptions` | `JSONB` |
| `FotofficePresupuestoVersion.chosenPaymentOptionId` | `TEXT` |
| `FotofficePresupuestoAjustes.paymentOptions` | `JSONB` |
| `FotofficeProductoCatalogo.incomeCategoryId` | `TEXT`, FK a `CashCategory` `ON DELETE SET NULL`, con índice |

### Los 13 CHECK nuevos

`FotofficePedido_status` (`CONFIRMADO | EN_CURSO | COMPLETADO | CANCELADO`),
`FotofficePedido_cancelReason` (cancelado exige motivo), `FotofficePedido_totalArs` (>= 0),
`FotofficePedidoCuota_position` (>= 1), `FotofficePedidoCuota_amountArs` (> 0),
`FotofficePedidoCuota_suggestedMethod`, `FotofficeCobro_method` (`EFECTIVO | TRANSFERENCIA |
MERCADO_PAGO | TARJETA | OTRO`, los mismos de `CashMovement.paymentMethod`), `FotofficeCobro_amountArs`
(> 0), `FotofficeCobro_feeArs`, `FotofficeCobro_netArs`, `FotofficeCobro_voidReason` (anulado exige
motivo), `FotofficeCobroImputacion_amountArs` (> 0) y `FotofficeRubro_not_self`.

### El cambio en una tabla existente: el CHECK de `FotofficeMessageTemplate.entityType` (R13)

Las últimas dos líneas del SQL **reemplazan una restricción** de una tabla que ya existe:

```sql
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO'));
```

- **Por qué:** las plantillas del enlace del pedido y del recibo son de un tipo nuevo, `PEDIDO`, que el
  CHECK de la etapa 2 (`GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO`) no aceptaba.
- **Por qué es seguro:** la lista nueva es la vieja **más** un valor (conserva los 5 anteriores), así
  que ninguna fila existente deja de cumplirla; es idempotente (`DROP ... IF EXISTS`); y el tipo
  `PEDIDO` sólo se escribe al sembrar o guardar plantillas con el módulo Pedidos encendido.

### Lo que el SQL no hace

- No carga datos: ni rubros, ni opciones de pago, ni numeración. Las filas de numeración `PEDIDO` y
  `RECIBO` nacen al usarse.
- No puede chequear que la suma de las cuotas dé el total, que lo imputado no supere la cuota, que el
  rubro padre sea del mismo `kind` y workspace ni que haya un solo nivel de padre: lo valida el código
  (`lib/pedidos`, `lib/rubros`).

## 2. Orden de publicación (sin staging)

0. Si la migración `20261022100000_fotoffice_perfil_precios` (PR 419, otra sesión) **todavía no está
   aplicada** en producción, aplicarla **primero** (ordena antes que esta). Mirarlo con el paso 1.
1. SQL de esta migración en **FOTOFFICE producción** (proyecto `compramelafoto`, rama
   `development`, `divine-hall-10689679` / `br-old-rain-adwthzng`).
2. Verificar (paso 3 de la sección 4).
3. Recién entonces se fusiona el PR y se publica el código. **No hay variables nuevas** (sección 3).
4. Daniel, como administrador de la plataforma, enciende **Pedidos** en DNX Estudio (sección 5).
5. Plan de cuentas, opciones de pago y numeración de DNX (sección 6).
6. Prueba en producción (sección 8).

## 3. En qué base va y variables de Vercel

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Las otras bases no son urgentes: sólo `apps/fotoffice` lee estas tablas.

**Variables de entorno nuevas: ninguna.** Los enlaces del pedido y del recibo se firman con la misma
clave que los del presupuesto (`resolverClaveDeEnlace`, en `lib/presupuestos/enlace.ts`): en producción,
`PRESUPUESTO_TOKEN_SECRET` o, si no está, `STORE_ORDER_TOKEN_SECRET`. Los prefijos del mensaje firmado
(`fotoffice-pedido:v1:` y `fotoffice-recibo:v1:`) separan los usos. Si no hay ninguna de las dos, **no
se pueden armar enlaces** y la ficha del pedido lo avisa. La dirección pública sale de
`NEXT_PUBLIC_APP_URL` / `APP_URL` (ya puestas) o del dominio propio de la organización.

**Cuidado:** cambiar esa clave rompe también todos los enlaces de pedidos y recibos ya enviados.

## 4. Procedimiento

### Paso 0 — Nadie tiene Pedidos encendido

```sql
SELECT count(*) AS encendidos
FROM "WorkspaceFeatureModule"
WHERE "moduleKey" = 'orders' AND enabled = true;
```

Tiene que dar **0**: el código nuevo trata `orders` como disponible, y una organización que ya lo
tuviera encendido vería Pedidos en cuanto se publique. Si da más de 0, aplicar la migración antes de
publicar (como dice la sección 2) y revisar esa organización.

### Paso 1 — Comprobar qué está aplicado

```sql
SELECT migration_name FROM "_prisma_migrations"
 WHERE migration_name IN ('20261022100000_fotoffice_perfil_precios','20261022120000_fotoffice_etapa_3_pedidos');
```

- Si aparece `20261022120000_...`, la base ya está lista: parar.
- Si **no** aparece `20261022100000_fotoffice_perfil_precios`, aplicarla primero con su propio
  documento y recién después seguir.

### Paso 2 — Aplicar y registrar, en una sola transacción

```sql
BEGIN;
-- pegar acá el contenido completo de migration.sql

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
  gen_random_uuid()::text,
  '0cb8afd5aafc20331cb7b2f5017b477f6ad0867d0f757e3e65c47337b91b3187',
  now(),
  '20261022120000_fotoffice_etapa_3_pedidos',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261022120000_fotoffice_etapa_3_pedidos'
);
COMMIT;
```

Antes de pegar, comprobar que el archivo no cambió: `shasum -a 256` del `migration.sql` tiene que dar
el checksum de arriba.

### Paso 3 — Verificar (sólo `SELECT`)

```sql
-- Las 5 tablas existen y están vacías
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN (
  'FotofficePedido','FotofficePedidoCuota','FotofficeCobro','FotofficeCobroImputacion','FotofficeRubro'); -- 5 filas

SELECT
  (SELECT count(*) FROM "FotofficePedido") AS pedidos,   -- 0
  (SELECT count(*) FROM "FotofficeCobro")  AS cobros,    -- 0
  (SELECT count(*) FROM "FotofficeRubro")  AS rubros;    -- 0

-- Las 4 columnas nuevas existen y admiten nulo (is_nullable = YES en las 4)
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND (
   (table_name = 'FotofficePresupuestoVersion' AND column_name IN ('paymentOptions','chosenPaymentOptionId')) OR
   (table_name = 'FotofficePresupuestoAjustes' AND column_name = 'paymentOptions') OR
   (table_name = 'FotofficeProductoCatalogo'   AND column_name = 'incomeCategoryId'))
 ORDER BY 1, 2; -- 4 filas

-- Los 13 CHECK nuevos de las tablas nuevas
SELECT conname FROM pg_constraint
 WHERE contype = 'c' AND conrelid IN (
   '"FotofficePedido"'::regclass, '"FotofficePedidoCuota"'::regclass, '"FotofficeCobro"'::regclass,
   '"FotofficeCobroImputacion"'::regclass, '"FotofficeRubro"'::regclass)
 ORDER BY 1; -- 13 filas

-- El CHECK reemplazado (R13): una sola fila, con PEDIDO y los otros 5 valores
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';

-- Las plantillas de antes siguen igual (comparar con el mismo SELECT corrido antes del SQL)
SELECT "entityType", count(*) FROM "FotofficeMessageTemplate" GROUP BY 1 ORDER BY 1;

-- La migración quedó registrada
SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name = '20261022120000_fotoffice_etapa_3_pedidos' AND finished_at IS NOT NULL; -- 1
```

## 5. Encender el módulo Pedidos en DNX Estudio

El módulo `orders` pasa de "planificado" a **disponible**, con el nombre "Pedidos", la ruta `/pedidos`
y **dependencia de Presupuestos** (`quotes`). **No se enciende solo en ninguna organización.** Sólo el
administrador de la plataforma enciende o apaga módulos.

Después de publicar, **Daniel**:

1. Entra a DNX Estudio → Configuración → Módulos (o Administración → Workspaces → DNX Estudio) y
   enciende **Pedidos**. Presupuestos ya está encendido; si no lo estuviera, la pantalla pide
   encenderlo antes.
2. En **Configuración → Comisión directiva** (roles), da **"Ver"** en Pedidos a quien debe leer y
   **"Gestionar"** a quien confirma, cobra, anula y edita el plan. El margen y los costos sólo los ven
   quienes tienen `configurar` o `verDinero`.
3. Los rubros se administran con el permiso existente de configurar Caja.

## 6. Configuración de DNX después de encender

1. **Numeración** (Configuración → Numeración): las filas **Pedido** y **Recibo** usan por omisión
   **año y 4 dígitos** (`2026-0001`). **No hay nada que configurar** salvo que ya existan filas de
   numeración con otro formato para esas claves; en ese caso, revisarlas antes del primer pedido.
   El número se asigna al confirmar el pedido (`PEDIDO`) y al registrar cada cobro (`RECIBO`).
2. **Caja → Rubros → "Cargar plan de cuentas de DNX"**: crea los rubros de dos niveles con sus códigos.
   Es idempotente: se puede volver a apretar. Sin rubros, los ingresos de los cobros quedan sin rubro.
3. **Configuración → Presupuestos → Opciones de pago** (opcional): si no se carga nada, cada
   presupuesto ofrece un solo plan "Hasta N cuotas sin interés", con `N = min(6, meses completos hasta
   el evento)` y mínimo 1 (6 si no hay fecha de evento), más el contado (1 cuota que vence el día de la
   confirmación).

## 7. Rollback

**Primero el código, después las tablas y columnas.** Con el código nuevo publicado y las columnas
borradas, el editor y la página pública del presupuesto y la ficha de producto dan error.

1. Apagar **Pedidos** en DNX (Configuración → Módulos).
2. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar que
   producción ya sirve la versión anterior.
3. Recién entonces, en orden seguro para las claves foráneas:

```sql
BEGIN;
-- Las plantillas de tipo PEDIDO no caben en el CHECK viejo: se borran antes de volver a él.
DELETE FROM "FotofficeMessageTemplate" WHERE "entityType" = 'PEDIDO';
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO'));

DROP TABLE "FotofficeCobroImputacion";
DROP TABLE "FotofficeCobro";
DROP TABLE "FotofficePedidoCuota";
DROP TABLE "FotofficePedido";
DROP TABLE "FotofficeRubro";

ALTER TABLE "FotofficeProductoCatalogo" DROP CONSTRAINT "FotofficeProductoCatalogo_incomeCategoryId_fkey";
DROP INDEX IF EXISTS "FotofficeProductoCatalogo_incomeCategoryId_idx";
ALTER TABLE "FotofficeProductoCatalogo" DROP COLUMN "incomeCategoryId";
ALTER TABLE "FotofficePresupuestoVersion" DROP COLUMN "paymentOptions", DROP COLUMN "chosenPaymentOptionId";
ALTER TABLE "FotofficePresupuestoAjustes" DROP COLUMN "paymentOptions";

DELETE FROM "_prisma_migrations" WHERE migration_name = '20261022120000_fotoffice_etapa_3_pedidos';
COMMIT;
```

**Advertencia:** si ya hay cobros, este rollback **pierde los pedidos, las cuotas, los recibos y las
imputaciones, sin vuelta atrás**. Los `CashMovement` que cada cobro creó (y sus contramovimientos de
anulación) **quedan en Caja** con `sourceModule = 'pedidos'` y un `sourceRef` que ya no apunta a nada:
no se borran solos y el saldo de Caja no cambia. Los enlaces de pedido y recibo ya enviados dejan de
funcionar. Las opciones de pago elegidas por clientes en presupuestos aceptados se pierden. No se
borran presupuestos, productos, contactos ni consultas. Los rubros (`CashCategory`) creados por el plan
de cuentas siguen existiendo, sin el árbol.

## 8. Prueba en producción (para Daniel, en el PR)

Todo en **DNX Estudio**, con datos de prueba que después se cancelan o archivan.

0. **Antes de nada**, con el SQL aplicado y el código publicado: abrir el editor de un presupuesto, la
   ficha de un producto del catálogo y el enlace público de un presupuesto ya enviado. Tienen que
   cargar sin error.
1. **Rubros:** Caja → Rubros → "Cargar plan de cuentas de DNX". Aparece el árbol de dos niveles.
2. **Presupuesto de prueba:** desde una consulta de prueba (con un contacto con **correo propio de
   Daniel**), crear un presupuesto de poco valor (por ejemplo, un ítem de $1.000), con fecha de
   evento, y **enviarlo**.
3. **Aceptar** desde otro navegador (o ventana privada): elegir un plan de pago (por ejemplo, 3
   cuotas) y tildar "Acepto". El presupuesto queda **Aceptado** con "Pedido por confirmar".
4. **Confirmar el pedido** desde la ficha del presupuesto. Se abre `/pedidos/<id>` con número
   `2026-0001` (año y 4 dígitos), estado **Confirmado** y las cuotas sumando exactamente el total.
5. **Cobrar en efectivo** la primera cuota. Se crea el cobro con **recibo `2026-0001`**; la cuota
   queda pagada y el saldo baja.
6. **Recibo desde otro navegador:** abrir el enlace del recibo sin sesión. Se ve la leyenda "Documento
   no válido como factura", el importe en letras y el detalle de la cuota; **no** se ven costos, notas
   internas ni otros pedidos. Abrir también el enlace público del pedido.
7. **Caja:** en Caja → Movimientos aparece el **ingreso** de ese cobro, con el cliente, el rubro del
   pedido y la cuenta del depósito automático de efectivo.
8. **Anular el cobro** con un motivo. El recibo pasa a "anulado", la cuota vuelve a estar pendiente y
   en Caja aparece el **contramovimiento** de la anulación.
9. **Cancelar el pedido** con un motivo. Queda **Cancelado**; si tuviera cobros vigentes, se anulan
   primero.
10. **Caja final:** el saldo de la cuenta tiene que quedar igual que antes de la prueba (ingreso y
    contramovimiento se compensan), y los dos movimientos siguen listados.
11. **Limpieza:** archivar la consulta y el contacto de prueba.

Si el enlace dice "Los enlaces para clientes no están configurados", falta la clave (sección 3). Si el
editor de presupuestos o la ficha de un producto dan error justo después de publicar, falta aplicar el
SQL (o falló).

---
