# ADR 0001 — Prisma unificado: merge CLF legacy → `packages/db`

| Metadato | Valor |
|----------|-------|
| **Estado** | Aceptado (decisión documentada; no implementado) |
| **Fecha** | 2026-07-04 |
| **Autores** | Equipo migración DNX Suite |
| **Base** | [`03-prisma-diff.md`](../migration/03-prisma-diff.md), [`prisma-migration-plan.md`](../migration/prisma-migration-plan.md) |

---

## Contexto

ComprameLaFoto en producción vive en `/Users/danielcuart/Desktop/compramelafoto` con **186 modelos**, **169 migraciones** y schema de **5 387 líneas**. El monorepo centraliza persistencia en `packages/db` (**162 modelos**, **19 migraciones**), compartido con FotoOffice y FotoRank.

El diff identificó:

- **82 modelos** solo en legacy (prod CLF).
- **58 modelos** solo en monorepo (suite).
- **24 modelos compartidos** con divergencia estructural.
- **5 enums compartidos** con valores distintos.
- **0 carpetas de migración** con el mismo nombre entre ambos historiales.

Sin decisiones explícitas, un merge silencioso rompería producción CLF (campos faltantes, enums truncados, colisión de nombres) o bloquearía FotoOffice (evaluaciones, workspaces, members).

**Principio rector:** la DB de producción CLF es fuente de verdad para datos y columnas CLF; el monorepo es fuente de verdad para tablas suite que legacy no tiene. Las colisiones se resuelven por rename o unión explícita — nunca por overwrite.

---

## Decisiones

### D1 — `Student` → renombrar CLF a `SchoolStudent`

**Decisión:** El modelo legacy `Student` (alumno escolar, PK `Int`, `schoolId`) se renombra a **`SchoolStudent`** en el schema unificado. El modelo **`Student`** del monorepo (evaluaciones FotoOffice, PK `String` cuid, `workspaceId`) **se mantiene sin cambios**.

| | Legacy CLF (→ `SchoolStudent`) | FotoOffice (→ `Student`) |
|---|-------------------------------|--------------------------|
| PK | `Int @id @default(autoincrement())` | `String @id @default(cuid())` |
| Scope | `schoolId` → `School` | `workspaceId` → `Workspace` |
| Relaciones clave | `StudentEnrollment`, `AlbumStudentRosterEntry`, `PreCompraOrder`, `StudentRosterImportRow` | `EvaluationContextStudent`, `EvaluationResult` |

**Impacto en código (post-import legacy):**

- Todas las referencias Prisma `prisma.student` en dominio escolar → `prisma.schoolStudent`.
- FKs `studentId` en tablas escolares → `schoolStudentId` (o mantener nombre columna `studentId` apuntando a `SchoolStudent` — preferir **renombrar columna** para claridad en schema nuevo).
- APIs y UI de roster, precompra, importación XLSX.

**Migración SQL necesaria (prod CLF, antes o junto con gap migration):**

```sql
-- Orden: solo en DB donde existe tabla legacy Student escolar y NO existe tabla evaluaciones Student
ALTER TABLE "Student" RENAME TO "SchoolStudent";

-- Renombrar FKs según inventario (ejemplos; lista completa en implementación):
-- ALTER TABLE "StudentEnrollment" RENAME COLUMN "studentId" TO "schoolStudentId";
-- ALTER TABLE "PreCompraOrder" RENAME COLUMN "studentId" TO "schoolStudentId";
```

**Orden de aplicación:**

1. Si prod CLF **no** tiene tabla `Student` de evaluaciones: rename tabla + FKs, luego aplicar migraciones FotoOffice que crean `Student` (evaluaciones).
2. Si branch dev **ya** tiene ambas tablas con mismo nombre: **imposible** sin restore — requiere branch limpio o rename manual previo documentado.

**Alternativa descartada:** unificar en un solo `Student` polimórfico — rechazada por complejidad y riesgo de datos.

---

### D2 — `Role`: unión completa; agregar `SCHOOL_ORGANIZER`; no eliminar valores

**Decisión:** El enum `Role` unificado contiene **todos** los valores de legacy **y** todos los de suite. Se **agrega** `SCHOOL_ORGANIZER` al monorepo si falta. **No se elimina** ningún valor existente en ningún entorno.

**Valores canónicos del enum unificado:**

```
ADMIN
PHOTOGRAPHER
LAB
CUSTOMER
LAB_PHOTOGRAPHER
ORGANIZER
SCHOOL_ORGANIZER          ← legacy CLF (obligatorio)
SUPER_ADMIN               ← suite
WORKSPACE_ADMIN           ← suite
STAFF                     ← suite
TEACHER_MANAGER           ← suite
COURSE_MANAGER            ← suite
```

