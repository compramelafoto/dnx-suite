# 07 — Reporte Fase 0 / Fase 1 Prisma: colisiones + dominio escuela/roster

**Fecha:** 2026-07-04  
**Rama de trabajo:** `migration-legacy-clf-to-monorepo`  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Fuentes:** ADR [`0001`](../decisions/0001-prisma-unificado-clf-legacy.md), plan [`06`](./06-prisma-merge-execution-plan.md)

**Restricciones respetadas:**

- ✅ Solo se editó `packages/db/prisma/schema.prisma`
- ✅ `prisma format` ejecutado (formateo de archivo)
- ❌ No se crearon migraciones
- ❌ No se ejecutó `prisma generate`, `migrate`, `db push` ni `db pull`

---

## Resumen cuantitativo

| Métrica | Antes | Después | Δ |
|---------|------:|--------:|--:|
| Modelos | 162 | 171 | **+9** |
| Enums | 103 | 111 | **+8** |
| Líneas schema (diff git) | — | — | **+816 / −88** |

---

## 1. Colisiones críticas resueltas (D1–D5)

| ID | Colisión | Decisión aplicada | Cambio en schema |
|----|----------|-------------------|------------------|
| **D1** | `Student` legacy vs evaluaciones | Legacy → **`SchoolStudent`** (PK `Int`); `Student` mono (cuid) **intacto** | Nuevo modelo `SchoolStudent`; relaciones escolares apuntan a él |
| **D2** | `Role` | Unión + valor **`SCHOOL_ORGANIZER`** | `enum Role` ampliado |
| **D3** | `ExportJobStatus` / preview jobs | Canónico **`SUCCEEDED`**; preview → **`PreviewJobStatus`** | `ExportJobStatus.COMPLETED` → `SUCCEEDED`; `DesignPreviewJobStatus` reemplazado por `PreviewJobStatus` |
| **D4** | `PreCompraOrderItemStatus` | + estados fulfillment escolar | `PHYSICAL_IN_PROGRESS`, `AT_SCHOOL`, `DELIVERED` |
| **D5** | `DesignExportJob` / `DesignPreviewJob` | PK **`Int`** legacy + campos mono nullable | Reescritura de ambos modelos (`attempts`, `lockedAt`, `lastError`, `@@unique([designRevisionId, status])`, etc.) |

### Notas D3 / D5

- `DesignPreviewJob` y `DesignExportJob` pasan de `String @id @default(cuid())` a `Int @id @default(autoincrement())`.
- Campos mono de observabilidad (`targetVersion`, `error`, `startedAt`, `completedAt`) se conservan como **nullable** para no romper semántica futura del monorepo.
- `targetVersion` deja de ser obligatorio en jobs (legacy no lo exige).

---

## 2. Modelos agregados (dominio 3 — escuela / roster)

Marcados con `// BEGIN LEGACY MERGE` … `// END LEGACY MERGE` en bloque de modelos.

| Modelo | Origen legacy | Notas |
|--------|---------------|-------|
| `SchoolLead` | `SchoolLead` | Captación / referidos |
| `SchoolOrganizer` | `SchoolOrganizer` | Membresía organizador escuela |
| `SchoolOrganizerInvitation` | `SchoolOrganizerInvitation` | Invitaciones pendientes |
| `AcademicYear` | `AcademicYear` | Año lectivo por escuela |
| **`SchoolStudent`** | `Student` (rename D1) | Alumno histórico escolar |
| `StudentEnrollment` | `StudentEnrollment` | Matrícula anual |
| `AlbumStudentRosterEntry` | `AlbumStudentRosterEntry` | Padrón operativo por álbum |
| `StudentRosterImportBatch` | `StudentRosterImportBatch` | Cabecera importación CSV |
| `StudentRosterImportRow` | `StudentRosterImportRow` | Fila auditada de importación |

**Total modelos nuevos:** 9 (8 legacy + 1 rename).

---

## 3. Modelos modificados (merge parcial dominio 3)

| Modelo | Cambios |
|--------|---------|
| `School` | `logoUrl`; relaciones roster (`academicYears`, `students`, `organizers`, `organizerInvitations`, `studentEnrollments`, `studentRosterImportBatches`, `albumStudentRosterEntries`, `convertedLeads`) |
| `Album` | `academicYearId`, `studentIdentificationMode`, `allowManualStudentFallback`; relaciones `academicYear`, `studentRosterEntries`, `studentRosterImportBatches`; índice `academicYearId` |
| `User` | Relaciones roster: `albumStudentRosterEntriesPhotosTaken`, `preCompraOrdersPhotosTaken`, `schoolOrganizerInvitationsSent`, `schoolOrganizerMemberships`, `schoolLeadsReferred`, `studentRosterImportBatchesUploaded` |
| `PreCompraOrder` | Campos roster (`studentId`, `albumRosterEntryId`, snapshots, `photosTaken*`, `isTest`, etc.); relaciones `albumRosterEntry`, `photosTakenBy`, `student` → `SchoolStudent`; índices legacy |
| `DesignPreviewJob` | Reescritura completa (D5) |
| `DesignExportJob` | Reescritura completa (D5) |

### Modelos mono sin cambios estructurales (verificado)

- **`Student`** (evaluaciones FotoOffice, PK `String` cuid) — **sin modificar**
- Todos los modelos **`Fotorank*`** — **sin modificar**
- Todos los modelos **FotoOffice** (`Workspace*`, `Member*`, `Course*`, `Evaluation*`, etc.) — **sin modificar**
- **Ningún modelo existente fue eliminado**

---

## 4. Enums agregados

