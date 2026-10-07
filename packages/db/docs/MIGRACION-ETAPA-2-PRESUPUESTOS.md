# Aplicar la migración de Etapa 2 · Catálogo y Presupuestos (FOTOFFICE, Entrega A)

Procedimiento manual, con el mismo criterio que `MIGRACION-ETAPA-1-CONSULTAS.md`, **sin staging**:
por pedido de Daniel, el SQL va directo a la base de producción de FOTOFFICE. Las tablas van
**antes** que el código: no se fusiona el PR sin haber aplicado esto.

Qué hace esta entrega: el **catálogo** de Ventas suma, en la ficha de cada producto, los datos para
presupuestar (si va en la lista de precios, rubro de ingreso, **combos** con sus componentes y
**costos-plantilla** con proveedor). Y aparece el módulo **Presupuestos**: se arma un presupuesto
desde una consulta con ítems **de lista** (precio del catálogo) o **calculados con ¿Cuánto Cobro?**,
se versiona (una versión enviada no cambia nunca; editarla crea la V2), se **envía por correo o
WhatsApp** con un **enlace público** donde el cliente lo ve, lo descarga en PDF y lo **acepta**. Al
aceptarlo la consulta pasa a **Ganada**, el presupuesto queda con **"Pedido por confirmar"** y el
responsable recibe una tarea y un correo interno. Más **Configuración → Presupuestos** (validez,
condiciones, propuesta de pago y seguimiento).

## Advertencia crítica: una pantalla que ya existe lee estas tablas

**La ficha de cada producto de Ventas → Catálogo (`/ventas/catalogo/<producto>`) lee
`FotofficeProductoCatalogo`, `FotofficeComboItem` y `FotofficeCostoPlantilla` siempre, en toda
organización que tenga Ventas, esté o no encendido Presupuestos.** Si el código se publica
**antes** que el SQL, esa ficha **da error** (Prisma `P2021`, la tabla no existe) en todas las
organizaciones con Ventas — incluida la Tienda de SFPR, cuyos productos se editan ahí. La lista del
catálogo, el mostrador, la Tienda pública y los pedidos **no** leen estas tablas y siguen andando.

Lo demás que lee las tablas nuevas está detrás del módulo Presupuestos (apagado en todas las
organizaciones hasta que se encienda a mano) o es una pantalla nueva:

- **Configuración → Presupuestos** es nueva y aparece en el menú de toda organización con Consultas
  encendido (DNX): sin el SQL, abrirla da error.
- **El cambio del CHECK de plantillas (R8)** sólo se usa cuando se siembran o guardan plantillas de
  tipo `PRESUPUESTO`, y eso pasa **sólo con el módulo Presupuestos encendido**. Ningún flujo
  existente escribe ese valor al publicar.

Por eso **el SQL se aplica primero, siempre**. Con el SQL aplicado y el código viejo todavía
publicado no pasa nada: las tablas nuevas no se usan, y el CHECK nuevo acepta todos los valores
que acepta el viejo.

Qué lee cada tabla (confirmado con `grep` en `apps/fotoffice`; las otras apps no las leen):

