# DNX Partners — Propuesta de dominio mínimo

**Fecha:** 2026-08-01  
**Etapa:** 00 / Implementación 01  
**Principio central:** un partner no implica pago. El dinero es un aporte opcional.

---

## 1. Naming

| Capa | Nombre | Notas |
|------|--------|-------|
| UI inicial | Sponsors y beneficios | No renombrar producto en esta etapa |
| Dominio técnico | DNX Partners | Prefijo schema `DnxPartner*` |
| Package | `@repo/partners` | Dominio puro + permisos; sin Prisma client directo idealmente (adapters) |
| No usar | “Partner” sin calificar en UI de payments | Reservar “partner de cobro / finance partner” |

---

## 2. Principios de modelo

1. **Una ficha Partner por empresa/institución/marca** en DNX Suite.
2. Las apps no duplican la ficha; crean **participaciones contextuales**.
3. Los **beneficios** pueden reutilizarse en varias apps/audiencias.
4. El módulo funciona **sin Mercado Pago, sin cobros y sin suscripciones**.
5. Carga y confirmación **manual** primero.
6. Enlaces a entidades externas (edición, concurso, álbum, FI, promoción) son **opcionales**.
7. Reglas de elegibilidad **tipadas** (no solo JSON libre).
8. Trazabilidad `createdAt/updatedAt` + actor cuando aplique; archivado en lugar de hard delete.
9. Sin dependencias circulares: `@repo/partners` → tipos/dominio; apps → adapters; payments solo vía puente opcional.

---

## 3. Modelo mínimo recomendado (v1)

### 3.1 `DnxPartner`

Empresa, comercio, institución, marca o persona colaboradora.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | cuid | |
| displayName | string | Nombre público |
| legalName | string? | |
| slug | string unique | |
| description | string? | |
| logoAssetId / logoUrl | soft ref | Alinear con media suite |
| website | string? | |
| instagram | string? | |
| email | string? | Contacto operativo (permiso sensible) |
| phone | string? | Sensible |
| taxId | string? | Opcional; no implica facturación |
| status | enum | DRAFT, ACTIVE, SUSPENDED, ARCHIVED |
| notesInternal | string? | Solo staff |
| financialIdentityId | string? | **Opcional** → `DnxFinancialIdentity` |
| createdByUserId | int? | |
| createdAt / updatedAt | datetime | |

Relaciones futuras: `applications[]` o tags `relatedAppKeys[]` (CLICKATON, FOTORANK, …) sin FK rígida a apps.

### 3.2 `DnxPartnerParticipation`

Participación concreta del partner en un contexto.

Ejemplos: Sony × Clickatón Rosario 2026; Tecnoflash × beneficios SFPR; Vicario × premio FotoRank.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | cuid | |
| partnerId | FK | |
| applicationKey | string | CLICKATON \| FOTORANK \| … |
| organizationRef | string? | Opaco (org FR, workspace, etc.) |
| contextType | enum tipado | EDITION, VENUE, CATEGORY, CONTEST, ALBUM, ORG, PLATFORM, OTHER |
| contextId | string? | ID opaco del contexto |
| participationType | enum | SPONSOR, PRIZE_PROVIDER, BENEFIT_PROVIDER, INSTITUTIONAL_ALLY, SERVICE_PROVIDER, PROMOTER, OTHER |
| title | string? | |
| description | string? | |
| startsAt / endsAt | datetime? | |
| status | enum | DRAFT, CONFIRMED, ACTIVE, ENDED, CANCELLED, ARCHIVED |
| estimatedValueMinor | int? | Referencial, opcional |
| currency | string? | Default ARS |
| requiresPayment | boolean | Default **false** |
| visibility | enum | INTERNAL, PUBLIC, MEMBERS_ONLY |
| notesInternal | string? | |
| createdAt / updatedAt | | |

### 3.3 `DnxPartnerContribution`

Qué aporta el partner en una participación (1..N).

| Campo | Tipo |
|-------|------|
| id | cuid |
| participationId | FK |
| kind | enum (abajo) |
| title | string |
| description | string? |
| quantity | int? |
| estimatedValueMinor | int? |
| promotionId | string? | Opcional → `DnxPromotion` |
| prizeBundleId | string? | Opcional soft-ref Clickatón |
| externalCode | string? | Código voucher manual |
| metadata | Json? | Solo datos no críticos; validar campos tipados fuera |
| status | enum | PLANNED, CONFIRMED, DELIVERED, CANCELLED |

**`ContributionKind` v1:**

