# Aplicar la migración de Etapa 5 · Contratos (FOTOFFICE)

Procedimiento manual, con el mismo criterio que `MIGRACION-ETAPA-4-AGENDA.md`, **sin staging**: el SQL va
directo a la base de producción de FOTOFFICE y **antes** que el código: no se fusiona el PR sin haber aplicado
esto. **Esta migración todavía NO se aplicó a ninguna base.**

Qué hace esta entrega: el módulo **Contratos** (`/contratos`). Del pedido sale un contrato a partir de una
plantilla con variables (datos de quien contrata, ítems, plan de cuotas, empresa), se manda a firmar por correo,
cada firmante verifica su identidad con un código y firma con su nombre y su trazo (**firma electrónica, Ley
25.506**: no es firma digital con certificado y los textos nunca lo dicen así), y al quedar firmado por todos se
genera un **PDF sellado** (con las firmas y una hoja de constancia) que se manda por correo a cada firmante y a la
organización. Opcionalmente, **recordatorios** a quien no firmó.

## Advertencia crítica: pantallas que ya existen leen tablas nuevas

**La ficha del pedido (`/pedidos/[id]`) y la ficha del contacto (`/clientes/[id]`) ahora LEEN
`FotofficePedidoContratante` y `FotofficeContrato`** (tarjetas «Contratantes» y «Contratos»), pero sólo en las
organizaciones con el módulo `contracts` encendido y con "Ver" en Contratos. Si el código se publica **antes**
que el SQL, esas lecturas fallan (`P2021`, la tabla no existe) y **abrir un pedido o un contacto da error en toda
organización que tenga Contratos encendido**. Hoy nadie lo tiene; aun así, **el SQL se aplica primero, siempre**:
encender Contratos en una organización sin el SQL rompe esas fichas.

Además, **el CHECK de `FotofficeMessageTemplate.entityType` se reemplaza**: se mantienen `GENERAL`, `CLIENTE`,
`SOCIO`, `CONSULTA`, `PRESUPUESTO`, `PEDIDO`, `PROYECTO` y `CITA`, y se suma `CONTRATO`. Sin el SQL, las cuatro
plantillas automáticas de correo del contrato (`CONTRATO_ENVIO`, `CONTRATO_CODIGO`, `CONTRATO_RECORDATORIO`,
`CONTRATO_FIRMADO`, tipo `CONTRATO`) no se pueden crear.

Con el SQL aplicado y el código viejo todavía publicado no pasa nada: las tablas nuevas no se usan, **no se suman
columnas a ninguna tabla existente** y el CHECK nuevo acepta todos los valores que aceptaba el viejo.

> **Nota sobre otra sesión:** otra sesión reservó la migración `20261027100000_fotoffice_bandeja_whatsapp`
> (tablas distintas: la bandeja de WhatsApp). Es **independiente** de ésta: no comparten tablas ni CHECK, no
> importa en qué orden se apliquen y cada una se registra con su propio nombre y su propio checksum.

## 1. Qué se aplica

Migración: `packages/db/prisma/migrations/20261027120000_fotoffice_etapa_5_contratos/migration.sql`

Checksum SHA-256 del archivo comprometido:

```
e4096b699c19717372dde5401d6140e94f30deefeecb0736b32f7aa287e09939
```

Comprobar antes de pegar: `shasum -a 256 packages/db/prisma/migrations/20261027120000_fotoffice_etapa_5_contratos/migration.sql`
tiene que dar exactamente ese valor. Si el archivo se toca, hay que recalcular el checksum acá y en el paso 2.

### Tablas nuevas (7) y quién las lee

Sólo `apps/fotoffice` las lee; las otras apps no.

