# Aplicar la migración de Etapa 4 · Agenda (FOTOFFICE, Entrega B)

Procedimiento manual, con el mismo criterio que `MIGRACION-ETAPA-4-PROYECTOS.md`, **sin staging**: por pedido
de Daniel, el SQL va directo a la base de producción de FOTOFFICE. Las tablas van **antes** que el código:
no se fusiona el PR sin haber aplicado esto. **Esta migración todavía NO se aplicó a ninguna base.**

Qué hace esta entrega: el módulo **Agenda** (`/agenda`). Un calendario del equipo con **citas** (reuniones,
sesiones, entregas, ensayos…) y, como capas que se prenden y se apagan, las entregas de proyectos, las tareas
con vencimiento, los vencimientos de cuotas (sólo con permiso de dinero), la próxima acción de las consultas, los
cumpleaños de contactos y las reservas confirmadas (sólo lectura). Un producto del catálogo puede tener reglas
**"Cita que genera"**: al confirmar un pedido se crea una cita por regla. Las citas y las entregas se copian a un
**calendario propio en Google Calendar** y lo que se cambia allá vuelve a la Agenda. Y hay un **recordatorio por
correo** al contacto que participa de una cita (apagado por omisión).

## Advertencia crítica: pantallas que ya existen leen tablas nuevas

**Confirmar un pedido (`confirmarPedido`) y el alta manual de un pedido ahora LEEN `FotofficeProductoCita` y
pueden ESCRIBIR `FotofficeCita`**, pero sólo en las organizaciones con el módulo `agenda` encendido.
**La ficha de producto del catálogo (Ventas → Catálogo) lee `FotofficeProductoCita` y `FotofficeCitaTipo`** para
mostrar y editar "Cita que genera" (también sólo con `agenda` encendido), y **las fichas de proyecto, pedido y
consulta leen `FotofficeCita`** para mostrar la tarjeta «Citas». Si el código se publica **antes** que el SQL,
esas lecturas fallan (`P2021`, la tabla no existe) y **confirmar pedidos y abrir productos del catálogo da error
en toda organización que tenga Agenda encendida**. Hoy nadie la tiene; aun así, **el SQL se aplica primero,
siempre**: encender Agenda en una organización sin el SQL rompe esos flujos.

Además, **el CHECK de `FotofficeMessageTemplate.entityType` se reemplaza**: se mantienen `GENERAL`, `CLIENTE`,
`SOCIO`, `CONSULTA`, `PRESUPUESTO`, `PEDIDO` y `PROYECTO`, y se suma `CITA`. Sin el SQL, la plantilla automática
del recordatorio de citas (`RECORDATORIO_CITA`, tipo `CITA`) no se puede crear.

Con el SQL aplicado y el código viejo todavía publicado no pasa nada: las tablas nuevas no se usan, **no se suman
columnas a ninguna tabla existente** y el CHECK nuevo acepta todos los valores que aceptaba el viejo.

## 1. Qué se aplica

Migración: `packages/db/prisma/migrations/20261026120000_fotoffice_etapa_4_agenda/migration.sql`

Checksum SHA-256 del archivo comprometido:

```
b625a4ff9cc30f3cdd955ce8b3d3406796374792335015243dad4f18a71ad14d
```

Comprobar antes de pegar: `shasum -a 256 packages/db/prisma/migrations/20261026120000_fotoffice_etapa_4_agenda/migration.sql`
tiene que dar exactamente ese valor. Si el archivo se toca, hay que recalcular el checksum acá y en el paso 2.

### Tablas nuevas (6) y quién las lee

Sólo `apps/fotoffice` las lee; las otras apps no.

