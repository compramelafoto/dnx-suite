# Clickatón — Commercial GO / NO-GO Checklist

**Fecha:** 2026-07-30  
**Scope:** apertura real de inscripciones (Production)  
**Estado Staging técnico:** 10C.3.1 — `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`  
**Veredicto 10D:** **`NO-GO`** — ver `CLICKATON_FINAL_GO_NO_GO.md` + runbook `CLICKATON_PRODUCTION_LAUNCH_RUNBOOK.md`

`LEGAL REVIEW REQUIRED` — bloquea GO Production (requiere `LEGAL APPROVED FOR REGISTRATION`).

---

## Bloqueantes Production (NO-GO hasta verde)

- [x] Staging: `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`
- [x] E2E pago Mercado Pago **TEST** Staging (guest) hasta CONFIRMED / return OK
- [ ] E2E activación DNX completa (password + Google) en Staging/Prod
- [ ] First-N benefit race último slot (evidencia formal N/N+1)
- [x] Migraciones aplicadas en DB Staging (`userId` nullable)
- [x] Edición comercial seed + flags Staging (AR2026 / Remera `stockLimit=100`)
- [ ] Edición AR2026 materializada/publicable en Production (hoy 404 / `publishedEditions: 0`)
- [ ] `LEGAL REVIEW` → `LEGAL APPROVED FOR REGISTRATION`
- [ ] Mercado Pago **LIVE** + OAuth Tammy + collector ACTIVE + webhooks prod
- [ ] `CLICKATON_DNX_PAYMENTS_PROVIDER` Production configurado
- [ ] Storage R2 (o durable) Production
- [ ] Backup Neon `backup-before-clickaton-production-launch`
- [ ] `DNX_SOCIAL_PUBLISHER_LIVE=false` confirmado en runtime
- [x] Runbook rollback / kill switch documentado (10D)

## Staging técnico (10C.2 → 10C.3.1)

- [x] Guest sin User prematuro (evidencia AR2026 Staging)
- [x] First-N runtime + selfcheck
- [x] Flags activación en `pago/exito` + landing `/activar` (código)
- [x] Selfchecks first-N / guest / reservation / payments(manual) / typecheck
- [x] `prisma migrate deploy` Staging (`ep-round-fog`)
- [x] Seed/update AR 2026 `stockLimit=100` en Staging
- [x] Deploy `clickaton-staging` + ruta maratón **200**
- [x] Preferencia Checkout Pro TEST creada
- [x] Smoke E2E real MP TEST hasta **APPROVED** / refresh **CONFIRMED** (CKA26-00002)
- [ ] Activación post-pago E2E completa (password set + login)
- [x] QR / credential ACTIVE post-CONFIRMED
- [ ] Email activación (Staging sin Resend; Production tiene vars)

## No hacer en GO

- Abrir 6 ediciones a la vez sin validar la comercial
- Usar `phase.capacity=100` como “remera primeros 100”
- Password temporal
- Publicar social LIVE sin checklist aparte
- Usar tarjeta MP de prueba `5031755734560604` (Luhn inválido en token API actual)