| Tabla | Pantallas y flujos que la leen o escriben |
|---|---|
| `FotofficeProductoCatalogo` | **Ventas → Catálogo → ficha del producto (sección "Para presupuestos": lista de precios, rubro, combo; `lib/catalogo/perfil.ts`, `combos.ts`) — SIN depender del módulo Presupuestos; editor del presupuesto (productos de la lista de precios para agregar ítems; `lib/presupuestos/editor-datos.ts`)** |
| `FotofficeComboItem` | **Ventas → Catálogo → ficha del producto (componentes del combo y su ahorro); editor del presupuesto (un combo se agrega con sus componentes)** |
| `FotofficeCostoPlantilla` | **Ventas → Catálogo → ficha del producto (costos-plantilla con proveedor; `lib/catalogo/costos.ts`); al guardar una versión del presupuesto se copian a su instantánea de costos (`lib/presupuestos/versiones.ts`), que sólo ven dueño y administradores** |
| `FotofficePresupuesto` | **Presupuestos → lista, Nuevo y ficha (`/presupuestos`); tarjeta "Presupuestos" de la ficha de la consulta (`/consultas/<id>`) y de la ficha del contacto (`/clientes/<id>`), sólo con "Ver" en Presupuestos; envío (`lib/presupuestos/envio.ts`); enlace público y aceptación (`/w/<slug>/presupuesto/<token>`, o `/presupuesto/<token>` en el dominio propio); historial de la consulta (`lib/presupuestos/historial.ts`)** |
| `FotofficePresupuestoVersion` | **Ficha del presupuesto (editor y versiones); envío (congela la versión, guarda el hash del token); página pública (busca la versión por `tokenHash`; nunca lee `costSnapshot`); aceptación (fecha, nombre, IP con hash y navegador); avisos al responsable; historial de la consulta** |
| `FotofficePresupuestoVista` | **Página pública (cada apertura registra una fila; la primera pasa el presupuesto a VISTO; `lib/presupuestos/vistas.ts`); historial de la consulta (vistas)** |
| `FotofficePresupuestoAjustes` | **Configuración → Presupuestos (lee y guarda; al abrirla, DNX recibe su fila inicial con `asegurarAjustesDnx`); Nuevo presupuesto (validez, condiciones y propuesta de pago por omisión); envío (la validez se cuenta de nuevo al enviar)** |
| `FotofficeMessageTemplate` (sólo el CHECK, R8) | **Configuración → Plantillas (tipo "Presupuestos" y siembra de "Te enviamos tu presupuesto" y "Tu presupuesto"), sólo con el módulo encendido; ficha del presupuesto (Enviar)** |

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261020120000_fotoffice_etapa_2_presupuestos` |
| Archivo | `packages/db/prisma/migrations/20261020120000_fotoffice_etapa_2_presupuestos/migration.sql` |
| Checksum SHA-256 | `6a5a70a805dd1e8640f5b80eccd38c1504525acad780db037d69139de3d6d221` |
| Operaciones | 7 `CREATE TABLE`, índices comunes y únicos, claves foráneas a `Workspace`, `Product`, `Client` y `ServiceSalesLead`, 8 `CHECK` nuevos y **el reemplazo de un `CHECK` existente** (ver abajo) |
| Destructivas | Ninguna. No agrega ni borra columnas de tablas existentes; `Product`, `Client` y `ServiceSalesLead` no reciben columnas (las claves foráneas nacen en las tablas nuevas) |

Crea **siete** tablas nuevas: `FotofficeProductoCatalogo`, `FotofficeComboItem`,
`FotofficeCostoPlantilla`, `FotofficePresupuesto`, `FotofficePresupuestoVersion`,
`FotofficePresupuestoVista` y `FotofficePresupuestoAjustes`. **No** crea `FotofficePropuestaModelo`
(llega con la Entrega B).

### El cambio en una tabla existente: el CHECK de `FotofficeMessageTemplate.entityType` (R8)

El comentario de arriba del SQL dice "no altera ninguna tabla existente". Es cierto para las
**columnas**, pero las dos últimas líneas **reemplazan una restricción** de una tabla que ya existe:

```sql
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO'));
```

- **Por qué:** las plantillas de envío de presupuestos son de un tipo nuevo, `PRESUPUESTO`, que el
  CHECK de la etapa 0.6 (`20261005120000_fotoffice_plantillas`: `GENERAL`, `CLIENTE`, `SOCIO`,
  `CONSULTA`) no aceptaba.
- **Por qué es seguro:**
  - la lista nueva es la vieja **más** un valor: toda fila que hoy cumple el CHECK lo sigue
    cumpliendo, así que el `ADD CONSTRAINT` (que revisa las filas existentes) no puede fallar por
    datos de hoy;
  - no toca columnas ni datos, y el código viejo nunca escribe `PRESUPUESTO`;
  - va dentro de la misma transacción que el resto: si algo falla, queda el CHECK viejo;
  - el `DROP … IF EXISTS` lo hace repetible.
- **Bloqueo:** el `ALTER TABLE` toma un candado exclusivo sobre `FotofficeMessageTemplate` mientras
  revisa las filas (son pocas: un instante). Mientras tanto, abrir Plantillas o mandar un mensaje
  desde una ficha espera, no falla.

### Lo que el SQL no hace

- **No carga datos.** Los ajustes de DNX Estudio (validez 15 días, seguimiento a 3 días
  **apagado**) los crea el código la primera vez que alguien abre **Configuración → Presupuestos**
  (`asegurarAjustesDnx`; nunca pisa una fila existente). Las plantillas `PRESUPUESTO` se siembran
  una vez por organización con el módulo encendido.
- **No enciende el módulo** (sección 5) **ni cambia la numeración** (sección 6).

**Dependencia.** Va después de la Etapa 1 (Consultas) ya en producción y necesita las tablas
`Workspace`, `Product`, `Client`, `ServiceSalesLead` y `FotofficeMessageTemplate`.

**Claves foráneas que frenan borrados.** `FotofficePresupuesto` apunta a la consulta
(`ServiceSalesLead`) y al contacto (`Client`) con `ON DELETE RESTRICT`: una consulta o un contacto
con presupuestos no se puede borrar de la base. Hoy FOTOFFICE no borra consultas ni contactos
(se archivan), así que ningún flujo existente lo choca.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261020120000_fotoffice_etapa_2_presupuestos/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. Orden de publicación (sin staging)

0. Comprobar que ninguna organización tiene Presupuestos encendido (sección 4, paso 0).
1. SQL de esta migración en **FOTOFFICE producción** (proyecto `compramelafoto`, rama
   `development`, `divine-hall-10689679` / `br-old-rain-adwthzng`).
2. Verificar (paso 3 de la sección 4).
3. Variable `PRESUPUESTO_TOKEN_SECRET` en Vercel (sección 3), si se decide usar una propia.
4. Recién entonces se fusiona el PR y se publica el código.
5. Daniel, como administrador de la plataforma, enciende **Presupuestos** en DNX Estudio
   (sección 5).
6. Configuración → Presupuestos y Configuración → Numeración de DNX (sección 6).
7. Prueba en producción (sección 8).

## 3. En qué base va y variables de Vercel

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Las otras bases no son urgentes: sólo `apps/fotoffice` lee estas tablas.

**Variables de entorno del proyecto FOTOFFICE en Vercel (Production):**

| Variable | Para qué | Si falta |
|---|---|---|
| `PRESUPUESTO_TOKEN_SECRET` (**recomendada**) | Clave con la que se firma el enlace de cada versión enviada (HMAC-SHA256, R7). En la base sólo queda el SHA-256 del enlace. | Se usa `STORE_ORDER_TOKEN_SECRET` (la de los pedidos de la Tienda; el prefijo separa los usos). Si tampoco está, **no se puede enviar** y la ficha del presupuesto lo avisa. |
| `PRESUPUESTO_IP_SALT` (opcional) | Sal del hash de la IP en vistas y aceptaciones. | Se usa `COVERAGE_ORIGIN_SALT` y, si falta, la clave del enlace. |

**Cuidado:** una vez enviados presupuestos, **cambiar la clave rompe todos los enlaces ya
enviados** (el cliente ve "no encontrado"). Elegirla antes de enviar el primero y no tocarla. Pasar
de `STORE_ORDER_TOKEN_SECRET` a una `PRESUPUESTO_TOKEN_SECRET` nueva también cuenta como cambio.
Generar una con `openssl rand -base64 32`, marcarla como sensible y volver a publicar (las variables
nuevas no llegan a un deploy ya hecho).

## 4. Procedimiento

### Paso 0 — Nadie tiene Presupuestos encendido (antes de publicar el código)

```sql
SELECT count(*) AS encendidos
FROM "WorkspaceFeatureModule"
WHERE "moduleKey" = 'quotes' AND enabled = true;
```

Tiene que dar **0**: el código nuevo trata `quotes` como disponible, y una organización que ya lo
tuviera encendido vería Presupuestos (y leería estas tablas) en cuanto se publique. En producción
dio 0 el 07/10/2026; volver a mirarlo el día de la publicación. Si da más de 0, **parar** y apagarlo
primero (o aplicar la migración antes de publicar, como dice la sección 2).

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261020120000_fotoffice_etapa_2_presupuestos';
```

