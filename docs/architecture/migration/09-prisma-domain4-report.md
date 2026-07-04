# 09 — Reporte Dominio 4 Prisma: album packs / preventa / upsell / venta escolar

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Plan:** [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § dominio 4  
**Validación previa:** [`08-prisma-phase0-validation.md`](./08-prisma-phase0-validation.md)

**Restricciones respetadas:**

- ✅ Solo `packages/db/prisma/schema.prisma`
- ✅ `prisma validate` + `prisma format`
- ❌ Sin migraciones, `generate`, `migrate`, `db push`, `db pull`
- ❌ Sin cambios en `apps/*`

---

## Veredicto

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | ✅ **Schema válido** |
| `npx prisma format` | ✅ Formateado |

---

## Resumen cuantitativo

| Métrica | Post Fase 0 | Post Dominio 4 | Δ dominio 4 |
|---------|------------:|---------------:|------------:|
| Modelos | 171 | **182** | **+11** |
| Enums | 111 | **121** | **+10** |
| Líneas (diff acumulado git) | — | — | **+1264 / −175** (total archivo) |

---

## 1. Modelos nuevos (11)

Bloque `// BEGIN LEGACY MERGE — dominio 4 album packs / preventa / upsell (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `AlbumPackComponent` | Componentes DIGITAL/PRINT/DESIGN de un `AlbumPack` |
| `AlbumPackSelectionSession` | Sesión de selección de fotos para pack |
| `AlbumPackOrderDraft` | Borrador de checkout de pack antes de MP |
| `AlbumPackSelectionPhoto` | Fotos elegidas en sesión de selección |
| `AlbumUpsellConfig` | Extras digitales/impresión post-upload |
| `AlbumUpsellPack` | Packs `PackDefinition` ofrecidos como upsell |
| `PackDefinition` | Catálogo preventa canjeable por álbum |
| `BenefitDefinition` | Beneficios incluidos en un pack preventa |
| `PackPurchaseEntitlement` | Derecho de canje 1:1 con `PreCompraOrder` |
| `RedemptionSession` | Flujo de canje post-pago |
| `PackAccessToken` | Token hash para acceso público al canje |

> `AlbumPack` ya existía en mono; se **mergeó** (no cuenta como nuevo).

---

## 2. Modelos modificados

| Modelo | Cambios |
|--------|---------|
| **`AlbumPack`** | +`coverImageUrl`, +`templateV2Id` (scalar), relaciones `components`, `orderDrafts`, `selectionSessions`; `price` sin `@default(0)` (legacy); índices `templateV2Id`, `isActive` |
| **`Album`** | Campos venta escolar: `albumPackPayEnabled`, `isTest`, `selectedCourseKeys`, `enableFaceBulkPurchase`, `faceBulkPriceCents`, comisiones organizador; relaciones packs/preventa/upsell |
| **`PreCompraOrder`** | Relación `packPurchaseEntitlement` |
| **`PreCompraOrderItem`** | `albumProductId` → **optional**; +`packDefinitionId`, +`fulfillmentQrToken`; relación `packDefinition` |
| **`Order`** | Relación `packRedemptionEntitlement` (canje) |
| **`Photo`** | Relación `albumPackSelectionPhotos` |
| **`PhotographerProduct`** | Relaciones `albumPackComponents`, `benefitDefinitions` |
| **`Template`** | +`version` (default `"v1"`); relación `benefitDefinitions` |

### Sin cambios estructurales

- **FotoOffice** (`Student`, `Member*`, `Workspace*`, `Evaluation*`, …) — intactos  
- **FotoRank** (`Fotorank*`, `ContestOrganization*`) — intactos  
- **Dominio 3** (`SchoolStudent`, roster, …) — intactos  

---

## 3. Enums nuevos (10)

Bloque `// BEGIN LEGACY MERGE — dominio 4 album packs / preventa (enums)`:

| Enum | Notas |
|------|-------|
| `AlbumPackComponentKind` | `DIGITAL`, `PRINT`, `DESIGN_PRODUCT` |
| `AlbumPackSelectionStatus` | `DRAFT`, `READY`, `EXPIRED` |
| `AlbumPackOrderDraftStatus` | `DRAFT`, `LOCKED`, `EXPIRED`, `CANCELLED` |
| `PackAvailabilityPhase` | `PRE_UPLOAD`, `POST_UPLOAD` (preventa; sin `ALWAYS`) |
| `PackBenefitKind` | `DIGITAL`, `PHYSICAL` |
| `BenefitTemplatePolicy` | `NONE`, `REQUIRED`, `OPTIONAL` |
| `BenefitSelectionMode` | `SINGLE_PHOTO`, `MULTI_PHOTO_FIXED`, `ALBUM_CHOICE` |
| `PackPurchaseEntitlementStatus` | 7 estados canje |
| `RedemptionSessionStatus` | `ACTIVE`, `ABANDONED`, `COMPLETED` |
| `OrganizerCommissionAppliesTo` | `PREVENTA`, `POST_EVENT`, `EXTRAS` — requerido por venta escolar en `Album` (plan dominio 9; incorporado aquí) |

**Enums mono conservados:** `AlbumPackAvailabilityPhase`, `AlbumPackType` (ya existían; usados por `AlbumPack`).

---

## 4. Relaciones agregadas (resumen)

### `Album`

- `upsellConfig` → `AlbumUpsellConfig?`
- `upsellPacks` → `AlbumUpsellPack[]`
- `packDefinitions` → `PackDefinition[]`
- `packPurchaseEntitlements` → `PackPurchaseEntitlement[]`
- `packSelectionSessions` → `AlbumPackSelectionSession[]`
- `packOrderDrafts` → `AlbumPackOrderDraft[]`
- `redemptionSessions` → `RedemptionSession[]`

### Cadena preventa / canje

```
PackDefinition → PreCompraOrderItem → PreCompraOrder → PackPurchaseEntitlement → RedemptionSession
                                                              ↓
                                                            Order (redeemedOrder)
```

### Upsell

```
AlbumUpsellPack → PackDefinition
AlbumUpsellConfig → Album (1:1)
```

### AlbumPack público

```
AlbumPack → AlbumPackComponent → PhotographerProduct
AlbumPack → AlbumPackSelectionSession → AlbumPackSelectionPhoto → Photo
AlbumPack → AlbumPackOrderDraft
```

---

## 5. Conflictos encontrados y decisiones

| Conflicto | Decisión |
|-----------|----------|
| `AlbumPack.templateV2Id` → `TemplateV2` (dominio 5) | Campo **scalar** `String?` + índice; **sin `@relation`** hasta dominio 5 |
| `PackDefinition.sourceCatalogProductId` / `sourceAlbumCatalogProductId` | FKs **scalar** sin relación a `CatalogProduct` / `AlbumCatalogProduct` (dominio 5) |
| `AlbumPack.price` mono `@default(0)` vs legacy sin default | **Eliminado default** — alineado legacy (ADR D6 para CLF) |
| `PreCompraOrderItem.albumProductId` obligatorio mono vs optional legacy | **Optional** + `packDefinitionId` (preventa packs) |
| `OrganizerCommissionAppliesTo` en plan dominio 9 | Enum incorporado en dominio 4 porque `Album.organizerCommissionAppliesTo` es venta escolar |
| `PackAccessToken.orderId` sin `@relation` en legacy | **Paridad legacy** — solo `Int` + índices (sin FK Prisma a `Order`) |
| `RedemptionSessionStatus.COMPLETED` vs `ExportJobStatus.SUCCEEDED` | Sin conflicto — enums distintos |

**Errores de validación:** ninguno.

---

## 6. Bloques pendientes (dominios 5–16)

| Dominio | Pendiente relevante para packs/preventa |
|---------|----------------------------------------|
| **5** | `TemplateV2` + relación `AlbumPack.templateV2`; `CatalogProduct*` + relaciones en `PackDefinition` |
| **7** | Merge completo `Order` (`origin`, `checkoutPaymentSource`, `isTest`, canje JSON, …) |
| **8** | Merge restante `DesignProject` / precompra escolar |
| **9** | `OrganizerCommission` modelo + relaciones `Album`/`Order`/`School` |
| **6–12, 16** | Resto según plan 06 |

### Campos `Album` aún no mergeados (fuera dominio 4)

`catalogProductLinks`, `organizerDownloads`, `organizerCommissions`, `cleanupStatus`, cámara/video, etc.

---

## 7. Validaciones ejecutadas

```bash
cd packages/db && npx prisma validate   # exit 0
cd packages/db && npx prisma format     # exit 0
```

---

## 8. Diff resumido del schema (dominio 4)

```
+ model AlbumPackComponent { … }
+ model AlbumPackSelectionSession { … }
+ model AlbumPackOrderDraft { … }
+ model AlbumPackSelectionPhoto { … }
+ model AlbumUpsellConfig { … }
+ model AlbumUpsellPack { … }
+ model PackDefinition { … }
+ model BenefitDefinition { … }
+ model PackPurchaseEntitlement { … }
+ model RedemptionSession { … }
+ model PackAccessToken { … }

  model AlbumPack {
+   coverImageUrl, templateV2Id
+   components, orderDrafts, selectionSessions
-   price @default(0)
+   price Int
  }

  model Album {
+   albumPackPayEnabled, isTest, selectedCourseKeys
+   enableFaceBulkPurchase, faceBulkPriceCents
+   organizerCommission*
+   upsellConfig, packDefinitions, packPurchaseEntitlements, …
  }

  model PreCompraOrderItem {
-   albumProductId Int
+   albumProductId Int?
+   packDefinitionId, fulfillmentQrToken
  }

+ enum AlbumPackComponentKind { … }
+ enum PackPurchaseEntitlementStatus { … }
+ enum OrganizerCommissionAppliesTo { … }
  … (+8 enums más)
```

---

## 9. Próximo paso sugerido

**Dominio 5** (catálogo global + Template V2) para cerrar FKs diferidas de `AlbumPack` y `PackDefinition`, según plan 06.
