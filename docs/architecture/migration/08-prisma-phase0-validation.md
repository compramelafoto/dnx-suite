# 08 — Validación Fase 0 Prisma (colisiones D1–D5 + dominio 3 roster)

**Fecha:** 2026-07-04  
**Archivo validado:** `packages/db/prisma/schema.prisma`  
**Reporte previo:** [`07-prisma-phase1-report.md`](./07-prisma-phase1-report.md)  
**ADR / plan:** [`0001`](../decisions/0001-prisma-unificado-clf-legacy.md), [`06`](./06-prisma-merge-execution-plan.md)

**Restricciones respetadas:**

- ✅ Sin migraciones nuevas
- ✅ Sin `migrate`, `db push`, `db pull`, `generate`
- ✅ Sin cambios en `apps/*`
- ✅ Sin modificación del schema (no se detectaron errores críticos)

---

## Veredicto

| Pregunta | Resultado |
|----------|-----------|
| ¿Schema estructuralmente válido? | **Sí** |
| ¿Errores críticos de sintaxis/relaciones? | **Ninguno** |
| ¿Seguro avanzar al dominio 4 (schema)? | **Sí**, con warnings documentados abajo |

La Fase 0 cumple su objetivo a nivel **schema Prisma**. Los warnings principales son **drift schema ↔ migraciones existentes** y **campos legacy aún no mergeados** en modelos compartidos — esperado hasta las fases 4–8 y hasta generar migraciones forward.

---

## 1. Validaciones ejecutadas

| # | Comando / método | Propósito | Resultado |
|---|------------------|-----------|-----------|
| 1 | `npx prisma validate` (`packages/db`) | Validación oficial Prisma (tipos, relaciones, enums) sin tocar DB | ✅ `The schema is valid` |
| 2 | `npx prisma format --check` | Formato / parseo del archivo | ✅ `All files are formatted correctly!` |
| 3 | `rg "^model"` + `uniq -d` | Modelos duplicados | ✅ 171 modelos, 0 duplicados |
| 4 | `rg "^enum"` + `uniq -d` | Enums duplicados | ✅ 111 enums, 0 duplicados |
| 5 | Script Python: relaciones `@relation("…")` nombradas | Pares bilaterales | ✅ 0 relaciones huérfanas |
| 6 | Comparación campo a campo legacy ↔ merged | Paridad dominio 3 (9 entidades) | ✅ OK en todos |
| 7 | Revisión manual `git diff` | Cambios Fase 0 vs HEAD | ✅ Coherente con ADR y plan 06 |
| 8 | Búsqueda en monorepo | Referencias rotas a enums eliminados | ✅ Solo en `_archive` stale |

**No ejecutado (explícitamente prohibido):** `prisma generate`, `migrate`, `db push`, `db pull`.

---

## 2. Revisión manual del diff

**Estadísticas git:** `+816 / −88` líneas en `packages/db/prisma/schema.prisma`.

### Cambios alineados con Fase 0

- **D1:** `SchoolStudent` nuevo; `Student` (evaluaciones, `String` cuid) sin cambios.
- **D2:** `Role.SCHOOL_ORGANIZER`.
- **D3:** `PreviewJobStatus` con `SUCCEEDED`; `DesignPreviewJobStatus` eliminado; `ExportJobStatus.SUCCEEDED`.
- **D4:** tres estados en `PreCompraOrderItemStatus`.
- **D5:** `DesignPreviewJob` / `DesignExportJob` reescritos (PK `Int`, campos legacy + mono nullable).
- **Dominio 3:** 9 modelos roster, 8 enums, merges parciales en `School`, `Album`, `User`, `PreCompraOrder`.
- Marcadores `// BEGIN LEGACY MERGE` / `// END LEGACY MERGE` presentes en bloques incorporados.

### Nota sobre el diff completo

El diff contra git puede incluir cambios **anteriores** al monorepo (p. ej. modelos FotoOffice `Member*`, `AlbumPack`) si ya estaban en working tree. La validación Fase 0 se centra en los bloques roster + colisiones D1–D5; esos bloques son internamente consistentes.

---

## 3. Revisión específica por entidad

### `SchoolStudent` (D1)