Si devuelve una fila, la base ya está lista. Si no, seguir.

### Paso 2 — Aplicar y registrar, en una sola transacción

```sql
BEGIN;
-- pegar acá el contenido completo de migration.sql

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
  gen_random_uuid()::text,
  '6a5a70a805dd1e8640f5b80eccd38c1504525acad780db037d69139de3d6d221',
  now(),
  '20261020120000_fotoffice_etapa_2_presupuestos',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261020120000_fotoffice_etapa_2_presupuestos'
);
COMMIT;
```

### Paso 3 — Verificar (sólo `SELECT`)

Justo después del SQL, las siete tablas existen y están **vacías**:

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN (
  'FotofficeProductoCatalogo','FotofficeComboItem','FotofficeCostoPlantilla','FotofficePresupuesto',
  'FotofficePresupuestoVersion','FotofficePresupuestoVista','FotofficePresupuestoAjustes'); -- 7 filas

SELECT
  (SELECT count(*) FROM "FotofficePresupuesto")        AS presupuestos, -- 0
  (SELECT count(*) FROM "FotofficePresupuestoVersion") AS versiones,    -- 0
  (SELECT count(*) FROM "FotofficePresupuestoAjustes") AS ajustes,      -- 0
  (SELECT count(*) FROM "FotofficeProductoCatalogo")   AS perfiles;     -- 0

SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261020120000_fotoffice_etapa_2_presupuestos' AND finished_at IS NOT NULL; -- 1

-- Los 8 CHECK nuevos
SELECT conname FROM pg_constraint
 WHERE contype = 'c' AND conrelid IN (
   '"FotofficePresupuesto"'::regclass, '"FotofficePresupuestoVersion"'::regclass,
   '"FotofficeComboItem"'::regclass, '"FotofficeCostoPlantilla"'::regclass,
   '"FotofficePresupuestoAjustes"'::regclass)
 ORDER BY 1;
-- 8 filas: FotofficeComboItem_not_self, FotofficeComboItem_quantity, FotofficeCostoPlantilla_amountArs,
--          FotofficePresupuestoAjustes_followUpDays, FotofficePresupuestoAjustes_validityDays,
--          FotofficePresupuestoVersion_acceptedAt, FotofficePresupuestoVersion_number, FotofficePresupuesto_status

-- El CHECK reemplazado (R8): una sola fila, con PRESUPUESTO en la lista
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';

-- Las plantillas de antes siguen igual (comparar con el mismo SELECT corrido antes del SQL)
SELECT "entityType", count(*) FROM "FotofficeMessageTemplate" GROUP BY 1 ORDER BY 1;
```

**Después de publicar el código, encender el módulo y abrir Configuración → Presupuestos en DNX.**
Con el id del workspace de DNX:

```sql
SELECT "workspaceId" FROM "FotofficeWorkspaceBranding" WHERE "publicSlug" = 'dnx-estudio';
```

```sql
-- Módulo encendido
SELECT "moduleKey", enabled FROM "WorkspaceFeatureModule"
 WHERE "workspaceId" = '<id de DNX>' AND "moduleKey" IN ('quotes', 'service-leads'); -- las dos en true

-- Ajustes de DNX: validez 15, seguimiento 3 apagado (o lo que se haya guardado después)
SELECT "validityDays", "followUpDays", "followUpEnabled", "updatedAt"
  FROM "FotofficePresupuestoAjustes" WHERE "workspaceId" = '<id de DNX>';

-- Numeración de Presupuestos: próximo número 2025262 hasta enviar el primero
SELECT key, prefix, "withYear", digits, "nextValue" FROM "FotofficeSequence"
 WHERE "workspaceId" = '<id de DNX>' AND key = 'PRESUPUESTO';

