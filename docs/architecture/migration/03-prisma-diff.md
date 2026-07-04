# 03 — Diff Prisma: legacy CLF vs `packages/db`

**Fecha:** 2026-07-04  
**Legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma` (5 387 líneas, 186 modelos, 126 enums, **169** migraciones)  
**Monorepo:** `packages/db/prisma/schema.prisma` (4 392 líneas, 162 modelos, 103 enums, **19** migraciones)  
**Método:** parseo estructural de `schema.prisma` (sin `prisma migrate`, `db push`, `db pull` ni `generate`)

> Solo análisis. Ningún archivo Prisma fue modificado.

---

## Resumen numérico

| Métrica | Legacy | Monorepo | Δ |
|---------|-------:|---------:|---|
| Modelos | 186 | 162 | — |
| Solo en legacy | **82** | — | +82 |
| Solo en monorepo | — | **58** | +58 |
| En ambos (por nombre) | **104** | **104** | — |
| Modelos compartidos **idénticos** | **80** | **80** | — |
| Modelos compartidos **modificados** | **24** | **24** | — |
| Enums | 126 | 103 | — |
| Solo en legacy | **67** | — | — |
| Solo en monorepo | — | **44** | — |
| Enums compartidos distintos | **5** | **5** | — |
| Carpetas migración | **169** | **19** | 0 nombres en común |

---

## Clasificación global de severidad

| Severidad | Significado | Conteo aprox. |
|-----------|-------------|---------------|
| **SAFE** | Añadir sin romper prod CLF; o solo orden/cosmética | ~94 ítems |
| **REVIEW** | Requiere decisión de producto o migración de datos | ~85 ítems |
| **CRITICAL** | Colisión de identidad, PK/FK, enum en prod, o pérdida de datos | ~12 ítems |

---

## 1. Modelos solo en legacy (82) — faltan en `packages/db`

Estos modelos existen en producción CLF y **no** están en el schema del monorepo.

| Dominio | Modelos | Severidad |
|---------|---------|-----------|
| **Album packs / preventa** | `AlbumPackComponent`, `AlbumPackOrderDraft`, `AlbumPackSelectionPhoto`, `AlbumPackSelectionSession`, `AlbumUpsellConfig`, `AlbumUpsellPack`, `BenefitDefinition`, `PackDefinition`, `PackPurchaseEntitlement`, `PackAccessToken`, `RedemptionSession` | REVIEW |
| **Catálogo global** | `CatalogProduct`, `CatalogProductCategory`, `CatalogProductComponent`, `CatalogProductImage`, `AlbumCatalogProduct`, `SystemCatalogTemplate` | REVIEW |
| **Escuela / roster** | `AcademicYear`, `AlbumStudentRosterEntry`, `StudentEnrollment`, `StudentRosterImportBatch`, `StudentRosterImportRow`, `SchoolLead`, `SchoolOrganizer`, `SchoolOrganizerInvitation` | REVIEW |
| **Cámara / ingest** | `CameraConnectionSettings`, `CameraIngestJob`, `CameraUploadLog` | REVIEW |
| **Cuánto Cobro** | `CuantoCobroConsulta`, `CuantoCobroConsultaActivity`, `CuantoCobroConsultaFile`, `CuantoCobroConsultaNote`, `CuantoCobroConsultaSequence`, `CuantoCobroFinancialProfile`, `CuantoCobroQuote`, `CuantoCobroQuoteSequence`, `CuantoCobroQuoteVersion` | REVIEW |
| **Blog** | `BlogAuthor`, `BlogCategory`, `BlogMedia`, `BlogPost`, `BlogPostTag`, `BlogPostView`, `BlogSubscriber`, `BlogTag` | SAFE |
| **Template V2** | `TemplateV2`, `TemplateV2Asset`, `TemplateV2Block`, `TemplateV2Publication`, `TemplateV2VariableBinding`, `TemplateV2Version` | REVIEW |
| **Equipos fotográficos / EXIF** | `PhotoExifMetadata`, `PhotographerDevice`, `PhotographicCameraBody`, `PhotographicGearCombination`, `PhotographicGearObservation`, `PhotographicLens`, `ExifDeviceScanLease`, `ExifDeviceScanState` | REVIEW |
| **Organizador / comisiones** | `EventOrganizerCommission`, `OrganizerCommission`, `OrganizerCommissionWithdrawalRequest`, `OrganizerEventDownload`, `OrganizerFeaturedGallery`, `OrganizerLandingSponsor`, `OrganizerOfficialPhotographer`, `OrganizerPublicProfile` | REVIEW |
| **Eventos** | `EventFolder`, `EventInterest`, `EventNearbyPhotographerNotification` | REVIEW |
| **Álbum / media** | `AlbumFolder`, `VideoAsset`, `VideoProcessingJob` | REVIEW |
| **Marketing / leads** | `CharlaFotoEscolarLead`, `DnxCourseEnrollment`, `DnxCourseLead`, `FotoOfficeInterest`, `FunnelVisit`, `Talk`, `TalkLead` | SAFE–REVIEW |
| **Otros** | `PlatformMetrics`, `SimulatorCapture` | SAFE |

**Lista completa (82):**

`AcademicYear`, `AlbumCatalogProduct`, `AlbumFolder`, `AlbumPackComponent`, `AlbumPackOrderDraft`, `AlbumPackSelectionPhoto`, `AlbumPackSelectionSession`, `AlbumStudentRosterEntry`, `AlbumUpsellConfig`, `AlbumUpsellPack`, `BenefitDefinition`, `BlogAuthor`, `BlogCategory`, `BlogMedia`, `BlogPost`, `BlogPostTag`, `BlogPostView`, `BlogSubscriber`, `BlogTag`, `CameraConnectionSettings`, `CameraIngestJob`, `CameraUploadLog`, `CatalogProduct`, `CatalogProductCategory`, `CatalogProductComponent`, `CatalogProductImage`, `CharlaFotoEscolarLead`, `CuantoCobroConsulta`, `CuantoCobroConsultaActivity`, `CuantoCobroConsultaFile`, `CuantoCobroConsultaNote`, `CuantoCobroConsultaSequence`, `CuantoCobroFinancialProfile`, `CuantoCobroQuote`, `CuantoCobroQuoteSequence`, `CuantoCobroQuoteVersion`, `DnxCourseEnrollment`, `DnxCourseLead`, `EventFolder`, `EventInterest`, `EventNearbyPhotographerNotification`, `EventOrganizerCommission`, `ExifDeviceScanLease`, `ExifDeviceScanState`, `FotoOfficeInterest`, `FunnelVisit`, `OrganizerCommission`, `OrganizerCommissionWithdrawalRequest`, `OrganizerEventDownload`, `OrganizerFeaturedGallery`, `OrganizerLandingSponsor`, `OrganizerOfficialPhotographer`, `OrganizerPublicProfile`, `PackAccessToken`, `PackDefinition`, `PackPurchaseEntitlement`, `PhotoExifMetadata`, `PhotographerDevice`, `PhotographicCameraBody`, `PhotographicGearCombination`, `PhotographicGearObservation`, `PhotographicLens`, `PlatformMetrics`, `RedemptionSession`, `SchoolLead`, `SchoolOrganizer`, `SchoolOrganizerInvitation`, `SimulatorCapture`, `StudentEnrollment`, `StudentRosterImportBatch`, `StudentRosterImportRow`, `SystemCatalogTemplate`, `Talk`, `TalkLead`, `TemplateV2`, `TemplateV2Asset`, `TemplateV2Block`, `TemplateV2Publication`, `TemplateV2VariableBinding`, `TemplateV2Version`, `VideoAsset`, `VideoProcessingJob`

---

## 2. Modelos solo en monorepo (58) — nuevos respecto a legacy

No existen en el schema legacy; provienen de **FotoOffice**, **FotoRank** y **auth suite**.

| Producto | Cantidad | Modelos | Severidad |
|----------|--------:|---------|-----------|
| **FotoOffice** | 26 | `Workspace`, `WorkspaceMembership`, `WorkspaceAppAccess`, `WorkspaceFeatureModule`, `FotofficeWorkspaceBranding`, `Member*`, `Membership*`, `CardTemplate`, `CardRequest`, `Course*`, `CourseSales*`, `TeacherApplication`, `ServiceLeadForm` | SAFE* |
| **FotoRank** | 25 | `FotorankContest*`, `FotorankJudge*`, `FotorankGlobalCategory*`, `FotorankDiploma*`, `FotorankProfile`, `FotorankAdminSession` | SAFE* |
| **Evaluaciones** | 6 | `EvaluationContext`, `EvaluationActivity`, `EvaluationContextStudent`, `EvaluationResult`, `EvaluationResultItem`, `Rubric`, `RubricCriteria`, `RubricLevel` | REVIEW |
| **Auth suite** | 1 | `UserSession` | REVIEW |
| **Shared conflict** | 2 | `ContestOrganization`, `ContestOrganizationMember`, `FotorankJudgeOrganizationMembership` | CRITICAL |
| **Otros** | 2 | `ServiceSalesLead` | REVIEW |

\* SAFE si la DB de producción CLF **no** comparte instancia con FotoOffice/FotoRank aún. Si comparten Neon branch, ya pueden existir tablas.

**Lista completa (58):** ver [`prisma-migration-plan.md`](./prisma-migration-plan.md) anexo B.

---

## 3. Modelos compartidos modificados (24)

### CRITICAL (8)

| Modelo | Diferencias principales | Riesgo |
|--------|-------------------------|--------|
| **`Student`** | Legacy: `Int` PK, `schoolId`, nombres/apellidos, roster escolar. Mono: `String` cuid, `workspaceId`, evaluaciones FotoOffice | **Colisión de nombre** — dos dominios distintos |
| **`Album`** | Mono le faltan **37** campos legacy (packs, cámara, cleanup, comisiones organizador, roster, videos, etc.) | Prod CLF usa esos campos |
| **`DesignExportJob`** | `id`: `Int` autoincrement → `String` cuid; campos `attempts`/`lastError`/`lockedAt` vs `completedAt`/`error`/`startedAt` | Jobs en vuelo / FKs |
| **`DesignPreviewJob`** | Igual que export job + `PreviewJobStatus` → `DesignPreviewJobStatus` | Jobs en vuelo |
| **`PreCompraOrder`** | Faltan 14 campos legacy (student snapshots, roster, test flags, entitlement) | Flujo escolar/precompra |
| **`WebhookEvent`** | `paymentId` pierde `@unique`; `status` pasa a opcional | Idempotencia webhooks MP |
| **`SelectionPhoto`** | `role`: enum `SelectionPhotoRole?` → `String?` | Tipado / validación |
| **`TemplateSlot`** | `role`: enum `TemplateSlotRole?` → `String?` | Tipado plantillas |

### REVIEW (11)

| Modelo | Diferencias principales |
|--------|-------------------------|
| **`User`** | +25 relaciones solo legacy (blog, cuantocobro, cámara, gear…); +18 relaciones solo mono (`fotorank*`, `userSessions`, `workspaceMembershipsUnified`, `globalRole`) |
| **`Order`** | Faltan 15 campos legacy (`origin`, `checkoutPaymentSource`, organizer refs, preventa snapshot, redemption) |
| **`OrderItem`** | Faltan 5 campos (`lineOrigin`, `packSlotIndex`, `benefitStableKey`, `entitlementId`, `metadata`) |
| **`Photo`** | Faltan 21 campos (folders, variants, EXIF, watermarks, camera ingest, cleanup) |
| **`AlbumPack`** | Faltan `coverImageUrl`, `templateV2Id`, relaciones `components`, `orderDrafts`, `selectionSessions`; `price` sin `@default(0)` en legacy |
| **`DesignProject`** | Mono añade 15 campos export/preview inline (legacy usa jobs separados) |
| **`PreCompraOrderItem`** | `albumProductId` deja de ser opcional en mono; faltan `packDefinitionId`, `fulfillmentQrToken` |
| **`ReferralAttribution`** | Faltan `sourceType`, `sourceEntityId`, `referralProgram` |
| **`ReferralEarning`** | Falta `referralProgram` |
| **`Template`** | Faltan `version`, `benefitDefinitions` |
| **`AppConfig`** | `downloadLinkDays` default 15 → 30 |

### REVIEW adicional (compartidos con solo campos/relaciones faltantes en mono)

| Modelo | Campos/relaciones solo en legacy |
|--------|----------------------------------|
| **`Event`** | 19 campos (pricing, comisiones, folders, status, uploads) |
| **`School`** | 10 relaciones/campos (roster, organizers, academic years) |
| **`EventMember`** | `termsAcceptedAt`, `termsAcceptedText` |
| **`PhotographerProduct`** | `albumPackComponents`, `benefitDefinitions` |
| **`DesignRevision`** | `projectApprovedForExport` (relación inversa) |

### SAFE (5 compartidos con diff menor)

`DesignRevision` (1 relación nueva mono), `EventMember`, `PhotographerProduct`, `DesignRevision`, `Event` — si se acepta añadir columnas nullable sin cambiar PKs (tras resolver CRITICAL en el mismo modelo padre).

> **Nota:** 80 modelos compartidos no presentan diferencias estructurales detectadas por el parser (p. ej. `Lab`, `ZipGenerationJob`, `FaceMatch`, `SupportTicket`).

---

## 4. Enums

### Solo en legacy (67)

Incluyen dominios CLF no portados: `AlbumPack*`, `BlogPost*`, `CameraIngestJobStatus`, `CuantoCobro*`, `EventOrganizerCommission*`, `OrderOrigin`, `CheckoutPaymentSource`, `StudentSourceType`, `TemplateV2Status`, `RosterImport*`, etc.

### Solo en monorepo (44)

Incluyen: `Fotorank*` (20+), `CourseSales*`, `Member*`, `CardRequest*`, `DesignPreviewJobStatus`, `DesignPreviewStatus`, `WorkspaceRole`, etc.

### Compartidos con valores distintos (5) — CRITICAL / REVIEW

| Enum | Legacy | Monorepo | Severidad |
|------|--------|----------|-----------|
| **`Role`** | `… ORGANIZER, SCHOOL_ORGANIZER` | `… ORGANIZER, SUPER_ADMIN, WORKSPACE_ADMIN, STAFF, TEACHER_MANAGER, COURSE_MANAGER` (sin `SCHOOL_ORGANIZER`) | **CRITICAL** |
| **`ExportJobStatus`** | `SUCCEEDED` | `COMPLETED` (sin `SUCCEEDED`) | **CRITICAL** — datos/código legacy usan `SUCCEEDED` |
| **`PreCompraOrderItemStatus`** | incluye `PHYSICAL_IN_PROGRESS`, `AT_SCHOOL`, `DELIVERED` | no los incluye | **CRITICAL** — fulfillment escolar |
| **`OrderStatus`** | mismo set, distinto orden | mismo set | SAFE |
| **`EventType`** | mismo set, distinto orden | mismo set | SAFE |

---

## 5. Índices, relaciones, constraints, defaults

El parser comparó campos y bloques `@@` a nivel texto. Hallazgos agregados:

| Tipo | Hallazgo | Severidad |
|------|----------|-----------|
| **PK type change** | `DesignExportJob`, `DesignPreviewJob`, `Student` — `Int` → `String` cuid | CRITICAL |
| **FK implícitas** | Modelos solo legacy referencian `Album`, `User`, `Photo` — al añadirlos hay que respetar `onDelete` legacy | REVIEW |
| **@@unique** | `WebhookEvent.paymentId` — unique solo en mono | CRITICAL |
| **@@unique** | `User.unsubscribeToken` — `@unique` solo en mono | REVIEW |
| **Defaults** | `AppConfig.downloadLinkDays` 15 vs 30 | REVIEW |
| **Defaults** | `AlbumPack.price` — `@default(0)` solo en mono | SAFE |
| **Índices** | `AlbumPack`: mono no tiene `@@index([isActive])` ni `templateV2Id` (modelo incompleto) | REVIEW |
| **Relaciones User** | Grafo de relaciones divergente — no rompe DB hasta añadir tablas hijas | REVIEW |

Para un diff línea a línea de un modelo:

```bash
# Ejemplo Student
diff <(sed -n '/^model Student/,/^}/p' /Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma) \
     <(sed -n '/^model Student/,/^}/p' packages/db/prisma/schema.prisma)