| Aspecto | Estado |
|---------|--------|
| PK `Int` autoincrement | ✅ |
| FK `schoolId` → `School` | ✅ |
| Relaciones inversas (`enrollments`, `albumRosterEntries`, `preCompraOrders`, `importRowsMatched`) | ✅ |
| Paridad campos vs legacy `Student` | ✅ |
| `@@unique([schoolId, externalStudentId])` | ✅ (múltiples `NULL` permitidos en PG) |

### `Student` (evaluaciones FotoOffice)

| Aspecto | Estado |
|---------|--------|
| PK `String @default(cuid())` | ✅ sin cambios |
| `workspaceId` → `Workspace` | ✅ |
| Sin relación con entidades escolares | ✅ |
| Coexistencia con `SchoolStudent` | ✅ sin colisión de nombre de modelo |

### `School`

| Aspecto | Estado |
|---------|--------|
| `logoUrl` + relaciones roster | ✅ |
| `students` → `SchoolStudent[]` (no `Student`) | ✅ |
| `organizerCommissions` (legacy) | ⚠️ pendiente dominio 9 |

### `Album`

| Aspecto | Estado |
|---------|--------|
| `academicYearId`, `studentIdentificationMode`, `allowManualStudentFallback` | ✅ |
| `academicYear` + índice | ✅ |
| `studentRosterEntries`, `studentRosterImportBatches` | ✅ |
| Campos legacy dominios 4–9 (`selectedCourseKeys`, comisiones, cámara, etc.) | ⚠️ pendiente (esperado) |

### `PreCompraOrder`

| Aspecto | Estado |
|---------|--------|
| Campos roster (`studentId`, snapshots, `isTest`, …) | ✅ |
| `student` → `SchoolStudent?` | ✅ |
| `albumRosterEntry`, `photosTakenBy` | ✅ |
| Índices legacy | ✅ |
| `buyerUserId` sin relación explícita a `User` | ⚠️ preexistente mono (no introducido en Fase 0) |

### `DesignPreviewJob` / `DesignExportJob` (D5)

| Aspecto | Estado |
|---------|--------|
| PK `Int` | ✅ schema válido |
| `status` → `PreviewJobStatus` / `ExportJobStatus` | ✅ |
| FKs a `DesignRevision` / `DesignProject` | ✅ |
| Back-relations en `DesignRevision` (`previewJobs`, `exportJobs`) | ✅ |
| `@@unique([designRevisionId, status])` | ✅ (paridad legacy; ver warning semántico) |
| Drift vs `init_baseline` migration (PK `TEXT`, enum viejo) | ⚠️ ver §5 |

### Enums colisión

| Enum | Estado |
|------|--------|
| `Role` + `SCHOOL_ORGANIZER` | ✅ |
| `ExportJobStatus` → `SUCCEEDED` (sin `COMPLETED`) | ✅ en schema |
| `PreviewJobStatus` reemplaza `DesignPreviewJobStatus` | ✅ |
| `PreCompraOrderItemStatus` + fulfillment escolar | ✅ |

---

## 4. Errores encontrados

**Ninguno.** Prisma validate exitoso; sin modelos/enums duplicados; sin referencias a tipos inexistentes; relaciones nombradas bilaterales.

---

## 5. Warnings

### W1 — Drift schema ↔ migraciones mono existentes (ALTO, esperado)

`packages/db/prisma/migrations/20260422085720_init_baseline/migration.sql` define:

- `DesignPreviewJob.id` → `TEXT` (cuid mono)
- `DesignPreviewJobStatus` con valor `COMPLETED`
- `ExportJobStatus` con `COMPLETED`
- Sin columnas `attempts`, `lockedAt`, `lastError`, `@@unique` en jobs

El schema Fase 0 **diverge** de lo ya migrado en mono. Esto **no invalida** el schema, pero **sí** implica que al aplicar contra una DB mono existente hará falta migración forward (fuera de alcance actual).

### W2 — Código archive referencia enums viejos (BAJO)

`apps/_archive/compramelafoto-monorepo-stale-2026-07/` usa `DesignPreviewJobStatus` y `ExportJobStatus.COMPLETED`. No afecta apps activas (`fotoffice`, `fotorank` sin referencias).

