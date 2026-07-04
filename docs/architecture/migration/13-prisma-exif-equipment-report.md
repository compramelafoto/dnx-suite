# 13 — Reporte Dominio 10 Prisma: EXIF / equipamiento fotográfico

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Plan:** [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § dominio 10  
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

| Métrica | Post Dominio 6 | Post Dominio 10 (EXIF) | Δ |
|---------|---------------:|-----------------------:|--:|
| Modelos | 198 | **206** | **+8** |
| Enums | 141 | **147** | **+6** |
| Líneas (git diff) | — | — | **+269** |

---

## 1. Modelos agregados (8)

Bloque `// BEGIN LEGACY MERGE — dominio 10 EXIF / equipamiento fotográfico (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `PhotographerDevice` | Dispositivo detectado por EXIF (admin interno) |
| `PhotoExifMetadata` | Metadatos EXIF por foto (procesamiento nocturno) |
| `ExifDeviceScanLease` | Lease singleton para escaneo (evita advisory locks con pooler) |
| `ExifDeviceScanState` | Estado global backfill / ventana diaria |
| `PhotographicCameraBody` | Body/cámara normalizada por fotógrafo |
| `PhotographicLens` | Lente normalizada por fotógrafo |
| `PhotographicGearCombination` | Combinación body + lente |
| `PhotographicGearObservation` | Observación por foto (shutter, EXIF resumido) |

---

## 2. Modelos modificados (3)

| Modelo | Cambios |
|--------|---------|
| **`User`** | +`photographerDevices`, +`photoExifMetadata`, +`photographicCameraBodies`, +`photographicLenses`, +`photographicGearCombinations`, +`photographicGearObservations` |
| **`Album`** | +`photographicGearObservations` |
| **`Photo`** | +`exifMetadata` → `PhotoExifMetadata?`; +`gearObservation` → `PhotographicGearObservation?` |

**Sin cambios en campos escalares:** `Photo.exifMetadataStatus`, `Photo.exifMetadataAnalyzedAt` (ya fusionados en dominio 7).

---

## 3. Enums agregados (6)

| Enum | Valores |
|------|---------|
| `ExifDeviceScanMode` | `BACKFILL`, `DAILY` |
| `PhotographerDeviceType` | `CAMERA`, `PHONE`, `DRONE`, `UNKNOWN` |
| `PhotographerDeviceConfidence` | `HIGH`, `MEDIUM`, `LOW` |
| `PhotographicGearConfidence` | `HIGH`, `MEDIUM`, `LOW` |
| `PhotographicGearEntityStatus` | `ACTIVE`, `MERGED`, `INACTIVE` |
| `ShutterCountConfidence` | `HIGH`, `MEDIUM`, `LOW`, `UNAVAILABLE` |

**Enum reutilizado (sin duplicar):** `PhotoExifMetadataStatus` — ya presente desde dominio 7 (core commerce); valores idénticos a legacy.

---

## 4. Relaciones agregadas

| Relación | Detalle |
|----------|---------|
| `Photo` ↔ `PhotoExifMetadata` | 1:1 (`photoId` unique) |
| `Photo` ↔ `PhotographicGearObservation` | 1:1 (`photoId` unique) |
| `User` ↔ gear/EXIF modelos | 1:N en todos los agregados |
| `Album` ↔ `PhotographicGearObservation` | 1:N |
| `PhotographerDevice` ↔ `PhotoExifMetadata` | 1:N (`deviceId`) |
| `PhotographicCameraBody` / `Lens` / `Combination` ↔ `Observation` | Jerarquía gear legacy |

---

## 5. Scalars sin `@relation` (paridad legacy)

| Campo | Motivo |
|-------|--------|
| `PhotographicCameraBody.maxShutterCountPhotoId` | Int? — sin FK Prisma en legacy |
| `PhotographicCameraBody.maxShutterCountAlbumId` | Int? — sin FK Prisma en legacy |

---

## 6. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 7. Pendientes

| # | Pendiente | Notas |
|---|-----------|-------|
| P1 | Migración forward `20260704150000_clf_gap_organizer_exif_gear` §2 | Fase SQL |
| P2 | FKs opcionales `maxShutterCountPhotoId` / `maxShutterCountAlbumId` → `Photo` / `Album` | Solo si se desea integridad explícita |
| P3 | Código admin EXIF / crons nocturnos | Import legacy (fuera de scope Prisma) |

---

## 8. Suite intacta

- **FotoOffice** / **FotoRank** — sin cambios  
- **Dominios 3–7** — sin regresiones

---

## 9. Diff resumido (git)

```
packages/db/prisma/schema.prisma | +269
```
