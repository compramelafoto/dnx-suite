# DNX Partners y Beneficios — ETAPA 00 / IMPLEMENTACIÓN 01 — Auditoría

**Fecha:** 2026-08-01  
**Alcance:** solo lectura / documentación  
**Producto UI propuesto:** Sponsors y beneficios  
**Dominio técnico propuesto:** DNX Partners  
**Restricciones respetadas:** sin migraciones, sin deploy, sin cobros, sin emails, sin refactors, sin eliminar modelos.

---

## Resumen ejecutivo

Hoy **no existe** un módulo transversal de partners comerciales / sponsors / beneficios reutilizable por las apps de DNX Suite.

Lo que sí existe son **fragmentos por producto** con semánticas distintas (y a menudo conflictivas) de la palabra “partner”:

| Fragmento | Semántica real | ¿Reutilizable para DNX Partners? |
|-----------|----------------|-----------------------------------|
| `@repo/payments` partner-onboarding | Socio de cobro Split MP | No como ficha comercial; sí enlace opcional futuro a `PaymentTerms` |
| `DnxPromotion` + `@repo/promotions` | Códigos de descuento en checkout | Sí, como un tipo de aporte / beneficio monetario |
| `OrganizerLandingSponsor` (CLF) | Logo/nombre en landing organizador | Parcial: display local, no ficha global |
| `ClickatonPrizeBundle.sponsor` | String libre en premio | No como entidad |
| `FotorankContest.sponsorsText` + JSON premios | Texto / JSON en reglas | Parcial: tipos conceptuales útiles |
| `BenefitDefinition` (CLF packs) | Beneficio de pack preventa | No: dominio álbum/print |
| `ClickatonUserEntitlement` | Early price / annual pass | No: entitlement de producto Clickatón |
| `CommunityProfile` | Directorio vendors CLF | Parcial: perfil público, no CRM partner |
| `ContestOrganization` / `Workspace` | Orgs de producto | No: no son partners comerciales |
| `DnxFinancialIdentity` | Identidad financiera PERSON/ORG | Enlace opcional; no sustituye ficha partner |

**Conclusión:** la primera versión debe crear un dominio nuevo (`DnxPartner*`) sin reutilizar la semántica “Partner” de Mercado Pago, sin asumir pagos, y sin duplicar la ficha principal en cada app.

---

## 1. Aplicaciones auditadas

| App | Sponsors UI | Beneficios comerciales | Promos códigos | Premios | Madurez relevante |
|-----|-------------|------------------------|----------------|---------|-------------------|
| **Clickatón** | Admin placeholder + marketing público | Premios / first-N / fases | ✅ `@repo/promotions` | ✅ bundles DB | Alta (hueco CRM) |
| **ComprameLaFoto** | Landing organizador CRUD | Packs preventa, lab, referral | ❌ no usa `@repo/promotions` | N/A | Alta (display local) |
| **FotoRank** | Texto libre + sponsor en premios JSON | Tipos `SPONSOR_BENEFIT`, `DISCOUNT`, `COUPON` | ❌ | ✅ JSON `rulesData` | Media |
| **FotoOffice** | Ninguno | `discountPrice` cursos | ❌ | Ninguno | Baja |
| **InfoSpot** | Ninguno | Ninguno | ❌ | Ninguno comercial | Nula |
| **DNX Payments** (paquete) | N/A | N/A | N/A | N/A | Partner = cobro MP |

También se revisaron: `packages/db`, `packages/promotions`, `packages/payments`, `packages/auth`, `packages/auth-guards`, docs de identidad y ADR financieros.

---

## 2. Modelos existentes relacionados

Fuente: `packages/db/prisma/schema.prisma`.

### 2.1 Sponsors / marcas (parciales)

| Modelo / campo | Dominio | Notas |
|----------------|---------|-------|
| `OrganizerLandingSponsor` | CLF | `name`, `logoR2Key`, `url`, `sortOrder`, `isActive`; comentario “fase posterior” |
| `ClickatonPrizeBundle.sponsor` | Clickatón | String libre |
| `FotorankContest.sponsorsText` | FotoRank | Texto libre |
| `FotorankContest.prizesSummary` | FotoRank | Texto libre |
| Premios JSON (`rulesData.premiosRecompensas`) | FotoRank | `sponsorName/Url/Logo`, tipos premio/reward |
| `ClickatonContactMessage` | Clickatón | Inbox “formar parte / sponsors”; no CRM |

### 2.2 Promociones / descuentos

| Modelo | Dominio | Notas |
|--------|---------|-------|
| `DnxPromotion` | Transversal (schema) | Código, %/monto, vigencia, cupos, `platform`, `editionId?` |
| `DnxPromotionRedemption` | Transversal | RESERVED / CONFIRMED / RELEASED + idempotencia |
| `LabSizeDiscount` | CLF labs | Descuento qty/tamaño |
| Descuentos digitales User/Album | CLF | Float % volumen |
| `CourseSalesCourse.discountPrice` | FotoOffice | Precio tachado |
| `ReferralCode` / Attribution | CLF | Referidos, no cupón genérico |