| Tabla | Para qué | Pantallas y flujos que la leen o escriben |
|---|---|---|
| `FotofficeCitaTipo` | Tipos de cita: nombre, color, orden, activo. Único por (workspaceId, name). DNX los siembra al abrir `/agenda` (Reunión con cliente, Evento, Sesión de fotos, Entrega, Prueba / ensayo, Otro). | **Agenda (colores y diálogo de cita), Configuración → Agenda → Tipos de cita, ficha de producto del catálogo (regla "Cita que genera"), confirmar pedido (escribe la cita con el tipo de la regla).** |
| `FotofficeCita` | La cita: título, tipo, estado (`AGENDADA`, `CONFIRMADA`, `REALIZADA`, `ANULADA`), inicio y fin (UTC), todo el día, lugar, notas, responsable, contacto, origen (proyecto, pedido o consulta), regla e ítem de origen, y los datos de sincronización con Google (`googleEventId`, `googleEtag`, `googleUpdatedAt`). | **Agenda (todas las vistas y el diálogo), tarjeta «Citas» de las fichas de proyecto, pedido y consulta, confirmar pedido y alta manual de pedido (escriben), sincronización con Google (empuje y traída), recordatorio al cliente.** |
| `FotofficeCitaParticipante` | Quiénes participan de la cita: una persona del equipo **o** un contacto (exactamente una de las dos), con rol opcional y nota. | **Agenda → diálogo de cita (participantes), recordatorio al cliente (a quién se manda).** |
| `FotofficeProductoCita` | Regla "Cita que genera" de un producto: tipo, título, días desde el evento, hora (`HH:MM`), duración en minutos, responsable, orden. | **Ficha de producto del catálogo (Ventas → Catálogo), confirmar pedido (lee), ficha del pedido (vista previa de las citas que se crearán).** |
| `FotofficeAgendaAjustes` | Una fila por organización: calendario de Google (`googleCalendarId`, `googleSyncToken`, `googleLastSyncAt`), capas por omisión (`defaultLayers`) y el recordatorio (`reminderEnabled`, `reminderHours`). | **Agenda (capas por omisión), Configuración → Agenda (Google Calendar y recordatorio al cliente), tareas programadas de Google y de recordatorios.** |
| `FotofficeCitaRecordatorio` | Reserva "ya se avisó": una fila por (cita, inicio). Si se mueve la cita, hay otra fila y vuelve a avisar. | **Sólo la tarea horaria de recordatorios.** |

### Índices

`FotofficeCitaTipo`: **único** `FotofficeCitaTipo_workspaceId_name_key` (workspaceId, name).

`FotofficeCita`:
- `FotofficeCita_workspaceId_startAt_idx` (workspaceId, startAt)
- `FotofficeCita_workspaceId_ownerUserId_startAt_idx` (workspaceId, ownerUserId, startAt)
- `FotofficeCita_typeId_idx`, `FotofficeCita_clientId_idx`, `FotofficeCita_proyectoId_idx`, `FotofficeCita_pedidoId_idx`, `FotofficeCita_consultaLeadId_idx`, `FotofficeCita_reglaId_idx`
- **Único** `FotofficeCita_workspaceId_googleEventId_key` (workspaceId, googleEventId): un evento de Google es una sola cita.
- **Único** `FotofficeCita_pedidoId_pedidoItemIndex_reglaId_key` (pedidoId, pedidoItemIndex, reglaId): evita crear dos veces la misma cita al reintentar confirmar. Las columnas nulas no chocan entre sí en Postgres: las citas sueltas y las que vienen de Google no se ven afectadas.

`FotofficeCitaParticipante`: `..._citaId_idx`, `..._userId_idx`, `..._clientId_idx`, `..._roleId_idx`.

`FotofficeProductoCita`: `..._workspaceId_productId_order_idx` (workspaceId, productId, order), `..._productId_idx`, `..._typeId_idx`.

`FotofficeAgendaAjustes`: **único** `FotofficeAgendaAjustes_workspaceId_key` (workspaceId).

`FotofficeCitaRecordatorio`: **único** `FotofficeCitaRecordatorio_citaId_startAt_key` (citaId, startAt).

### Claves foráneas (16)

