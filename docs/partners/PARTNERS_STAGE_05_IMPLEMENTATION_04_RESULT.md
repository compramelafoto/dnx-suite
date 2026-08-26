# DNX Partners — ETAPA 05 / IMPLEMENTACIÓN 04 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `DONE`  
**Alcance:** migrate + deploy productivo onboarding Partners + logos PNG/WEBP (sin features nuevas).

---

## 1. Estado general

DONE en producción.

- Migración `20260807190000_dnx_partner_onboarding_invitation` aplicada en **Clickatón** y **FotoRank**.
- Deploy Clickatón `READY` + alias `maratonfotografica.com`.
- FotoRank: solo migrate schema (sin delta UI); **sin redeploy** de app.
- Tests `@repo/partners`: 92/92. Build Clickatón PASS.

---

## 2. Delta funcional

| Área | Contenido |
|------|-----------|
| Dominio | onboarding API/token/status, logo MIME PNG/WEBP, `client-safe` exports |
| DB | invitation + brand profile columns + contact privacy flags |
| Clickatón | formulario token, APIs, admin invite/review, logo library |
| FotoRank | schema parity only |

Fix de deploy (mínimo): `@repo/partners/client-safe` para Client Components (evita `node:crypto` del barrel).

---

## 3. Migraciones FotoRank

| Migración | Estado |
|-----------|--------|
| `20260807190000_dnx_partner_onboarding_invitation` | **APPLIED** |
| Post-status | Database schema up to date |

Host allowlist: `ep-dawn-dew…` / DB `neondb`.

---

## 4. Migraciones Clickatón

| Migración | Estado |
|-----------|--------|
| `20260807190000_dnx_partner_onboarding_invitation` | **APPLIED** |
| Post-status | Database schema up to date |

Host allowlist: `ep-silent-haze…` / DB `clickaton_production`.

---

## 5. Backups

| Base | Nombre | Id | Estado |
|------|--------|-----|--------|
| Clickatón | `backup-clickaton-partners-onboarding-prod-20260807` | `br-dawn-hat-awt4rdmb` | ready |
| FotoRank | `backup-fotorank-partners-onboarding-prod-20260807` | `br-mute-sun-adqislq3` | ready |

---

## 6. SQL audit

Migración aditiva: CREATE TYPE ×2, ADD COLUMN IF NOT EXISTS, CREATE TABLE invitation, índices, FKs.  
Sin DROP / TRUNCATE / reset / renames destructivos.

---

## 7. Migrate status post

Ambas DBs: **up to date**. Tabla `DnxPartnerOnboardingInvitation` presente. Invitaciones count: 0.

---

## 8–11. Validaciones

| Check | Resultado |
|-------|-----------|
| Tests `@repo/partners` | 92/92 PASS |
| Typecheck partners | PASS |
| Typecheck onboarding Clickatón | PASS (fix TS2742 return type) |
| Lint | no corrido global |
| Build Clickatón | PASS (local + Vercel) |
| Prisma validate/generate | PASS en migrate scripts |

---

## 12–17. Logos

Nuevos: solo PNG/WEBP. JPG nuevo rechazado. Legacy JPG no eliminado. Variantes + ayudas visuales + upload R2 → `DnxPartnerAsset`.

---

## 18–24. Formulario / token / admin

- Ruta: `/partners/completar-datos/[token]`
- Token hash SHA-256; expiración 14d; revocable; rate limit
- SEO: `noindex, nofollow`; ausente sitemap/nav
- Admin: Solicitar datos / Copiar link / review
- Submit no publica; prospect/confirmado intactos

---

## 25–29. Submit / review / seguridad

Cubierto por tests + APIs. API token inválido → 404 genérico sin enumeración.

---

## 30. Deployment Clickatón

| Campo | Valor |
|-------|-------|
| Project | `clickaton-dnxsuite` |
| Deployment ID | `dpl_6AUkZJk9wjg4FC9jUGAxWB7KBTa8` |
| URL | `clickaton-dnxsuite-n4a65li42-compramelafotos-projects.vercel.app` |
| Alias | `maratonfotografica.com` |
| readyState | READY |
| Rollback prev | `dpl_9W8T365baPwC1MZNJM8qzMttG6L1` |

---

## 31. Smoke Clickatón

| Check | Resultado |
|-------|-----------|
| Home / maratones / tienda / login | HTTP OK |
| Token inválido API | 404 + mensaje genérico |
| Página token | `robots=noindex, nofollow` |
| Sitemap/home | sin links onboarding |
| Admin sponsors | requiere auth (redirect login) |
| Ruta build | `/partners/completar-datos/[token]` presente |

Prueba controlada con partner real + submit: no ejecutada (evitar contaminar prod); preferir admin genera link cuando haya caso autorizado.

---

## 32–33. FotoRank deploy

**No aplica** redeploy app (sin UI Imp 03). Solo migrate schema DONE.

---

## 34. Producción estable

Alias productivo Clickatón apunta al nuevo deployment READY. Migraciones aplicadas sin errores.

---

## 35. Rollback

| Tipo | Mecanismo |
|------|-----------|
| Código | `vercel rollback` / redeploy `dpl_9W8T365baPwC1MZNJM8qzMttG6L1` |
| DB | branches Neon `br-dawn-hat-awt4rdmb` / `br-mute-sun-adqislq3` (solo con análisis) |
| Invitaciones | revoke status |

---

## 36. Riesgos

- Disco local casi lleno durante build (cache ENOSPC); build Vercel OK.
- Deploy desde workspace dirty (WIP ajeno presente en upload); turbo solo buildéa clickaton.
- Aprobar datos crea contacto primary adicional.

---

## 37. Archivos tocados en Imp 04 ops

- Migrates aplicados (SQL ya versionado Imp 03)
- Fix deploy: `packages/partners/src/client-safe.ts` + exports + imports UI cliente
- Return types API admin onboarding
- Doc este archivo

---

## 38. % MVP Sponsors

~**95%** Stage 05 (tracking + carga + onboarding + prod). Falta email/WhatsApp invite opcional.

---

## 39. Próximo paso

1. En admin Clickatón: generar invitación a un partner real autorizado.  
2. Completar ficha + logo PNG/WEBP.  
3. Review → aprobar datos/logos → mantener `HIDDEN` hasta decisión de publicación.  
4. (Opcional) email “Solicitar datos” automático.