### W3 — `PreCompraOrderItem.albumProductId` sigue siendo obligatorio (MEDIO, dominio 8)

Legacy permite `albumProductId Int?` (líneas pack). El merge completo de precompra está planificado en dominio 8; no bloquea dominio 4 (packs).

### W4 — `@@unique([designRevisionId, status])` en jobs (BAJO)

Solo puede existir **un** job por `(revisión, status)` — p. ej. una sola fila `FAILED` por revisión. Paridad legacy; la app debe reutilizar o limpiar filas.

### W5 — Nombre de relación `PreCompraOrder.student` → `SchoolStudent` (BAJO)

Válido en Prisma (tipo resuelve la ambigüedad con `Student` evaluaciones). Al importar código legacy, revisar que `prisma.student` escolar pase a `prisma.schoolStudent` **o** mantener alias de relación documentado.

### W6 — `StudentEnrollment.enrollmentId` en roster sin `onDelete` (BAJO)

`AlbumStudentRosterEntry.enrollment` no declara `onDelete`; comportamiento default `Restrict`. Paridad legacy.

### W7 — Campos `Album` / `School` incompletos vs prod CLF (INFO)

Dominios 4–9 pendientes. No es regresión de Fase 0.

### W8 — `ZipJobStatus` / `FotorankJudgeAssignmentStatus` conservan `COMPLETED` (INFO)

Distintos de `ExportJobStatus` / `PreviewJobStatus`; sin conflicto.

---

## 6. Riesgos PK Int vs String (D5)

| Modelo | Schema Fase 0 | Migración mono `init_baseline` | Riesgo al desplegar |
|--------|---------------|-------------------------------|---------------------|
| `DesignPreviewJob` | `Int` autoincrement | `TEXT` cuid | **Alto** si hay datos mono |
| `DesignExportJob` | `Int` autoincrement | `TEXT` cuid | **Alto** si hay datos mono |
| `SchoolStudent` | `Int` (tabla nueva) | No existe | Bajo (CREATE TABLE) |
| `Student` evaluaciones | `String` cuid | Igual | Sin cambio |

**Recomendación:** al planificar migraciones, tratar D5 como migración destructiva o de recreación de tablas jobs en entornos mono, o aplicar primero contra DB CLF prod (donde jobs ya son `Int`).

---

## 7. Recomendaciones

1. **Avanzar al dominio 4** en schema: estructura Fase 0 es sólida.
2. **Antes de `prisma generate` en CI/dev:** acordar estrategia de migración para D3/D5 (enum rename + PK jobs).
3. **Dominio 4:** al mergear `AlbumPack`, verificar relaciones con `Album` ya presentes (`packs AlbumPack[]` existe en mono).
4. **Dominio 8:** hacer `PreCompraOrderItem.albumProductId` optional alinear con legacy.
5. **Import código CLF:** checklist D1 (`schoolStudent` vs `student` escolar) y D3 (`SUCCEEDED` vs `COMPLETED`).
6. **Mantener** `prisma validate` + `format --check` como gate en cada fase de merge.

---

## 8. Checklist Fase 0 (ADR 0001)

| Criterio ADR | Schema Fase 0 |
|--------------|---------------|
| D1: `SchoolStudent` + `Student` evaluaciones separados | ✅ |
| D2: `SCHOOL_ORGANIZER` en `Role` | ✅ |
| D3: `SUCCEEDED` en export/preview jobs | ✅ |
| D4: estados físicos en `PreCompraOrderItemStatus` | ✅ |
| D5: jobs PK `Int` + campos mono nullable | ✅ |
| Dominio 3 modelos + enums | ✅ |
| FotoOffice / FotoRank intactos | ✅ (sin eliminaciones) |
| Sin migraciones en esta fase | ✅ |

---

## 9. Conclusión operativa

**La Fase 0 pasa validación estructural.** No se requieren correcciones al schema antes del dominio 4.

Los warnings W1 y W2–W5 deben tenerse en cuenta al escribir migraciones y al importar apps; no bloquean la edición continuada del schema en Fase 1 (dominio 4).

**Próximo paso sugerido:** ejecutar merge dominio 4 según [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § dominio 4, con las mismas restricciones (solo schema + `prisma format` + reporte).
