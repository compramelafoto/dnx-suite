# 12 — Reporte Dominio 6 Prisma: cámara / FTP / ingest

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Plan:** [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § dominio 6 (subset cámara/FTP)  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma`

**Restricciones respetadas:**

- ✅ Solo `packages/db/prisma/schema.prisma`
- ✅ `npx prisma validate` + `npx prisma format --check`
- ❌ Sin migraciones, `generate`, `migrate`, `db push`, `db pull`
- ❌ Sin cambios en `apps/*`

---

## Veredicto

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | ✅ **Schema válido** |
| `npx prisma format --check` | ✅ **Formateado** |

---

## Resumen cuantitativo

| Métrica | Post Dominio 5 | Post Dominio 6 (cámara) | Δ |
|---------|---------------:|------------------------:|--:|
| Modelos | 194 | **198** | **+4** |
| Enums | 138 | **141** | **+3** |
| Líneas (git diff) | — | — | **+144 / −1** |

---

## 1. Modelos agregados (4)

Bloque `// BEGIN LEGACY MERGE — dominio 6 cámara / FTP / ingest (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `AlbumFolder` | Árbol de carpetas por álbum (organización de fotos subidas por cámara/FTP/web) |
| `CameraConnectionSettings` | Config FTP por fotógrafo (`ftpUsername`, `ftpPasswordHash`, álbum activo, modo asignación) |
| `CameraUploadLog` | Log de intentos de subida (status, `rawKey` staging R2, error) |
| `CameraIngestJob` | Cola durable raw → `finalizeAlbumPhotoFromRaw` (worker ingest) |

---

## 2. Modelos modificados (3)

| Modelo | Cambios |
|--------|---------|
| **`User`** | +`albumFoldersCreated`, +`cameraConnectionSettings`, +`cameraUploadLogs`, +`cameraIngestJobs` |
| **`Album`** | +`cameraConnectionActiveSettings`, +`cameraUploadLogs`, +`cameraIngestJobs`, +`albumFolders` |
| **`Photo`** | +`folder` → `AlbumFolder?`; +`cameraIngestJob` → `CameraIngestJob?` (1:1 vía `photoId` unique) |

---

## 3. Enums agregados (3)

| Enum | Valores |
|------|---------|
| `CameraConnectionAssignmentMode` | `MANUAL`, `ALBUM_EVENT_TIME` |
| `CameraIngestJobStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `AlbumPhotoIngestSource` | `CAMERA`, `WEB_UPLOAD` |

**Enums modificados:** ninguno.

---

## 4. Relaciones agregadas

| Relación | Detalle |
|----------|---------|
| `User` ↔ `CameraConnectionSettings` | 1:1 (`userId` unique) |
| `User` ↔ `CameraUploadLog` / `CameraIngestJob` | 1:N |
| `User` ↔ `AlbumFolder` | `albumFoldersCreated` (`createdBy`) |
| `Album` ↔ `CameraConnectionSettings` | `cameraConnectionActiveSettings` (`activeAlbumId`) |
| `Album` ↔ `CameraUploadLog` / `CameraIngestJob` / `AlbumFolder` | 1:N |
| `CameraUploadLog` ↔ `CameraIngestJob` | 1:1 opcional (`uploadLogId` unique) |
| `CameraIngestJob` ↔ `Photo` | 1:1 opcional (`photoId` unique) |
| `Photo` ↔ `AlbumFolder` | N:1 (`folderId`) — completa pendiente dominio 7 |

---

## 5. Scalars sin `@relation` (paridad legacy)

| Campo | Motivo |
|-------|--------|
| `CameraIngestJob.eventFolderId` | `EventFolder` en dominio 9 |
| `CameraIngestJob.folderId` | Scalar en legacy; carpeta vía `Photo.folderId` al completar ingest |
| `Photo.eventFolderId` | `EventFolder` en dominio 9 |

---

## 6. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 7. Modelos del plan § dominio 6 **no incluidos** (fuera de scope solicitado)

| Modelo | Motivo |
|--------|--------|
| `VideoAsset` | Video — dominio separado del bloque cámara/FTP |
| `VideoProcessingJob` | Idem |

Quedan para un merge explícito de video o continuación dominio 6 completo.

---

## 8. Pendientes

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | `Photo.eventFolder` → `EventFolder` | 9 |
| P2 | `CameraIngestJob` FKs a `folder` / `eventFolder` si se desea integridad explícita | 6/9 |
| P3 | `VideoAsset`, `VideoProcessingJob` + enums `VideoCategory`, `VideoProcessingStatus`, `VideoProcessingJobStatus` | 6 (video) |
| P4 | Migración forward `20260704130000_clf_gap_catalog_camera_media` §2 | Fase SQL |

---

## 9. Suite intacta

- **FotoOffice** / **FotoRank** — sin cambios  
- **Dominios 3–5, 7** — sin regresiones

---

## 10. Diff resumido (git)

```
packages/db/prisma/schema.prisma | +144 / -1
```