| Tabla | Para qué | Pantallas y flujos que la leen o escriben |
|---|---|---|
| `FotofficeContratoPlantilla` | Plantillas de contrato por organización (nombre, texto, activa, orden). Único por (workspaceId, name). DNX recibe una plantilla modelo al abrir Configuración → Contratos. | **Configuración → Contratos → Plantillas, tarjeta «Contratos» del pedido (selector de plantilla), generar un contrato, «Actualizar datos» del borrador.** |
| `FotofficePedidoContratante` | Quién contrata un pedido: orden 1 o 2 → contacto. Sin fila, el contratante 1 es el contacto del pedido. Único por (pedidoId, orden). | **Ficha del pedido (tarjeta «Contratantes», lee y escribe), generar un contrato y enviarlo (lee), ficha del contacto.** |
| `FotofficeContrato` | El contrato: estado, texto, versión vigente, fechas, PDF final (`pdfKey`, `pdfHash`, `pdfSentAt`) y firma en papel. | **`/contratos` (lista), `/contratos/[id]` (ficha) y su descarga de PDF, tarjetas «Contratos» del pedido y del contacto, página pública de firma, tarea diaria (recordatorios y PDF pendiente).** |
| `FotofficeContratoVersion` | Texto congelado al enviar y su huella SHA-256. Una versión nueva reemplaza a la anterior (corregir y reenviar). | **Ficha del contrato, página pública de firma, PDF (el texto sellado), recordatorios.** |
| `FotofficeContratoFirmante` | Quién firma cada versión: enlace y código (sólo hashes), evidencia (IP con hash, navegador) y firma. | **Página pública de firma (escribe), ficha del contrato (estados, «Copiar enlace», «Reenviar»), PDF y hoja de constancia, recordatorios (rota el enlace).** |
| `FotofficeContratoEvento` | Bitácora del contrato. Nunca guarda el código de verificación ni textos. | **Historial de la ficha del contrato.** |
| `FotofficeContratoAjustes` | Una fila por organización: datos de la empresa, firma de la empresa, cláusula de consentimiento y recordatorio. | **Configuración → Contratos, variables `[empresa_…]`, página pública (cláusula y firma de la empresa), PDF, tarea diaria (¿recordatorios encendidos?).** |

Archivos en el almacenamiento privado (R2, `R2_PRIVATE_BUCKET`, mismo bucket que los adjuntos, otro prefijo):
`contratos/<workspaceId>/empresa/…` (firma de la empresa), `contratos/<workspaceId>/<contratoId>/<firmanteId>.png`
(firma dibujada) y `contratos/<workspaceId>/<contratoId>/contrato-<número>-v<versión>.pdf` (PDF sellado). **No
hay variables de entorno nuevas.**

### Índices

- `FotofficeContratoPlantilla`: **único** `FotofficeContratoPlantilla_workspaceId_name_key` (workspaceId, name).
- `FotofficePedidoContratante`: **único** `FotofficePedidoContratante_pedidoId_orden_key` (pedidoId, orden); `..._workspaceId_idx`, `..._clientId_idx`.
- `FotofficeContrato`: **único** `FotofficeContrato_workspaceId_number_key` (workspaceId, number); **único** `FotofficeContrato_currentVersionId_key`; `..._workspaceId_status_idx`, `..._pedidoId_idx`, `..._clientId_idx`, `..._templateId_idx`, `..._manualAttachmentId_idx`.
- `FotofficeContratoVersion`: **único** `FotofficeContratoVersion_contratoId_number_key` (contratoId, number); `..._workspaceId_idx`.
- `FotofficeContratoFirmante`: **único** `FotofficeContratoFirmante_tokenHash_key`; `..._workspaceId_idx`, `..._versionId_idx`, `..._clientId_idx`.
- `FotofficeContratoEvento`: `..._contratoId_createdAt_idx`, `..._workspaceId_idx`.
- `FotofficeContratoAjustes`: **único** `FotofficeContratoAjustes_workspaceId_key`.

### Claves foráneas (18)

