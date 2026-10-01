# Aplicar la migración de Plantillas de mensajes (FOTOFFICE, etapa 0.6)

Procedimiento manual, con el mismo criterio que `MIGRACION-CAMPOS-Y-NUMERACION.md`, pero **sin
staging**: por pedido de Daniel (01/10), el SQL va directo a la base de producción de FOTOFFICE.
Las tablas van **antes** que el código: no se fusiona el PR sin haber aplicado esto.

**Estas pantallas usan las tablas nuevas. Publicar el código antes que el SQL las rompe:**

- **Configuración → Plantillas** (lista de plantillas, editor y respuesta automática).
- **El botón "Mensaje" de las fichas de Cliente, Socio y Consulta** (elegir plantilla, mandar
  correo, abrir WhatsApp).
- **La línea de tiempo de las fichas de Cliente y Socio, y el historial de la ficha de Consulta**
  (muestran los mensajes enviados).
- **El formulario público de consultas**: busca la respuesta automática después de cada alta.
  Ese paso nunca hace fallar el alta (si la tabla no existe, la consulta se guarda igual y sólo
  queda un error con código en el log), pero sin la tabla la respuesta automática no sale.

Qué lee cada tabla:

| Tabla | Pantallas que la leen |
|---|---|
| `FotofficeMessageTemplate` | **Configuración → Plantillas; panel "Mensaje" de las fichas de Cliente, Socio y Consulta; historial de la ficha de Consulta (nombre de la plantilla usada); alta por el formulario público (respuesta automática)** |
| `FotofficeMessage` | **Línea de tiempo de las fichas de Cliente y Socio; historial de la ficha de Consulta; Configuración → Plantillas (cuántas veces se usó cada una); envío de correos (tope diario de 200)** |

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261005120000_fotoffice_plantillas` |
| Archivo | `packages/db/prisma/migrations/20261005120000_fotoffice_plantillas/migration.sql` |
| Checksum SHA-256 | `32de1a1bc7386264ce8b1b73343a93d39e7f8695a484480bb8972c692e38a400` |
| Operaciones | 2 `CREATE TABLE`, 3 índices comunes, 1 único parcial, 3 claves foráneas, 5 `CHECK` |
| Destructivas | Ninguna. Es aditiva: no modifica ni borra columnas existentes |

Crea **dos** tablas nuevas: `FotofficeMessageTemplate` (las plantillas, incluida la respuesta
automática `CONSULTA_AUTORESPUESTA`) y `FotofficeMessage` (el registro de cada correo enviado o
fallido y de cada WhatsApp abierto).

**El SQL no carga datos.** Las plantillas iniciales (la respuesta automática, **apagada**, en
todas las organizaciones, y las 7 plantillas de DNX Estudio) se crean **en código**, la primera
vez que alguien abre Configuración → Plantillas o el botón "Mensaje" de una ficha.

**Dependencia.** Va después de la 0.1 (PR 277), la 0.2 (PR 281), la 0.3 (PR 286), la 0.4
(PR 290) y la 0.5 (PR 294), apilados. Usa el número de consulta de la 0.5 (`[consulta_numero]`).

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261005120000_fotoffice_plantillas/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. Orden de publicación (sin staging)

1. Se fusionan primero, en orden, los PR 277, 281, 286, 290 y 294, **cada uno con su SQL
   aplicado en producción antes que su código** (ver el documento de migración de cada uno).
2. Esta rama se rebasa sobre `main` actualizado.
3. SQL de esta migración en **FOTOFFICE producción** (proyecto `compramelafoto`, rama
   `development`, `divine-hall-10689679` / `br-old-rain-adwthzng`).
4. Recién entonces se fusiona el PR.
5. Prueba manual en producción (sección 6).

## 3. En qué base va

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

La base necesita la tabla `Workspace` (por las claves foráneas). Las otras bases no son
urgentes: sólo `apps/fotoffice` lee estas tablas.

## 4. Procedimiento

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261005120000_fotoffice_plantillas';
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
  '32de1a1bc7386264ce8b1b73343a93d39e7f8695a484480bb8972c692e38a400',
  now(),
  '20261005120000_fotoffice_plantillas',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261005120000_fotoffice_plantillas'
);
COMMIT;
```

### Paso 3 — Verificar (sólo `SELECT`)

Justo después del SQL, las dos tablas existen y están **vacías**:

```sql
SELECT count(*) FROM "FotofficeMessageTemplate"; -- 0
SELECT count(*) FROM "FotofficeMessage";         -- 0

SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261005120000_fotoffice_plantillas' AND finished_at IS NOT NULL; -- 1

-- El índice único parcial y los CHECK quedaron creados
SELECT indexname FROM pg_indexes WHERE tablename = 'FotofficeMessageTemplate';
SELECT conname FROM pg_constraint
 WHERE conrelid IN ('"FotofficeMessageTemplate"'::regclass, '"FotofficeMessage"'::regclass) AND contype = 'c';
-- 5 filas: FotofficeMessageTemplate_channel, _entityType, _subject, FotofficeMessage_channel, _status
```

