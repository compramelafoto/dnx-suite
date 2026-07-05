# 21 — Reporte Dominio D16: shared cleanup (cierre merge Prisma)

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Referencia:** [`18-prisma-gap-after-video.md`](./18-prisma-gap-after-video.md)

**Restricciones respetadas:**

- ✅ Solo `packages/db/prisma/schema.prisma`
- ✅ `npx prisma validate` + `npx prisma format --check`
- ❌ Sin migraciones, `generate`, `migrate`, `db push`, `db pull`
- ❌ Sin cambios en `apps/*`
- ❌ Sin commit

---

## Veredicto

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | ✅ **Schema válido** |
| `npx prisma format --check` | ✅ **Formateado** (tras `prisma format` automático) |

---

## Cobertura legacy post-cleanup

| Métrica | Estado |
|---------|--------|
| Modelos legacy ausentes | **0** (`Student` → `SchoolStudent` ADR D1) |
| Enums legacy ausentes | **0** |
| Relaciones `User` pendientes (GAP 18) | **0** |
| Campos `User` pendientes (GAP 18) | **0** |
| Índices pendientes | **0** |
| Modelos duplicados | **0** |
| Enums duplicados | **0** |
| **Total modelos mono** | **245** |
| **Total enums mono** | **169** |

> **Merge Prisma legacy CLF: estructuralmente completo** en `packages/db/prisma/schema.prisma`.

---

## 1. Campos `User` agregados (5)

Bloque `// BEGIN LEGACY MERGE — dominio 16 shared cleanup`:

| Campo | Tipo | Origen |
|-------|------|--------|
| `workingCoverageRadiusKm` | `Int?` | Legacy — radio de cobertura fotógrafo |
| `payoutAlias` | `String?` | Legacy — retiros comisión organizador |
| `payoutBank` | `String?` | Legacy |
| `payoutAccountHolder` | `String?` | Legacy |
| `allowUnpaidOrderClientData` | `Boolean @default(false)` | Legacy — flag admin |

---

## 2. Índices agregados (1)

| Modelo | Índice |
|--------|--------|
| `Template` | `@@index([version])` |

---

## 3. Comentarios eliminados / ajustados

| Ubicación | Acción | Motivo |
|-----------|--------|--------|
| `Photo.eventFolderId` | Eliminado `/// FK EventFolder — relación en dominio 9` | Dominio 9 ya mergeado; comentario temporal obsoleto |

**Marcadores `BEGIN/END LEGACY MERGE`:** **conservados** en todos los dominios (0–16). Siguen siendo documentación útil de procedencia del merge; no se eliminaron bloques ya integrados para no perder trazabilidad en auditorías futuras.

---

## 4. Warnings / observaciones

| # | Observación |
|---|-------------|
| W1 | Mono incluye **+59 modelos** y **+43 enums** adicionales vs legacy (suite FotoOffice, FotoRank, workspace, evaluaciones) — esperado por ADR. |
| W2 | `Role` / `GlobalRole` en mono tienen valores suite extra vs legacy — ADR D2, no es gap. |
| W3 | Pendiente **fuera de schema:** migraciones SQL forward para materializar tablas/columnas en PostgreSQL. |
| W4 | Pendiente: `prisma generate` en apps cuando el equipo lo autorice (fuera de scope). |

---

## 5. Conflictos

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## Diff resumido

```
packages/db/prisma/schema.prisma | +17 −1
```

---

## Historial de commits merge (rama `migration-legacy-clf-to-monorepo`)

| Commit | Dominio |
|--------|---------|
| `c5cc49b` | 9 — organizador / eventos |
| `4464fef` | 6 — video |
| `7be6adf` | 11 — cuánto cobro |
| `4c30b56` | 12 — blog / marketing |
| *(pendiente)* | 16 — shared cleanup |