| Tabla | Columna | Apunta a | Al borrar |
|---|---|---|---|
| `FotofficeContratoPlantilla` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficePedidoContratante` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficePedidoContratante` | `pedidoId` | `FotofficePedido` | CASCADE |
| `FotofficePedidoContratante` | `clientId` | `Client` | RESTRICT |
| `FotofficeContrato` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeContrato` | `pedidoId` | `FotofficePedido` | RESTRICT |
| `FotofficeContrato` | `clientId` | `Client` | RESTRICT |
| `FotofficeContrato` | `templateId` | `FotofficeContratoPlantilla` | SET NULL |
| `FotofficeContrato` | `currentVersionId` | `FotofficeContratoVersion` | SET NULL |
| `FotofficeContrato` | `manualAttachmentId` | `FotofficeAttachment` | SET NULL |
| `FotofficeContratoVersion` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeContratoVersion` | `contratoId` | `FotofficeContrato` | CASCADE |
| `FotofficeContratoFirmante` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeContratoFirmante` | `versionId` | `FotofficeContratoVersion` | CASCADE |
| `FotofficeContratoFirmante` | `clientId` | `Client` | SET NULL |
| `FotofficeContratoEvento` | `workspaceId` | `Workspace` | CASCADE |
| `FotofficeContratoEvento` | `contratoId` | `FotofficeContrato` | CASCADE |
| `FotofficeContratoAjustes` | `workspaceId` | `Workspace` | CASCADE |

(Todas con `ON UPDATE CASCADE`. Las columnas de usuario —`ownerUserId`, `createdByUserId`, `actorUserId`— son
enteros sin FK: la validación la hace el código. Que `FotofficeContrato` apunte con RESTRICT al pedido y al
contacto significa que **un pedido o un contacto con contratos no se puede borrar**: hay que anular el contrato y,
si hace falta borrar de verdad, hacerlo con una consulta aparte.)

### Los 12 CHECK nuevos y 1 reemplazado

- `FotofficeContratoPlantilla_name`: `length(trim("name")) > 0`.
- `FotofficeContratoPlantilla_body`: `length(trim("body")) > 0`.
- `FotofficePedidoContratante_orden`: `"orden" IN (1, 2)`.
- `FotofficeContrato_status`: `"status" IN ('BORRADOR', 'ENVIADO', 'FIRMADO_PARCIAL', 'FIRMADO', 'RECHAZADO', 'ANULADO')`.
- `FotofficeContrato_name`: `length(trim("name")) > 0`.
- `FotofficeContrato_voidReason`: si hay `voidedAt`, el motivo no puede estar vacío.
- `FotofficeContratoVersion_contentHash`: `"contentHash" ~ '^[0-9a-f]{64}$'`.
- `FotofficeContratoFirmante_orden`: `"orden" IN (1, 2)`.
- `FotofficeContratoFirmante_codeAttempts`: `"codeAttempts" >= 0`.
- `FotofficeContratoFirmante_codesSentInWindow`: `"codesSentInWindow" >= 0`.
- `FotofficeContratoFirmante_rejectReason`: si hay `rejectedAt`, el motivo no puede estar vacío.
- `FotofficeContratoAjustes_reminderDays`: `"reminderDays" BETWEEN 1 AND 30`.
- **Reemplazado:** `FotofficeMessageTemplate_entityType`: `"entityType" IN ('GENERAL','CLIENTE','SOCIO','CONSULTA','PRESUPUESTO','PEDIDO','PROYECTO','CITA','CONTRATO')`.

### Lo que el SQL no hace

No suma columnas a tablas existentes, no borra ni actualiza filas, no siembra plantillas ni ajustes (la plantilla
modelo de DNX y las plantillas de correo se crean solas desde el código, al abrir las pantallas o al primer
envío). Lo que no puede chequear el SQL lo valida el código (`lib/contratos`): que el contacto, el pedido, la
plantilla y el adjunto de un contrato sean del mismo workspace.

## 2. Orden de publicación (sin staging)

1. SQL de esta migración en **FOTOFFICE producción** (sección 4).
2. Verificar (sección 4, paso 3).
3. Recién entonces se fusiona el PR y se publica el código. **No hay variables de entorno nuevas**: la tarea
   programada nueva usa `CRON_SECRET`, que ya existe, y el PDF y las firmas usan el bucket privado que ya existe.
4. Daniel, como administrador de la plataforma, enciende **Contratos** en DNX Estudio (sección 5).
5. Configuración → Contratos (datos de la empresa, firma, cláusula) y la plantilla real (sección 5).
6. Prueba en producción (sección 8).

## 3. En qué base va

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Las otras bases no son urgentes: sólo `apps/fotoffice` lee estas tablas.

### Tarea programada nueva (`apps/fotoffice/vercel.json`)

| Ruta | Horario | Qué hace |
|---|---|---|
| `/api/cron/contratos-recordatorios` | `0 13 * * *` (todos los días, 13:00 UTC = 10:00 de Buenos Aires) | (1) **Recordatorios de firma** a quien no firmó, sólo en organizaciones con el módulo y «Recordatorios» encendidos. (2) **Reintento del PDF**: contratos firmados por todos (últimos 30 días, no firmados en papel) que quedaron sin PDF o sin la copia enviada. |

Pide `CRON_SECRET` (o `FOTOFFICE_CRON_SECRET`), como las demás. Mientras nadie tenga Contratos encendido, no hace
nada. Devuelve sólo contadores.

Cómo funcionan los **recordatorios** (Configuración → Contratos → «Recordatorios», apagado por omisión, de 1 a 30
días, 3 por omisión):

- Le recuerda a cada firmante que **no firmó ni rechazó**, de la **versión vigente** de un contrato `ENVIADO` o
  `FIRMADO_PARCIAL`, con el enlace sin vencer, cuando pasaron **N días o más desde que se envió** la versión y
  **N días o más desde el último recordatorio** (si hubo). Un firmante recibe uno cada N días hasta que firma,
  rechaza, se anula o se corrige el contrato, o vence el enlace (30 días desde el envío).
- El enlace se guarda sólo como hash, no se puede reconstruir: **cada recordatorio ROTA el enlace** (hash y
  vencimiento nuevos, como «Reenviar enlace») y el correo lleva el enlace nuevo. **El enlace de un correo anterior
  deja de funcionar**; si el recordatorio no sale, se vuelve atrás la rotación y el enlace anterior sigue andando.
- Es un correo automático: cuenta en el tope diario de automáticos de la organización (50) y como máximo se mandan
  **200 por corrida** entre todas las organizaciones. No tiene el freno de «una respuesta automática por dirección
  cada 24 h» (es transaccional). La corrida se corta si el proveedor falla 5 veces seguidas.
- En el historial del contrato queda el evento «Recordatorio enviado» y el correo en los mensajes del contrato.

Cómo funciona el **PDF** de un contrato firmado:

- Se genera con `after()` apenas firma el último firmante, sin frenar la firma. Si no llega a terminar, la tarea
  diaria lo completa. Es **idempotente**: no se genera dos veces.
- Se guarda en el bucket privado y su huella SHA-256 queda en `FotofficeContrato.pdfHash`; la huella del **texto**
  de la versión va dentro de la hoja de constancia. Antes de sellar se comprueba que el texto guardado coincida con
  su huella; antes de enviar o descargar, que el archivo coincida con la suya.
- Se manda como adjunto (correo «Contrato firmado») a cada firmante y a la organización (correo de contacto de la
  marca; si no tiene, el del responsable o el dueño). Si ningún envío sale por un problema temporal, se reintenta al
  día siguiente; si al menos uno salió, se da por enviado para no repetirlo a quienes ya lo recibieron.
- Descarga: el equipo desde la ficha (`/contratos/[id]/pdf`, con "Ver"), y cada firmante desde su enlace una vez
  que el contrato quedó firmado por todas las partes.

## 4. Procedimiento

### Paso 0 — Nadie tiene Contratos encendido y el atajo `contratos` está libre

```sql
SELECT count(*) AS encendidos
FROM "WorkspaceFeatureModule"
WHERE "moduleKey" = 'contracts' AND enabled = true;
```

Tiene que dar **0**. Si da más, esa organización verá Contratos apenas se publique: aplicar el SQL antes de publicar.

La ruta `/contratos` queda reservada y pisaría el atajo público de una institución con ese nombre. Tiene que dar **0 filas**:

```sql
SELECT "workspaceId", "publicSlug" FROM "FotofficeWorkspaceBranding" WHERE lower("publicSlug") = 'contratos';
```

### Paso 1 — Comprobar qué está aplicado

```sql
SELECT migration_name FROM "_prisma_migrations"
 WHERE migration_name IN ('20261026120000_fotoffice_etapa_4_agenda','20261027120000_fotoffice_etapa_5_contratos');