-- Plantillas de presupuesto sembradas (2: correo y WhatsApp) al abrir Plantillas o la ficha
SELECT name, channel, "entityType" FROM "FotofficeMessageTemplate"
 WHERE "workspaceId" = '<id de DNX>' AND "entityType" = 'PRESUPUESTO';

-- Presupuestos por estado
SELECT status, "pedidoPorConfirmar", count(*) FROM "FotofficePresupuesto"
 WHERE "workspaceId" = '<id de DNX>' GROUP BY 1, 2 ORDER BY 1;

-- Versiones enviadas, vistas y aceptación (sin datos personales ni costos)
SELECT p.id, v.number, v."sentAt", v."revokedAt", v."acceptedAt",
       (SELECT count(*) FROM "FotofficePresupuestoVista" x WHERE x."versionId" = v.id) AS vistas
  FROM "FotofficePresupuesto" p JOIN "FotofficePresupuestoVersion" v ON v."presupuestoId" = p.id
 WHERE p."workspaceId" = '<id de DNX>' ORDER BY v."createdAt" DESC LIMIT 20;

-- Ninguna versión enviada sin hash de enlace, y ningún hash repetido (el único lo impide)
SELECT count(*) FROM "FotofficePresupuestoVersion" WHERE "sentAt" IS NOT NULL AND "tokenHash" IS NULL; -- 0
```

> Ojo con las horas: las columnas `timestamp` guardan la hora en UTC. Al leerlas, restar 3 horas
> para la hora de Argentina. `validUntil` es una fecha sin hora.

## 5. Encender el módulo Presupuestos en DNX Estudio

El módulo `quotes` pasa de "planificado" a **disponible**, con el nombre "Presupuestos", la ruta
`/presupuestos` y **dependencia de Consultas** (`service-leads`). **No se enciende solo en ninguna
organización.** Se mantiene la regla de main: **sólo el administrador de la plataforma enciende o
apaga módulos**; el dueño de la organización ve el estado y lo pide.

Después de publicar, **Daniel (administrador de la plataforma)**:

1. Entra a DNX Estudio → Configuración → Módulos (o Administración → Workspaces → DNX Estudio) y
   enciende **Presupuestos**. Consultas ya está encendido en DNX; si no lo estuviera, la pantalla
   pide encenderlo antes.
2. Al encender, el dueño y los administradores ven el ítem **Presupuestos** en el grupo Consultas
   del menú.
3. En **Configuración → Comisión directiva** (roles), al rol del equipo (el de Sabi y Cami) le da
   **"Gestionar" en Presupuestos** para que armen y envíen. Ese rol **no** ve costos ni márgenes:
   los ven sólo dueño y administradores (`configurar`), R4.

## 6. Configuración de DNX después de encender

1. **Configuración → Presupuestos:** al abrirla se crean los ajustes de DNX (validez 15 días,
   seguimiento a 3 días **apagado**). Cargar las **condiciones generales** y la **propuesta de
   pago** por omisión, y guardar. El seguimiento queda guardado para la Entrega B ("Se usa
   próximamente"): todavía no manda nada. Esta pantalla se puede usar con el módulo apagado.
2. **Configuración → Numeración**, fila **Presupuestos**: poner el **próximo número en
   `2025262`** (sigue la numeración de Alboom) **antes de enviar el primer presupuesto**: el número
   se asigna al enviar por primera vez y después no cambia. Configuración → Presupuestos lo
   recuerda con un enlace.

## 7. Rollback

**Primero el código, después las tablas.** Con el código nuevo publicado y las tablas borradas,
la ficha de producto del catálogo da error en toda organización con Ventas (ver la advertencia).

1. Apagar **Presupuestos** en DNX (Configuración → Módulos).
2. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar que
   producción ya sirve la versión anterior.
3. Recién entonces, en orden seguro para las claves foráneas:

```sql
BEGIN;
-- Las plantillas de tipo PRESUPUESTO no caben en el CHECK viejo: se borran antes de volver a él.
DELETE FROM "FotofficeMessageTemplate" WHERE "entityType" = 'PRESUPUESTO';
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA'));

