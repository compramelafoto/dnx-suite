# Clickatón — Commercial GO / NO-GO Checklist

**Fecha:** 2026-07-30  
**Scope:** apertura real de inscripciones (Production)  
**Estado Staging técnico:** en progreso 10C.1  

`LEGAL REVIEW REQUIRED` — bloquea GO Production, **no** bloquea Staging.

---

## Bloqueantes Production (NO-GO hasta verde)

- [ ] Staging: `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`
- [ ] E2E pago Mercado Pago **TEST** completo (guest + existing + new + Google-only)
- [ ] First-N benefit validado (N / N+1 / race último slot)
- [ ] Activación DNX post-pago (password + Google)
- [ ] Migraciones aplicadas en DB Staging compartida
- [ ] Edición comercial publicada con flags correctos (no DRAFT accidental)
- [ ] `LEGAL REVIEW` cerrada (guest, Cuenta DNX cross-platform, imagen, Instagram, merch, reembolsos, EXIF/IA)
- [ ] Mercado Pago **LIVE** credentials + collector + webhooks prod
- [ ] `DNX_SOCIAL_PUBLISHER_LIVE=false` confirmado (o decisión explícita)
- [ ] Runbook rollback / expire holds / soporte

## Staging técnico (10C.1)

- [x] Guest sin User prematuro
- [x] First-N runtime (`filterPhaseItemsByFirstNQuota` + strip en TX)
- [x] Flags activación en `pago/exito` + landing `/activar`
- [x] Selfchecks first-N / guest / payments
- [ ] `prisma migrate deploy` Staging (`userId` nullable si falta)
- [ ] Seed/update AR 2026 `stockLimit=100` en Staging
- [ ] Deploy `clickaton-staging` con commit 10C.1
- [ ] Smoke E2E real MP TEST (guest / existing / new / N+1)

## No hacer en GO

- Abrir 6 ediciones a la vez sin validar la comercial
- Usar `phase.capacity=100` como “remera primeros 100”
- Password temporal
- Publicar social LIVE sin checklist aparte
