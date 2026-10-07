# Aplicar la migración de Etapa 1 · Contactos y Consultas (FOTOFFICE, primera entrega)

Procedimiento manual, con el mismo criterio que `MIGRACION-PLANTILLAS.md`, **sin staging**:
por pedido de Daniel, el SQL va directo a la base de producción de FOTOFFICE. Las tablas van
**antes** que el código: no se fusiona el PR sin haber aplicado esto.

Qué hace esta entrega (tareas 1 a 6): cada consulta pasa a tener su **ficha propia**
(categoría, origen, valor estimado, fecha y lugares del evento, novios, participantes con rol),
queda **enganchada a un contacto** (la persona que consultó) y se puede cargar a mano
("Nueva consulta"), con alta rápida, columnas y filtros en el tablero, totales por columna y
acciones en lote (por ejemplo, asignar responsable a varias consultas).

## Advertencia crítica: el formulario público escribe en estas tablas

**El formulario público de consultas (el que usan los clientes desde el sitio) ya no guarda una
consulta suelta: guarda la consulta junto con su ficha, su contacto y su categoría, todo en una
sola operación.** Si el código se publica **antes** que el SQL:

- Las tablas nuevas no existen, el sistema intenta sembrar los catálogos (falla, queda sólo un
  error con código en el log) y después la operación de alta falla entera.
- **Respaldo del formulario público:** cuando esa operación falla por algo que no es un dato
  mal cargado (tabla inexistente, bloqueo vencido, base caída, ninguna categoría), el formulario
  guarda **sólo la consulta vieja** (`ServiceSalesLead`), con los mismos campos que antes de esta
  etapa, y le da número, circuito, aviso y respuesta automática igual. La persona ve el cartel de
  éxito. En el log queda `[consultas] altaDeConsulta falló` con el código y después
  `[consultas] alta web guardada sin ficha` (`ALTA_WEB_RESPALDO`). Cuando las tablas existan, el
  enganche le pone contacto y categoría al abrir Consultas.
- Aun así **no funcionan Consultas** (tablero, lista, informe, ficha, nueva) hasta aplicar el SQL.

Por eso **el SQL se aplica primero, siempre** (el respaldo es una red, no el plan). Con el SQL ya aplicado y el código viejo todavía
publicado no pasa nada: las tablas nuevas simplemente no se usan.

Qué lee cada tabla (confirmado en el código de `apps/fotoffice`):

| Tabla | Pantallas y flujos que la leen o escriben |
|---|---|
| `FotofficeConsulta` | **Formulario público de consultas (`app/actions/service-lead.ts`: la crea en cada alta); Consultas → tablero, lista e informe (categoría, fecha del evento y valor de cada tarjeta, totales por columna); ficha de la consulta; Nueva consulta y alta rápida; acciones en lote; enganche de consultas viejas al abrir Consultas** |
| `FotofficeConsultaCategoria` | **Formulario público (elige la categoría equivalente al tipo de evento); Nueva consulta y alta rápida (selector de categoría); tablero y lista (categoría y qué datos pide cada grupo: boda, evento, trabajo con o sin fecha); ficha de la consulta; enganche** |
| `FotofficeOrigen` | **Nueva consulta y ficha (de dónde llegó); filtros de la lista; informe** |
| `FotofficeRolParticipante` | **Ficha y Nueva consulta (roles de los participantes: novios, padres, planner, etc.)** |
| `FotofficeConsultaParticipante` | **Ficha de la consulta (participantes con su rol); Nueva consulta** |
| `FotofficeContactoPerfil` | **Ficha de la consulta (bloque del contacto: categoría CONTACTO/CLIENTE/PROVEEDOR/COLABORADOR, celular, etc.); formulario público y Nueva consulta (crean el perfil del contacto nuevo); una consulta ganada pasa al contacto de CONTACTO a CLIENTE** |
| `FotofficeConsultaAjustes` | **Aviso al equipo y tarea "Responder consulta" al entrar una consulta nueva (responsable por defecto, si manda correo y si crea tarea); plantilla del aviso al equipo (`lib/plantillas/automaticos.ts`)** |

