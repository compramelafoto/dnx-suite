# DNX Partners — ETAPA 03 / IMPLEMENTACIÓN 01 — Resultado

**Fecha:** 2026-08-03  
**Estado:** `DONE` (integración FotoOffice de beneficios accesibles; flags off; sin deploy/commit)

---

## Resumen

FotoOffice consume beneficios ya materializados en `DnxPartnerBenefitAccess` vía dominio `@repo/partners`. No recalcula elegibilidad ni administra sponsors.

App: `apps/fotoffice` (package `fotoffice`).

---

## Decisiones de auditoría acotada

| Tema | Decisión |
|------|----------|
| Auth | `requireAuth()` → `user.id: number` |
| Nav | `ShellNav` + flag de visibilidad |
| Feature flags | Env (mismo patrón que platform admin emails) |
| UI | Sistema `.fo-*` local (sin `@repo/design-system`) |
| Imágenes | `<img>` + `object-contain` / `object-cover` |
| Admin | Solo `isFotofficePlatformAdmin` |
| Analytics | Diferida (sin infra canónica) |
| Caché | Ninguna compartida; consulta por `userId` |

---

## Rutas

| Ruta | Rol |
|------|-----|
| `/beneficios` | Usuario autenticado (si flags lo permiten) |
| `/beneficios/[benefitId]` | Detalle; revalida acceso |
| `/admin/beneficios` | Super admin: resumen + preview |

---

## Feature flags

```bash
FOTOFFICE_PARTNER_BENEFITS_ENABLED          # módulo
FOTOFFICE_PARTNER_BENEFITS_PUBLICATION_APPROVED  # gate legal
CLICKATON_ADMIN_BASE_URL                   # links a ficha canónica
```

| ENABLED | PUBLICATION | Comportamiento |
|---------|-------------|----------------|
| false | * | `notFound`, sin nav |
| true | false | Solo platform admin (preview) |
| true | true | Usuarios con acceso FOTOFFICE |

**No activar en producción** sin checklist legal.

---

## Adapter / DTO

`apps/fotoffice/lib/partners/**`

- `listFotoOfficeBenefitsForUser`
- `getFotoOfficeBenefitDetail`
- `getFotoOfficeBenefitAccessSummary`
- `previewFotoOfficeBenefitsAsUser` (sin escrituras de access)
- `listAdminFotoOfficeBenefits`

DTO `FotoOfficeAccessibleBenefit`: sin finanzas, notas, taxId, accessKey, reason codes crudos, emails internos.

Reutiliza: `listAccessibleBenefitsForUser`, `canUserAccessBenefit`, `getBenefitAccessExplanation`, `isBenefitCurrentlyAvailable`, `isBenefitExpiringSoon`, resolución de assets.

---

## Métodos de uso

PROMO_CODE (copiar, no redención), DIGITAL_CREDENTIAL (próximamente), PHYSICAL_CREDENTIAL, IDENTITY_VERIFICATION, MANUAL_APPROVAL, EXTERNAL_LINK (URL segura), CONTACT_PARTNER (website/instagram públicos).

---

## Seguridad / privacidad

- Consulta siempre por usuario autenticado.
- Detalle vuelve a chequear acceso.
- Preview admin solo por `userId` numérico + auditoría.
- Sin enumerar otros usuarios ni membresías de terceros.
- Logs: `scope=fotoffice_partner_benefits` sin códigos/PII.

---

## Acción legal (obligatoria antes de publicar)

Flags de publicación deben permanecer off hasta validar autorización del partner, uso de marca, vigencia, cupos, responsabilidades, datos personales, códigos, y que visualizar/copiar ≠ redención.

---

## Próxima implementación recomendada

Redención controlada / QR / credencial digital canónica, o analytics canónica — solo tras gate legal activo.