**Después de publicar el código** (las plantillas las crea el código, no el SQL). Con el id del
workspace de DNX:

```sql
SELECT "workspaceId" FROM "FotofficeWorkspaceBranding" WHERE "publicSlug" = 'dnx-estudio';
```

```sql
-- Plantillas de DNX (aparecen al abrir Configuración → Plantillas): 7 comunes + 1 automática
SELECT channel, "entityType", name, "systemKey", enabled FROM "FotofficeMessageTemplate"
 WHERE "workspaceId" = '<id de DNX>' ORDER BY "systemKey" NULLS LAST, channel, "order";

-- La respuesta automática nace apagada: enabled = false
SELECT enabled FROM "FotofficeMessageTemplate"
 WHERE "workspaceId" = '<id de DNX>' AND "systemKey" = 'CONSULTA_AUTORESPUESTA';

-- Mensajes de hoy (día de Buenos Aires), sin mostrar direcciones ni textos
SELECT channel, status, automatic, "errorCode", "createdAt"
  FROM "FotofficeMessage"
 WHERE "workspaceId" = '<id de DNX>'
   -- medianoche de hoy en Buenos Aires, expresada en UTC (como guarda la columna)
   AND "createdAt" >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '3 hours'
 ORDER BY "createdAt" DESC;
```

> Ojo con las horas: `createdAt` es `timestamp` sin zona y guarda la hora en UTC. Al leerla, restar
> 3 horas para la hora de Argentina.

## 5. Rollback

**Primero el código, después las tablas.** Si se borran las tablas con el código nuevo
publicado, las pantallas de la sección inicial se rompen.

1. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar
   que producción ya sirve la versión anterior.
2. Recién entonces:

```sql
BEGIN;
DROP TABLE "FotofficeMessage";
DROP TABLE "FotofficeMessageTemplate";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261005120000_fotoffice_plantillas';
COMMIT;
```

Esto borra las plantillas (incluidas las que se hayan editado) y todo el registro de mensajes
enviados: no tiene vuelta atrás. Las fichas de Cliente, Socio y Consulta en sí no se tocan.
`FotofficeMessage` va primero porque apunta a `FotofficeMessageTemplate`.

## 6. Prueba manual en producción (para Daniel, en el PR)

**Antes de probar: FOTOFFICE nunca mandó correos a clientes.** Para que salgan, en Vercel
(proyecto de FOTOFFICE, entorno **Production**) tienen que estar cargadas:

- `RESEND_API_KEY` — la clave de Resend (marcada como sensible).
- `FOTOFFICE_NOTIFICATIONS_FROM` — el remitente, con un dominio **verificado en Resend**
  (por ejemplo `FOTOFFICE <avisos@dominio-verificado>`). No hay remitente por defecto: si falta
  cualquiera de las dos, el envío falla, queda registrado como "Falló" y la ficha muestra
  "El envío de correos no está configurado".

El nombre visible del remitente es el de la organización y "responder a" es el correo de
contacto cargado en la marca de la organización. **Tope: 200 correos por día y por
organización** (día de Buenos Aires), contando los automáticos; al llegar, no se envía.

1. **Correo:** desde la ficha de un cliente **propio de Daniel** (con su correo), botón
   "Mensaje" → Correo → elegir una plantilla → enviar. Debe llegar el correo con la firma y
   aparecer en la línea de tiempo de la ficha como "Enviado".
2. **WhatsApp:** desde una ficha con **el número de Daniel**, "Mensaje" → WhatsApp → elegir
   una plantilla → abrir. Se abre WhatsApp con el texto completo y queda en la línea de tiempo
   como "Abierto en WhatsApp".
3. **Respuesta automática:** en Configuración → Plantillas, encender la respuesta automática.
   Hacer una consulta de prueba desde el formulario público con un correo de Daniel. Debe
   llegar el correo con el número de la consulta, y en el historial de esa consulta debe
   figurar el mensaje como "Automático".
4. **Apagar la respuesta automática** al terminar (salvo que Daniel decida dejarla encendida),
   y archivar o marcar la consulta de prueba.

Si un correo no llega, mirar en el historial de la ficha si quedó "Falló" y, con la consulta de
la sección 4, el `errorCode` (por ejemplo `CONFIGURATION_ERROR` = faltan las variables de Vercel;
`PROVIDER_REJECTED:403:…` = el dominio del remitente no está verificado en Resend).