```

- Tiene que aparecer la de Agenda: el CHECK de plantillas que se reemplaza ya incluye `CITA`. Si no aparece,
  aplicarla primero con su documento (si no, este SQL la pisaría y el CHECK de Agenda quedaría inconsistente).
- Si ya aparece `20261027120000_...`, la base está lista: parar.

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
  'e4096b699c19717372dde5401d6140e94f30deefeecb0736b32f7aa287e09939',
  now(),
  '20261027120000_fotoffice_etapa_5_contratos',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261027120000_fotoffice_etapa_5_contratos'
);
COMMIT;
```

Si algo falla, la transacción entera se deshace (no queda nada a medias). Es la manera manual + registro con
checksum que se usa en FOTOFFICE (no se corre `migrate deploy`; también sirve `prisma migrate resolve --applied
20261027120000_fotoffice_etapa_5_contratos` después de pegar el SQL, pero entonces el checksum registrado sale del
archivo del repositorio y hay que comprobar que sea el de arriba). El checksum es el del archivo tal como queda
comprometido en `main`.

### Paso 3 — Verificar (sólo `SELECT`)

```sql
-- Las 7 tablas existen y están vacías
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN (
  'FotofficeContratoPlantilla','FotofficePedidoContratante','FotofficeContrato','FotofficeContratoVersion',
  'FotofficeContratoFirmante','FotofficeContratoEvento','FotofficeContratoAjustes'); -- 7 filas

SELECT
  (SELECT count(*) FROM "FotofficeContratoPlantilla") AS plantillas,  -- 0
  (SELECT count(*) FROM "FotofficePedidoContratante") AS contratantes, -- 0
  (SELECT count(*) FROM "FotofficeContrato")          AS contratos,    -- 0
  (SELECT count(*) FROM "FotofficeContratoFirmante")  AS firmantes,    -- 0
  (SELECT count(*) FROM "FotofficeContratoAjustes")   AS ajustes;      -- 0

-- Los 12 CHECK de las tablas nuevas
SELECT conname FROM pg_constraint
 WHERE contype = 'c' AND conrelid IN (
   '"FotofficeContratoPlantilla"'::regclass, '"FotofficePedidoContratante"'::regclass, '"FotofficeContrato"'::regclass,
   '"FotofficeContratoVersion"'::regclass, '"FotofficeContratoFirmante"'::regclass, '"FotofficeContratoAjustes"'::regclass)
 ORDER BY 1; -- 12 filas

-- Los índices únicos
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
  'FotofficeContratoPlantilla_workspaceId_name_key',
  'FotofficePedidoContratante_pedidoId_orden_key',
  'FotofficeContrato_workspaceId_number_key',
  'FotofficeContrato_currentVersionId_key',
  'FotofficeContratoVersion_contratoId_number_key',
  'FotofficeContratoFirmante_tokenHash_key',
  'FotofficeContratoAjustes_workspaceId_key'); -- 7 filas

-- Claves foráneas de las 7 tablas
SELECT count(*) FROM pg_constraint
 WHERE contype = 'f' AND conrelid IN (
  '"FotofficeContratoPlantilla"'::regclass, '"FotofficePedidoContratante"'::regclass, '"FotofficeContrato"'::regclass,
  '"FotofficeContratoVersion"'::regclass, '"FotofficeContratoFirmante"'::regclass, '"FotofficeContratoEvento"'::regclass,
  '"FotofficeContratoAjustes"'::regclass); -- 18

-- El CHECK reemplazado: una sola fila, con CONTRATO y los otros 8 valores
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';

-- Las plantillas de antes siguen igual (comparar con el SELECT del paso 1)
SELECT "entityType", count(*) FROM "FotofficeMessageTemplate" GROUP BY 1 ORDER BY 1;

-- La migración quedó registrada con el checksum correcto
SELECT checksum FROM "_prisma_migrations"
 WHERE migration_name = '20261027120000_fotoffice_etapa_5_contratos' AND finished_at IS NOT NULL;
-- e4096b699c19717372dde5401d6140e94f30deefeecb0736b32f7aa287e09939
```

