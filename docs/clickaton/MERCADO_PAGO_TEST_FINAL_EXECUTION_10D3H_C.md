# Clickatón — Etapa 10D3H-C — Ejecución final smoke Mercado Pago TEST

## Fecha / HEAD / staging

| Campo | Valor |
| ----- | ----- |
| Fecha | 2026-07-22 |
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD | `ead6565` (contiene `9d94ac2`) |
| Staging alias | `https://clickaton-staging.vercel.app` |
| Deploy alias SHA | `9d94ac2` (READY) |
| Neon | `clickaton-staging` / `clickaton_staging` |
| Provider | `mercado_pago_test` |
| Smoke externo pago | **Ejecutado** — aprobado vía Checkout Pro TEST + S2S |

## Push / producción

- Push de código de pagos: **no** en esta corrida.
- Producción comercial / Neon prod / `clickaton-dnxsuite`: **intactos**.

## Check-config

`pnpm --filter clickaton smoke:dnx-payments-test -- --check-config` → **exit 0**

Seller `TEST_USER` / `safeToExecute=true` · buyer `@testuser.com` · DB staging · URLs staging.

## Execute (sanitizado)

| Recurso | ID sanitizado | Estado final |
| --- | --- | --- |
| Registration | `cmrvt7…1nub` | CONFIRMED |
| Order DNX | `dnx_or…4c04` | PAID / SANDBOX |
| Preference | `314137…9b3a` | approved (mapped PROCESSED) |
| Payment MP | `169962…0634` | APPROVED |
| Hold capacidad | — | CONSUMED |
| Amount | 1500 minor | ARS ($ 15) |
| External ref | `clickaton:registration:cmrvt7…` | match |

## Checkout visual

- Descripción: Inscripción Clickatón TEST
- Importe: $ 15 ARS
- Host: `www.mercadopago.com.ar`
- Medio: tarjeta TEST oficial (APRO)
- Primera apertura con sesión personal: **abortada** (saldo/tarjetas reales)
- Pago completado en perfil limpio sin cuenta personal

## Retorno

`clickaton-staging.vercel.app/.../pago/exito` con `status=approved` y `payment_id` presente.  
La UI staging mostró “Enlace de acceso inválido” (token/`AUTH_SECRET` vs deploy) — **no** se usó el redirect como confirmación.

## S2S / reconciliación

- Refresh 1: APPROVED / CONFIRMED / APPROVED
- Refresh 2: idéntico (idempotente)
- Reconciliación: **CONSISTENT**
- Nota: MP reportó `live_mode=true` en pago TEST; audit `live_mode_ignored_for_test` (bridge TEST)

## Webhook HTTP externo

Inbox staging: eventos `clickaton.normalized_payment` por **refresh S2S** (PROCESSED).  
**No** quedó evidencia de POST firmado `payment.created/updated` desde MP en inbox (posible firma/secret en deploy o entrega).  

Simulación previa del panel: 400 `WEBHOOK_UNSIGNED` controlado.

## Escenarios secundarios

| Escenario | Estado |
| --- | --- |
| Aprobado | Ejecutado completo |
| Rechazado | No ejecutado |
| Pendiente | No ejecutado |

## Tests posteriores

smoke-db-classify, prisma validate/generate, `@repo/payments` (120), selfchecks DNX/MP, check-types, lint — **OK**. Build clickaton — OK.

## WIP execute (no pusheado)

Scripts/adapters locales necesarios para search-by-external-reference + confirm S2S. No se comprometieron en esta etapa.

## Veredicto

**MERCADO PAGO TEST APROBADO — WEBHOOK REQUIERE AJUSTE**

Pago real TEST + S2S + persistencia + reconciliación OK; falta cerrar entrega HTTP firmada del webhook en staging.

## Próximo paso (no iniciado)

Tras ajustar webhook firmado en staging: **10D3I**.