| Tabla | Columna | Apunta a | Al borrar |
|---|---|---|---|
| `FotofficeCitaTipo` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeCita` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeCita` | `typeId` | `FotofficeCitaTipo` | SET NULL |
| `FotofficeCita` | `clientId` | `Client` | SET NULL |
| `FotofficeCita` | `proyectoId` | `FotofficeProyecto` | SET NULL |
| `FotofficeCita` | `pedidoId` | `FotofficePedido` | SET NULL |
| `FotofficeCita` | `consultaLeadId` | `ServiceSalesLead` | SET NULL |
| `FotofficeCita` | `reglaId` | `FotofficeProductoCita` | SET NULL |
| `FotofficeCitaParticipante` | `citaId` | `FotofficeCita` | CASCADE |
| `FotofficeCitaParticipante` | `clientId` | `Client` | CASCADE |
| `FotofficeCitaParticipante` | `roleId` | `FotofficeProyectoRol` | SET NULL |
| `FotofficeProductoCita` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeProductoCita` | `productId` | `Product` | CASCADE |
| `FotofficeProductoCita` | `typeId` | `FotofficeCitaTipo` | SET NULL |
| `FotofficeAgendaAjustes` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeCitaRecordatorio` | `citaId` | `FotofficeCita` | CASCADE |

(Todas con `ON UPDATE CASCADE`. Las columnas de usuario, `ownerUserId`, `createdByUserId`, `userId` de los
participantes, son enteros sin FK: la validación la hace el código.)

### Los 10 CHECK nuevos y 1 reemplazado

- `FotofficeCitaTipo_color`: `"color" ~ '^#[0-9a-fA-F]{6}$'`.
- `FotofficeCitaTipo_name`: `length(trim("name")) > 0`.
- `FotofficeCita_status`: `"status" IN ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'ANULADA')`.
- `FotofficeCita_rango`: `"endAt" > "startAt"`.
- `FotofficeCita_title`: `length(trim("title")) > 0`.
- `FotofficeCitaParticipante_persona`: `("userId" IS NULL) <> ("clientId" IS NULL)` (exactamente una de las dos).
- `FotofficeProductoCita_daysFromEvent`: `"daysFromEvent" BETWEEN -365 AND 365`.
- `FotofficeProductoCita_durationMinutes`: `"durationMinutes" BETWEEN 15 AND 1440`.
- `FotofficeProductoCita_startTime`: `"startTime" IS NULL OR "startTime" ~ '^[0-2][0-9]:[0-5][0-9]$'`.
- `FotofficeAgendaAjustes_reminderHours`: `"reminderHours" BETWEEN 1 AND 168`.
- **Reemplazado:** `FotofficeMessageTemplate_entityType`: `"entityType" IN ('GENERAL','CLIENTE','SOCIO','CONSULTA','PRESUPUESTO','PEDIDO','PROYECTO','CITA')`.

### Lo que el SQL no hace

No suma columnas a tablas existentes, no borra ni actualiza filas, no siembra tipos de cita ni reglas. Lo que no
puede chequear el SQL lo valida el código (`lib/agenda`): que el contacto, el pedido, el proyecto, el tipo y la
regla de una cita sean del mismo workspace.

## 2. Orden de publicación (sin staging)

1. SQL de esta migración en **FOTOFFICE producción** (sección 4).
2. Verificar (sección 4, paso 3).
3. Recién entonces se fusiona el PR y se publica el código. **No hay variables de entorno nuevas**: las dos tareas
   programadas nuevas usan `CRON_SECRET`, que ya existe.
4. Daniel, como administrador de la plataforma, enciende **Agenda** en DNX Estudio (sección 5).
5. Daniel conecta Google y crea el calendario (sección 6).
6. Prueba en producción (sección 8).

## 3. En qué base va

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Las otras bases no son urgentes: sólo `apps/fotoffice` lee estas tablas.

### Dos tareas programadas nuevas (`apps/fotoffice/vercel.json`)

| Ruta | Horario | Qué hace |
|---|---|---|
| `/api/cron/agenda-google-sync` | `*/10 * * * *` (cada 10 minutos) | Trae de Google lo creado, movido o borrado en el calendario de la Agenda. Sólo organizaciones con calendario creado. |
| `/api/cron/agenda-recordatorios` | `0 * * * *` (cada hora en punto) | Manda el recordatorio de cita a los contactos con correo. Sólo organizaciones que lo encendieron. |

Las dos piden `CRON_SECRET` (o `FOTOFFICE_CRON_SECRET`), como las demás. Mientras nadie tenga Agenda ni el
recordatorio encendidos, no hacen nada.

## 4. Procedimiento

### Paso 0 — Nadie tiene Agenda encendida y el atajo `agenda` está libre