## 5. Encender Contratos en DNX Estudio

El módulo `contracts` ("Contratos") pasa a **disponible**, con la ruta `/contratos` y **depende de Pedidos**
(`orders`). **No se enciende solo en ninguna organización.** Sólo el administrador de la plataforma enciende o
apaga módulos.

Después de publicar, **Daniel**:

1. Entra a DNX Estudio → Configuración → Módulos (o Administración → Workspaces → DNX Estudio) y enciende
   **Contratos** (Pedidos tiene que estar encendido).
2. En **Configuración → Comisión directiva** (roles), da **"Ver"** en Contratos a quien debe leerlos y
   **"Gestionar"** a quien genera, edita, envía, anula y marca contratos firmados en papel. Las **plantillas y los
   ajustes** sólo los configura el dueño o un administrador.
3. **Configuración → Contratos** (al abrirla por primera vez se crea la plantilla modelo de DNX y las plantillas
   de correo del contrato):
   - **Datos de la empresa:** nombre (obligatorio para poder enviar), CUIT y domicilio. Van a las variables
     `[empresa_nombre]`, `[empresa_cuit]` y `[empresa_domicilio]` y al PDF.
   - **Firma de la empresa:** subir una imagen PNG o JPG (hasta 1 MB, fondo blanco o transparente). Aparece en la
     página de firma y en el PDF sellado.
   - **Cláusula de consentimiento:** el texto que cada firmante tiene que aceptar antes de pedir el código. Viene
     una de fábrica (firma electrónica, Ley 25.506, Código Civil y Comercial arts. 286 y 288). **Es un texto
     modelo: hay que revisarlo con un abogado antes de usarlo con clientes.** Si se deja vacío rige la de fábrica.
   - **Recordatorios:** tildar «Mandar recordatorios a quien no firmó» y elegir los días (1 a 30; 3 por omisión).
     Nace **apagado**. Cada recordatorio renueva el enlace del firmante (ver sección 3).
