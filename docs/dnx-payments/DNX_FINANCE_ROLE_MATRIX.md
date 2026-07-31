# DNX Payments — Matriz de roles financieros

**Etapa:** 10D.2.2F / **promoción Production 10D.2.3**  
**Estado:** ACCEPTED — MANDATORY (Staging + Production grants aplicados)  
**Legal:** `LEGAL REVIEW REQUIRED`  
**Promoción:** `docs/clickaton/CLICKATON_10D23_PRODUCTION_FINANCE_PROMOTION.md` → `READY FOR PRODUCTION PARTNER OAUTH`

---

## Regla permanente

```text
SUPER_ADMIN
≠ FINANCE_OWNER
≠ PARTNER_CONNECT
≠ VIEWER
```

Los permisos financieros se otorgan **solo** con `DnxFinanceGrant` explícitos.  
Ningún rol global (`SUPER_ADMIN`, allowlist admin Clickatón) implica por sí solo:

- definir porcentajes;
- editar allocations;
- conectar Mercado Pago;
- operar el collector owner.

Un Super Admin **puede** recibir `DNX_FINANCE_OWNER` o `DNX_FINANCE_PARTNER_CONNECT`, pero debe ser un grant aparte.

---

## Capacidades

| Capability | Significado |
|------------|-------------|
| `DNX_FINANCE_OWNER` | Administración financiera global (recipients, %, allocations, owner OAuth) |
| `PRODUCT_FINANCE_VIEWER` | Lectura financiera de producto (Clickatón) |
| `DNX_FINANCE_PARTNER_CONNECT` | Conectar/reconectar/revocar **su** MP personal |
| `PRODUCT_FINANCE_MANAGER` | Mutar distribución de edición (sin ser suite owner) |
| `DNX_FINANCE_ADMIN` | Ops finance (no redefine ownership de suite) |

---

## Matriz Clickatón (canónica)

| Capability | `cuart.daniel@gmail.com` | `dnxfotografia@gmail.com` | `tammyytamer@gmail.com` |
|---|---:|---:|---:|
| Ver finanzas permitidas | YES | YES | YES |
| Conectar MP propio | YES | YES | YES |
| Revocar MP propio | YES | YES | YES |
| Ver MP ajeno | según política OWNER | NO | NO |
| Definir recipients | YES | NO | NO |
| Definir porcentajes | YES | NO | NO |
| Editar allocations | YES | NO | NO |
| Reemplazar owner collector | solo flujo owner seguro | NO | NO |

### Separación conceptual

1. **Administración financiera** — grant `DNX_FINANCE_OWNER` (panel edición + cuenta collector).
2. **Mi cuenta de cobro** — grant `DNX_FINANCE_PARTNER_CONNECT` (`/admin/finanzas/mi-cuenta`).
3. **Ownership técnico** de `DnxPaymentAccount` ORGANIZATION (`pa_ba733fa7…`) ≠ rol finance.  
   Migrar grants **no** debe mutar status/vault/providerUserId del collector.

---

## UI

| Superficie | Quién |
|------------|--------|
| `/admin/ediciones/[id]/finanzas` | mutaciones solo con manage grant |
| `/admin/finanzas/cuenta-owner` | OWNER + flags owner onboarding |
| `/admin/finanzas/mi-cuenta` | PARTNER_CONNECT (u OWNER via `canConnectOwnMpAccount`) |

Nav admin: label **Mi cuenta de cobro** (no mezclar con admin de %).

---

## Operación

Script:

```bash
cd packages/db
DATABASE_URL=… pnpm exec tsx ../../apps/clickaton/scripts/normalize-finance-role-matrix-10d22f.ts --staging
DATABASE_URL=… pnpm exec tsx ../../apps/clickaton/scripts/normalize-finance-role-matrix-10d22f.ts --production --confirm=APPLY_PROD_FINANCE_MATRIX
```

Tests:

- `packages/payments/src/finance-permissions/role-matrix-10d22f.test.ts`
- `finance-permissions.test.ts` (SUPER_ADMIN ≠ PARTNER_CONNECT)

---

## Seed emails (`FINANCE_SEED_EMAILS`)

Solo UX/bootstrap — **no** otorgan permisos:

- `daniel` → `cuart.daniel@gmail.com`
- `dnxStudio` → `dnxfotografia@gmail.com`
- `tammy` → `tammyytamer@gmail.com`