La **ficha de Cliente** (`/clientes`) **no lee** estas tablas en esta entrega: los campos
ampliados del contacto se editan recién en la próxima. Los clientes que ya existen no tienen
perfil: el código los trata como CLIENTE; los que crea una consulta nacen como CONTACTO.

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20261017120000_fotoffice_etapa_1_consultas` |
| Archivo | `packages/db/prisma/migrations/20261017120000_fotoffice_etapa_1_consultas/migration.sql` |
| Checksum SHA-256 | `249a9c7ba5e4c27f8861f7e4e79f310c8f0c1337e0b5457602e290476049d33c` |
| Operaciones | 7 `CREATE TABLE`, 4 `CHECK`, índices comunes y únicos, claves foráneas a `Workspace`, `ServiceSalesLead` y `Client` |
| Destructivas | Ninguna. Es aditiva: no modifica ni borra tablas ni columnas existentes (`ServiceSalesLead` y `Client` no reciben columnas) |

Crea **siete** tablas nuevas: `FotofficeConsulta`, `FotofficeConsultaCategoria`, `FotofficeOrigen`,
`FotofficeRolParticipante`, `FotofficeConsultaParticipante`, `FotofficeContactoPerfil` y
`FotofficeConsultaAjustes`.

**El SQL no carga datos.** Los catálogos se **siembran solos, en código**, la primera vez que
alguien abre Consultas o entra una consulta nueva: **DNX Estudio recibe sus 21 categorías,
8 orígenes y 16 roles**; las demás organizaciones, una categoría por cada tipo de evento viejo.
Las consultas que ya existen se **enganchan solas** (contacto, categoría, fecha y lugar) al abrir
Consultas, de a 50 por vez; es seguro repetirlo.

**Qué NO incluye esta entrega** (viene en la próxima): la pantalla **Configuración → Consultas**
(administrar categorías, orígenes y roles), la **importación por CSV** y los **campos ampliados
del cliente en su ficha**. Mientras tanto los catálogos son los sembrados.

**Dependencia.** Va después de las etapas 0.1 a 0.6 ya en producción (usa el número de consulta,
el circuito y las plantillas) y necesita las tablas `Workspace`, `ServiceSalesLead` y `Client`.

Verificar el archivo antes de empezar:

```bash
shasum -a 256 packages/db/prisma/migrations/20261017120000_fotoffice_etapa_1_consultas/migration.sql
```

Si no da el checksum de la tabla de arriba, **parar**: el archivo cambió después de escribir este documento.

## 2. Orden de publicación (sin staging)

1. SQL de esta migración en **FOTOFFICE producción** (proyecto `compramelafoto`, rama
   `development`, `divine-hall-10689679` / `br-old-rain-adwthzng`).
2. Verificar (paso 3 de la sección 4).
3. Recién entonces se fusiona el PR y se publica el código.
4. Abrir Consultas una vez con un usuario del equipo (dispara la siembra y el enganche) y
   correr las verificaciones posteriores.
5. Prueba manual en producción (sección 6).

## 3. En qué base va

| Base | Proyecto / rama Neon | IDs |
|---|---|---|
| FOTOFFICE (producción real) | `compramelafoto` / `development` | `divine-hall-10689679` / `br-old-rain-adwthzng` |

Las otras bases no son urgentes: sólo `apps/fotoffice` lee estas tablas.

## 4. Procedimiento

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20261017120000_fotoffice_etapa_1_consultas';
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
  '249a9c7ba5e4c27f8861f7e4e79f310c8f0c1337e0b5457602e290476049d33c',
  now(),
  '20261017120000_fotoffice_etapa_1_consultas',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261017120000_fotoffice_etapa_1_consultas'
);
COMMIT;
```

### Paso 3 — Verificar (sólo `SELECT`)

Justo después del SQL, las siete tablas existen y están **vacías**:

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN (
  'FotofficeConsulta','FotofficeConsultaCategoria','FotofficeOrigen','FotofficeRolParticipante',
  'FotofficeConsultaParticipante','FotofficeContactoPerfil','FotofficeConsultaAjustes'); -- 7 filas