```sql
SELECT count(*) AS encendidos
FROM "WorkspaceFeatureModule"
WHERE "moduleKey" = 'agenda' AND enabled = true;
```

Tiene que dar **0**. Si da más, esa organización verá Agenda apenas se publique: aplicar el SQL antes de publicar.

La ruta `/agenda` queda reservada y pisaría el atajo público de una institución con ese nombre. Tiene que dar **0 filas**:

```sql
SELECT "workspaceId", "publicSlug" FROM "FotofficeWorkspaceBranding" WHERE lower("publicSlug") = 'agenda';
```

### Paso 1 — Comprobar qué está aplicado

```sql
SELECT migration_name FROM "_prisma_migrations"
 WHERE migration_name IN ('20261025120000_fotoffice_etapa_4_proyectos','20261026120000_fotoffice_etapa_4_agenda');
```

- Tiene que aparecer la de Proyectos: esta migración usa `FotofficeProyecto` y `FotofficeProyectoRol`. Si no
  aparece, aplicarla primero con su documento.
- Si ya aparece `20261026120000_...`, la base está lista: parar.

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
  'b625a4ff9cc30f3cdd955ce8b3d3406796374792335015243dad4f18a71ad14d',
  now(),
  '20261026120000_fotoffice_etapa_4_agenda',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261026120000_fotoffice_etapa_4_agenda'
);
COMMIT;
```

Si algo falla, la transacción entera se deshace (no queda nada a medias). Es la manera manual + registro con
checksum que se usa en FOTOFFICE (no se corre `migrate deploy`). El checksum es el del archivo tal como queda
comprometido en `main`.

### Paso 3 — Verificar (sólo `SELECT`)

```sql
-- Las 6 tablas existen y están vacías
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN (
  'FotofficeCitaTipo','FotofficeCita','FotofficeCitaParticipante','FotofficeProductoCita',
  'FotofficeAgendaAjustes','FotofficeCitaRecordatorio'); -- 6 filas

SELECT
  (SELECT count(*) FROM "FotofficeCitaTipo")        AS tipos,       -- 0
  (SELECT count(*) FROM "FotofficeCita")            AS citas,       -- 0
  (SELECT count(*) FROM "FotofficeProductoCita")    AS reglas,      -- 0
  (SELECT count(*) FROM "FotofficeAgendaAjustes")   AS ajustes;     -- 0

-- Los 10 CHECK de las tablas nuevas
SELECT conname FROM pg_constraint
 WHERE contype = 'c' AND conrelid IN (
   '"FotofficeCitaTipo"'::regclass, '"FotofficeCita"'::regclass, '"FotofficeCitaParticipante"'::regclass,
   '"FotofficeProductoCita"'::regclass, '"FotofficeAgendaAjustes"'::regclass)
 ORDER BY 1; -- 10 filas

-- Los índices únicos
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
  'FotofficeCitaTipo_workspaceId_name_key',
  'FotofficeCita_workspaceId_googleEventId_key',
  'FotofficeCita_pedidoId_pedidoItemIndex_reglaId_key',
  'FotofficeAgendaAjustes_workspaceId_key',
  'FotofficeCitaRecordatorio_citaId_startAt_key'); -- 5 filas

-- Claves foráneas de las 6 tablas
SELECT count(*) FROM pg_constraint
 WHERE contype = 'f' AND conrelid IN (
  '"FotofficeCitaTipo"'::regclass, '"FotofficeCita"'::regclass, '"FotofficeCitaParticipante"'::regclass,
  '"FotofficeProductoCita"'::regclass, '"FotofficeAgendaAjustes"'::regclass, '"FotofficeCitaRecordatorio"'::regclass); -- 16

-- El CHECK reemplazado: una sola fila, con CITA y los otros 7 valores
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';

-- Las plantillas de antes siguen igual (comparar con el SELECT del paso 1)
SELECT "entityType", count(*) FROM "FotofficeMessageTemplate" GROUP BY 1 ORDER BY 1;

-- La migración quedó registrada con el checksum correcto
SELECT checksum FROM "_prisma_migrations"
 WHERE migration_name = '20261026120000_fotoffice_etapa_4_agenda' AND finished_at IS NOT NULL;