4. **Pegar la plantilla real de DNX:** Configuración → Contratos → **Plantillas** → «Contrato de eventos
   (modelo)» → **editarla con el texto real del contrato de DNX** (o crear una nueva, desactivar o borrar el
   modelo). El modelo viene marcado «MODELO PARA REEMPLAZAR» y es texto genérico: **no usarlo tal cual**. El
   editor avisa si hay variables que no existen. Variables disponibles: `[contratante1_nombre]`,
   `[contratante1_documento]`, `[contratante1_domicilio]`, `[contratante1_correo]`, `[contratante1_telefono]` (y
   lo mismo con `contratante2`), `[pedido_numero]`, `[pedido_total]`, `[pedido_items]` y `[pedido_cuotas]` (las
   dos últimas se dibujan como tabla), `[evento]`, `[evento_fecha]`, `[empresa_nombre]`, `[empresa_cuit]`,
   `[empresa_domicilio]`, `[fecha_hoy]`, `[contrato_numero]` y `[salto_de_pagina]` (corte de página real en el
   PDF). Formato: `# Título`, `## Subtítulo` y `**negrita**`.
5. (Opcional) **Textos de los correos:** Configuración → Plantillas → Automáticos: «Envío del contrato para
   firmar», «Código para firmar», «Recordatorio de un contrato sin firmar» y «Contrato firmado». Variables:
   `[contrato_numero]`, `[contrato_enlace]` (sólo envío y recordatorio), `[contrato_codigo]` (sólo el código; **no
   se guarda en ningún registro**) y `[firmante_nombre]`.
6. **Contratantes:** en cada pedido, la tarjeta «Contratantes» permite elegir quién contrata (el contratante 1 es,
   por omisión, el contacto del pedido) y sumar un contratante 2 opcional. Cada uno necesita un correo válido.

## 6. Qué no hace todavía

- Un contrato `RECHAZADO` no se corrige ni se reenvía (sólo se anula y se genera otro).
- Un contrato `FIRMADO` no se puede anular desde la pantalla.
- La firma electrónica no es firma digital con certificado: lo dice la leyenda de la página, de cada firma y del PDF.
- El PDF usa la tipografía estándar (Helvetica): un carácter fuera del alfabeto latino occidental (por ejemplo un
  emoji) se reemplaza por «?» **sólo en el PDF** y la hoja de constancia lo avisa; el texto original y su huella
  quedan intactos en el sistema.

## 7. Rollback

**Primero el código, después las tablas.** Con el código nuevo publicado y las tablas borradas, abrir pedidos y
contactos da error en las organizaciones con Contratos encendido.

1. Apagar **Contratos** en DNX (Configuración → Módulos).
2. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar que producción ya
   sirve la versión anterior. Esto también saca la tarea programada nueva.
3. Recién entonces, en orden seguro para las claves foráneas (primero lo que apunta a otras tablas):