**Migración:** solo `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '...'` por valor faltante en cada DB. PostgreSQL no permite eliminar valores de enum en uso — coherente con la decisión.

**Impacto:**

- `@repo/auth` / `@repo/auth-guards`: mapeo de `globalRole` y `User.role` debe reconocer `SCHOOL_ORGANIZER`.
- Código FotoOffice que asume solo roles workspace: sin cambio de valores existentes.
- Seeds y tests: actualizar fixtures si usan subset incompleto.

---

### D3 — `ExportJobStatus`: canónico `SUCCEEDED`; deprecar `COMPLETED`

**Decisión:** El valor canónico para job completado exitosamente es **`SUCCEEDED`** (legacy CLF, producción). El valor **`COMPLETED`** del monorepo se **elimina del enum unificado** tras migración de datos.

**Enum unificado:**

```
PENDING
PROCESSING
SUCCEEDED    ← canónico (ex-COMPLETED en mono)
FAILED
```

**Migración de datos (solo en DBs que aplicaron schema mono con COMPLETED):**

```sql
-- Si existiera filas con COMPLETED (dev/staging mono)
UPDATE "DesignExportJob" SET status = 'SUCCEEDED' WHERE status = 'COMPLETED';
UPDATE "DesignPreviewJob" SET status = 'SUCCEEDED' WHERE status = 'COMPLETED';
-- Luego recrear enum o usar migración Prisma que reemplace valores
```

**Período de alias en aplicación (opcional, 1 release):**

```typescript
// Helper temporal en lib de diseño — eliminar tras cutover
const EXPORT_DONE = new Set(['SUCCEEDED', 'COMPLETED']);
function isExportDone(status: string) { return EXPORT_DONE.has(status); }
```

**Justificación:** el código y crons legacy referencian `SUCCEEDED`; cambiar prod a `COMPLETED` implica más superficie que alinear mono hacia legacy.

**Alcance:** `ExportJobStatus` en `DesignExportJob`. `DesignPreviewJob` usa enum distinto (`PreviewJobStatus` / `DesignPreviewJobStatus`) — ver D5.

---

### D4 — `PreCompraOrderItemStatus`: mantener fulfillment escolar legacy; unión con mono

**Decisión:** El enum unificado es la **unión** de valores legacy y mono. Los estados de fulfillment escolar legacy **no se eliminan**. Los valores mono existentes **se mantienen**.

**Valores canónicos (orden lógico de flujo):**

```
WAITING_SELFIE
WAITING_UPLOAD
APPROVED_BY_MATCH
WAITING_SELECTION
READY_TO_DESIGN
DESIGN_SUBMITTED
NEEDS_CHANGES
APPROVED
EXPORTED
PHYSICAL_IN_PROGRESS    ← legacy escolar (obligatorio)
AT_SCHOOL               ← legacy escolar (obligatorio)
DELIVERED               ← legacy escolar (obligatorio)
```

**Migración:** `ALTER TYPE "PreCompraOrderItemStatus" ADD VALUE` para los tres valores faltantes en monorepo. Sin `UPDATE` de datos existentes.

**Impacto:** dashboards fotógrafo, operaciones escuela, crons de diseño — cualquier `switch`/`enum` en mono debe incluir los tres estados antes de deploy CLF.

---

### D5 — `DesignExportJob` / `DesignPreviewJob`: mantener PK `Int` legacy

**Decisión:** Se **mantiene** el diseño legacy para ambos modelos:

| Campo | Decisión |
|-------|----------|
| `id` | `Int @id @default(autoincrement())` — **no** `cuid()` del monorepo |
| Campos legacy | Conservar `attempts`, `lastError`, `lockedAt`, `updatedAt` |
| Campos mono añadidos | Incorporar `completedAt`, `error`, `startedAt`, `targetVersion` como **columnas adicionales nullable** si aportan observabilidad — no reemplazan legacy |

**`DesignPreviewJob.status`:** unificar tipo en enum legacy `PreviewJobStatus` si existe en prod; si mono introdujo `DesignPreviewJobStatus`, **mapear al enum legacy** en schema unificado y migrar valores mono → legacy equivalentes.

**Impacto:**

- Revertir en `packages/db` el cambio conceptual de PK `String` antes de merge.
- Jobs en cola en prod conservan IDs enteros — sin remapeo masivo.
- Código mono que asume `id: string` en evaluaciones de diseño: actualizar a `number` en paths CLF.

**Alternativa descartada:** adoptar `cuid` en prod — requiere migración de PK + todas las FKs; riesgo CRITICAL sin beneficio claro.

---

### D6 — `Album`, `Order`, `Photo`, `PreCompraOrder`: legacy es fuente de verdad

**Decisión:** Para estos cuatro modelos (y relaciones directas documentadas en el diff), el schema unificado en `packages/db` debe ser **`legacy ∪ mono`**: todos los campos y relaciones presentes en legacy prod **más** los campos mono que no entren en conflicto.

