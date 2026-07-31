# Clickatón 10D.2.1 — Partner MP Self-Connect Report

**Fecha:** 2026-07-30  
**Legal global:** `LEGAL REVIEW REQUIRED` (sin cambio)

---

## Veredicto

# `PARTNER MP SELF-CONNECT READY IN STAGING` (código)

**Seguimiento 10D.2.2:** `PARTNER STAGING OAUTH FAILED` — ver `CLICKATON_10D22_PARTNER_OAUTH_VALIDATION.md`  
(Staging deploy OK; OAuth sandbox bloqueado por falta de `CLICKATON_MP_CLIENT_*` en Vercel Staging.)

| Estado | ¿Aplica? |
|--------|----------|
| PARTNER MP SELF-CONNECT READY IN STAGING | **SÍ** (código + tests unitarios PASS) |
| READY FOR TAMMY OAUTH | **NO** (Staging OAuth no completado; sin Production deploy) |
| PARTNER AUTHORIZATION MODEL BLOCKED | NO |
| PARTNER OAUTH CALLBACK BLOCKED | NO |
| OWNER ACCOUNT REGRESSION | NO (invariante + tests) |
| MP LIVE PARTNER PREFLIGHT BLOCKED | Pendiente hasta deploy Production + flag |

---

## Entregado

1. Audit: `docs/dnx-payments/PARTNER_SELF_CONNECT_AUDIT.md`
2. Spec: `docs/dnx-payments/DNX_PARTNER_MP_SELF_CONNECT.md`
3. Capability Prisma: `DNX_FINANCE_PARTNER_CONNECT` (+ migration aditiva)
4. Servicio `ClickatonPartnerOAuthService` (reusa authorize/exchange/vault/PKCE)
5. Routes partner + callback unificado OWNER/PARTNER
6. Panel `/admin/finanzas/mi-cuenta`
7. Invariante owner collector
8. Tests: 12/12 partner + matrix VIEW≠CONNECT≠OWNER
9. Fixture script grants (reversible, sin OAuth)
10. Diagnóstico + preflight extendidos

---

## Matriz permisos

| Capability | Viewer | Partner Connect | Owner |
|---|---:|---:|---:|
| Ver resumen propio | ✓ | ✓ | ✓ |
| Conectar MP propio | ✗ | ✓ | ✓ |
| Revocar MP propio | ✗ | ✓ | ✓ |
| Ver accounts ajenos | ✗ | ✗ | ✓ |
| Configurar allocations | ✗ | ✗ | ✓ |
| Cambiar owner collector | ✗ | ✗ | ✓ |

---

## Owner account

**NO tocada.** Snapshot post-fixture: `pa_ba733fa7a35f4326` ACTIVE + vault.  
Tests afirman id/status/vault ref estables tras partner connect/revoke.

## Grants Production (sin OAuth)

| User | PARTNER_CONNECT | VIEWER | Payment accounts |
|------|-----------------|--------|------------------|
| Tammy (id=2) | GRANTED | ya ACTIVE | 0 |
| Control compramelafoto (id=3) | GRANTED | GRANTED | 0 |

Reversible: revocar solo `DNX_FINANCE_PARTNER_CONNECT` con `--revoke` (viewer de Tammy se conserva).

---

## Siguiente (humano / ops)

### Staging

1. `prisma migrate deploy` (enum PARTNER_CONNECT)
2. Env Staging:
   - `DNX_PARTNER_MP_SELF_CONNECT_ENABLED=true`
   - `DNX_PARTNER_MP_OAUTH_ENVIRONMENT=TEST`
3. Seed grants: `seed-partner-connect-grants.ts`
4. Login control → Mi cuenta → Conectar MP (sandbox) → callback → reconnect → revoke
5. Confirmar owner snapshot igual

### Production (después Staging PASS)

1. Deploy código (inscripciones cerradas)
2. Flag partner ON + env `PROD` (o inferido)
3. Seed grants Tammy (sin OAuth)
4. `GET /api/cron/mp-oauth-preflight` → partnerVerdict PASS
5. Solo entonces: **`READY FOR TAMMY OAUTH`**

### Tammy (después READY)

1. maratonfotografica.com → login DNX  
2. Finanzas → Mi cuenta de cobro  
3. Conectar Mercado Pago → autorizar → callback  
4. Validar ACTIVE + vault + owner intacto  
5. **Luego** (aparte): asignar recipient 100% en edición

---

## No hecho (correcto)

- OAuth Tammy LIVE  
- Pago LIVE  
- Abrir inscripciones  
- Cambiar %  
- Revoke/overwrite owner  
- Legal  
