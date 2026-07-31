# Clickatón 10D.2.2E — PARTNER_CONNECT para cuart.daniel@gmail.com

**Fecha:** 2026-07-30  
**Entorno:** Staging (`clickaton-staging` / Neon `ep-round-fog…`)  
**Legal:** `LEGAL REVIEW REQUIRED` (sin cambio)

---

## Veredicto

# `DNX USER NOT FOUND`

No se otorgó `DNX_FINANCE_PARTNER_CONNECT`.  
No se creó User nuevo.  
No se tocó owner (`pa_stg_owner_invariant` / Production `pa_ba733fa7…`).  
No OAuth LIVE. No inscripciones. No porcentajes.

---

## 1. Resolución de identidad (Staging)

| Campo | Resultado |
|-------|-----------|
| Email buscado | `cuart.daniel@gmail.com` (normalizado, case-insensitive) |
| User | **ausente** en DB Staging (`User` count=38) |
| Similar (`%cuart%`, `%daniel%cuart%`) | **0 filas** |
| Alias identity | N/A / sin match usable |

Usuario cercano (no es el target):

| email | User.id | globalRole | grants finance |
|-------|---------|------------|----------------|
| `dnxfotografia@gmail.com` | 62 | USER | ninguno |

Ese login Google Staging **no** sustituye a `cuart.daniel@gmail.com`.

---

## 2. Regla permanente (documentada + test)

```text
SUPER_ADMIN ≠ PARTNER_CONNECT automático
```

- `PARTNER_CONNECT` = grant financiero personal explícito (`DnxFinanceGrant.capability = DNX_FINANCE_PARTNER_CONNECT`).
- Un Super Admin puede recibirlo, pero **solo** con grant explícito.
- No se cambia la definición global de `SUPER_ADMIN`.

Código / docs:

- `docs/dnx-payments/DNX_PARTNER_MP_SELF_CONNECT.md`
- Test: `packages/payments/src/finance-permissions/finance-permissions.test.ts`  
  (`SUPER_ADMIN ≠ automatic PARTNER_CONNECT`)

---

## 3. Desbloqueo

1. En Staging, iniciar sesión **una vez** con Google (o crear cuenta) usando exactamente  
   `cuart.daniel@gmail.com`  
   → crea el `User` canónico en la DB de identidad Staging.
2. Reanudar 10D.2.2E: grant explícito + panel `/admin/finanzas/mi-cuenta` + connect TEST.
3. Confirmar allowlist admin Clickatón si el panel exige acceso admin además del grant.

**Alternativa (solo si Daniel confirma):** otorgar el grant a otro User existente (p. ej. `dnxfotografia@gmail.com` id 62) — **no** se hizo en esta etapa.

---

## 4. Checks no ejecutados (gate User)

| Check | Estado |
|-------|--------|
| Conflictos partner account | N/A |
| Grant ACTIVE | N/A |
| UX mi-cuenta | N/A |
| Owner invariant | sin mutación |