-- b625a4ff9cc30f3cdd955ce8b3d3406796374792335015243dad4f18a71ad14d
```

## 5. Encender Agenda en DNX Estudio

El módulo `agenda` ("Agenda") pasa a **disponible**, con la ruta `/agenda` y **sin dependencias**. **No se enciende
solo en ninguna organización.** Sólo el administrador de la plataforma enciende o apaga módulos.

Después de publicar, **Daniel**:

1. Entra a DNX Estudio → Configuración → Módulos (o Administración → Workspaces → DNX Estudio) y enciende **Agenda**.
2. Abre **`/agenda`** por primera vez: ahí se **siembran los 6 tipos de cita de DNX** (Reunión con cliente en azul,
   Evento en rojo, Sesión de fotos en verde, Entrega en violeta, Prueba / ensayo en naranja, Otro en gris). Es
   idempotente: no duplica, y un tipo dado de baja no se reactiva.
3. En **Configuración → Comisión directiva** (roles), da **"Ver"** en Agenda a quien debe leerla y **"Gestionar"** a
   quien crea, edita y mueve citas. Las capas de proyectos, pedidos y consultas sólo aparecen si su módulo está
   encendido y la persona tiene "Ver" ahí; los vencimientos de cuotas piden además permiso de dinero.
4. **Configura "Cita que genera"** en cada producto del catálogo que corresponda (Ventas → Catálogo → ficha del
   producto): tipo, título, días desde el evento, hora y duración, responsable. **Sin reglas no se crea ninguna cita
   al confirmar un pedido.** Si el pedido no tiene fecha de evento, la cita no se crea y la vista previa lo avisa.
5. (Opcional) **Recordatorio al cliente**: Configuración → Agenda → «Recordatorio al cliente». Elegir las horas
   antes (1 a 168; 24 por omisión) y tildar «Activar el recordatorio de citas». Nace **apagado**. El texto se edita
   en Configuración → Plantillas → Automáticos («Recordatorio de una cita al cliente»; la plantilla se crea sola al
   abrir esa pantalla o al correr la tarea). Variables: `[cita_titulo]`, `[cita_fecha]`, `[cita_hora]`,
   `[cita_lugar]`. Sale una vez por cita y horario, sólo a contactos con correo (nunca al equipo), no sale si la
   cita está anulada o realizada, y cuenta en el tope diario de correos automáticos (50 por organización).

## 6. Google Calendar

Se usa la integración Google que la organización ya tiene para Reservas. **Nunca se tocan los calendarios de los
espacios de Reservas ni sus eventos**: la Agenda crea y usa un calendario aparte.

1. Si Google todavía **no está conectado**: Configuración → **Integraciones** → conectar Google (con la cuenta de
   la organización). Si la cuenta se conectó antes de esta entrega, Configuración → Agenda puede avisar que falta un
   permiso: reconectar desde Integraciones.
2. Configuración → **Agenda** → Google Calendar → **«Crear calendario «DNX Estudio Agenda»»**. Se guarda el
   calendario y se hace la primera sincronización (las citas y entregas que ya existían suben a Google).
3. En esa misma pantalla se ve el estado de la cuenta, el calendario y la **última sincronización** (hora de
   Argentina). Si pasan más de 45 minutos sin sincronizar, la pantalla avisa.

Cómo se sincroniza:

- **Empuje (Agenda → Google):** al crear, editar, mover o anular una cita se crea, cambia o borra el evento, sin
  frenar la acción. Las entregas de proyectos van como eventos de todo el día con prefijo «Entrega: ».
- **Traída (Google → Agenda), cada 10 minutos:** lo nuevo creado en Google se vuelve una cita (sin tipo ni
  responsable); lo modificado actualiza la cita si el cambio de Google es posterior (gana el último); lo borrado en
  Google anula la cita. Las entregas son de **sólo ida**: moverlas en Google no cambia la fecha del proyecto.

## 7. Rollback

**Primero el código, después las tablas.** Con el código nuevo publicado y las tablas borradas, confirmar pedidos y
abrir productos del catálogo dan error en las organizaciones con Agenda encendida.

1. Apagar **Agenda** en DNX (Configuración → Módulos).
2. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar que producción ya sirve
   la versión anterior. Esto también saca las dos tareas programadas nuevas.
3. Recién entonces, en orden seguro para las claves foráneas (primero lo que apunta a otras tablas):

```sql
BEGIN;
-- Las plantillas de tipo CITA no caben en el CHECK anterior: se borran antes de volver a él.
DELETE FROM "FotofficeMessageTemplate" WHERE "entityType" = 'CITA';
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO'));

