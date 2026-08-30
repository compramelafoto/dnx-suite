# 12 — ETAPA 06: Base de datos — el bloqueante XL, resuelto y probado

**Fecha:** 2026-08-29
**Rama:** `feat/clf-migracion-monorepo-etapa06`
**Estado:** **P0-02 RESUELTO Y VERIFICADO** sobre copia real de producción
**Producción:** NO se tocó en ningún momento

---

## 1. Qué se descubrió (y no estaba escrito en ningún lado)

### 1.1 Legacy y Monorepo viven en el MISMO proyecto Neon

| | Proyecto Neon | Rama | Tamaño | Tablas |
|--|--|--|--:|--:|
| **Legacy producción** | `compramelafoto` (`divine-hall-10689679`) | `production` (`br-autumn-rain-ad18wq7y`) | 792 MB | **213** |
| **Monorepo dev** | el mismo | `development` (`br-old-rain-adwthzng`) | 73 MB | **416** |

La rama `development` se sacó de `production` el **2026-01-31** y desde entonces divergieron:
- ganó ~240 tablas de la suite (FotOffice, FotoRank, Clickatón, InfoSpot, partners…)
- **nunca recibió** las tablas escolares que producción incorporó en abril de 2026

Consecuencia: **el módulo escolar del monorepo nunca corrió contra datos reales.**

### 1.2 El choque `Student` es real y estaba a punto de destruir datos

| | Tabla física `Student` |
|--|--|
| **Producción** | 12 columnas, `id` entero, `schoolId` — **188 alumnos reales**, 24 escuelas |
| **Monorepo dev** | 6 columnas, `id` texto, `workspaceId` — **0 filas** (evaluaciones FotOffice) |

El `prisma migrate diff` de producción contra el esquema del monorepo generaba:

```sql
ALTER TABLE "Student" DROP CONSTRAINT "Student_pkey",
DROP COLUMN "dni", DROP COLUMN "externalStudentId", DROP COLUMN "firstName",
DROP COLUMN "isActive", DROP COLUMN "lastName", DROP COLUMN "normalizedFullName",
DROP COLUMN "normalizedKey", DROP COLUMN "schoolId", DROP COLUMN "sourceType",
DROP COLUMN "updatedAt",
...
ALTER COLUMN "id" SET DATA TYPE TEXT;
```

**Eso borraba los 188 alumnos.**

### 1.3 El `Student` de FotOffice es código muerto

- `prisma.student` se usa **0 veces** en todo el monorepo
- Las pantallas de `/evaluaciones` funcionan con datos falsos (`MockStudent`)
- `Student`, `EvaluationResult` y `EvaluationContextStudent`: **0 filas** las tres
- En producción esas tablas **ni existen**

---

## 2. La solución: 6 líneas de esquema

El bloqueante catalogado **XL** (ventana de mantenimiento, backup, rename en producción)
se resolvió sin migrar un solo dato.

| # | Línea | Antes | Después |
|--|--:|--|--|
| 1 | 2921 | `@@map("SchoolStudent")` | `@@map("Student")` |
| 2 | 6850 | `students Student[]` | `students EvaluationStudent[]` |
| 3 | 7732 | `model Student {` | `model EvaluationStudent {` |
| 4 | 7753 | `student Student @relation` | `student EvaluationStudent @relation` |
| 5 | 7819 | `student Student @relation` | `student EvaluationStudent @relation` |
| 6 | enum | `PhotoExifMetadataStatus` | `+ SKIPPED_SAMPLING` |

El código de la app **no cambia**: sigue usando `prisma.schoolStudent`.
Sólo cambia a qué tabla física apunta ese modelo.

### 2.1 El enum divergente

Comparación sistemática de los **479** valores de enum de legacy contra el monorepo:
**una sola divergencia**.

`PhotoExifMetadataStatus.SKIPPED_SAMPLING` existe en legacy y faltaba en el monorepo —
una función que legacy ganó después del import y nunca volvió. Síntoma del trabajo duplicado.

---

## 3. Verificación sobre copia real de producción

**Método:** rama Neon `migracion-monorepo-prueba2` (`br-morning-sea-ad2u3ss7`),
copia instantánea de `production`. Producción nunca se tocó.

### 3.1 Resultado del diff, antes y después

| | Antes de los 6 cambios | Después |
|--|--:|--:|
| Líneas de SQL | 10.089 | 9.994 |
| `DROP COLUMN` sobre `Student` | **10** | **0** |
| Operaciones sobre `Student` | destructivas | **ninguna** |

### 3.2 Arreglo de datos necesario (blog multi-plataforma)

El monorepo agrega `platform` (obligatoria) a 5 tablas de blog que ya tienen filas.
Se resuelve poblando las filas existentes:

```sql
ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'compramelafoto'
```

Correcto por definición: todo el contenido de blog en producción CLF **es** de CompraMeLaFoto.
Afecta a `BlogAuthor`, `BlogCategory`, `BlogMedia`, `BlogPost`, `BlogTag`.

### 3.3 Migración aplicada — `Script executed successfully`

| Dato | Antes | Después | |
|--|--:|--:|--|
| Tablas | 213 | **453** | +240 de la suite |
| Alumnos escolares | 188 | **188** | intactos |
| Escuelas | 24 | **24** | intactas |
| Usuarios | 751 | **751** | intactos |
| Fotos | 240.110 | **240.110** | intactas |
| Álbumes | 854 | **854** | intactos |
| Órdenes | 2.784 | **2.784** | intactas |
| Posts de blog | 61 | **61** (todos `compramelafoto`) | etiquetados |
| `EvaluationStudent` | no existía | creada, vacía | |

### 3.4 Lectura real desde el cliente Prisma del monorepo

