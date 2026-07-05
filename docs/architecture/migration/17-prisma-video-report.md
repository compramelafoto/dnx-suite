# 17 — Reporte Dominio: video

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma`  
**Guía:** [`15-prisma-final-gap-analysis.md`](./15-prisma-final-gap-analysis.md)

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
| `npx prisma format --check` | ✅ **Formateado** |

---

## Resumen cuantitativo

| Métrica | Post Dominio 9 | Post Video | Δ |
|---------|---------------:|-----------:|--:|
| Modelos | 219 | **221** | **+2** |
| Enums | 155 | **158** | **+3** |
| Líneas (git diff) | — | — | **+109** |

---

## 1. Modelos agregados (2)

Bloque `// BEGIN LEGACY MERGE — dominio 6 video (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `VideoAsset` | Video vendible en álbum (MVP fase 0) |
| `VideoProcessingJob` | Cola de procesamiento ffmpeg por video |

---

## 2. Modelos modificados (3)

| Modelo | Cambios |
|--------|---------|
| **`Album`** | +`videos` → `VideoAsset[]` |
| **`EventFolder`** | +`videos` → `VideoAsset[]` |
| **`User`** | +`uploadedVideos` → `VideoAsset[]` (`VideoUploader`) |

---

## 3. Enums agregados (3)

Bloque `// BEGIN LEGACY MERGE — dominio 6 video (enums)`:

| Enum | Valores |
|------|---------|
| `VideoCategory` | `REEL`, `HIGHLIGHT`, `CEREMONY`, `DRONE`, `INTERVIEW`, `BACKSTAGE`, `SHOW`, `SPORT`, `SCHOOL`, `OTHER` |
| `VideoProcessingStatus` | `PENDING`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED`, `EXPIRED` |
| `VideoProcessingJobStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |

---

## 4. Relaciones completadas

| Modelo | Relación | Destino |
|--------|----------|---------|
| `Album` | `videos` | `VideoAsset[]` |
| `EventFolder` | `videos` | `VideoAsset[]` |
| `User` | `uploadedVideos` | `VideoAsset[]` (`VideoUploader`) |
| `VideoAsset` | `album`, `eventFolder`, `uploadedBy`, `processingJob` | `Album`, `EventFolder?`, `User?`, `VideoProcessingJob?` |
| `VideoProcessingJob` | `video` | `VideoAsset` |

---

## 5. Relaciones no aplicadas (ausentes en legacy)

| Relación solicitada | Estado | Motivo |
|---------------------|--------|--------|
| `User.videoProcessingJobs` | ❌ No añadida | No existe en legacy; `VideoProcessingJob` solo FK a `VideoAsset` |
| `Photo.video` | ❌ No añadida | `Photo` en legacy no tiene campo ni relación con video |

---

## 6. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 7. Suite intacta

- **FotoOffice** / **FotoRank** — sin modelos tocados; solo relaciones compartidas en `User`/`Album` necesarias para video CLF.

---

## 8. Pendientes post-video

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | Cuánto Cobro (9 modelos, 6 enums) | 11 |
| P2 | Blog / marketing / leads (15 modelos, 5 enums) | 12 |
| P3 | Shared cleanup (`User` campos residuales, `Template` índice) | 16 |
| P4 | Migración forward SQL | Fase SQL |

---

## Diff resumido

```
packages/db/prisma/schema.prisma | +109
```

**Bloques añadidos:**

- `BEGIN/END LEGACY MERGE — dominio 6 video (enums)` — 3 enums
- `BEGIN/END LEGACY MERGE — dominio 6 video (modelos)` — 2 modelos
- Relaciones inline en `Album`, `EventFolder`, `User`
