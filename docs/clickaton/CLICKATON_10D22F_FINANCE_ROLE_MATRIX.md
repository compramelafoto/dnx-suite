# Clickatón 10D.2.2F — Normalización de roles financieros

**Fecha:** 2026-07-30  
**Legal:** `LEGAL REVIEW REQUIRED`

---

## Veredicto

# `DNX FINANCE ROLE MATRIX NORMALIZED`

---

## Grants finales

### Staging (`ep-round-fog…`)

| User | id | globalRole | Grants ACTIVE |
|------|----|------------|---------------|
| `cuart.daniel@gmail.com` | 63 | SUPER_ADMIN | OWNER + PARTNER_CONNECT + VIEWER |
| `dnxfotografia@gmail.com` | 62 | USER | VIEWER + PARTNER_CONNECT |
| `tammyytamer@gmail.com` | 64 | USER | VIEWER + PARTNER_CONNECT |

Owner staging `pa_stg_owner_invariant`: **intacto** (ACTIVE / TEST / vault).

### Production (`ep-silent-haze…` / `clickaton_production`)

| User | id | globalRole | Grants ACTIVE |
|------|----|------------|---------------|
| `cuart.daniel@gmail.com` | 5 (creado) | SUPER_ADMIN | OWNER + PARTNER_CONNECT + VIEWER |
| `dnxfotografia@gmail.com` | 1 | USER | VIEWER + PARTNER_CONNECT *(OWNER + MANAGER revocados)* |
| `tammyytamer@gmail.com` | 2 | USER | VIEWER + PARTNER_CONNECT |

### Owner payment account Production

| Campo | Antes = Después |
|-------|-----------------|
| id | `pa_ba733fa7a35f4326` |
| status | ACTIVE |
| environment | PROD |
| providerUserId | `97484805` |
| vault | `dnxcred_d5524b2adf65420aa7fd` |
| updatedAt | `2026-07-28T19:00:18.388Z` (sin cambio) |

**Ownership técnico** de la FI ORGANIZATION sigue con `ownerUserId=1` (dnxfotografia).  
**Rol finance OWNER** migró por grant a `cuart.daniel`. No se mutó collector/vault.

---

## Staging UX (post-deploy `dpl_HehyEVH6WSDTfn229B3VtpZdyQY8`)

| User | Panel mi-cuenta | Conectar API | Bloque admin financiera |
|------|-----------------|--------------|-------------------------|
| Daniel | 200 + CTA | PARTNER ok | SÍ |
| dnxfotografia | 200 + CTA | PARTNER ok | NO |
| Tammy | 200 + CTA | PARTNER ok | NO |

---

## Tests

**25/25 PASS** (finance-permissions + role-matrix-10d22f + partner-oauth).

---

## Código / docs

- Script: `apps/clickaton/scripts/normalize-finance-role-matrix-10d22f.ts`
- Fix: `packages/auth` — `getSessionIdentityByRawToken` ahora selecciona `globalRole`
- Allowlist: `cuart.daniel@gmail.com` en `CLICKATON_ADMIN_EMAILS`
- Seed email daniel → `cuart.daniel@gmail.com`
- Nav: “Mi cuenta de cobro”
- Docs: `DNX_FINANCE_ROLE_MATRIX.md`, update `DNX_PARTNER_MP_SELF_CONNECT.md`

---

## Notas

- No OAuth LIVE / no pagos / no inscripciones / no cambio de %.
- **Production app** aún no redeployada: grants ya en DB; para que el panel Production respete allowlist + `globalRole` SUPER_ADMIN hace falta deploy de `clickaton-dnxsuite` (fuera del alcance mínimo de grants; Staging ya deployado).
- Users creados si faltaban (Daniel Staging+Prod, Tammy Staging) — sin passwords; login Google por email.
