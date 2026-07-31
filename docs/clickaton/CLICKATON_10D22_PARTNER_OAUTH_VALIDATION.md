# Clickatón 10D.2.2 / 10D.2.2B — Validación Partner OAuth Staging + Preflight Production

**Fecha:** 2026-07-30  
**Legal:** `LEGAL REVIEW REQUIRED` (sin cambio)

---

## Veredicto (10D.2.2B retest)

# `PARTNER STAGING OAUTH INCOMPLETE — AWAITING CONTROL CALLBACK`

**No** se emite `PARTNER STAGING OAUTH PASS` (falta OAuth + reconnect + revoke del control).  
**No** se emite `READY FOR TAMMY OAUTH`.  
**No** se desplegó Production.  
**No** se abrieron inscripciones. **No** pago LIVE. **No** se tocó owner Production `pa_ba733fa7…`.  
**No** se conectó Tammy.

| Checkpoint | Estado |
|------------|--------|
| Deploy Staging READY | **PASS** (`dpl_6jCTtPveNra3ATT57oCE9jjb7pwi`) |
| `CLICKATON_MP_CLIENT_ID` / `SECRET` en Staging | **PASS** (runtime PRESENT) |
| Preflight partner Staging | **PASS** — `PARTNER_MP_PREFLIGHT_PASS` / `partnerBlockers: []` |
| Ya no `APP_NOT_CONFIGURED` | **PASS** |
| Flags partner | **PASS** — enabled + `environment=TEST` |
| Panel control `/admin/finanzas/mi-cuenta` | **PASS** (CTA Conectar visible) |
| Connect API → authorize URL MP | **PASS** (`flowType=PARTNER`, `environment=TEST`) |
| Callback OAuth control (Daniel) | **NO EJECUTADO** — User 61 sin `DnxPaymentAccount` |
| Reconnect / Revoke | **N/A** (sin cuenta partner ACTIVE) |
| Owner invariant Staging | **PASS** (`pa_stg_owner_invariant` ACTIVE + vault intacto) |
| Deploy Production | **NO** (gate: OAuth+reconnect+revoke Staging) |
| Preflight Production partner | **NO** |

---

## 1. Staging deployment (10D.2.2B)

| Campo | Valor |
|-------|--------|
| Proyecto | `clickaton-staging` |
| Deploy actual | `dpl_6jCTtPveNra3ATT57oCE9jjb7pwi` |
| Status | **Ready** (created ~07:24 ART) |
| Alias | `https://clickaton-staging.vercel.app` |
| Health DB | `200` / host `ep-round-fog…` / `publishedEditions=11` |
| Client ID/Secret | cargados ~12m antes del retest (Preview + Production) |

### Preflight partner (runtime)

`GET /api/cron/mp-oauth-preflight` →

- `partnerVerdict`: **`PARTNER_MP_PREFLIGHT_PASS`**
- `partnerBlockers`: `[]`
- `checks.appConfigured`: `true`
- `checks.partnerSelfConnectEnabled`: `true`
- `checks.partnerEnvironment`: **`TEST`**
- `checks.partnerFlowReady`: `true`
- `env.CLICKATON_MP_CLIENT_ID` / `SECRET`: **PRESENT**
- `env.DNX_PARTNER_MP_SELF_CONNECT_ENABLED`: **PRESENT**

Owner preflight del mismo endpoint sigue `MP_LIVE_OAUTH_PREFLIGHT_BLOCKED` (esperado en Staging: onboarding owner off, phrase missing, redirect ≠ prod). **No** bloquea partner.

Nota observacional Staging: `checks.registrationsOpen=true` en edición publicada Staging (preexistente; **no** se modificó en esta etapa). Production no tocada.

---

## 2. Flags validados

| Flag | Evidencia |
|------|-----------|
| `DNX_PARTNER_MP_SELF_CONNECT_ENABLED=true` | Connect no devuelve `PARTNER_SELF_CONNECT_DISABLED`; preflight `partnerSelfConnectEnabled=true` |
| `DNX_PARTNER_MP_OAUTH_ENVIRONMENT=TEST` | Connect JSON `environment: "TEST"`; preflight `partnerEnvironment: "TEST"` |

---

## 3. Panel + Connect (control)

Usuario Staging: `compramelafoto@gmail.com` (User.id **61**)