```sql
BEGIN;
-- Las plantillas de tipo CONTRATO no caben en el CHECK anterior: se borran antes de volver a él.
DELETE FROM "FotofficeMessageTemplate" WHERE "entityType" = 'CONTRATO';
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType"
  CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA'));

-- Rompe el ciclo contrato <-> versión antes de borrar.
UPDATE "FotofficeContrato" SET "currentVersionId" = NULL;
DROP TABLE "FotofficeContratoEvento";
DROP TABLE "FotofficeContratoFirmante";
DROP TABLE "FotofficeContratoVersion";
DROP TABLE "FotofficeContrato";
DROP TABLE "FotofficePedidoContratante";
DROP TABLE "FotofficeContratoPlantilla";
DROP TABLE "FotofficeContratoAjustes";

DELETE FROM "_prisma_migrations" WHERE migration_name = '20261027120000_fotoffice_etapa_5_contratos';
COMMIT;
```

Después del rollback, comprobar que el CHECK quedó exactamente como antes (los 8 valores, sin `CONTRATO`):

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = '"FotofficeMessageTemplate"'::regclass AND conname = 'FotofficeMessageTemplate_entityType';
```

**Advertencia: pérdida de datos sin vuelta atrás.** Si ya hay contratos, este rollback **borra los contratos, sus
versiones, firmantes (con la evidencia de cada firma), la bitácora, los contratantes elegidos, las plantillas de
contrato, los ajustes de Contratos** y las plantillas de correo de tipo `CONTRATO`. **No borra los archivos del
almacenamiento privado** (`contratos/…`: firmas y PDF sellados), que quedan huérfanos: **un contrato firmado es un
documento con valor legal; antes de revertir hay que descargar los PDF firmados** (los PDF ya enviados por correo
a los firmantes no se pierden). No se borran pedidos, contactos ni los adjuntos de la ficha (los contratos
marcados como firmados en papel apuntan a un adjunto, no lo contienen). Quedan los mensajes ya registrados en
`FotofficeMessage` con `entityType = 'CONTRATO'` (inofensivos; no hay CHECK sobre esa columna). Si hay contratos
con datos reales, **hacer antes un respaldo o una rama de Neon** de la base.

## 8. Prueba en producción (para Daniel, en el PR)

Todo en **DNX Estudio**, con un pedido de prueba y **tu propio correo** como contratante.

1. **Preparar:** con Contratos encendido y la plantilla real cargada (sección 5), en Configuración → Contratos
   completar nombre de la empresa, subir la firma y dejar los recordatorios apagados.
2. **Pedido de prueba:** crear un pedido (o usar uno de prueba) a nombre de un contacto con **tu correo**. En la
   tarjeta «Contratos» del pedido elegir la plantilla y **Generar contrato**. Abrirlo (`/contratos/[id]`) y revisar
   que las variables y las tablas (ítems, cuotas) salieron bien. Si hace falta, editar el borrador o «Actualizar
   datos».
3. **Enviar:** «Enviar a firmar». Llega el correo «Contrato … para firmar» con el enlace.
4. **Firmar desde el celular:** abrir el enlace en el teléfono, leer, escribir el nombre, aceptar la cláusula y
   pedir el código; llega por correo. Ingresar el código y **firmar con el dedo**. Comprobar que se ve «Firmado» y
   que en la ficha el contrato pasa a **Firmado**, con el historial (visto, código enviado y verificado, firmado).
5. **PDF por correo:** en pocos minutos llega «El contrato … quedó firmado» con el **PDF adjunto**; llega también la
   copia a la casilla de la organización. Abrirlo: texto completo con acentos y ñ, tablas, la firma dibujada, la
   firma de la empresa, «Página n de m», y la **hoja de constancia** (número, versión, huella SHA-256, correo
   enmascarado, hora de Argentina, IP con hash, navegador y la leyenda de la Ley 25.506).
6. **Descargas:** «Descargar PDF» en la ficha del contrato y en la página del enlace del firmante (ya firmado). Un
   usuario sin "Ver" en Contratos no tiene que poder bajarlo.
7. **Recordatorio (opcional):** en otro contrato de prueba, activar los recordatorios con 1 día y dejarlo sin
   firmar; a las 10:00 del día siguiente llega «Te falta firmar…» con un enlace nuevo (el enlace anterior ya no
   abre). Después, **anular** ese contrato (con motivo) y apagar los recordatorios si no se quieren usar.
8. **Limpiar:** el contrato firmado de prueba no se puede anular desde la pantalla: queda como constancia del
   ensayo y se **cancela el pedido de prueba**. Comprobar que **abrir pedidos y contactos de siempre** sigue
   funcionando igual y que, sin el módulo encendido, no aparece nada de Contratos.
