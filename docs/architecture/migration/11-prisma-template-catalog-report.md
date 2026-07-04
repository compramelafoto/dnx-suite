# 11 — Reporte Dominio 5 Prisma: catálogo global + Template V2

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Plan:** [`06-prisma-merge-execution-plan.md`](./06-prisma-merge-execution-plan.md) § dominio 5  
**ADR:** [`0001-prisma-unificado-clf-legacy.md`](../decisions/0001-prisma-unificado-clf-legacy.md)  
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

| Métrica | Post Dominio 7 | Post Dominio 5 | Δ dominio 5 |
|---------|---------------:|---------------:|------------:|
| Modelos | 182 | **194** | **+12** |
| Enums | 130 | **138** | **+8** |
| Líneas (git diff dominio 5) | — | — | **+312 / −2** |

---

## 1. Modelos agregados (12)

Bloques `// BEGIN LEGACY MERGE — dominio 5 …`:

### Catálogo global (6)

| Modelo | Propósito |
|--------|-----------|
| `CatalogProductCategory` | Categorías del catálogo por fotógrafo (`userId` + `name`) |
| `CatalogProduct` | Producto reutilizable (SIMPLE / PACK / COMBO) con precio base y origen plantilla sistema |
| `SystemCatalogTemplate` | Plantillas maestras admin clonables a `CatalogProduct` |
| `CatalogProductImage` | Mockups e imágenes del producto |
| `CatalogProductComponent` | Componentes de entrega (digital, impreso, diseño) con refs opcionales a Template V2 |
| `AlbumCatalogProduct` | Vínculo álbum ↔ producto de catálogo (activación por álbum) |

### Template V2 (6)

| Modelo | Propósito |
|--------|-----------|
| `TemplateV2` | Plantilla de diseño multipágina (cuid, `ownerUserId`, estado) |
| `TemplateV2Version` | Versiones con `canvasJson` / `metaJson` |
| `TemplateV2Block` | Bloques del lienzo (foto, texto, variable, forma, etc.) |
| `TemplateV2Asset` | Assets (imagen, logo, fuente) por versión |
| `TemplateV2VariableBinding` | Bindings de variables a bloques |
| `TemplateV2Publication` | Visibilidad y flujo de revisión/publicación |

---

## 2. Modelos fusionados (relaciones completadas)

| Modelo | Cambio |
|--------|--------|
| **`AlbumPack`** | +`templateV2` → `TemplateV2?` (`@relation("AlbumPackDesignTemplateV2")`); comentario FK actualizado |
| **`PackDefinition`** | +`sourceCatalogProduct` → `CatalogProduct?`; +`sourceAlbumCatalogProduct` → `AlbumCatalogProduct?` |
| **`User`** | +`catalogProductCategories`, +`catalogProducts` |
| **`Album`** | +`catalogProductLinks` → `AlbumCatalogProduct[]` |
| **`BenefitDefinition`** | Sin cambios — ya en paridad legacy (dominio 4); relaciones `photographerProduct`, `template`, `packDefinition` intactas |
| **`PhotographerProduct`** | Sin cambios — relaciones dominio 4 (`albumPackComponents`, `benefitDefinitions`) ya presentes |
| **`AlbumPackComponent`** | Sin cambios — relación `photographerProduct` ya presente |

---

## 3. Relaciones completadas (dominio 4 → dominio 5)

| FK / campo pendiente | Relación Prisma añadida |
|----------------------|-------------------------|
| `AlbumPack.templateV2Id` | `AlbumPack.templateV2` → `TemplateV2` |
| `PackDefinition.sourceCatalogProductId` | `PackDefinition.sourceCatalogProduct` → `CatalogProduct` |
| `PackDefinition.sourceAlbumCatalogProductId` | `PackDefinition.sourceAlbumCatalogProduct` → `AlbumCatalogProduct` |
| `AlbumCatalogProduct` ↔ `PackDefinition` | `preventaPack` / `sourceAlbumCatalogProduct` (bidireccional) |
| `CatalogProduct` ↔ `PackDefinition` | `preventaPackSources` / `sourceCatalogProduct` |

