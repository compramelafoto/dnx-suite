# 10 — Reporte Dominio 7 Prisma: core commerce CLF

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Plan:** [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § dominio 7  
**ADR:** [`0001-prisma-unificado-clf-legacy.md`](../decisions/0001-prisma-unificado-clf-legacy.md) D6  
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
| `npx prisma format --check` | ✅ **Formateado** (requirió `prisma format` previo por espaciado manual) |

**¿Es seguro commitear?** ✅ **Sí** — solo `packages/db/prisma/schema.prisma` + este reporte. No incluir cambios paralelos en `apps/*` ni `pnpm-lock.yaml`.

---

## Resumen cuantitativo

| Métrica | Post Dominio 4 | Post Dominio 7 (core commerce) | Δ dominio 7 |
|---------|---------------:|---------------------------------:|------------:|
| Modelos | 182 | **182** | 0 (merge, sin modelos nuevos) |
| Enums | 121 | **130** | **+9** |
| Líneas (git diff dominio 7) | — | — | **+161 / −8** |

---

## 1. Modelos modificados

### `Album`

Bloque `// BEGIN LEGACY MERGE — core commerce CLF (Album cleanup / retención)`:

| Campo | Tipo |
|-------|------|
| `cleanupStatus` | `AlbumCleanupStatus @default(NONE)` |
| `cleanupPendingAt` | `DateTime?` |
| `cleanupStartedAt` | `DateTime?` |
| `cleanupCompletedAt` | `DateTime?` |
| `cleanupLastError` | `String?` |
| `cleanupBlockReason` | `String?` |
| `cleanupPhotosProcessed` | `Int @default(0)` |

**Índice:** `@@index([cleanupStatus])`

### `Photo`

Bloque `// BEGIN LEGACY MERGE — core commerce CLF (Photo variants / cleanup / carpetas)`:

| Campo | Tipo |
|-------|------|
| `thumbWatermarkedKey` | `String?` |
| `previewWatermarkedKey` | `String?` |
| `variantsVersion` | `String?` |
| `variantsGeneratedAt` | `DateTime?` |
| `variantsStatus` | `PhotoVariantsStatus @default(PENDING)` |
| `variantsError` | `String?` |
| `exifMetadataStatus` | `PhotoExifMetadataStatus? @default(PENDING)` |
| `exifMetadataAnalyzedAt` | `DateTime?` |
| `storageDeletedAt` | `DateTime?` |
| `metadataDeletedAt` | `DateTime?` |
| `storageCleanupStatus` | `PhotoStorageCleanupStatus @default(ACTIVE)` |
| `capturedAt` | `DateTime?` |
| `folderId` | `Int?` (scalar; sin `@relation` hasta dominio 6) |
| `eventFolderId` | `Int?` (scalar; sin `@relation` hasta dominio 9) |

**Índices:** `folderId`, `eventFolderId`, `[variantsStatus, createdAt]`, `[exifMetadataStatus, createdAt]`, `storageCleanupStatus`, `storageDeletedAt`

### `Order`

Bloque `// BEGIN LEGACY MERGE — core commerce CLF (Order checkout / preventa / organizador)`:

| Campo | Tipo |
|-------|------|
| `buyerName` | `String?` |
| `origin` | `OrderOrigin @default(STANDARD_CHECKOUT)` |
| `checkoutPaymentSource` | `CheckoutPaymentSource @default(MERCADO_PAGO)` |
| `isTest` | `Boolean @default(false)` |
| `redemptionPaymentRefsJson` | `Json?` |
| `preCompraPaymentRef` | `String?` |
| `preventaPackSnapshotJson` | `Json?` |
| `redemptionOrderId` | `Int? @unique` |
| `redeemsOrderId` | `Int? @unique` |
| `organizerSchoolId` | `Int?` |
| `organizerUserId` | `Int?` |
| `organizerReferralApplied` | `Boolean @default(false)` |
| `updatedAt` | `DateTime @updatedAt` |

**Índices:** `organizerSchoolId`, `organizerReferralApplied`, `origin`, `checkoutPaymentSource`, `[status, updatedAt]`, `isTest`

### `OrderItem`

Bloque `// BEGIN LEGACY MERGE — core commerce CLF (OrderItem preventa / packs)`:

| Campo | Tipo |
|-------|------|
| `lineOrigin` | `OrderItemLineOrigin @default(STANDARD)` |
| `entitlementId` | `Int?` |
| `benefitStableKey` | `String?` |
| `packSlotIndex` | `Int?` |
| `metadata` | `Json?` |

**Índices:** `lineOrigin`, `entitlementId`

### `SelectionPhoto`

| Cambio | Detalle |
|--------|---------|
| `role` | `String?` → `SelectionPhotoRole?` (paridad legacy school pipeline) |

### `TemplateSlot`

| Cambio | Detalle |
|--------|---------|
| `role` | `String?` → `TemplateSlotRole?` |

### `WebhookEvent`

Alineado a legacy (idempotencia MP por par `paymentId` + `status`):

| Cambio | Mono (antes) | Legacy (ahora) |
|--------|--------------|----------------|
| `paymentId` | `@unique` | Sin `@unique` |
| `status` | `String?` | `String @default("")` |
| Constraint | `paymentId` único | `@@unique([paymentId, status])` |

---

## 2. Modelos revisados sin cambios (ya en paridad)

| Modelo | Notas |
|--------|-------|
| `PreCompraOrder` | Dominios 3 + 4 ya fusionados; paridad con legacy |
| `PreCompraOrderItem` | `albumProductId` optional, `packDefinitionId`, `fulfillmentQrToken` (dominio 4) |
| `PhotographerProduct` | Paridad campos; relaciones dominio 4 presentes |
| `PaymentSplit` | Idéntico a legacy |
| `AlbumProduct` | Paridad (mono conserva `defaultTemplateId` y relaciones suite) |

### Modelos inexistentes en legacy

| Modelo buscado | Resultado |
|----------------|-----------|
| `Payment` | No existe en legacy ni mono |
| `MercadoPagoPayment` | No existe; pagos MP vía campos en `Order`/`PreCompraOrder` + `WebhookEvent` + `MercadoPagoOAuthState` |

---

## 3. Enums nuevos (9)

Bloque `// BEGIN LEGACY MERGE — core commerce CLF (enums)`:

| Enum | Valores |
|------|---------|
| `AlbumCleanupStatus` | `NONE`, `PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_REFERENCES`, `BLOCKED_PRINT`, `FAILED` |
| `PhotoVariantsStatus` | `PENDING`, `PROCESSING`, `READY`, `FAILED` |
| `PhotoExifMetadataStatus` | `PENDING`, `ANALYZED`, `NO_EXIF`, `FAILED`, `SKIPPED_EXPIRED` |
| `PhotoStorageCleanupStatus` | `ACTIVE`, `STORAGE_PURGED`, `PURGED_WITH_REFERENCES` |
| `CheckoutPaymentSource` | `MERCADO_PAGO`, `PREPAID_PACK`, `SIMULATED` |
| `OrderOrigin` | `STANDARD_CHECKOUT`, `PACK_REDEMPTION`, `PREVENTA_PACK` |
| `OrderItemLineOrigin` | `STANDARD`, `PACK_INCLUDED`, `EXTRA` |
| `TemplateSlotRole` | `PHOTO_MAIN`, `PHOTO_1`…`BANNER` (8 valores) |
| `SelectionPhotoRole` | `PHOTO_MAIN`, `PHOTO_1`…`GROUP_PHOTO` (5 valores) |

**Enums modificados:** ninguno (solo tipado de campos `role` en `SelectionPhoto` / `TemplateSlot`).

---

## 4. Relaciones agregadas

**Ninguna relación Prisma nueva** en este dominio. Política deliberada: FKs escalares sin `@relation` hasta que existan los modelos hijo en dominios posteriores.

### Relaciones legacy **diferidas** (requieren dominios 5–10)

| Modelo | Relación legacy | Dominio |
|--------|-----------------|---------|
| `Photo` | `folder` → `AlbumFolder` | 6 |
| `Photo` | `eventFolder` → `EventFolder` | 9 |
| `Photo` | `cameraIngestJob` → `CameraIngestJob` | 6 |
| `Photo` | `exifMetadata` → `PhotoExifMetadata` | 10 |
| `Photo` | `gearObservation` → `PhotographicGearObservation` | 10 |
| `Photo` | `organizerDownloads` → `OrganizerEventDownload[]` | 9 |
| `Order` | `organizerCommissions` → `OrganizerCommission[]` | 9 |
| `Order` | `eventOrganizerCommission` → `EventOrganizerCommission?` | 9 |

### Relaciones conservadas (dominios 3–4)

- `Order.packRedemptionEntitlement`, `PreCompraOrder.packPurchaseEntitlement`, `Photo.albumPackSelectionPhotos`, etc. — **sin cambios**.

---

## 5. Conflictos encontrados y decisiones

| ID | Conflicto | Decisión |
|----|-----------|----------|
| **C1** | `WebhookEvent.paymentId`: mono `@unique` vs legacy `@@unique([paymentId, status])` | **Gana legacy** — MP puede emitir múltiples webhooks por `paymentId` con distinto `status`; idempotencia por par compuesto ([`03-prisma-diff.md`](./03-prisma-diff.md) CRITICAL) |
| **C2** | `SelectionPhoto.role` / `TemplateSlot.role`: mono `String?` vs legacy enums | **Gana legacy** — enums `SelectionPhotoRole` / `TemplateSlotRole` |
| **C3** | `Photo.folderId` / `eventFolderId`: legacy tiene `@relation` a modelos inexistentes en mono | **FK scalar only** — relaciones en dominio 6/9 |
| **C4** | `Order.redemptionOrderId` / `redeemsOrderId`: legacy sin `@relation` explícita entre Orders | **Mantener scalar** como legacy (evita self-relation circular prematura) |

**Conflictos de tipo/enum sin resolver:** ninguno — no se detuvo la fusión.

---

## 6. Warnings pendientes

| # | Warning | Acción futura |
|---|---------|---------------|
| W1 | `WebhookEvent`: validar en prod CLF si existen filas con mismo `paymentId` y distinto `status` antes de migración forward | Query en [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § R1 |
| W2 | `Photo.folderId` / `eventFolderId` sin FK Prisma — integridad solo a nivel app hasta dominio 6/9 | Añadir `@relation` al crear `AlbumFolder` / `EventFolder` |
| W3 | `Order.organizerSchoolId` / `organizerUserId` sin relación a `School` / `User` | Dominio 9 |
| W4 | `OrderItem.entitlementId` sin `@relation` a `PackPurchaseEntitlement` | Evaluar en dominio 4/8 si conviene FK explícita |
| W5 | Columnas cleanup en `Album`/`Photo` requieren backfill/default en migración `20260704160000_clf_align_shared_models` | Solo en fase migración SQL (fuera de scope) |
| W6 | `SelectionPhoto.role` / `TemplateSlot.role`: migración de datos `String` → enum si mono staging tiene valores libres | Validar valores antes de deploy |

---

## 7. Sin cambios (suite intacta)

- **FotoOffice:** `Student`, `Member*`, `Workspace*`, `Evaluation*`, …  
- **FotoRank:** `Fotorank*`, `ContestOrganization*`  
- **Dominio 3:** `SchoolStudent`, roster, imports  
- **Dominio 4:** packs, preventa, upsell (11 modelos)

---

## 8. Próximos pasos (plan § dominios 5–16)

| Orden | Dominio | Impacto en core commerce |
|------:|---------|--------------------------|
| 5 | Catálogo + Template V2 | `CatalogProduct*`, `TemplateV2*` |
| 6 | Cámara / carpetas | Completar relaciones `Photo.folder`, `cameraIngestJob` |
| 8 | Precompra / diseño escolar (merge) | `DesignProject`, jobs — complementa `PreCompraOrderItem` |
| 9 | Organizador / comisiones | `OrganizerCommission*`, `Order` relaciones organizador |
| 10 | EXIF / gear | `PhotoExifMetadata`, `PhotographicGearObservation` |
| 16 | Shared cleanup | `User`, referrals; verificación índices post-merge |

**Migración forward asociada (futura, no creada):** `20260704160000_clf_align_shared_models` (ADR D6 + D7).

---

## 9. Diff resumido (git)

```
packages/db/prisma/schema.prisma | +161 / -8
```

**Bloques `BEGIN/END LEGACY MERGE` añadidos o extendidos:**

- `Album` — cleanup / retención  
- `Photo` — variantes watermark, EXIF/cleanup, carpetas (scalar)  
- `Order` — checkout, preventa, organizador  
- `OrderItem` — líneas pack/preventa  
- Enums core commerce (9)  
- Ajustes `SelectionPhoto`, `TemplateSlot`, `WebhookEvent`
