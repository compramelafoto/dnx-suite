# DNX Partners — ETAPA 05 / IMPLEMENTACIÓN 03 — Resultado

**Fecha:** 2026-08-07  
**Estado código:** `DONE`  
**Estado producción:** `DONE` vía Imp 04 — ver `PARTNERS_STAGE_05_IMPLEMENTATION_04_RESULT.md`

---

## 1. Estado general

Implementación de onboarding público por invitación + biblioteca guiada de logos PNG/WEBP en dominio `@repo/partners` y superficie Clickatón.

- Dominio + tests: **PASS** (`@repo/partners` 92/92).
- Typecheck partners + clickaton: **PASS**.
- Migración aditiva lista: `20260807190000_dnx_partner_onboarding_invitation`.
- Deploy / migrate prod: **pendiente de ejecución controlada** (backup → migrate FR+CK → deploy CK).

---

## 2. Formatos nuevos de logo

Solo **PNG** (`image/png`) y **WEBP** (`image/webp`) vía `assertPartnerLogoUploadAllowed`.

## 3. Legacy JPG

JPG/JPEG legacy **no se eliminan**; siguen resolviendo. Admin muestra aviso de formato anterior. Imágenes generales (`assertPartnerUploadAllowed`) siguen admitiendo JPEG.

## 4. Tipos de logo

`LOGO_PRIMARY` (mínimo), `LOGO_LIGHT`, `LOGO_DARK`, `LOGO_HORIZONTAL`, `LOGO_VERTICAL`, `ISOTYPE` — guías en `PARTNER_LOGO_VARIANT_GUIDES`.

## 5. Ejemplos visuales

Cards HTML/CSS (`PartnerLogoVariantCard` / `PartnerLogoLibrary`) sin marcas reales ni deps de generación.

## 6. Preview claro/oscuro

`PartnerLogoDualPreview` — fondo blanco + fondo oscuro, `object-fit: contain`, damero opcional.

## 7. Dimensiones

Recomendaciones en copy; warning no bloqueante si `width < 500` (`partnerLogoResolutionWarning`). Límite logo: **10 MB** (`DNX_PARTNER_LOGO_MAX_BYTES`).

## 8. Validación MIME

Magic bytes + rechazo MIME spoof; logos solo PNG/WEBP.

## 9. Storage

Reutiliza `DnxPartnerAsset` + `getPartnerAssetStorage` (R2). Sin bucket paralelo.

## 10. Logo principal

`isPrimary` en upload `LOGO_PRIMARY`; historial por nuevos assets (no delete físico inmediato).

## 11. Publicación independiente

Submit / approve logo **no** cambian `publicVisibility` ni publican. Gate Imp 02 intacto.

## 12. Formulario previo

**No existía** onboarding público. Se creó canónico.

## 13. Ruta pública

`/partners/completar-datos/[token]` (Clickatón).

## 14. Modelo invitation

`DnxPartnerOnboardingInvitation` + enums status/review. Campos brand profile en `DnxPartner` / privacy flags en contacto.

## 15. Seguridad token

SHA-256 (`tokenHash`); plaintext solo al crear; anti-enumeración; rate limit in-memory; binding partner vía token.

## 16. Expiración

Default **14 días** (`DNX_PARTNER_ONBOARDING_EXPIRES_DAYS`).

## 17. Pasos formulario

1 Empresa · 2 Contacto · 3 Logos · 4 Revisar y enviar.

## 18–23. Datos / contactos / ubicación / destination / logos / consentimientos

Cubiertos en wizard + draft/submit. Contacto privado por defecto. Consentimientos authority + brandUsage obligatorios; marketing opcional.

## 24. Submit

Guarda `submissionJson`, marca `SUBMITTED` + `PENDING_REVIEW`. **No** aplica a `DnxPartner` hasta approve. **No** publica.

## 25–26. Review admin

Panel ACTUAL vs PROPUESTO + aprobar datos/logos / solicitar corrección / rechazar.

## 27–28. Prospectos / confirmados

Submit no cambia `PROSPECT`/`ACTIVE`. Tests cubren prospect permanece prospect.

## 29. Reutilización DNX

Datos van a `DnxPartner` / contact / assets canónicos (multi-app).

## 30. Clickatón

Admin: Solicitar datos, columna “Datos del Partner”, review, logo library, APIs tokenizadas.

## 31. FotoRank

Dominio transversal listo; UI dedicada no obligatoria en esta imp si admin global/CK genera invitación. Requiere migrate schema en DB FR.

## 32. Auditoría

Eventos: invitation_created, link_opened, submitted, data_approved, logos_approved, changes_requested, rejected, revoked. Sin token plano.

## 33. Tests

`partners-onboarding.test.ts` + MIME logo. Suite: **92 pass**.

## 34–36. Typecheck / Lint / Build

- Typecheck `@repo/partners`: PASS  
- Typecheck `apps/clickaton`: PASS  
- Build/deploy prod: pendiente

## 37. Migraciones

`packages/db/prisma/migrations/20260807190000_dnx_partner_onboarding_invitation/migration.sql` — aditiva.

## 38–42. Backup / Deploy / Smoke / Prod / Rollback

**Pendiente ops.** Orden: backup Neon FR+CK → `prisma migrate deploy` en ambas DBs → deploy Clickatón → smoke invite/submit/review → FR deploy solo si hace falta. Rollback: no aplicar código; SQL manual drop de columnas/tabla/enums si fuera necesario (documentado en migración).

## 43. Riesgos

- Migración pendiente = UI onboarding falla con migration notice.
- Rate limit in-memory (multi-instance Vercel): best-effort.
- Aprobar datos crea contacto primary adicional (no merge automático con contactos previos).

## 44. Archivos clave

- `packages/partners/src/onboarding-*.ts`, `logo-types.ts`, `assets-mime.ts`, `assets-limits.ts`
- `packages/db/prisma/migrations/20260807190000_*`
- `packages/db/src/partners-prisma-repository.ts`
- `apps/clickaton/app/(public)/partners/completar-datos/[token]/*`
- `apps/clickaton/app/api/public/partners/onboarding/**`
- `apps/clickaton/app/api/admin/partners/[partnerId]/onboarding/**`
- `apps/clickaton/components/partners/logo/*`, `onboarding/*`, `admin/partners/PartnerOnboarding*`

## 45. % MVP Sponsors

~**92%** del MVP Stage 05 (tracking + carga + onboarding logos). Falta email/WhatsApp invite y portal permanente (explícitamente fuera de alcance).

## 46. Próximo paso

1. Backup Neon Clickatón + FotoRank.  
2. `prisma migrate deploy` en ambas.  
3. Deploy Clickatón.  
4. Smoke: Solicitar datos → completar → review → verificar HIDDEN.  
5. (Opcional) email invite Imp 04.
