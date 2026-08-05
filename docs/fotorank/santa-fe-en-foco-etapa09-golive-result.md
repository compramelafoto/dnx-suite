# Santa Fe en Foco — ETAPA 09 — Resultado GO-LIVE

**Fecha:** 2026-08-04  
**Estado final:** **GO** (apertura limitada)  
**Autorización:** CAMINO B — Mario Alberto Laus, Presidente SFPR  
**Versión legal:** `sfef-provisional-institutional-v1`

## Backup

| Campo | Valor |
|-------|--------|
| Archivo | `/tmp/fotorank-prod-backups/fotorank-prod-20260804T191414Z.dump` |
| SHA-256 | `0d410d0a6f43cb71a9baa846a7cb66186db836032c0e19444e72976a0fb3b08a` |
| Companion | `...dump.sha256` |

## Migraciones aplicadas

Únicamente la migración auditada FotoRank:

- `20260804010000_fotorank_registration_answers_json` (`answersJson` JSONB)
- Resuelta con `prisma migrate resolve --applied` tras SQL aplicado
- **No** se aplicó el lote pendiente de Clickatón/partners

## Seed productivo

- Script: `packages/db/prisma/scripts/seed-santa-fe-en-foco-production.ts`
- Contest ID: `cmsf1je750005xpzcrizp52rd`
- Slug: `santa-fe-en-foco`
- `registrationEnabled=true`, pricing `FREE`
- Upload cerrado: `submissionOpensAt=2099-01-01`, `publicUploadOpen=false`
- 4 categorías ACTIVE
- Rules PUBLISHED: `sfef-provisional-institutional-v1`

## Deployment

| Campo | Valor |
|-------|--------|
| Production deployment | `dpl_6AnSXBHBJXGQ1dPZ3i9tNZSkaZzV` |
| URL Vercel | `https://fotorank-dnxsuite-c6idxqpak-compramelafotos-projects.vercel.app` |
| Alias prod | `https://fotorank.dnxsuite.com` + `https://fotorank.com` |
| Staging intacto | `dpl_2vxiteyEEmwSRSBVwdXXgx6DZBmp` → `fotorank.staging.dnxsuite.com` |
| Rollback deploy | `dpl_525VUHaEaz9ANgbFBQnMe9oryZyg` |

## URLs finales

- Landing: https://fotorank.com/concursos/santa-fe-en-foco → 200 (via `fotorank.dnxsuite.com`)
- Inscripción: https://fotorank.com/concursos/santa-fe-en-foco/inscripcion → login + flujo FREE

## Validaciones

| Chequeo | Resultado |
|---------|-----------|
| OAuth Google `redirect_uri` Production | PASS (`fotorank.dnxsuite.com/api/auth/google/callback`) |
| Login Email | PASS |
| Inscripción FREE | PASS |
| Upload cerrado (notice, sin panel) | PASS |
| Dashboard participante | PASS |
| Panel admin | PASS |
| Resultados/ranking/jurado no expuestos | PASS |
| Email transaccional Resend | PASS (verify email enviado a `@fotorank.test`, from `FotoRank <noreply@maratonfotografica.com>`) |
| E2E Playwright Production | **6/6 PASS** |

## Alcance vigente

Habilitado: landing, concurso, inscripción FREE, Google, Email, dashboard participante, admin, categorías, consentimientos provisionales, email real, `registrationEnabled=true`.

Deshabilitado: upload, jurado, resultados, ranking, publicación de obras.

## Rollback

1. `registrationEnabled=false` en Production DB (cierre inmediato de nuevas inscripciones).
2. Re-alias Production a `dpl_525VUHaEaz9ANgbFBQnMe9oryZyg`.
3. Restore DB desde dump solo si corrupción severa (no borrar inscripciones reales).
4. Staging permanece en ETAPA 08 (`dpl_2vxitey…`).

## Notas ops

- Se agregaron `RESEND_API_KEY` + `EMAIL_FROM` al proyecto Vercel `fotorank-dnxsuite` (Production).
- `EMAIL_FROM` actual: `FotoRank <noreply@maratonfotografica.com>` (dominio Resend verificado). Ideal migrar a dominio `fotorank.com` / `dnxsuite.com` cuando esté verificado en Resend.
- Candidate Preview no sirve para E2E (SSO). Validación final contra dominios públicos Production.
