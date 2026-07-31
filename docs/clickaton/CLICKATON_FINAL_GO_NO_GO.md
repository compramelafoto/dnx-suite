# Clickatón — GO / NO-GO final (actualizado 10D.1)

**Fecha:** 2026-07-30  
**Alcance:** apertura real de inscripciones (Production)  
**Proyecto Vercel Production:** `clickaton-dnxsuite`  
**Dominio canónico:** `https://maratonfotografica.com`  
**Staging técnico previo:** `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING` (10C.3.1)  
**Remediación:** `docs/clickaton/CLICKATON_10D1_PRELAUNCH_REMEDIATION.md`

---

## Veredicto

# Storage: `CLICKATON PRODUCTION STORAGE READY`

(actualizado 10D.1.1B — R2 Production verificado en runtime)

**Aún no** es `GO FOR PRODUCTION LAUNCH` (quedan legal, Tammy OAuth, pago LIVE controlado, etc.).  
**Inscripciones cerradas** (`registrationEnabled=false`).  
**Legal:** `LEGAL REVIEW REQUIRED`.  
**Nota pendiente:** `FOTORANK CONTEST WORK STORAGE AUDIT REQUIRED` (obras de consignas ≠ `clickaton-media`).

---

## Resumen ejecutivo (post-10D.1)

| Área | Estado |
|------|--------|
| Staging checkout + reconciliación MP TEST | PASS (10C.3.1) |
| Production proyecto / dominio / HTTPS | PASS |
| Production DB (`ep-silent-haze…`, ≠ Staging) | PASS |
| Backup `backup-before-clickaton-production-launch` | **PASS** (`br-proud-butterfly-awggsxia`) |
| Migrate Production | **PASS** (schema up to date) |
| Edición AR2026 publicada + regs cerradas | **PASS** (`publishedEditions: 1`) |
| Landing `/maratones/clickaton-argentina-2026` | **PASS** HTTP 200 + “Inscripciones próximamente” |
| Kill switch (`registrationEnabled`) | **PASS** |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | **PASS parcial** = `manual` (LIVE adapter forbidden) |
| Legal | **BLOCKER** `LEGAL REVIEW REQUIRED` |
| MP LIVE + OAuth Tammy + collector ACTIVE | **BLOCKER** |
| Distribución 100% ACTIVE | **BLOCKER** (acuerdo DRAFT, sin payment account) |
| R2 / storage Production | **BLOCKER** |
| Email Resend (vars) | PASS vars / WARNING smoke no ejecutado |
| Welcome card Production | BLOCKED (R2) |
| Pago LIVE controlado | NO HECHO (etapa siguiente) |
| Production Branch Vercel | **PASS** = `main` |

---

## Matriz Production (delta 10D.1)

| Variable / servicio | Estado |
|---------------------|--------|
| Backup Neon pre-launch | PASS |
| Prisma migrate | PASS |
| `publishedEditions` | **1** |
| Ruta maratón AR2026 | **200** |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | PRESENT = `manual` |
| R2 `R2_*` | **MISSING** |
| Resend / EMAIL_FROM | PRESENT (smoke pendiente) |
| Webhook GET | 405 |
| Cron reconcile | registrado; probe sin secret → 401 |
| Tammy User.id | `2` / `tammyytamer@gmail.com` |
| Tammy `DnxPaymentAccount` | **ninguna** |
| Deploy Production 10D.1 | `dpl_3SfbV8tbjwLNseaRwDWJWKwMjBgs` |

---

## Condiciones para `PRE-LAUNCH READY — HUMAN ACTIONS PENDING`

Cerrar primero:

1. R2 Production configurado + smoke upload/read/delete  
2. Welcome card TEST (social LIVE=false)  
3. Smoke Resend Production  
4. Confirmación exact match `CLICKATON_MP_REDIRECT_URI`  
5. Path LIVE payments acordado (hoy `mercado_pago_production` forbidden)

Entonces solo deberían quedar humanas:

- `LEGAL APPROVED FOR REGISTRATION`  
- OAuth Tammy → collector ACTIVE + distribución 100%  
- Pago LIVE controlado (sub-etapa posterior)

---

## Condiciones para abrir inscripciones (más tarde)

1. Veredicto pre-launch ready (o superior)  
2. Legal aprobado  
3. Collector ACTIVE + distribución ACTIVE  
4. Kill switch operativo verificado  
5. Pago LIVE controlado OK  
6. Recién entonces: `registrationEnabled=true` (manual, sin auto-enable)

---

**Acción legal:** sigue **bloqueante**. Pack: `CLICKATON_LEGAL_APPROVAL_PACK.md`.