DROP TABLE "FotofficeCitaRecordatorio";
DROP TABLE "FotofficeCitaParticipante";
DROP TABLE "FotofficeCita";
DROP TABLE "FotofficeProductoCita";
DROP TABLE "FotofficeCitaTipo";
DROP TABLE "FotofficeAgendaAjustes";

DELETE FROM "_prisma_migrations" WHERE migration_name = '20261026120000_fotoffice_etapa_4_agenda';
COMMIT;
```

Después del rollback, comprobar que el CHECK quedó exactamente como antes (los 7 valores, sin `CITA`):

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';
```

**Advertencia: pérdida de datos sin vuelta atrás.** Si ya hay citas, este rollback **borra las citas, sus
participantes, los avisos ya enviados (`FotofficeCitaRecordatorio`), los tipos de cita, las reglas "Cita que
genera" de los productos y los ajustes de Agenda** (incluido el calendario de Google guardado), y las plantillas de
tipo `CITA`. No se borran pedidos, productos, contactos ni proyectos. Quedan: el **calendario «… Agenda» y sus
eventos en Google** (se borran a mano desde Google Calendar si hace falta) y los mensajes ya registrados en
`FotofficeMessage` con `entityType = 'CITA'` (inofensivos; no hay CHECK sobre esa columna). Si hay citas con datos
reales, **hacer antes un respaldo o una rama de Neon** de la base.

## 8. Prueba en producción (para Daniel, en el PR)

Todo en **DNX Estudio**, con datos de prueba que después se anulan o cancelan.

1. **Cita a mano:** en `/agenda`, crear una cita de prueba (título, tipo, hora, lugar, responsable) y un
   participante contacto con correo propio. Se ve en la grilla con el color del tipo.
2. **Verla en Google:** el evento aparece en el calendario «DNX Estudio Agenda» de Google Calendar (si no apareció,
   mirar «Última sincronización» en Configuración → Agenda).
3. **Moverla en Google:** cambiar la hora del evento en Google. En **menos de 10 minutos** (una corrida de la tarea
   de traída) la cita de la Agenda queda con la hora nueva.
4. **Borrarla en Google:** borrar el evento en Google. En menos de 10 minutos la cita queda **ANULADA** en la Agenda
   (no se borra de la base y no aparece en la grilla).
5. **Cita nueva en Google:** crear un evento directamente en el calendario de la Agenda: en menos de 10 minutos
   aparece como cita (sin tipo ni responsable).
6. **Regla de cita en un producto:** Ventas → Catálogo → un producto de prueba → «Cita que genera»: tipo, días
   desde el evento, hora y duración. Guardar.
7. **Pedido de prueba:** crear un presupuesto con ese producto y fecha de evento, aceptarlo y **confirmar el
   pedido**. Se crea la cita (fecha del evento + días de la regla); aparece en la Agenda, en la tarjeta «Citas» de
   la ficha del pedido y en Google. Confirmar de nuevo / reintentar no la duplica.
8. **Recordatorio con un contacto de prueba:** crear un contacto con **tu propio correo**, ponerlo como participante
   de una cita de prueba que empiece en las próximas horas, y en Configuración → Agenda activar el recordatorio con
   un plazo mayor que el tiempo que falta (por ejemplo, 24 horas). En la **próxima hora en punto** llega el correo
   con título, fecha, hora y lugar. Comprobar que **no se repite** en la hora siguiente, que **mover la cita**
   vuelve a avisar, y que una cita anulada no avisa. Dejar el recordatorio apagado al terminar si no se quiere
   usar.
9. **Limpiar:** anular las citas de prueba, cancelar el pedido de prueba, quitar la regla del producto de prueba y
   borrar los eventos de prueba que queden en Google.
10. Comprobar que **confirmar un pedido de un producto sin regla** sigue funcionando igual y no crea citas.