---

## 4. Enums agregados (8)

| Enum | Valores |
|------|---------|
| `CatalogProductType` | `SIMPLE`, `PACK`, `COMBO` |
| `CatalogProductImageRole` | `MOCKUP` |
| `CatalogDeliveryType` | `DIGITAL`, `IMPRESO`, `MIXTO`, `DISEÑO`, `MANUAL` |
| `TemplateV2Status` | `DRAFT`, `ACTIVE`, `ARCHIVED` |
| `TemplateV2BlockType` | `BACKGROUND`, `PHOTO`, `TEXT`, `VARIABLE_TEXT`, `IMAGE`, `SHAPE` |
| `TemplateV2AssetKind` | `IMAGE`, `LOGO`, `FONT` |
| `TemplateV2Visibility` | `PRIVATE`, `PUBLIC` |
| `TemplateV2ReviewStatus` | `DRAFT`, `IN_REVIEW`, `APPROVED`, `REJECTED` |

---

## 5. Nombres solicitados vs legacy (sin conflicto de tipo)

Los siguientes nombres **no existen** en el schema legacy de producción; se mapearon al modelo canónico equivalente:

| Nombre solicitado | Equivalente legacy | Nota |
|-------------------|-------------------|------|
| `TemplateCategory` | — | No existe; categorías de catálogo = `CatalogProductCategory` (string `category` en `SystemCatalogTemplate` es metadata, no modelo) |
| `CatalogCategory` | `CatalogProductCategory` | Mismo concepto, nombre legacy oficial |
| `CatalogProductVariant` | — | No existe; precio único en `CatalogProduct.basePriceCents` |
| `CatalogProductPrice` | — | No existe; precio en `CatalogProduct.basePriceCents` |

**Decisión:** no inventar modelos ausentes en prod CLF; fusionar únicamente los 12 modelos del plan § dominio 5.

---

## 6. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ningún conflicto de tipo o enum | Merge directo desde legacy |

**Referencias forward:** `CatalogProduct` y `AlbumCatalogProduct` referencian `PackDefinition` definido más abajo en el archivo — válido en Prisma.

---

## 7. Relaciones intencionalmente sin `@relation` (legacy igual)

| Campo | Motivo |
|-------|--------|
| `CatalogProductComponent.designTemplateId` | Scalar `String?` — ref a `TemplateV2` sin FK Prisma en legacy |
| `TemplateV2.ownerUserId` | Scalar `Int` — sin relación `User` en legacy |
| `TemplateV2.currentVersionId` | Scalar — sin `@relation` a `TemplateV2Version` en legacy |
| `TemplateV2Version` / `TemplateV2Block` / `TemplateV2Asset` / `TemplateV2VariableBinding` | Sin relaciones inversas explícitas en legacy |

---

## 8. Pendientes (otros dominios)

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | `DesignProject` merge completo (usa `Template` v1; integración V2 en app) | 8 |
| P2 | Relación `User` ↔ `TemplateV2` (`ownerUserId`) si se desea integridad FK | Opcional |
| P3 | Relación `TemplateV2` ↔ `TemplateV2Version` (`currentVersionId`) | Opcional |
| P4 | `CatalogProductComponent` → `TemplateV2` FK explícita | Opcional |
| P5 | Migración forward `20260704130000_clf_gap_catalog_camera_media` | Fase SQL |

---

## 9. Suite intacta

- **FotoOffice** / **FotoRank** — sin modelos tocados  
- **Dominios 3, 4, 7** — sin regresiones; solo relaciones cruzadas dominio 4↔5

---

## 10. Diff resumido (git)

```
packages/db/prisma/schema.prisma | +312 / -2
```

**Ubicación en schema:**

- Enums + modelos catálogo + Template V2: tras `PhotographerProduct`, antes de `Album`
- Relaciones: `User`, `Album`, `AlbumPack`, `PackDefinition`