| Check | Resultado |
|-------|-----------|
| Sesión `dnx_session` | PASS |
| Ve «Mi cuenta de cobro» | PASS |
| Estado «No conectada» | PASS (aún sin callback) |
| CTA «Conectar Mercado Pago» | PASS (visible; ya no mensaje APP_NOT_CONFIGURED) |
| Acciones owner / allocations | AUSENTES (PASS) |
| Grants | `DNX_FINANCE_PARTNER_CONNECT` + `PRODUCT_FINANCE_VIEWER` |
| Payment accounts partner | **0** |

### Connect runtime (ya no APP_NOT_CONFIGURED)

`GET /api/dnx-payments/partner/mercadopago/connect?format=json` → `200`:

```json
{
  "ok": true,
  "flowType": "PARTNER",
  "environment": "TEST",
  "stateId": "oas_…",
  "authorizeUrl": "https://auth.mercadopago.com/authorization?client_id=…&redirect_uri=https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback&code_challenge_method=S256"
}
```

Redirect 302 sin `format=json` apunta a `auth.mercadopago.com` con PKCE + callback Staging.

---

## 4. Auditoría OAuth manual (Daniel)

**No hay evidencia de callback completado** para el control:

- PERSON identity de User 61: `paymentAccounts: []`
- Cuentas recientes: solo `pa_stg_owner_invariant` + collector PERSON histórico user 2 (`3141372692`) — **no** mutadas por este retest

Por tanto **no** se puede validar aún:

- `DnxPaymentAccount` PARTNER ACTIVE
- tokens solo en vault
- reconnect
- revoke

Owner Staging invariant **intacto**:

| Campo | Valor |
|-------|--------|
| accountId | `pa_stg_owner_invariant` |
| status | ACTIVE |
| environment | TEST |
| vaultRef | `dnxcred_stg_owner_invariant` |
| providerUserId | `STAGING_OWNER_INVARIANT_999` |
| capabilities | COLLECTOR |

---

## 5. Acción humana requerida (desbloqueo OAuth)

En Staging, con cuenta control:

1. Login: `https://clickaton-staging.vercel.app/login`  
   `compramelafoto@gmail.com` + password fixture Staging (`StagingPartner10D22!`)  
   o sesión Google del mismo email si aplica
2. `/admin/finanzas/mi-cuenta` → **Conectar Mercado Pago**
3. Autorizar con usuario MP **TEST distinto de `3141372692`** (conflicto de ownership)
4. Confirmar callback a  
   `https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback`
5. Avisar para auditar DB + ejecutar **Reconnect** + **Revoke** + invariante owner

Tras OAuth + reconnect + revoke PASS → emitir `PARTNER STAGING OAUTH PASS` y continuar § Production (deploy + flags LIVE + preflight; **sin** OAuth Tammy ni pago LIVE).

---

## 6. Production (pendiente — gate Staging)

**No iniciado** en 10D.2.2B.

Plan al desbloquear:

1. Deploy Production `clickaton-dnxsuite` con inscripciones **cerradas**
2. Flags Partner LIVE (`DNX_PARTNER_MP_SELF_CONNECT_ENABLED` + `DNX_PARTNER_MP_OAUTH_ENVIRONMENT=PROD`)
3. Preflight partner Production
4. **No** OAuth Tammy / **No** pago LIVE
5. Solo si preflight Production partner PASS → `READY FOR TAMMY OAUTH`

Owner Production esperado intacto: `pa_ba733fa7…`.

---

## 7. Tests (sin cambio en este retest)

Última corrida conocida de la etapa previa: **30/30 PASS** (finance-permissions / owner-oauth / partner-oauth).

---

## Veredictos posibles (estado actual)

| Código | Aplica |
|--------|--------|
| READY FOR TAMMY OAUTH | **NO** |
| PARTNER STAGING OAUTH PASS | **NO** (callback/reconnect/revoke pendientes) |
| PARTNER STAGING OAUTH FAILED | No (bloqueo APP_NOT_CONFIGURED **resuelto**) |
| PARTNER STAGING OAUTH INCOMPLETE — AWAITING CONTROL CALLBACK | **SÍ** |
| OWNER ACCOUNT REGRESSION | NO |
| PARTNER PRODUCTION DEPLOY BLOCKED | Gate Staging incompleto |
| MP LIVE PARTNER PREFLIGHT BLOCKED | N/A (no intentado) |
