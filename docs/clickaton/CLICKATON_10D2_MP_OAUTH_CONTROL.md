# Clickatón 10D.2 — Preflight y OAuth LIVE controlado (Mercado Pago)

**Fecha:** 2026-07-30 (actualizado **10D.2.3**)  
**Proyecto Vercel Production:** `clickaton-dnxsuite`  
**Dominio:** `https://maratonfotografica.com`  
**Callback:** `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback`

---

## Veredicto actual (10D.2.3)

# `READY FOR PRODUCTION PARTNER OAUTH`

Ver detalle: `docs/clickaton/CLICKATON_10D23_PRODUCTION_FINANCE_PROMOTION.md`

| Gate | Estado |
|------|--------|
| Staging matriz + partner | PASS |
| Deploy Production | PASS (`dpl_8AXuQERDEkPcebZqqUAc6a8GoWNq`) |
| Partner flags LIVE (`PROD`) | PASS |
| Preflight partner Production | **PARTNER_MP_PREFLIGHT_PASS** |
| Owner `pa_ba733fa7…` | ACTIVE / vault intacto |
| Inscripciones | **cerradas** |
| OAuth Tammy | Pendiente (humano) |
| Pago LIVE | Bloqueado (legal + Tammy + allocation) |

---

## Histórico breve

| Etapa | Resultado |
|-------|-----------|
| 10D.2 | CONTROL USER NOT EQUIVALENT / Tammy bloqueada pre-partner |
| 10D.2.1 | Partner self-connect implementado |
| 10D.2.2 | Staging APP_NOT_CONFIGURED → retest 10D.2.2B PASS parcial |
| 10D.2.2F | Matriz roles Daniel/DNX/Tammy |
| **10D.2.3** | **Promoción Production + READY FOR PRODUCTION PARTNER OAUTH** |

---

## Owner account (no tocar)

`pa_ba733fa7a35f4326` ORGANIZATION ACTIVE / PROD + vault — **no revocar / no sobrescribir**.

Rol finance OWNER = grant de `cuart.daniel@gmail.com` (ownership técnico org puede seguir referenciando user 1).

---

## Matriz de grants Production

| Capability | Daniel | dnxfotografia | Tammy |
|---|---:|---:|---:|
| DNX_FINANCE_OWNER | Sí | No | No |
| DNX_FINANCE_PARTNER_CONNECT | Sí | Sí | Sí |
| PRODUCT_FINANCE_VIEWER | Sí | Sí | Sí |

Doc: `docs/dnx-payments/DNX_FINANCE_ROLE_MATRIX.md`

---

## Flags Partner Production

```text
DNX_PARTNER_MP_SELF_CONNECT_ENABLED=true
DNX_PARTNER_MP_OAUTH_ENVIRONMENT=PROD
```

(`PROD` es el valor de contrato en código; no usar `LIVE` como string de env.)

---

## Siguiente acción humana

1. Tammy → login → Mi cuenta de cobro → Conectar Mercado Pago (LIVE)
2. Validar ACTIVE + vault + owner intacta
3. Daniel configura Tammy 100% distribuible
4. Legal → único desbloqueo pago LIVE / apertura

---

## Legal

`LEGAL REVIEW REQUIRED`