**Reglas de merge de campos:**

| Regla | Aplicación |
|-------|------------|
| Campo solo en legacy | **Añadir** a `packages/db` |
| Campo solo en mono | **Añadir** si no contradice semántica legacy |
| Mismo nombre, distinto tipo | **Gana legacy**; revisar manual si mono tiene datos |
| Mismo nombre, distinto `@default` | **Gana legacy** para CLF (`AppConfig.downloadLinkDays` → default `15` en prod) |
| Relaciones solo legacy | Añadir con modelos hijos del gap (82 modelos) |

**Resumen de gap a incorporar en `packages/db` (conteos del diff):**

| Modelo | Campos/relaciones solo legacy (aprox.) |
|--------|----------------------------------------|
| `Album` | 37 |
| `Photo` | 21 |
| `Order` | 15 |
| `PreCompraOrder` | 14 |
| `OrderItem` | 5 (mismo bloque Order) |
| `PreCompraOrderItem` | 3 + revisar optional `albumProductId` → **mantener optional como legacy** |

**Modelos relacionados en la misma decisión:** `Event`, `School`, `User` (union de relaciones), `AlbumPack` — misma política legacy-first para columnas CLF.

**No hacer:** reducir el schema mono eliminando columnas legacy “por limpieza”.

---

### D7 — Estrategia de migraciones

**Decisión:**

| # | Regla |
|---|-------|
| D7.1 | **No replay** de las **169** migraciones legacy sobre una DB que ya aplicó las **19** del monorepo. |
| D7.2 | **Mantener** las 19 migraciones monorepo ya aplicadas en entornos que las tienen (FotoOffice, FotoRank, members, evaluaciones, `init_baseline`). |
| D7.3 | **Archivar** copia de 169 legacy en `packages/db/prisma/migrations/_archive/legacy/` — referencia histórica, no deploy. |
| D7.4 | **Crear migraciones forward** que condensen el gap legacy, **por dominios** (recomendado) o en una sola SQL si el equipo prefiere simplicidad operativa. |
| D7.5 | **Descartar como forward** las 3 migraciones mono de album packs / album mode; su contenido queda **absorbido** por el gap legacy (son subset). |
| D7.6 | Orden forward propuesto tras las 19 existentes — ver tabla abajo. |

**Migraciones mono a descartar en historial forward (contenido absorbido por gap legacy):**

- `20260502170000_add_album_pack_entity`
- `20260502173500_add_album_pack_enums_and_constraints`
- `20260502201000_add_album_mode`

> En DBs que **solo** aplicaron estas tres sin el resto del gap legacy: la migración forward `clf_gap` debe ser idempotente (`IF NOT EXISTS`).

**Migraciones forward propuestas (por dominio):**

| Orden | Nombre sugerido | Contenido |
|------:|-----------------|-----------|
| 1 | `20260704100000_clf_rename_student_to_school_student` | D1 — solo prod CLF |
| 2 | `20260704110000_clf_gap_core_school_roster` | AcademicYear, roster, SchoolOrganizer*, StudentEnrollment*, etc. |
| 3 | `20260704120000_clf_gap_album_packs_preventa` | AlbumPack*, Pack*, Benefit*, TemplateV2* |
| 4 | `20260704130000_clf_gap_catalog_camera_media` | Catalog*, Camera*, Video*, AlbumFolder |
| 5 | `20260704140000_clf_gap_cuantocobro_blog_leads` | CuantoCobro*, Blog*, leads |
| 6 | `20260704150000_clf_gap_organizer_exif_gear` | Organizer*, EventFolder*, PhotoExif*, Photographic* |
| 7 | `20260704160000_clf_align_shared_models` | D6 — ALTER TABLE Album, Order, Photo, PreCompraOrder, User, Event, School |
| 8 | `20260704170000_clf_align_enums` | D2, D3, D4 — Role, ExportJobStatus, PreCompraOrderItemStatus |
| 9 | `20260704180000_clf_verify_indexes_constraints` | Índices y FKs faltantes post-merge |

**Alternativa aceptable:** fusionar 2–6 en una sola `20260704110000_clf_gap_all_tables.sql` si el equipo prioriza un solo PR de SQL.

---

## Consecuencias

### Positivas

- Un solo `packages/db` sirve CLF + FotoOffice + FotoRank sin segunda base de datos.
- Colisiones CRITICAL resueltas antes de escribir schema — reduce rework.
- Prod CLF conserva tipos, enums y PKs probados en millones de filas.
- Historial de migraciones legible: 19 mono + ~9 forward CLF en lugar de 169 + 19 en conflicto.

### Negativas / coste