SELECT count(*) FROM "FotofficeConsulta";          -- 0
SELECT count(*) FROM "FotofficeConsultaCategoria"; -- 0

SELECT count(*) FROM "_prisma_migrations"
 WHERE migration_name='20261017120000_fotoffice_etapa_1_consultas' AND finished_at IS NOT NULL; -- 1

SELECT conname FROM pg_constraint
 WHERE conrelid IN ('"FotofficeConsultaCategoria"'::regclass, '"FotofficeContactoPerfil"'::regclass,
                    '"FotofficeConsulta"'::regclass) AND contype = 'c';
-- 4 filas: FotofficeConsultaCategoria_group, FotofficeContactoPerfil_category,
--          FotofficeConsulta_guests, FotofficeConsulta_estimatedValue
```

**Después de publicar el código y abrir Consultas** (los catálogos y el enganche los hace el
código, no el SQL). Con el id del workspace de DNX:

```sql
SELECT "workspaceId" FROM "FotofficeWorkspaceBranding" WHERE "publicSlug" = 'dnx-estudio';
```

```sql
-- Catálogos de DNX: 21 categorías, 8 orígenes, 16 roles
SELECT
  (SELECT count(*) FROM "FotofficeConsultaCategoria" WHERE "workspaceId" = '<id de DNX>') AS categorias, -- 21
  (SELECT count(*) FROM "FotofficeOrigen"            WHERE "workspaceId" = '<id de DNX>') AS origenes,   -- 8
  (SELECT count(*) FROM "FotofficeRolParticipante"   WHERE "workspaceId" = '<id de DNX>') AS roles;     -- 16

-- Categorías por organización (las demás: una por cada tipo de evento viejo)
SELECT "workspaceId", count(*) FROM "FotofficeConsultaCategoria" GROUP BY 1 ORDER BY 2 DESC;

-- Enganche: consultas con ficha vs. consultas sin ficha (debe tender a 0 sin ficha;
-- se completa de a 50 cada vez que se abre Consultas)
SELECT
  (SELECT count(*) FROM "ServiceSalesLead" WHERE "workspaceId" = '<id de DNX>') AS consultas,
  (SELECT count(*) FROM "FotofficeConsulta" WHERE "workspaceId" = '<id de DNX>') AS con_ficha,
  (SELECT count(*) FROM "ServiceSalesLead" l WHERE l."workspaceId" = '<id de DNX>'
     AND NOT EXISTS (SELECT 1 FROM "FotofficeConsulta" c WHERE c."leadId" = l."id")) AS sin_ficha;

-- Consultas enganchadas a un contacto: ninguna debe quedar sin contacto ni sin categoría
SELECT count(*) AS enganchadas_a_contacto FROM "FotofficeConsulta" c
  JOIN "Client" cl ON cl."id" = c."clientId"
 WHERE c."workspaceId" = '<id de DNX>';
SELECT count(*) AS sin_categoria FROM "FotofficeConsulta"
 WHERE "workspaceId" = '<id de DNX>' AND "categoryId" IS NULL; -- 0

-- Consultas por categoría
SELECT k.name, k."group", count(c.*) FROM "FotofficeConsultaCategoria" k
  LEFT JOIN "FotofficeConsulta" c ON c."categoryId" = k."id"
 WHERE k."workspaceId" = '<id de DNX>' GROUP BY 1, 2 ORDER BY 3 DESC;
