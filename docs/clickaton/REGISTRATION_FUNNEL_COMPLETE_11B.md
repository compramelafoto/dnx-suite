# CLICKATÓN — ETAPA 11B — CIERRE DEL FUNNEL COMPLETO DE INSCRIPCIÓN

**Fecha:** 2026-07-23  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Base 11A:** `952cf4d` (NO GO 47/100 — histórico intacto)  
**Alcance:** journey participante TEST/sandbox de punta a punta  
**Restricciones:** sin push, sin deploy, sin LIVE, sin OAuth owner real, sin WIP ajeno

---

## Criterio de éxito

> Una persona puede descubrir Clickatón, elegir una edición real, inscribirse, completar el pago en TEST/sandbox, recibir la confirmación, acceder a su QR y credencial y gestionar su participación desde Mi cuenta, sin intervención manual del organizador.

---

## Journey antes (11A)

Instagram → Home (placeholder “próximamente”) → ficha (fixture desalineado) → formulario (copy niega pago) → reserva → checkout TEST posible → acreditación en DB → **sin email / sin QR usable / Mi cuenta stub / holds sin cron / free stuck**.

## Journey después (11B)

Home (Prisma) → edición piloto `piloto-test-11b` → ficha → formulario (copy TEST honesto) → consentimientos versionados en copy → reserva + hold →  
- **pago:** checkout sandbox → acreditación S2S/webhook → CONFIRMED + credencial + QR regenerable + email confirmado + Mi cuenta  
- **gratis:** auto-confirm sin MP → mismo fulfillment  
- holds: cron `/api/cron/expire-registration-holds` + email vencimiento

---

## Arquitectura

| Capa | Pieza |
|---|---|
| Público | `prisma` default `CLICKATON_PUBLIC_DATA_SOURCE`; `UpcomingEventsSection` |
| Reserva | `createPublicRegistrationService` + holds capacidad |
| Free | `confirmFreeRegistration` |
| Pago | DNX Payments TEST (sin cambios flags) |
| Confirmación | `confirmPaid` + `applyPaymentEvent` / S2S refresh (nunca redirect) |
| QR | HMAC regenerable (`qr-token.ts`); solo hash en DB |
| Email | Resend vía `@repo/auth` `sendIdentityEmail`; destinatarios TEST |
| Mi cuenta | `/mi-cuenta` + `/mi-cuenta/inscripciones/[id]` |
| Holds | use case expire + cron Vercel 15m |

---

## Estados canónicos (journey)

```
DRAFT / PENDING_PAYMENT  →  PROCESSING (pago)  →  CONFIRMED (+ payment APPROVED)
                         ↘  EXPIRED (hold)
                         ↘  CANCELLED / FAILED (pago terminal)
FREE: totalAmount=0 → CONFIRMED directo (sin orden MP)
```

Invalid: confirmar por redirect; liberar hold de inscripción APPROVED; checkout con totalAmount=0.

---

## Edición piloto TEST

- Slug: `piloto-test-11b`
- Seed: `CLICKATON_SEED_PILOT=1 pnpm --filter clickaton seed:pilot-edition`
- Tickets: pago sandbox + gratis
- No usar en producción comercial

---

## Legales

- `content/legal-funnel.ts` — términos/privacidad TEST
- Páginas `/legal/terminos` y `/legal/privacidad`
- Marcados **PENDIENTE VALIDACIÓN JURÍDICA — Daniel** donde aplica
- Consent: `acceptedTermsAt` / `acceptedImageAt`; versión en constantes de contenido (persistencia de versión en fila: gap no bloqueante TEST)

---

## Emails

| Email | Trigger | Resultado |
|---|---|---|
| reservation_created | reserva paga | TEST inbox / override |
| payment_confirmed | acreditación | best-effort post-confirm |
| free_confirmed | free path | best-effort |
| hold_expired | expire batch | best-effort |

Env: `CLICKATON_EMAIL_TEST_TO` (recomendado). Sin envío a externos reales por defecto.

---

## QR y credencial

- Plaintext = HMAC(`registrationId`,`credentialId`); regenerable server-side
- UI: Mi cuenta → credencial + QR (`qrcode`) + print
- Auth: sesión; ownership por userId/email

