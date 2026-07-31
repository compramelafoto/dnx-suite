# Clickatón 10D.2.3 — Promoción Production: roles financieros + Partner OAuth

**Fecha:** 2026-07-30  
**Legal:** `LEGAL REVIEW REQUIRED` (sin cambio — bloquea pago LIVE / apertura pública)

---

## Veredicto

# `READY FOR PRODUCTION PARTNER OAUTH`

Inscripciones **cerradas**. No OAuth Tammy ejecutado en esta etapa. No pago LIVE. No cambio de %.

| Gate | Resultado |
|------|-----------|
| Staging final matriz + partner | **PASS** |
| Backup Neon | **PASS** `backup-before-finance-role-production-promotion` (`br-polished-river-aw12ek0x`) |
| `prisma migrate status` Production | **up to date** (91 migrations) |
| Deploy Production | **PASS** `dpl_8AXuQERDEkPcebZqqUAc6a8GoWNq` → `maratonfotografica.com` |
| Flags partner LIVE | **PASS** (`SELF_CONNECT=true`, `OAUTH_ENVIRONMENT=PROD`) |
| Grants Production | **PASS** (idempotente) |
| Preflight partner | **`PARTNER_MP_PREFLIGHT_PASS`** / `partnerEnvironment=PROD` |
| Owner invariant | **PASS** `pa_ba733fa7a35f4326` ACTIVE/PROD/vault sin mutación |
| UI Production (sesión) | **PASS** Daniel / DNX / Tammy |
| Tests unitarios | **25/25 PASS** |
| Resend | Env **PRESENT** — smoke de envío LIVE **no ejecutado** (evitar mail no solicitado) |
| OAuth Tammy | **NO** (acción humana siguiente) |
| Allocations 100% | **NO** (post-Tammy ACTIVE) |

---

## 1. Staging final (gate)

| User | manage % | Mi cuenta | Connect API | Admin financiera UI |
|------|----------|-----------|-------------|---------------------|
| `cuart.daniel@gmail.com` | YES | 200 | PARTNER/TEST | YES |
| `dnxfotografia@gmail.com` | NO | 200 | PARTNER/TEST | NO |
| `tammyytamer@gmail.com` | NO | 200 | PARTNER/TEST | NO |

- Partner preflight Staging: `PARTNER_MP_PREFLIGHT_PASS`
- Owner staging `pa_stg_owner_invariant`: intacto
- Reconnect/revoke full path: N/A sin cuenta ACTIVE; APIs responden errores de dominio (`NOT_CONNECTED`), no `APP_NOT_CONFIGURED`

---

## 2. Owner Production (snapshot)

| Campo | Valor |
|-------|--------|
| accountId | `pa_ba733fa7a35f4326` |
| status | ACTIVE |
| environment | PROD |
| providerUserId | `97484805` |
| vaultRef | `dnxcred_d5524b2adf65420aa7fd` |
| capabilities | COLLECTOR |
| orgRef | `clickaton:partners-production:mp-owner` |
| technical ownerUserId | 1 (`dnxfotografia`) — metadata; rol finance OWNER = Daniel vía grant |
| updatedAt | `2026-07-28T19:00:18.388Z` (sin cambio post-promoción) |

Edición AR2026: `registrationEnabled=false`, published.

---

## 3. Backup

| Branch | Id | Created |
|--------|----|---------|
| `backup-before-finance-role-production-promotion` | `br-polished-river-aw12ek0x` | 2026-07-30T11:13:57Z |
| (previo) `backup-before-clickaton-production-launch` | `br-proud-butterfly-awggsxia` | 2026-07-30T08:03:17Z |

---

## 4. Deploy

| Campo | Valor |
|-------|--------|
| Proyecto | `clickaton-dnxsuite` |
| Deployment | `dpl_8AXuQERDEkPcebZqqUAc6a8GoWNq` |
| Alias | `https://maratonfotografica.com` |
| Git base (local) | `6e3b0d4` + working tree partner/roles (deploy CLI) |
| `DNX_SOCIAL_PUBLISHER_LIVE` | `false` (re-set en promoción) |

---

## 5. Flags Partner Production

| Variable | Valor contrato |
|----------|----------------|
| `DNX_PARTNER_MP_SELF_CONNECT_ENABLED` | `true` |
| `DNX_PARTNER_MP_OAUTH_ENVIRONMENT` | **`PROD`** (no `LIVE` — el código solo acepta `TEST`\|`PROD`) |
| Callback | `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |

Preflight runtime:

- `partnerVerdict`: **PARTNER_MP_PREFLIGHT_PASS**
- `partnerEnvironment`: **PROD**
- `partnerFlowReady`: true
- `registrationsOpen`: **false**
- `redirectExactMatch`: true
- Owner preflight también `MP_LIVE_OAUTH_PREFLIGHT_PASS` (sin ejecutar OAuth owner)

---

## 6. Grants Production

| User | id | globalRole | Grants |
|------|----|------------|--------|
| `cuart.daniel@gmail.com` | 5 | SUPER_ADMIN | OWNER + PARTNER_CONNECT + VIEWER |
| `dnxfotografia@gmail.com` | 1 | USER | VIEWER + PARTNER_CONNECT |
| `tammyytamer@gmail.com` | 2 | USER | VIEWER + PARTNER_CONNECT |

Script: `normalize-finance-role-matrix-10d22f.ts --production --confirm=APPLY_PROD_FINANCE_MATRIX`

---

## 7. UI Production (sesión opaca)

| User | Panel | Conectar | env | Admin financiera |
|------|-------|----------|-----|------------------|
| Daniel | 200 | ok PARTNER | PROD | SÍ |
| DNX | 200 | ok PARTNER | PROD | NO |
| Tammy | 200 | ok PARTNER | PROD | NO |

Permisos: Daniel manage YES; DNX/Tammy manage NO; isolation partner A≠B YES.

---

## 8. Pendiente (humano / legal)

1. **OAuth Tammy LIVE** en `/admin/finanzas/mi-cuenta` (no ejecutado aquí)
2. Configurar allocation Tammy = 100% con Daniel (post ACTIVE)
3. Resend smoke de envío real (env PRESENT; no enviado en esta etapa)
4. Legal review → único camino a pago LIVE + apertura inscripciones

---

## 9. Veredictos alternativos (no aplican)

- PRODUCTION FINANCE DEPLOY BLOCKED — no
- PARTNER LIVE PREFLIGHT BLOCKED — no
- OWNER ACCOUNT REGRESSION — no
- TAMMY OAUTH BLOCKED — N/A (aún no intentado; listo para humano)
- PRODUCTION EMAIL BLOCKED — no emitido (smoke no corrido; key presente)