### 2.3 Benefits / entitlements (otras semánticas)

| Modelo | Dominio | Semántica |
|--------|---------|-----------|
| `BenefitDefinition` | CLF packs | Ítems incluidos en pack |
| `PackPurchaseEntitlement` | CLF | Derecho canjeable post-pago |
| `ClickatonUserEntitlement` | Clickatón | Early price / annual pass |
| `ClickatonEntitlementConsumption` | Clickatón | Consumo idempotente |

### 2.4 Premios

| Modelo | Dominio | Notas |
|--------|---------|-------|
| `ClickatonPrizeBundle` + `Assignment` | Clickatón | Premios por edición; sponsor string |
| FotoRank `ContestPrizeItem` / `ContestRewardItem` | FotoRank | Tipado rico en TS, persistido en JSON |

### 2.5 Organizations / memberships / community

| Modelo | Dominio | Notas |
|--------|---------|-------|
| `ContestOrganization` + Member | FotoRank | Org organizadora de concursos |
| `Workspace` + `WorkspaceMembership` | FotoOffice / suite | Tenant operativo |
| `Membership` | Legacy workspace | Dual-write con WorkspaceMembership |
| `CommunityProfile*` | CLF | Directorio fotógrafos/vendors |
| `School`, `Lab` | CLF | Entidades de producto, no partners DNX |
| Enums huérfanos `MembershipFee*` | Schema | Preparación de cuotas de socios; **sin modelo** |

### 2.6 Identidad financiera / payments (no CRM)

| Modelo | Notas |
|--------|-------|
| `DnxFinancialIdentity` | PERSON \| ORGANIZATION; `legalName`, `taxId`, `organizationRef` |
| `DnxEconomicAgreement` + participants/versions/rules | Acuerdos de % versionados |
| `DnxFinanceGrant` | Capabilities financieras explícitas |
| `DnxPayment*` / MP OAuth | Cobros, splits, vault |

**No existen** modelos: `Company`, `LegalEntity`, `Business`, `Advertiser`, `Coupon`, `Voucher`, `Billing`, `Subscription`, `Eligibility`, ni `DnxPartner`.

---

## 3. Confusión crítica de nomenclatura: “Partner”

En el monorepo, **Partner** significa hoy casi siempre:

1. **Participante económico de Split Mercado Pago** (`PARTNER` en receiver/roleLabel).
2. **Usuario con grant** `DNX_FINANCE_PARTNER_CONNECT` (conectar su propia cuenta MP).
3. Keys productivas Clickatón: `dani` / `rodri` / `tammy` en `@repo/payments` governance.

**No** significa “empresa patrocinadora / aliada comercial”.

### Recomendación de naming (sin renombrar producto en esta etapa)

| Capa | Nombre |
|------|--------|
| UI visible (inicial) | **Sponsors y beneficios** |
| Dominio técnico | **DNX Partners** (`DnxPartner`, `DnxPartnerParticipation`, …) |
| Partners de cobro MP | Mantener vocabulario existente en payments (`finance partner`, `MP partner connect`) |
| Código nuevo | Prefijo `DnxPartner*` / package `@repo/partners` — **nunca** reutilizar clases/símbolos de `partner-onboarding` sin calificar |

---

## 4. Funcionalidades reutilizables

### Reutilizar / adaptar

1. **`@repo/promotions` + `DnxPromotion*`** — motor de códigos; un `Contribution` tipo `DISCOUNT` / beneficio con código puede enlazar a una promoción existente.
2. **Patrón de grants** (`DnxFinanceGrant` + `finance-permissions`) — plantilla para permisos granulares de partners (capa separada).
3. **`DnxFinancialIdentity`** — enlace opcional cuando haya aporte monetario o cobro; nunca obligatorio.
4. **UI Clickatón admin** — shell de `/admin/sponsors` + navegación ya reservada; CRUD de promociones como referencia UX.
5. **UI CLF `OrganizerLandingSponsorsManager` / carousel** — patrón de display de logos (scope local).
6. **Tipos FotoRank prize/reward** — catálogo conceptual de aportes no monetarios (`SPONSOR_BENEFIT`, `DISCOUNT`, `COUPON`, `PROMOTION`).
7. **Tipos públicos Clickatón `PublicSponsor`** — shape de presentación (local/global, level, logo).
8. **Identidad `User` + `@repo/auth`** — usuarios elegibles; no crear identidad paralela de partners-personas.
9. **Patrones de estado** — `isActive`, `ARCHIVED`, `REVOKED` (evitar hard delete).
10. **Contact inboxes** — leads de “quiero ser aliado”; no son el CRM del partner, pero alimentan alta manual.

### No reutilizar como núcleo

- `BenefitDefinition` / pack entitlements CLF (dominio preventa).
- `ClickatonUserEntitlement` (producto Clickatón).
- `CommunityProfile` como ficha canónica (otro flujo de alta/directorio).
- `ContestOrganization` / `Workspace` como “la empresa partner”.
- Labels `PARTNER` de agreements/split como entidad comercial.