Bloque `// BEGIN LEGACY MERGE — dominio 3 escuela/roster (enums)`:

| Enum | Valores |
|------|---------|
| `StudentIdentificationMode` | `NONE`, `MANUAL`, `ROSTER_OPTIONAL`, `ROSTER_REQUIRED` |
| `StudentSourceType` | `IMPORT`, `MANUAL_PHOTOGRAPHER`, `MANUAL_ORGANIZER`, `MANUAL_PARENT_FALLBACK`, `SYNC_FROM_PREVIOUS_YEAR`, `SCHOOL_ENROLLMENT_SYNC` |
| `StudentEnrollmentStatus` | `ACTIVE`, `INACTIVE`, `LEFT`, `GRADUATED` |
| `RosterImportStatus` | `PENDING`, `PREVIEW`, `APPLIED`, `FAILED` |
| `RosterImportRowStatus` | `CREATED`, `MATCHED`, `UPDATED`, `SKIPPED_DUPLICATE`, `AMBIGUOUS`, `ERROR` |
| `SchoolOrganizerStatus` | `ACTIVE`, `DISABLED` |
| `SchoolOrganizerInvitationStatus` | `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED` |
| `SchoolLeadStatus` | `NEW`, `CONTACTED`, `IN_PROGRESS`, `CONVERTED`, `DISCARDED` |

### Enums modificados (colisiones)

| Enum | Cambio |
|------|--------|
| `Role` | + `SCHOOL_ORGANIZER` |
| `ExportJobStatus` | `COMPLETED` → `SUCCEEDED` |
| `PreviewJobStatus` | **Nuevo** (reemplaza `DesignPreviewJobStatus`) |
| `PreCompraOrderItemStatus` | + `PHYSICAL_IN_PROGRESS`, `AT_SCHOOL`, `DELIVERED` |

### Enum eliminado del schema

| Enum | Motivo |
|------|--------|
| `DesignPreviewJobStatus` | Unificado en `PreviewJobStatus` (D3) |

---

## 5. Conflictos encontrados y decisiones

| Conflicto | Resolución |
|-----------|------------|
| Dos entidades `Student` con PK distintas | D1: rename legacy → `SchoolStudent` |
| `Role` sin rol escolar | D2: `SCHOOL_ORGANIZER` |
| `COMPLETED` vs `SUCCEEDED` en jobs | D3: `SUCCEEDED` canónico en export y preview |
| Estados físicos de ítems precompra | D4: tres valores legacy añadidos al enum existente |
| PK `cuid` vs `Int` en design jobs | D5: Int legacy + campos mono opcionales |
| Relación `PreCompraOrder.student` | Campo `studentId` conservado; tipo `SchoolStudent` (ADR permite mantener nombre columna) |
| `School.organizerCommissions` (legacy) | **Pendiente** — dominio 9 (organizador/comisiones), no incluido en esta fase |

---

## 6. Bloques pendientes (plan 06 — dominios 4–16)

| Orden | Dominio | Modelos / trabajo pendiente |
|------:|---------|----------------------------|
| 4 | Album packs / preventa / upsell | 11 modelos + merge `AlbumPack` |
| 5 | Catálogo global + Template V2 | 12 modelos |
| 6 | Cámara / video / carpetas | 6 modelos |
| 7 | Core commerce merge | Union completa `Album`, `Photo`, `Order`, `OrderItem` |
| 8 | Precompra / diseño escolar merge | Union `PreCompraOrderItem`, `DesignProject`, etc. |
| 9 | Organizador / eventos / comisiones | 11 modelos + merge `Event` |
| 10 | EXIF / equipamiento | 8 modelos |
| 11 | Cuánto Cobro | 9 modelos |
| 12 | Blog / marketing / leads | ~15 modelos |
| 13–15 | FotoOffice / FotoRank / Evaluaciones | Ya en mono — verificar tras merges 7–8 |
| 16 | Shared cleanup + enums + índices | `User`, referrals, webhooks, verificación final |

### Campos legacy de `Album` aún no incorporados (dominios 4–9)

Ejemplos: `selectedCourseKeys`, `enableFaceBulkPurchase`, `organizerCommission*`, `cleanupStatus`, relaciones a packs/catálogo/cámara, etc.

### Campos legacy de `School` pendientes

`organizerCommissions` → requiere modelo `OrganizerCommission` (dominio 9).

---

## 7. Próximos pasos recomendados (fuera de este entregable)

1. **Fase schema 2:** dominio 4 (packs/preventa) según plan 06.
2. **Migración forward** (cuando corresponda): `20260704100000` rename tabla + `20260704110000` gap roster.
3. **`prisma generate`** solo tras sign-off del schema de la fase.
4. Refactor código legacy importado: referencias `prisma.student` escolar → `prisma.schoolStudent`.

---

## 8. Validación realizada

```bash
cd packages/db && npx prisma format
# → Formatted prisma/schema.prisma (exit 0)
```

No se validó contra base de datos (sin `db pull` / `migrate`).

---

## 9. Marcadores LEGACY MERGE en archivo

| Ubicación | Contenido |
|-----------|-----------|
| `User` relaciones | dominio 3 |
| `Album` campos + relaciones | dominio 3 |
| `School` relaciones | dominio 3 |
| Bloque modelos post-`SchoolCourse` | 9 modelos |
| `PreCompraOrder` campos | dominio 3 |
| Sección enums | 8 enums roster |

Las resoluciones D1–D5 en enums compartidos y modelos `Design*Job` llevan comentarios `/// ADR D*` inline (no bloque LEGACY MERGE — son modificaciones, no incorporaciones).