```

> Ojo con las horas: las columnas `timestamp` guardan la hora en UTC. Al leerlas, restar 3 horas
> para la hora de Argentina.

## 5. Rollback

**Primero el código, después las tablas.** Si se borran las tablas con el código nuevo
publicado, el formulario público sigue guardando la consulta vieja por el respaldo (ver la
advertencia crítica), pero Consultas deja de funcionar.

1. Revertir el PR (o volver a publicar en Vercel el deploy anterior de FOTOFFICE) y confirmar
   que producción ya sirve la versión anterior.
2. Recién entonces, en orden seguro para las claves foráneas (hijas primero):

```sql
BEGIN;
DROP TABLE "FotofficeConsultaParticipante";
DROP TABLE "FotofficeConsulta";
DROP TABLE "FotofficeContactoPerfil";
DROP TABLE "FotofficeConsultaAjustes";
DROP TABLE "FotofficeRolParticipante";
DROP TABLE "FotofficeOrigen";
DROP TABLE "FotofficeConsultaCategoria";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261017120000_fotoffice_etapa_1_consultas';
COMMIT;
```

Esto borra las fichas de consulta, los perfiles de contacto, los participantes y los catálogos:
no tiene vuelta atrás. **No** se borran las consultas (`ServiceSalesLead`), los clientes
(`Client`) ni los contactos creados por las consultas nuevas: sólo se pierde lo que agregó esta
etapa. Los contactos creados por consultas quedan como clientes comunes.

## 6. Prueba manual en producción (para Daniel, en el PR)

Todo en **DNX Estudio**, con datos de prueba que después se archivan.

1. **Formulario público:** mandar una consulta desde el formulario público de DNX Estudio con un
   correo de Daniel. Debe aparecer en Consultas, **enganchada a un contacto** (si el correo ya
   existía, usa ese contacto; si no, crea uno nuevo como CONTACTO), con su categoría equivalente
   al tipo de evento, y **crear la tarea "Responder consulta" del equipo** (y el aviso por
   correo si está encendido). Con el módulo Consultas apagado no hay ni aviso ni tarea.
   El formulario tiene un **campo trampa** invisible (`fo_hp_x`): si un robot lo llena, ve el
   mismo cartel de éxito pero no se guarda nada (en el log, sólo el código `CAMPO_TRAMPA`).
2. **Nueva consulta a mano (boda):** Consultas → Nueva consulta, categoría de boda, cargar
   **novios**, **lugares** (ceremonia y recepción), invitados y valor estimado, más un
   participante con rol. Poner una **fecha que coincida con otra consulta ya cargada**: debe
   aparecer el **aviso de fecha superpuesta** (no impide guardar). Las altas a mano (nueva y
   rápida) **no mandan el correo de aviso**: la tarea "Responder consulta" se crea sólo si el
   responsable es otra persona; si quien la carga es el responsable, no hay ni correo ni tarea.
3. **Alta rápida:** en el tablero, agregar una consulta con el alta rápida **en la columna del
   circuito predeterminado**: debe caer en la primera etapa del circuito.
4. **Acción en lote:** seleccionar **3 consultas** y **asignar responsable**; las tres deben
   mostrar el nuevo responsable (y cada una, su entrada en el historial). **Pasar a otro
   circuito** deja afuera, con el motivo "tiene tareas obligatorias pendientes", las consultas
   cuya etapa exige tareas y tiene obligatorias sin tildar, salvo para quien puede configurar
   (como "Pasar igual"; el paso queda marcado como forzado).
5. **Totales del tablero:** el total (valor estimado) al pie de cada columna debe coincidir con
   la suma de las tarjetas de esa columna; probar también con el filtro de categoría.
6. **Enganche de las consultas viejas:** abrir Consultas dos o tres veces y correr las
   verificaciones posteriores de la sección 4 hasta que `sin_ficha` llegue a 0. Una consulta que
   falla no traba a las demás: cada vez se engancha hasta el lote (50) intentando como mucho el
   doble, y las que fallan se reintentan la próxima vez.
7. **Limpieza:** archivar las consultas de prueba.

Si en el log de Vercel de FOTOFFICE aparece `[consultas] alta web guardada sin ficha`, la
consulta se guardó por el respaldo: casi seguro falta aplicar el SQL (o falló). La línea
anterior, `[consultas] altaDeConsulta falló`, trae el código (por ejemplo `P2021` = la tabla no
existe). Si el formulario devuelve "No se pudo registrar el lead.", falló también el respaldo
(la base no responde).