---

## 5. Duplicaciones encontradas

| Concepto | Duplicación |
|----------|-------------|
| Sponsor display | CLF `OrganizerLandingSponsor` vs Clickatón `PublicSponsor` (fixtures/demo) vs FotoRank `sponsorsText` |
| Sponsor en premio | Clickatón string `sponsor` vs FotoRank `sponsorName/Url/Logo` en JSON |
| “Beneficio” | CLF pack benefit vs Clickatón first-N / entitlement vs marketing copy “benefits” vs futuro beneficio partner |
| “Partner” | Finance MP partner vs marketing “aliados/sponsors” vs roleLabel `PARTNER` |
| Descuentos | `DnxPromotion` vs lab discounts vs referral vs `discountPrice` cursos vs reward `COUPON` en JSON |
| Organización | ContestOrganization vs Workspace vs FinancialIdentity ORGANIZATION vs CommunityProfile vs School/Lab |
| Contacto comercial | `ContactMessage`, `ClickatonContactMessage`, leads FO/CLF — sin CRM unificado |

---

## 6. Riesgos de acoplamiento

1. **DB Clickatón separada** (histórica): un `DnxPartner` en DB suite no aparece automáticamente en Neon Clickatón hasta unificar identidad/datos.
2. **Mezclar partners comerciales con finance partners** → grants/MP y CRM colisionan en UI y permisos.
3. **Meter ficha partner dentro de ContestOrganization / Workspace** → filtra mal por producto y rompe “una empresa, una ficha”.
4. **Depender de Mercado Pago** para el módulo → viola el principio “pago opcional”.
5. **Guardar eligibility solo como JSON** sin tipos → reglas opacas e inconsistentes entre apps.
6. **Publicar beneficios sin capa legal** → riesgo de marcas, datos personales y códigos compartidos.
7. **Reutilizar `@repo/promotions` sin vínculo tipado a Partner** → códigos huérfanos sin dueño comercial.
8. **Dependencias circulares** si `@repo/partners` importa apps o si payments importa partners y viceversa sin puentes claros.

---

## 7. Soft delete / archivado

No hay soft-delete global. Para partners se recomienda alinear con patrones maduros:

- Status `DRAFT | ACTIVE | SUSPENDED | ARCHIVED` (como FI).
- `isActive` / `publishedAt` en beneficios.
- Grants/contactos sensibles: `REVOKED` + timestamps.
- Evitar `DELETE` físico de fichas con historial de participaciones.

---

## 8. Permisos actuales (contexto)

| Capa | Mecanismo |
|------|-----------|
| Clickatón admin | Allowlist email + `SUPER_ADMIN` — **sin** rol sponsor |
| Finanzas | `DnxFinanceGrant` tipado |
| FotoRank | Membership org (poco enforced en UI) |
| FotoOffice | `WorkspaceMembership` |
| InfoSpot | `InfoSpotUserRole` |
| CLF sponsors landing | Ownership del `OrganizerPublicProfile` |

No hay capabilities `partner.*` comerciales. Ver propuesta en `partners-domain-proposal.md` e integración en `partners-integration-map.md`.

---

## 9. Evidencia de paths clave

```
packages/db/prisma/schema.prisma          # OrganizerLandingSponsor, DnxPromotion*, FI, prizes
packages/promotions/                      # motor códigos
packages/payments/src/partner-onboarding/ # Partner = MP (NO comercial)
packages/payments/src/finance-permissions/
apps/clickaton/app/admin/(panel)/sponsors/page.tsx
apps/clickaton/app/admin/(panel)/promociones/page.tsx
apps/clickaton/content/founding-allies.ts
apps/clickaton/components/marathon/MarathonSponsors.tsx
apps/compramelafoto/components/organizer/OrganizerLandingSponsorsManager.tsx
apps/fotorank/app/lib/fotorank/prizesRewards.ts
docs/architecture/decisions/0002-financial-identity-and-economic-agreements.md
docs/auth/DNX_SUITE_IDENTITY_CURRENT_STATE_AUDIT.md
docs/dnx-payments/DNX_FINANCE_ROLE_MATRIX.md
```

---

## 10. Veredicto de auditoría

| Pregunta | Respuesta |
|----------|-----------|
| ¿Existe módulo DNX Partners? | **No** |
| ¿Existe identidad compartida de empresa comercial? | **No** (solo FI financiera + orgs de producto) |
| ¿Se puede construir sin pagos? | **Sí** — y debe ser el default |
| ¿Hay base para códigos/descuentos? | **Sí** — `@repo/promotions` |
| ¿Hay UI Clickatón lista? | **Slot vacío** en `/admin/sponsors` |
| ¿Bloqueadores duros para documentar el dominio? | **Ninguno** |
| ¿Bloqueadores para implementación productiva multi-app? | Identidad/DB Clickatón + decisiones humanas (ver pending) |

**Estado de esta etapa documental:** `DONE`.
