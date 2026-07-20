# Clickatón — Etapa 10D3H-B — Configuración Mercado Pago TEST y smoke

## Objetivo

Cablear **Mercado Pago TEST** (Checkout Pro Preferences) detrás de DNX Payments, con validación fail-closed de credenciales, y determinar si el smoke externo Nivel C puede ejecutarse.

## Fecha / commits base

- **Fecha:** 2026-07-20
- **HEAD de partida:** `eefc001` (fin 10D3H)
- **Documentación oficial consultada:** Checkout Pro credentials / test accounts / Preferences API (Mercado Pago Developers)

## Auditoría

### Adapter Orders vs Preferences

| Alternativa | Estado | Ventaja | Riesgo | Decisión |
| ----------- | ------ | ------- | ------ | -------- |
| Mercado Pago Orders Split | Existe (`MercadoPagoOrdersAdapter`) | Persistencia/webhook Orders | Requiere split, deviceSessionId, receivers | **No** para inscripción Clickatón |
| Checkout Pro Preferences | Nuevo (`MercadoPagoCheckoutProTestAdapter`) | Redirect, sandbox con credenciales de prueba, back_urls, notification_url | Tokens `APP_USR-` ambiguos vs prod | **Sí** — elegido |
| Llamada MP desde Clickatón | Prohibido | — | Rompe arquitectura | **No** |

Flujo:

```text
Clickatón → DNX Payments (createClickatonCheckoutService)
→ provider bridge mercado_pago_test
→ POST /checkout/preferences
→ init_point (HTTPS allowlisted)
→ webhook/refresh → GET /v1/payments/{id} (S2S)
→ evento normalizado → efectos inscripción
```

### Credenciales (riesgo crítico)

Hallazgo previo / MCP: `isTestPrefix=false`, token `APP_USR-` marcado sandbox-eligible.

Según docs oficiales Checkout Pro, las **credenciales de prueba** también usan prefijo `APP_USR-` (igual que producción). Por eso **no** se puede inferir TEST solo por el prefijo.

`validateMercadoPagoTestCredentials()` exige:

1. `declaredEnvironment=sandbox`
2. Para `APP_USR-`: attestation `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba`
3. Seller verificado vía `/users/me` como `TEST_USER` (`@testuser.com` / nickname TESTUSER)
4. `safeToExecute=false` en cualquier ambigüedad

**En esta máquina de desarrollo:** token ausente en shell → smoke externo **no ejecutado**.

### Staging

| Propiedad | Resultado |
| --------- | --------- |
| Proyecto | `clickaton-dnxsuite` |
| Preview | healthy |
| Commit desplegado | `e7b6d5c` (anterior a 10D3G-B/10D3H) |
| HEAD local | `eefc001+` (esta etapa) |
| Deploy automático | **No** (sin autorización) |
| Apta para Nivel C | **No** hasta deploy ≥ `eefc001` |

### Base staging

No auditada con escritura. Smoke externo no tocó Neon. Selfchecks usan solo PostgreSQL local descartable.

| Propiedad | Resultado |
| --------- | --------- |
| Host enmascarado | (no consultado en remoto) |
| Producción | No usada |
| Apta para smoke TEST | Pendiente de staging autorizado |

## Selección de provider

```text
CLICKATON_DNX_PAYMENTS_PROVIDER=manual          # default local
CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test
```

`mercado_pago_production` → throw.

## Mapping de estados

| Mercado Pago | DNX | Clickatón |
| ------------ | --- | --------- |
| pending | PENDING | PENDING_PAYMENT |
| in_process | PROCESSING | PENDING_PAYMENT |
| approved | APPROVED | CONFIRMED |
| rejected | REJECTED | FAILED |
| cancelled | CANCELLED | CANCELLED |
| refunded | REFUNDED | MANUAL_REVIEW |
| charged_back | CHARGEBACK | MANUAL_REVIEW |

## Scripts

- `selfcheck:mercado-pago-test-adapter` — mocks offline
- `smoke:dnx-payments-test -- --check-config` — checklist fail-closed
- `smoke:dnx-payments-test -- --execute --confirm-test-only` — aborta si controles fallan

## Smoke Mercado Pago TEST

**Estado: BLOQUEADO POR CREDENCIALES TEST** (y también por deployment).

No se creó preference real. No se cobró. No se usó token ambiguo MCP para ejecutar.

## Tareas manuales obligatorias

1. En [Mercado Pago Developers → Your integrations](https://www.mercadopago.com.ar/developers/panel/app), abrir la app de **pruebas**.
2. Confirmar sección **Tests → Test credentials / Credenciales de prueba**.
3. Crear/seleccionar **seller TEST** y **buyer TEST** (emails `@testuser.com`).
4. Copiar Access Token y Public Key de **prueba** (nunca Production credentials).
5. Cargar en **Vercel Preview** (no Production) del proyecto `clickaton-dnxsuite`:
   - `MERCADOPAGO_TEST_ACCESS_TOKEN`
   - `MERCADOPAGO_TEST_PUBLIC_KEY`
   - `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba`
   - `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test`
   - `CLICKATON_DNX_PAYMENTS_MODE=prisma`
   - `CLICKATON_PUBLIC_URL` = URL HTTPS preview (no `maratonfotografica.com`)
   - `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` = `{PUBLIC}/api/webhooks/dnx-payments`
   - `DNX_PAYMENTS_WEBHOOK_SECRET`
   - `DATABASE_URL` staging no productiva
6. Configurar webhook de la app TEST hacia la URL staging HTTPS.
7. Autorizar **deploy** del HEAD que contenga ≥ `eefc001` + commits 10D3H-B.
8. Verificar `GET /users/me` con el token de prueba → seller TEST.
9. Ejecutar `pnpm --filter clickaton smoke:dnx-payments-test -- --check-config` en CI/staging.
10. Solo si check-config sale 0: `--execute --confirm-test-only` (etapa 10D3H-C).

**No pegar secretos en chat, git ni docs.**

## Riesgos

- Prefijo `APP_USR-` compartido TEST/PROD
- Staging desactualizado (`e7b6d5c`)
- Webhook aún adapter temporal en Clickatón
- Checkout URL allowlist debe incluir hosts MP (ya añadidos)

## Veredicto

**CONFIGURACIÓN TEST APROBABLE — REQUIERE TAREAS MANUALES**

## Próximo paso

**CLICKATÓN — ETAPA 10D3H-C — EJECUCIÓN FINAL DEL SMOKE MERCADO PAGO TEST**