```

---

## 6. Migraciones — comparación de historiales

### 6.1 Solo en legacy (169 carpetas)

**Ninguna** carpeta coincide por nombre con `packages/db`. El historial legacy es incremental desde `00000000000000_baseline` hasta `20260702120000_exif_device_scan_state`.

**Agrupación aproximada por dominio:**

| Dominio | Migraciones legacy |
|---------|-------------------:|
| Core / histórico (`other`) | 112 |
| Album packs | 13 |
| Escuela / roster | 10 |
| Organizador / comisiones | 9 |
| Cuánto Cobro | 8 |
| Cámara / ingest | 5 |
| Equipos / EXIF | 5 |
| Referidos | 3 |
| Blog | 2 |
| Template v2 | 1 |
| Album cleanup | 1 |

**Últimas migraciones legacy (muestra):**

```
20260701190000_photographic_gear_v2
20260702120000_exif_device_scan_state
20260629120000_foto_office_interest
20260624120000_cuanto_cobro_user_fields … (serie cuantocobro)
```

### 6.2 Solo en monorepo (19 carpetas)

```
20260422085720_init_baseline                    # ~167 KB SQL — squash inicial suite
20260422185334_service_leads_subtypes_meta
20260424022429_add_service_lead_forms
20260424033104_add_service_lead_form_mode
20260424162000_add_presential_courses_mvp
20260428192455_add_evaluaciones_engine          # introduce Student (evaluaciones)
20260501110000_add_teacher_applications
20260501114500_add_workspace_branding_colors
20260501130000_add_members_registry
20260501141000_add_membership_fees
20260501143000_add_member_charges_payments
20260501152000_add_member_cards
20260501170500_add_card_template_v2
20260501181000_add_card_requests
20260501184500_add_member_card_validity
20260502090000_card_templates_by_category
20260502170000_add_album_pack_entity            # subset album packs
20260502173500_add_album_pack_enums_and_constraints
20260502201000_add_album_mode
```

`init_baseline` **ya incluye** `Workspace`, `FotorankContest` y núcleo CLF compartido (~104 tablas), pero **no** incluye `AlbumPack`, `BlogPost`, `TemplateV2`, ni la mayoría de los 82 modelos solo-legacy.

### 6.3 Equivalentes conceptuales (no por nombre)

| Monorepo | Legacy equivalente | Relación |
|----------|-------------------|----------|
| `20260422085720_init_baseline` | Estado CLF ~enero–abril 2026 + tablas suite | **Parcial** — baseline mono es snapshot anterior al tail legacy |
| `20260502170000_add_album_pack_entity` | `20260502104700_add_album_pack_model` + siguientes | **Subset** — mono tiene tabla `AlbumPack` mínima |
| `20260502173500_album_pack_enums_and_constraints` | `20260502105800_album_pack_enums` | **Parcial** |
| `20260502201000_add_album_mode` | `20260502124600_add_album_mode` | **Probable equivalente** (verificar SQL) |
| `20260428192455_add_evaluaciones_engine` | — | **Solo mono** — introduce colisión `Student` |

### 6.4 Candidatas a descartar (post-unificación)

| Migración mono | Motivo |
|----------------|--------|
| `20260502170000_add_album_pack_entity` | Sustituida por historial legacy más completo |
| `20260502173500_album_pack_enums_and_constraints` | Idem |
| `20260502201000_add_album_mode` | Reemplazar por legacy si el SQL coincide |

**No descartar** migraciones FotoOffice/FotoRank/members sin validar DB compartida.

### 6.5 Candidatas a fusionar

| Estrategia | Descripción |
|------------|-------------|
| **Squash legacy → `clf_production_snapshot`** | Una migración SQL generada desde schema legacy reconciliado |
| **Forward desde mono** | Mantener 19 migraciones mono + N migraciones `clf_*` que añaden gap legacy |
| **Re-baseline completo** | Nuevo `init` desde schema unificado final; marcar historiales como `_archive/` |

---

## 7. Conflictos con otros productos del monorepo

### FotoOffice (CRITICAL / REVIEW)

| Conflicto | Detalle |
|-----------|---------|
| **`Student`** | Mismo nombre; mono = alumno evaluaciones por `workspaceId`; legacy = alumno escolar por `schoolId` |
| **`Role` enum** | Mono añade roles workspace; legacy usa `SCHOOL_ORGANIZER` |
| **`User`** | Mono añade `globalRole`, `userSessions`, relaciones members |
| **Tablas members/cards** | 26 modelos solo mono — OK en DB compartida si no chocan nombres |

### FotoRank (SAFE en nombres)

25 modelos `Fotorank*` sin colisión de nombre con legacy. Riesgo operativo: tamaño del schema y migraciones en misma DB.

### Shared packages

| Paquete | Impacto del diff |
|---------|------------------|
| `@repo/db` | Debe reflejar schema unificado; hoy **no** es superset de legacy |
| `@repo/auth` | Depende de `UserSession` (solo mono) — legacy usa cookie distinta |
| `@repo/auth-guards` | `Role` / `globalRole` deben alinearse con enum unificado |

---

## 8. Matriz de severidad por categoría

| Categoría | SAFE | REVIEW | CRITICAL |
|-----------|-----:|-------:|---------:|
| Modelos solo legacy | 13 | 69 | 0 |
| Modelos solo mono | 51 | 5 | 2 |
| Modelos compartidos modificados | 0 | 16 | 8 |
| Enums compartidos distintos | 2 | 0 | 3 |
| Migraciones (estrategia) | — | 19 mono + 169 legacy | Squash / orden |

---

## 9. Comandos de reproducción

```bash
# Conteos modelos
grep -c '^model ' /Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma
grep -c '^model ' packages/db/prisma/schema.prisma

# Solo en legacy
comm -23 \
  <(grep '^model ' /Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma | awk '{print $2}' | sort) \
  <(grep '^model ' packages/db/prisma/schema.prisma | awk '{print $2}' | sort)

# Migraciones
comm -23 /tmp/legacy-migs.txt /tmp/mono-migs.txt | wc -l   # 169
comm -13 /tmp/legacy-migs.txt /tmp/mono-migs.txt             # 19 mono
```

---

## Referencias

- [`02-legacy-inventory.md`](./02-legacy-inventory.md) — inventario funcional legacy
- [`prisma-migration-plan.md`](./prisma-migration-plan.md) — plan de unificación
- [`01-current-state.md`](./01-current-state.md) — WIP monorepo

---

*Análisis generado sin modificar schemas ni ejecutar herramientas Prisma destructivas.*