```
MONEY
PRODUCT
PRIZE
VOUCHER
DISCOUNT
SERVICE
EQUIPMENT
PROMOTION
INSTITUTIONAL_SUPPORT
OTHER
```

Cubre Tecnoflash (SERVICE/DISCOUNT), Vicario (SERVICE + límites), Sony (PRIZE/DISCOUNT/SPONSOR), canjes, difusión (`PROMOTION`), etc.

### 3.4 `DnxBenefit`

Beneficio usable por usuarios elegibles (puede vivir sin participación, pero v1 recomienda anclar a partner + participación opcional).

| Campo | Tipo | Notas |
|-------|------|-------|
| id | cuid | |
| partnerId | FK | |
| participationId | FK? | |
| title | string | |
| description | string? | |
| benefitType | enum | DISCOUNT_PERCENT, DISCOUNT_AMOUNT, FREE_SERVICE, VOUCHER, CODE, PRODUCT, ACCESS, OTHER |
| percentOff / amountOffMinor | int? | |
| code | string? | Puede espejar o linkear `DnxPromotion` |
| promotionId | string? | |
| redemptionInstructions | string? | Cómo canjear (credencial, local, web) |
| startsAt / endsAt | datetime? | |
| totalQuota | int? | |
| perPersonLimit | int? | |
| status | enum | DRAFT, PUBLISHED, PAUSED, EXPIRED, ARCHIVED |
| publishChannels | string[] tipado | FOTOFFICE, CLICKATON, EMAIL, MANUAL, … |
| termsSummary | string? | Resumen; legales fuera de schema |
| createdAt / updatedAt | | |

### 3.5 `DnxBenefitAudience` (eligibility simple)

Primera versión: **filas tipadas**, no motor de reglas complejo.

| Campo | Tipo |
|-------|------|
| id | cuid |
| benefitId | FK |
| audienceType | enum (abajo) |
| refType | string? | organization, edition, product, membership, … |
| refId | string? | |
| manualUserId | int? | Para MANUAL_USERS |
| label | string? | |

**`AudienceType` v1:**

```
ALL_USERS
ORGANIZATION_MEMBERS      # socios SFPR / ContestOrganization / etc. vía ref
EVENT_PARTICIPANTS        # edición Clickatón / concurso
PRODUCT_BUYERS            # inscripción / producto comprado
MANUAL_USERS
ROLE_OR_MEMBERSHIP        # membresía / rol tipado
CUSTOM_FUTURE             # placeholder explícito, no implementar motor
```

Evaluación: función pura en `@repo/partners` + adapters por app que resuelven “¿este User califica?”.

### 3.6 `DnxPartnerPaymentTerms` (opcional)

Solo si `participation.requiresPayment === true`.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | cuid | |
| participationId | FK unique | |
| mode | enum | ONE_TIME, INSTALLMENTS, MONTHLY, TRANSFER, PAYMENT_LINK, MERCADO_PAGO, MANUAL |
| amountMinor | int? | |
| currency | string? | |
| dueAt | datetime? | |
| status | enum | NOT_REQUIRED, PENDING, PARTIAL, PAID, WAIVED, CANCELLED |
| financialIdentityId | string? | |
| economicAgreementId | string? | Soft link |
| notes | string? | |

**v1:** CRUD manual de estado. **Sin** crear preferencias MP, cuotas automáticas ni suscripciones.

---

## 4. Qué queda fuera del núcleo v1

- CRM completo / pipeline comercial.
- Marketplace de beneficios.
- ROI / analytics avanzados.
- Facturación fiscal.
- Motor de reglas eligibility complejo (AND/OR anidados).
- Automatizaciones de marketing.
- Portal self-service completo del partner.
- Renombrado global de “Partner” en payments.

---

## 5. Relación con dominios existentes

```
DnxPartner ──opcional──► DnxFinancialIdentity
     │
     ├── DnxPartnerParticipation ──opcional──► context (edition/contest/…)
     │         │
     │         ├── DnxPartnerContribution ──opcional──► DnxPromotion / PrizeBundle
     │         └── DnxPartnerPaymentTerms ──opcional──► EconomicAgreement
     │
     └── DnxBenefit ──► DnxBenefitAudience
              │
              └──opcional──► DnxPromotion
```

### Mapeo de ejemplos reales

