# Clickatón — Etapa 10D3H-C — Ejecución final smoke Mercado Pago TEST

## Fecha / HEAD / staging

| Campo | Valor |
| ----- | ----- |
| Fecha | 2026-07-22 |
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD | `962f81d` (incluye `b7dda93`, `3fee3e3`, `26550be`, ancestro `9d94ac2`) |
| Staging alias | `https://clickaton-staging.vercel.app` |
| Deploy alias | Preview git limpio `dpl_84Ttqo…` / `clickaton-staging-omdryttvq…` · SHA `962f81d` · READY |
| Neon | `clickaton-staging` / `clickaton_staging` |
| Provider | `mercado_pago_test` |
| Smoke externo pago | **Ejecutado** — aprobado vía Checkout Pro TEST + S2S |

## Push / producción

- Push autorizado: `26550be`, `3fee3e3`, `b7dda93` (+ unblockers `3f92e34`, `962f81d` para build staging).
- Alias staging apunta a deployment GitHub limpio (sin `gitDirty`).
- Producción comercial / Neon prod / `clickaton-dnxsuite` / `maratonfotografica.com`: **intactos**.
- Incidente: deploy CLI accidental a `fotoffice-dnxsuite` → alias `fotoffice.com` restaurado al deployment previo.

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
Fix de mensajes (`b7dda93`) desplegado; el retorno sigue sin confirmar el pago.

## S2S / reconciliación

- Refresh 1: APPROVED / CONFIRMED / APPROVED
- Refresh 2: idéntico (idempotente)
- Reconciliación: **CONSISTENT**
- Nota: MP reportó `live_mode=true` en pago TEST; attestation sandbox (`live_mode_attested_sandbox`) con bridge TEST + orden SANDBOX.

## Webhook HTTP — deploy y secret

| Campo | Resultado |
| --- | --- |
| `DNX_PAYMENTS_WEBHOOK_SECRET` | Presente en `clickaton-staging` / Production (Encrypted). Fuente declarada: MP CLICKATON → Webhooks → Pruebas. Valor **no** expuesto. |
| GET `/api/webhooks/dnx-payments` | **405** `METHOD_NOT_ALLOWED` |
| POST unsigned | **400** `WEBHOOK_UNSIGNED` |
| POST con `x-signature` inválida | **401** `WEBHOOK_INVALID_SIGNATURE` |
| Código | Parser oficial `x-signature` / manifest / S2S / origin `HTTP_WEBHOOK` |

## Replay oficial

- Panel MP Developers → login requerido (DNI/email + reCAPTCHA).
- **Replay no ejecutado** en esta corrida: bloqueado por autenticación del panel.
- No se fabricó firma. No se creó segundo pago.
- Inbox staging: sigue mostrando solo `refresh_…` / S2S_REFRESH (sin fila `mp_wh_…` / HTTP_WEBHOOK nueva).

## Escenarios secundarios

| Escenario | Estado |
| --- | --- |
| Aprobado | Ejecutado completo |
| Rechazado | No ejecutado |
| Pendiente | No ejecutado |
| Webhook firmado real | Pendiente de replay oficial tras login MP |

## Tests posteriores

smoke-db-classify, prisma validate/generate, `@repo/payments` (135), selfchecks DNX/MP, check-types, lint, build — **OK**.

## WIP execute (no pusheado)

Scripts/adapters locales (search-by-external-reference, confirm S2S en status, smoke execute). No se mezclaron en los commits de webhook.

## Veredicto

**DEPLOY APROBADO — REPLAY NO DISPONIBLE**

Staging despliega el fix de firma MP; falta replay oficial desde el panel (login/MFA) para cerrar evidencia HTTP_WEBHOOK.

## Próximo paso (no iniciado)

1. Daniel inicia sesión en Mercado Pago Developers (panel abierto / reCAPTCHA).
2. Replay oficial del payment `169962…0634`.
3. Si replay OK → cierre documental **10D3H-D**.
4. Si no hay replay → autorización para segundo pago TEST.
5. **No** iniciar 10D3I todavía.