- Rename `Student` → `SchoolStudent` obliga refactor en todo el código legacy importado (alto volumen en roster/precompra).
- Período dual en helpers (`COMPLETED` alias) si staging mono ya usa valores distintos.
- Schema unificado estimado ~240 modelos — `prisma generate` y tiempos de migrate deploy mayores.
- Equipo debe mantener disciplina: **no** añadir modelos CLF fuera de `packages/db` tras cutover.

### Neutral

- Workers (`camera-ingest-worker`, etc.) dejarán de copiar schema local; dependerán de `@repo/db` post-merge.
- Versión Prisma: alinear `^6.19.1` (legacy) antes de implementar.

---

## Riesgos

| ID | Riesgo | Mitigación |
|----|--------|------------|
| R1 | Rename `Student` en DB que ya tiene tabla evaluaciones | Validar con `SELECT` / `information_schema` antes de D1; usar branch Neon dedicado |
| R2 | `ALTER TYPE Role ADD VALUE` en transacción larga | Ejecutar en ventana de bajo tráfico; valores idempotentes |
| R3 | Gap migration incompleta — falta tabla de prod | Checklist contra lista de 82 modelos del diff |
| R4 | FotoOffice deploy con enum `Role` incompleto | CI check: schema debe listar todos los valores D2 |
| R5 | Datos `COMPLETED` en staging mono | Script D3 antes de deploy |
| R6 | `albumProductId` NOT NULL en mono rompe precompra legacy | D6: restaurar optional como legacy |
| R7 | Migración forward no idempotente en DB parcial | SQL con `IF NOT EXISTS` / guards |
| R8 | Rollback solo vía `pg_dump` | Backup obligatorio pre-migrate prod |

---

## Checklist — antes de tocar `schema.prisma`

- [ ] ADR 0001 revisado y aceptado por responsable CLF + FotoOffice
- [ ] Tag git legacy prod: `6e6fd6d4` (o HEAD actual) documentado
- [ ] Branch Neon `migration/clf-unify` creado
- [ ] `pg_dump --schema-only` y dump datos críticos de prod CLF
- [ ] Inventario: ¿prod CLF tiene tabla `Student` de evaluaciones? (define orden D1)
- [ ] Inventario: ¿staging mono tiene filas `DesignExportJob` con `COMPLETED`?
- [ ] Lista de 82 modelos solo-legacy impresa / automatizada para verificación post-gap
- [ ] Lista de 24 modelos shared modificados asignada a reviewer
- [ ] Versión Prisma acordada (`6.19.x`) en `packages/db`
- [ ] Plan de ventana de mantenimiento prod comunicado
- [ ] Rollback documentado: restore dump, no `migrate reset`

---

## Checklist — después de tocar `schema.prisma` y migraciones

- [ ] `prisma validate` pasa en `packages/db`
- [ ] `prisma generate` — client compila sin errores TypeScript en apps dependientes
- [ ] `migrate deploy` exitoso en branch Neon **vacío** (smoke desde cero)
- [ ] `migrate deploy` exitoso en restore **snapshot prod CLF** + forward migrations
- [ ] Conteo tablas: ≥ legacy prod + tablas suite mono
- [ ] D1: tabla `SchoolStudent` existe; `Student` es evaluaciones (cuid) o pendiente según entorno
- [ ] D2: `SCHOOL_ORGANIZER` presente en enum `Role`
- [ ] D3: ninguna fila `ExportJobStatus = COMPLETED` en jobs diseño
- [ ] D4: tres estados escolares en `PreCompraOrderItemStatus`
- [ ] D5: `DesignExportJob.id` es `integer` en DB
- [ ] D6: columnas críticas `Album`/`Photo`/`Order`/`PreCompraOrder` presentes (script diff columnas)
- [ ] D7: `_archive/legacy` poblado; 169 migraciones no en carpeta deploy activa
- [ ] FotoOffice smoke: login, evaluaciones, members
- [ ] FotoRank smoke: concurso, jurados
- [ ] CLF smoke: login fotógrafo, álbum, upload, checkout test, webhook MP test
- [ ] Workers camera-ingest / video-worker conectan a `@repo/db`
- [ ] Documentar en [`03-prisma-diff.md`](../migration/03-prisma-diff.md) enlace a este ADR como resolución de CRITICAL

---

## Referencias

- [`../migration/03-prisma-diff.md`](../migration/03-prisma-diff.md) — diff técnico
- [`../migration/prisma-migration-plan.md`](../migration/prisma-migration-plan.md) — plan operativo
- [`../migration/02-legacy-inventory.md`](../migration/02-legacy-inventory.md) — inventario legacy
- [`../migration/01-current-state.md`](../migration/01-current-state.md) — WIP monorepo

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-07-04 | Creación ADR 0001 — decisiones D1–D7 aceptadas en documentación |