| Caso | Partner | Participation | Contribution | Benefit / Audience |
|------|---------|---------------|--------------|--------------------|
| Tecnoflash descuento socios SFPR | Tecnoflash | FOTOFFICE / org SFPR | DISCOUNT/SERVICE | Benefit + ORGANIZATION_MEMBERS |
| Tecnoflash Clickatón | Tecnoflash | CLICKATON edition | DISCOUNT | Benefit + EVENT_PARTICIPANTS |
| Vicario limpiezas + credencial | Vicario | MULTI | SERVICE | Benefit + límite + instrucciones |
| Sony sponsor categoría FR | Sony | FOTORANK contest/category | PRIZE / MONEY? | Public visibility; benefit opcional |
| Sony códigos | Sony | MULTI | DISCOUNT → Promotion | Benefit code + audience |
| Clickatón sponsor sede | Partner X | CLICKATON venue | PROMOTION / MONEY? | Display público; paymentTerms opcional |
| Participación sin pago | Partner Y | any | PRODUCT/SERVICE | requiresPayment=false |

---

## 6. Ubicación en el monorepo

```
packages/partners/                 # @repo/partners (NUEVO)
  src/
    types.ts                       # enums y records
    partner.ts                     # invariantes de ficha
    participation.ts
    contribution.ts
    benefit.ts
    eligibility.ts                 # evaluateAudience puro
    permissions.ts                 # capabilities + assert*
    index.ts
  README.md

packages/db/prisma/schema.prisma   # modelos DnxPartner* (etapa siguiente)
docs/partners/                     # esta documentación

apps/clickaton/...                 # primer consumidor admin + público
apps/fotoffice/...                 # primer consumidor de beneficios elegibles
apps/fotorank/...                  # bridge premios/sponsors
apps/compramelafoto/...            # bridge display landing (fase posterior)
apps/infospot/...                  # consumo editorial / difusión (fase posterior)
```

### Dependencias permitidas

```
@repo/partners  →  (ninguna app; opcional types-only)
apps/*          →  @repo/partners + @repo/db adapters
@repo/payments  →  NO depende de @repo/partners en v1
@repo/partners  →  NO importa @repo/payments en v1 (IDs opcionales como string)
@repo/promotions→  independiente; link por promotionId
```

---

## 7. Permisos propuestos

Capa nueva (espejo de finance grants), **no** reutilizar `DNX_FINANCE_PARTNER_CONNECT`.

### Capabilities sugeridas

| Capability | Descripción |
|------------|-------------|
| `partner.read` | Ver partners no sensibles |
| `partner.create` | Alta de ficha |
| `partner.update` | Editar ficha |
| `partner.archive` | Archivar |
| `partner.participation.manage` | CRUD participaciones |
| `partner.contribution.manage` | CRUD aportes |
| `partner.benefit.manage` | CRUD beneficios |
| `partner.audience.assign` | Asignar audiencias |
| `partner.benefit.publish` | Publicar / pausar beneficios |
| `partner.commercial.manage` | Notas comerciales, valor estimado |
| `partner.payment_terms.manage` | PaymentTerms opcionales |
| `partner.contact.sensitive` | Ver email/teléfono/taxId/notas internas |

### Integración con roles existentes

| Actor actual | Acceso v1 sugerido |
|--------------|-------------------|
| Clickatón admin (allowlist / SUPER_ADMIN) | Bundle operativo completo **excepto** payments finance |
| `DNX_FINANCE_OWNER` / `PRODUCT_FINANCE_MANAGER` | `payment_terms` + link FI (no implica publish benefits) |
| FotoOffice WORKSPACE_OWNER/ADMIN | Ver beneficios publicados + audiencias de su org (no CRM global) |
| FotoRank org OWNER/ADMIN | Gestionar participaciones de **sus** concursos (scope) |
| Partner externo (futuro portal) | Solo su ficha / aportes; fuera de v1 |
| Finance `PARTNER_CONNECT` | **Sin** acceso CRM partners salvo que se otorgue grant aparte |

Implementación v1 pragmática en Clickatón: gate admin existente + checks de capability en server actions (tabla `DnxPartnerGrant` o reutilizar shape de `DnxFinanceGrant` con enum distinto).

---

## 8. Validaciones tipadas (anti-JSON-crítico)

Persistir como columnas/enums:

- `ContributionKind`, `AudienceType`, `ParticipationType`, `BenefitType`, `PaymentMode`, statuses.

JSON permitido solo para:

- `metadata` no crítico (URLs extra, copy A/B).
- Snapshots de auditoría de publicación.

Evaluadores de elegibilidad y publicación deben vivir en TypeScript tipado en `@repo/partners`.