```
prisma.schoolStudent.count() -> 188
alumno + escuela          -> Juan Pérez | Instituto Parroquial Monte Cristo
prisma.album.count()      -> 854
prisma.order.count()      -> 2784
prisma.user.count()       -> 751
blogPost platform=clf     -> 61
evaluationStudent.count() -> 0
```

**El monorepo lee los datos de producción, con relaciones, sin tocarlos.**

---

## 4. Pendientes que este trabajo dejó identificados

### 4.1 Historial de migraciones (P0-03) — en curso

Los historiales están **completamente separados**:

| | Cantidad |
|--|--:|
| Migraciones aplicadas en producción | 201 (10 revertidas) |
| Carpetas de migración en el monorepo | 158 |
| **En común** | **1** (baseline) |

`prisma migrate status` contra la copia migrada reporta las 158 como pendientes,
aunque el esquema ya está en destino. La salida es hacer *baseline*:
marcar las 158 como aplicadas con `prisma migrate resolve --applied`.

### 4.2 Destrucciones restantes — todas inocuas

| Operación | Filas en producción | Veredicto |
|--|--:|--|
| `DROP TABLE "DnxPartnerBenefitSyncRun"` | 0 | inocuo |
| `DnxPartnerBenefitAccess` pierde 8 columnas | 0 | inocuo |
| `DROP TYPE "DnxPartnerBenefitAccessSource"` | — | inocuo |
| `DROP TABLE "CronLease"` | **2** | **ver 4.3** |

### 4.3 `CronLease` no se migró — regresión detectada

`CronLease` es el candado que evita que dos ejecuciones del mismo cron se pisen.

| | Legacy | Monorepo |
|--|--|--|
| Modelo Prisma | `model CronLease` (línea 2137) | **ausente** |
| Código | `lib/cron-advisory-lock.ts`, `lib/analysis/collect-pipeline-health.ts` | **ausente** |

Es la misma familia que las 14 APIs rotas: algo que existe en producción y no se portó.
Va junto con `/api/cron/analysis-health` en la etapa de cierre de huecos.

### 4.4 Desalineación de versiones de Prisma

| | Versión |
|--|--|
| `packages/db` declara | `prisma ^6.9.0` → instalada **6.19.2** |
| `@prisma/client` resuelto | **7.8.0** |
| `npx prisma` en la raíz | **7.8.0** |

Prisma 7 **rechaza** el esquema actual (`url` y `directUrl` ya no van en el schema;
deben moverse a `prisma.config.ts`). Hoy funciona porque el CLI 6.19.2 de `packages/db`
es el que corre. Conviene alinear antes del cutover para evitar sorpresas en el build.

---

## 5. Cómo reproducir

```bash
# 1. Generar la migración contra la copia y aplicar el arreglo del blog
prisma migrate diff --from-url "$COPIA" \
  --to-schema-datamodel packages/db/prisma/schema.prisma --script > m.sql
sed -i '' "s/ADD COLUMN     \"platform\" TEXT NOT NULL/& DEFAULT 'compramelafoto'/g" m.sql

# 2. Aplicar (corre en transacción: si falla, revierte solo)
prisma db execute --url "$COPIA" --file m.sql
```

**Nota operativa:** `prisma db execute` ejecuta el archivo en una transacción.
Cada intento fallido deja la copia limpia, así que se puede iterar sobre la misma rama.

---

## 6. Estado del bloqueante

| ID | Antes | Ahora |
|--|--|--|
| **P0-02** — rename `Student` → `SchoolStudent` | Abierto, complejidad **XL** | **RESUELTO** — 6 líneas, verificado con datos reales |
| **P0-03** — historial de migraciones | Abierto, complejidad **XL** | Acotado: baseline de 158 migraciones |
| **P0-05** — workers Docker | Abierto, complejidad **L** | **ANULADO** — nunca funcionaron en legacy |

---

## 7. Hallazgo de prueba real (2026-08-30): `UserSession` bloquea el login en producción

**Síntoma reportado:** al entrar con Google, el sitio vuelve a la pantalla de login en vez de ir al panel.

### Causa

El login del monorepo persiste la sesión en la tabla **`UserSession`** (`packages/auth/src/sessions.ts`:
`prisma.userSession.create` al entrar, `findUnique` en cada request posterior).

| | `UserSession` |
|--|--|
| Esquema legacy | **no existe** — legacy usa sólo la cookie `auth-token`, sin tabla |
| Producción (`br-autumn-rain`) | **no existe** |
| Esquema monorepo | existe (línea 5140) |
| Copia migrada (`br-morning-sea`) | existe, 0 filas |

El sitio desplegado seguía apuntando a producción: **las variables de entorno de Vercel se
aplican al desplegar**, y el último deploy es anterior al cambio de `DATABASE_URL`.

Secuencia: Google autentica → la app intenta crear la fila en `UserSession` → la tabla no existe →
no hay sesión → el guard rebota al login. Consistente con **0 sesiones** en ambas ramas.

### Consecuencia para el cutover

**Bloqueante duro.** Mientras producción no reciba la migración, **nadie puede iniciar sesión**
en el monorepo. No es un problema de cookies, de dominio ni de `AUTH_SECRET`.

Esto no era visible en la auditoría de julio porque el cierre de auth (ETAPA 03) se validó
a nivel de código, no contra el esquema físico de producción.

### Salida

1. **Ahora, para probar:** redesplegar para que tome la copia migrada (ya tiene la tabla).
2. **En el cutover:** la migración a producción debe aplicarse **antes** de dirigir tráfico.
   `UserSession` viene incluida entre las ~240 tablas que crea el script ya verificado (§3.3).

### Nota operativa

Un cambio de variable en Vercel **no afecta al deploy en curso**. Verificar siempre con un
deploy nuevo antes de concluir que una variable "no funcionó".
