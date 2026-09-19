# Aplicar la migración de Solicitudes y Coberturas

Procedimiento para poner las once tablas del módulo `coverages` en las bases Neon.
Escrito el 2026-09-15, con el estado de cada base verificado ese día.

**El código está en `main`** (PR #112).

> ## Estado al 2026-09-15
>
> - **FOTOFFICE: HECHO.** Aplicada y verificada. Ver la sección 7.
> - **CompraMeLaFoto y Clickatón: pendientes**, solo por higiene del historial.
> - **InfoSpot: no corresponde.** Ver la sección 2.
> - **El módulo sigue apagado en todos los workspaces.** Encenderlo es la sección 4.

Mientras el módulo esté apagado nadie ve nada distinto. Si se enciende en una base donde la
migración no corrió, las pantallas rompen porque van a buscar tablas que no existen.

---

## 1. Qué se aplica

| | |
|---|---|
| Migración | `20260914120000_coberturas` |
| Archivo | `packages/db/prisma/migrations/20260914120000_coberturas/migration.sql` |
| Checksum SHA-256 | `db8a01ded40e99a0f31f4ba35fdb5399a43333c6347d859be5c767526133ddc7` |
| Tamaño | 393 líneas |
| Operaciones | 11 `CREATE TABLE`, 28 `CREATE INDEX`, 22 `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` |
| Destructivas | **Ninguna.** Cero `DROP`, cero `ALTER COLUMN`, cero `ALTER TYPE` |

Ninguna tabla existente cambia de forma. Las once que se crean empiezan todas con
`Coverage`.

Antes de empezar, verificá que el archivo es el que este documento describe:

```bash
shasum -a 256 packages/db/prisma/migrations/20260914120000_coberturas/migration.sql
```

Si el resultado no es el checksum de la tabla de arriba, **parar**: el archivo se editó
después de que se escribió este procedimiento, y el resto del documento deja de valer.

---

## 2. En qué bases va, y en cuál no

Estado verificado el 2026-09-15.

| Base | Proyecto Neon / rama | `Workspace` | `Client` | `Member` | `User` | Estado |
|---|---|---|---|---|---|---|
| **FOTOFFICE + FotoRank** | `divine-hall-10689679` / `br-old-rain-adwthzng` (development) | ✅ | ✅ | ✅ | ✅ | **APLICADA 15.09.2026** |
| **CompraMeLaFoto** | `divine-hall-10689679` / `br-autumn-rain-ad18wq7y` (production) | ✅ | ✅ | ✅ | ✅ | Pendiente |
| **Clickatón** | `bitter-math-56019731` / default | ✅ | ✅ | ✅ | ✅ | Pendiente |
| **InfoSpot** | `wandering-pine-79918137` / default | ✅ | ❌ | ❌ | — | **No corresponde** |

### Por qué InfoSpot no puede

La migración crea claves foráneas hacia `Client` y `Member`, y **esas dos tablas no
existen en InfoSpot**. El `ALTER TABLE … ADD CONSTRAINT` va a fallar.

No es un problema: InfoSpot nunca consulta las tablas de coberturas. La regla de aplicar
todo en las cinco bases existe porque **agregar una columna a una tabla compartida** rompe
las escrituras de las otras apps. Acá no se agrega ninguna columna a ninguna tabla
existente: solo se crean tablas nuevas. Las relaciones que se ven en `schema.prisma` sobre
`Workspace`, `Member`, `Client` y `User` son virtuales de Prisma y no tocan esas tablas.

**Qué hacer con InfoSpot:** nada. No aplicar ni registrar. Anotarlo, para que la próxima
auditoría de migraciones no lo lea como un olvido.

### Prioridad

La única base donde el módulo se va a usar es **FOTOFFICE**, y ya está hecha. Las otras dos
se ponen al día por higiene, para que el historial no divirja más de lo que ya está.

---

## 3. El procedimiento, base por base

Repetir estos cuatro pasos en cada base que falte. **FOTOFFICE ya pasó por acá** el
2026-09-15; quedan CompraMeLaFoto y Clickatón.

Los cuatro pasos se corrieron por el MCP de Neon, que ejecuta con las credenciales del lado
del servidor. Es preferible a bajar un `DATABASE_URL`: la cadena de conexión de producción
nunca queda escrita en ningún lado.

### Paso 1 — Comprobar que no está aplicada

```sql
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'Coverage%') AS tablas_coverage,
  (SELECT count(*) FROM "_prisma_migrations"
    WHERE migration_name = '20260914120000_coberturas') AS ya_registrada;
```

Las dos tienen que dar **0**. Si `tablas_coverage` da 11 y `ya_registrada` da 0, las tablas
están pero falta el registro: saltar al Paso 3. Si las dos dan distinto de cero, esta base
ya está lista.

### Paso 2 — Aplicar el SQL

Ejecutar el contenido completo de `migration.sql`, **en una sola transacción**:

```sql
BEGIN;
-- pegar acá el contenido íntegro de migration.sql
COMMIT;
```

La transacción importa: si algo falla a la mitad, no quedan seis tablas creadas y cinco no.
Postgres soporta DDL transaccional, así que un `ROLLBACK` deja la base exactamente como
estaba.

### Paso 3 — Registrar la migración

Sin esto, `prisma migrate status` va a seguir informándola como pendiente para siempre, y
la próxima persona va a intentar aplicarla de nuevo.

```sql
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT
  gen_random_uuid()::text,
  'db8a01ded40e99a0f31f4ba35fdb5399a43333c6347d859be5c767526133ddc7',
  now(),
  '20260914120000_coberturas',
  NULL, NULL, now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260914120000_coberturas'
);
```

El `WHERE NOT EXISTS` hace que correrlo dos veces no duplique la fila.

El checksum **no se inventa**: es el `shasum -a 256` del archivo, que es exactamente lo que
Prisma guarda. Ya está verificado en el Paso 1 de la sección 1. Un checksum mal puesto hace
que Prisma denuncie la migración como modificada meses después, cuando nadie se acuerde.

> Para una migración que **ya está aplicada en otra base**, el camino más seguro es copiar
> el checksum de ahí en vez de calcularlo:
> `SELECT checksum FROM "_prisma_migrations" WHERE migration_name = '<nombre>';`
> y comprobar que coincide con el `shasum -a 256` del archivo local antes de insertarlo.
> Acá no aplica: esta migración no está en ninguna base todavía, así que el checksum sale
> del archivo, que es exactamente lo mismo que Prisma habría guardado.

### Paso 4 — Verificar

```sql
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'Coverage%') AS tablas,
  (SELECT count(*) FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY' AND table_name LIKE 'Coverage%') AS claves_foraneas,
  (SELECT count(*) FROM "_prisma_migrations"
    WHERE migration_name = '20260914120000_coberturas' AND finished_at IS NOT NULL) AS registrada;
```

Esperado: **11 tablas, 22 claves foráneas, 1 registrada.**

---

## 4. Después: encender el módulo

Recién con las tablas aplicadas en la base de FOTOFFICE.

1. Entrar como super admin a `/admin/workspaces`, abrir el workspace de FOTOPOSITIVA y
   activar **Solicitudes y Coberturas**.
2. El módulo **necesita que Socios esté encendido también**: de ahí salen los colaboradores.
3. Abrir `/coberturas/configuracion` y poner los valores acordados para FOTOPOSITIVA:
   - Participante: `Voluntario/a`
   - Solicitante: `Organización`
   - Modalidad: la mixta (se publica, se postulan, el coordinador confirma)
   - Confirmación del coordinador: encendida
   - Umbral de refuerzo: `180` minutos, recomendando `2` personas
   - A quién avisarle cuando entra un pedido: los correos de la coordinación
4. **El formulario público arranca apagado a propósito.** Encenderlo es una decisión
   aparte: publica una dirección que recibe datos de terceros.

### Variable de entorno a revisar

`COVERAGE_ORIGIN_SALT` — la sal con la que se hashea el origen de los envíos públicos. Si
no está, el sistema usa el id del workspace, que sirve porque es un cuid no público, pero
avisa por consola. Conviene configurarla en Vercel.

Y `NEXT_PUBLIC_APP_URL` tiene que estar: sin ella, el correo de recepción sale **sin el
enlace de seguimiento** y la organización se queda con un código que no abre nada. El
sistema lo avisa por consola, pero es mejor no llegar a eso.

---

## 5. Si hay que volver atrás

La migración es puramente aditiva, así que revertirla es borrar lo que creó. Ninguna tabla
existente se tocó, así que no hay nada que restaurar.

```sql
BEGIN;
DROP TABLE IF EXISTS "CoverageEvent", "CoverageCollaboratorProfile", "CoverageDeliverable",
  "CoverageAssignment", "CoverageApplication", "CoverageCall", "CoverageRole",
  "Coverage", "CoverageConsent", "CoverageRequest", "CoverageSettings" CASCADE;
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260914120000_coberturas';
COMMIT;
```

**Esto borra las solicitudes que hayan entrado.** Si ya hay pedidos reales de
organizaciones, exportarlos antes. Con el módulo recién encendido y sin uso, no hay nada
que perder.

---

## 6. Estado de las bases antes de aplicar

Para que quien lea esto dentro de unos meses sepa contra qué se comparó.

- **FOTOFFICE (development)**: 176 migraciones registradas, la última
  `20260913000000_cash_and_clients`. 159 socios, 3 workspaces. Hay 5 filas sin `finished_at`
  y 5 con `rolled_back_at` — ruido viejo del historial, no bloquea nada.
- **CompraMeLaFoto (production)**: tiene `20260913000000_cash_and_clients` registrada.
- **Clickatón**: 163 migraciones registradas, con `20260913000000_cash_and_clients`.
- **InfoSpot**: sin `Client` ni `Member`. Ver la sección 2.

Un detalle para no confundirse: en `packages/db/prisma/migrations/` hay **dos** directorios
con el mismo prefijo de fecha, `20260914120000_coberturas` y
`20260914120000_subilafoto_orden_por_evento`. Son independientes y las dos aditivas; el
orden lo resuelve el resto del nombre.

---

## 7. Qué pasó al aplicarla en FOTOFFICE

Ejecutada el **2026-09-15** sobre `divine-hall-10689679` / `br-old-rain-adwthzng`, con los
62 statements y el registro **en una sola transacción**. Sin errores.

Resultado de la verificación del Paso 4:

| Control | Esperado | Obtenido |
|---|---|---|
| Tablas `Coverage*` | 11 | **11** |
| Claves foráneas | 22 | **22** |
| Índices | — | 39 (28 de la migración + 11 claves primarias) |
| Fila en `_prisma_migrations` | 1 | **1** |
| Checksum guardado | `db8a01de…` | **coincide con el archivo** |

Y lo que más importaba comprobar, porque es lo que no se puede deshacer si sale mal:

| Dato existente | Antes | Después |
|---|---|---|
| Socios | 159 | **159** |
| Workspaces | 3 | **3** |

Las once tablas quedaron vacías y **el módulo sigue apagado en todos los workspaces**: cero
filas en `WorkspaceFeatureModule` con `moduleKey = 'coverages'`. Nadie vio nada distinto.

### Una decisión que se tomó al ejecutar

El registro en `_prisma_migrations` se metió **dentro de la misma transacción** que el DDL,
en vez de como un paso aparte. Motivo: así es imposible que queden las tablas creadas sin su
registro, que es el estado que después hace que alguien intente aplicarla de nuevo. El
procedimiento de la sección 3 los presenta como pasos separados porque son más fáciles de
seguir así; si los corrés juntos, mejor.