---

## Holds

- Reserva con `expiresAt`
- Cron: `apps/clickaton/vercel.json` → `*/15 * * * *`
- Auth: `CRON_SECRET` Bearer o header Vercel Cron
- Idempotente; no toca APPROVED/CONFIRMED

---

## SEO / robots

- Default: noindex (local/preview/staging)
- Producción index **solo** si `CLICKATON_ALLOW_SEARCH_INDEXING=true` (OFF en 11B)

---

## Seguridad (resumen)

- Confirmación solo por estado acreditado
- QR sin plaintext en DB/logs
- Email sandboxing
- Access token `?t=` sigue existiendo para resumen (expirable); Mi cuenta prioriza sesión
- Flags productivos OFF

---

## Runbook mínimo de apertura (TEST → futuro LIVE)

### Antes

- [ ] Seed/publicar edición real
- [ ] Precio/cupo/fechas/términos
- [ ] Email provider + `CLICKATON_EMAIL_TEST_TO` (TEST) / prod inbox
- [ ] Cron activo + `CRON_SECRET`
- [ ] Flags LIVE/Orders OFF hasta gates I
- [ ] Prueba free + pago sandbox + mobile
- [ ] Robots: noindex hasta go-live explícito
- [ ] Rollback plan (despublicar edición)

### Durante

- [ ] Monitorear PENDING / holds / emails fallidos / cupos / duplicados

### Después

- [ ] Cierre inscripción · export · conciliación · prep check-in (11C)

---

## Pruebas

| Suite | Notas |
|---|---|
| `selfcheck:qr-token` | regenerabilidad |
| `selfcheck:registration-funnel-11b` | email sandbox + QR |
| selfchecks checkout/public-registration previos | H2 / 10D |
| E2E sandbox browser | requiere seed + env staging (ejecutar ops) |

---

## Limitaciones 11B

- Sin E2E browser automático ejecutado en esta máquina sin DB seed
- Sin validación jurídica final
- Sin constraint DB único email+edición (app-level + findActive)
- LIVE / OAuth owner / DistributionVersion: fuera de alcance
- Token `?t=` aún en resumen (aceptable TEST; endurecer en 11F)

---

## Rollback

1. Despublicar edición piloto (`isPublished=false`)
2. Apagar cron / dejar de seedear
3. Revert commit 11B
4. Flags permanecen OFF

---

## Readiness vs 11A

Ver tabla READY SCORE en entrega 11B. Score histórico 47/100 de 11A **no se modifica**.

## Próximo paso (solo si VALIDADO)

**11C — Check-in completo y aprobación en sede** — no iniciar automáticamente.

---

## Validación operativa 11B2

**Doc:** [`REGISTRATION_FUNNEL_VALIDATION_11B2.md`](./REGISTRATION_FUNNEL_VALIDATION_11B2.md)  
**Fecha:** 2026-07-23  
**HEAD código:** `1b2de05`  
**Decisión:** **NO GO** — journey TEST incompleto operativamente.

### Entorno

- Staging URL: `https://clickaton-staging.vercel.app`
- Deploy staging observado: **pre-11B** (piloto 404; Home con “próximamente”)
- Seed: **no ejecutado** (DB staging no clasificable / pull `DATABASE_URL` vacío; local Neon fail-closed)
- Email: Resend + `CLICKATON_EMAIL_TEST_TO` **ausentes**
- Evidencia smoke browser: `.local/audit-11b2/` (gitignored)

### Casos E2E

Pago acreditado / pendiente / rechazado / free / hold / mobile / email real: **no ejecutados** (bloqueados por ops).

### Suites código

Selfchecks QR / funnel-11b / hardening / checkout: **OK**. Email selfcheck: `skipped`.

### Bugs / correcciones

Sin correcciones de producto en 11B2 (solo documentación). Bloqueo = configuración + deploy staging + seed.

### Limitaciones

Sin push; sin deploy productivo; sin LIVE; score 11A 47/100 intacto.

### Decisión final 11B2

**BLOQUEADO — SEED STAGING NO DISPONIBLE** · no iniciar 11C.
