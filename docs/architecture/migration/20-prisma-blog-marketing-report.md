# 20 — Reporte Dominio: blog / marketing / leads

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma`  
**Guía:** [`18-prisma-gap-after-video.md`](./18-prisma-gap-after-video.md)

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

## Resumen cuantitativo

| Métrica | Post Cuánto Cobro | Post Blog/Marketing | Δ |
|---------|------------------:|--------------------:|--:|
| Modelos | 230 | **245** | **+15** |
| Enums | 164 | **169** | **+5** |
| Líneas (git diff) | — | — | **+350** |

---

## 1. Modelos agregados (15)

Bloque `// BEGIN LEGACY MERGE — dominio 12 blog / marketing / leads (modelos)`:

| Modelo legacy | Notas |
|---------------|-------|
| `FotoOfficeInterest` | Captación FotoOffice desde CC u otros orígenes |
| `Talk` | Charlas / webinars / capacitaciones |
| `TalkLead` | Leads de charlas |
| `BlogCategory` | Categorías editoriales |
| `BlogTag` | Tags transversales |
| `BlogAuthor` | Autores (opcionalmente vinculados a `User`) |
| `BlogMedia` | Biblioteca multimedia (**no** `BlogImage` en legacy) |
| `BlogPost` | Artículos |
| `BlogPostView` | Vistas únicas por visitante |
| `BlogPostTag` | Relación artículo ↔ tag |
| `BlogSubscriber` | Suscriptores newsletter MVP (**no** `Newsletter` / `NewsletterSubscriber` en legacy) |
| `CharlaFotoEscolarLead` | Lead legacy charla foto escolar |
| `DnxCourseEnrollment` | Inscripciones curso DNX |
| `DnxCourseLead` | Interés en curso sin pago |
| `SimulatorCapture` | Capturas simulador Cam Of Duty |

---

## 2. Modelos solicitados pero inexistentes en legacy (no inventados)

| Nombre solicitado | Estado | Equivalente legacy (si aplica) |
|-------------------|--------|-------------------------------|
| `BlogImage` | ❌ No existe | `BlogMedia` |
| `Lead` | ❌ No existe | `TalkLead`, `CharlaFotoEscolarLead`, `DnxCourseLead` |
| `LeadSource` | ❌ No existe | — |
| `LandingPage` | ❌ No existe | — |
| `Newsletter` | ❌ No existe | `BlogSubscriber` |
| `NewsletterSubscriber` | ❌ No existe | `BlogSubscriber` |
| `ContactForm` | ❌ No existe | — |
| `MarketingCampaign` | ❌ No existe | `EmailCampaign` (ya en mono) |
| `CampaignEvent` | ❌ No existe | — |

---

## 3. Modelos ya presentes en mono (sin re-merge)

| Modelo | Observación |
|--------|-------------|
| `ContactMessage` | Formulario «Trabajá con nosotros» — ya mergeado |
| `EmailCampaign` | Campañas email admin — ya en mono |
| `EmailSend` | Envíos por campaña — ya en mono |

---

## 4. Enums agregados (5)

Bloque `// BEGIN LEGACY MERGE — dominio 12 blog / marketing / leads (enums)`:

| Enum | Valores |
|------|---------|
| `BlogPostStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `BlogPostType` | `BLOG`, `FEATURE`, `CASE_STUDY`, `COMPARISON` |
| `TalkStatus` | `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED` |
| `TalkModality` | `MEET`, `ONLINE`, `PRESENCIAL`, `OTHER` |
| `DnxCourseEnrollmentStatus` | `PENDING_PAYMENT`, `APPROVED`, `CANCELLED` |

---

## 5. Relaciones `User` agregadas (3)

| Relación | Destino |
|----------|---------|
| `blogAuthors` | `BlogAuthor[]` |
| `fotoOfficeInterests` | `FotoOfficeInterest[]` |
| `simulatorCaptures` | `SimulatorCapture[]` |

---

## 6. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 7. Suite intacta

- **FotoOffice** / **FotoRank** — sin modelos suite tocados.

---

## 8. Pendientes post-dominio 12

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | `User`: `payoutAlias`, `payoutBank`, `payoutAccountHolder`, `allowUnpaidOrderClientData`, `workingCoverageRadiusKm` | 16 |
| P2 | `Template.@@index([version])` | 16 |
| P3 | Migración forward SQL | Fase SQL |

---

## Diff resumido

```
packages/db/prisma/schema.prisma | +350
```