DROP TABLE "FotofficePresupuestoVista";
ALTER TABLE "FotofficePresupuesto" DROP CONSTRAINT "FotofficePresupuesto_currentVersionId_fkey";
ALTER TABLE "FotofficePresupuesto" DROP CONSTRAINT "FotofficePresupuesto_acceptedVersionId_fkey";
DROP TABLE "FotofficePresupuestoVersion";
DROP TABLE "FotofficePresupuesto";
DROP TABLE "FotofficePresupuestoAjustes";
DROP TABLE "FotofficeCostoPlantilla";
DROP TABLE "FotofficeComboItem";
DROP TABLE "FotofficeProductoCatalogo";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261020120000_fotoffice_etapa_2_presupuestos';
COMMIT;
```

Esto borra los presupuestos, sus versiones, vistas y aceptaciones, los ajustes, los combos, los
costos-plantilla y los perfiles de producto, y las plantillas de presupuesto: **no tiene vuelta
atrás**. **No** se borran productos, contactos, consultas ni sus tareas (las tareas "Presupuesto
visto" o "Presupuesto aceptado: confirmar el pedido" quedan como tareas comunes). El número de
presupuesto asignado (`FotofficeRecordNumber`, `entityType = 'PRESUPUESTO'`) queda huérfano y no
molesta. Los enlaces ya enviados dejan de funcionar. Una consulta que se ganó al aceptar sigue
Ganada.

## 8. Prueba en producción (para Daniel, en el PR)

Todo en **DNX Estudio**, con datos de prueba que después se archivan.

1. **Catálogo:** en Ventas → Catálogo abrir un producto (la ficha tiene que cargar sin error),
   marcarlo "en la lista de precios" y cargarle un costo-plantilla. Abrir también un producto de la
   Tienda de SFPR: la ficha carga igual.
2. **Armar:** desde una consulta de prueba (con un contacto que tenga **un correo propio de
   Daniel**), "Nuevo presupuesto". Agregar **dos ítems de lista** y **uno calculado con ¿Cuánto
   Cobro?**. Revisar totales, descuento y que el dueño ve costo y margen.
3. **Enviar por correo** al correo de Daniel. Comprobar que le llega con el enlace, que el
   presupuesto pasa a **Enviado** y que tiene número (el primero, `2025262`, con el prefijo
   que tenga la secuencia).
4. **Abrir el enlace en otro navegador** (o una ventana privada, sin sesión): se ve el presupuesto
   **sin costos ni márgenes**, con "Acepto", "Tengo dudas" y "Descargar PDF". En la ficha, el
   presupuesto pasa a **Visto** y aparece la tarea "Presupuesto visto". Pegar el enlace en WhatsApp
   no lo marca como visto (la vista previa es un robot).
5. **Versión nueva:** editar el presupuesto enviado → se crea la **V2**; enviarla. El enlace viejo
   muestra la V2.
6. **Aceptar** desde el otro navegador, con nombre y tilde. Comprobar:
   - el presupuesto queda **Aceptado** con el cartel **"Pedido por confirmar"**;
   - la consulta pasa a **Ganada** y el contacto a **Cliente**;
   - el responsable tiene la tarea **"Presupuesto aceptado: confirmar el pedido"** y el correo
     interno;
   - el historial de la consulta muestra envíos, vistas y la aceptación;
   - volver a aceptar dice que ya fue aceptado.
7. **Equipo sin costos:** con un usuario del rol del equipo (como Sabi o Cami, con "Gestionar" en
   Presupuestos) abrir el mismo presupuesto y uno nuevo: **no ve costos ni márgenes** en ningún
   lado, sólo puede usar ítems de lista, y puede enviar.
8. **Limpieza:** archivar la consulta y el contacto de prueba.

Si el envío dice "El envío de presupuestos no está configurado", falta la clave del enlace en
Vercel (sección 3). Si la ficha de un producto da error justo después de publicar, falta aplicar el
SQL (o falló).
