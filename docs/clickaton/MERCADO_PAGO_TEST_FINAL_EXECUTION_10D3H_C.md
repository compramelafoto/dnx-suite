# Clickatón — Etapa 10D3H-C — Ejecución final smoke Mercado Pago TEST

## Fecha / HEAD / staging

| Campo | Valor |
| ----- | ----- |
| Fecha | 2026-07-20 |
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD local / origin | `dd14f37` (ahead 0 / behind 0) |
| Ancestros 10D3H-B | `0ef8083`, `029ef68`, `dd14f37` |
| Ancestros 10D3H | `2a7611b`, `f340f05`, `e21c26c`, `eefc001` |
| Entorno objetivo | Preview / staging (no Production) |
| Provider requerido | `mercado_pago_test` |
| Smoke externo | **No ejecutado** — bloqueado por configuración |

## Objetivo

Completar verificación, deployment autorizado y smoke externo Checkout Pro TEST:

```text
Clickatón staging → inscripción TEST → reserva → orden DNX → preferencia MP TEST
→ Checkout Pro TEST → retorno → S2S → evento → confirmación → reconciliación
```

## Runtime confirmado (código)

```text
Clickatón (lib/checkout/actions/runtime.ts)
→ @repo/payments (createClickatonCheckoutService + bridge)
→ MercadoPagoCheckoutProTestAdapter
→ Preferences API / payments S2S
```

No hay llamadas directas de Clickatón a Mercado Pago.

## Credenciales verificadas (sin valores)

| Control | Resultado |
| ------- | --------- |
| Shell local `MERCADOPAGO_TEST_ACCESS_TOKEN` | Ausente |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | Ausente |
| `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba` | Ausente |
| `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test` | Ausente (efectivo `manual`) |
| `validateMercadoPagoTestCredentials()` con token real en shell | No ejecutable (token ausente) |
| `safeToExecute` | No alcanzado |
| Preferencia / cobro TEST | **No creado** |

MCP DNX puede tener token de prueba en otro contexto (`APP_USR-`, sandbox-eligible). **No se usó** para crear preferencias: falta attestation `credenciales_de_prueba` + seller `TEST_USER` vía `/users/me` en el runtime Clickatón, y el smoke exige vars locales/Preview explícitas.

## Seller / buyer TEST

| Rol | Estado |
| --- | ------ |
| Seller TEST (`TEST_USER` / `@testuser.com`) | No verificado en esta sesión (sin token en shell) |
| Buyer TEST | No attestado (`mp.buyer_test_attested` bloqueante) |
| Datos personales reales | No usados |

## Deployment staging

| Propiedad | Valor |
| --------- | ----- |
| Proyecto | `clickaton-dnxsuite` |
| Preview deployment | `dpl_FuvTsq9yDgRRe6dwNPJ9cVMZPU2J` |
| URL preview | `https://clickaton-dnxsuite-8ugv6wj8w-compramelafotos-projects.vercel.app` |
| Alias git | `https://clickaton-dnxsuite-git-migratio-33c1e4-compramelafotos-projects.vercel.app` |
| Rama | `migration-legacy-clf-to-monorepo` |
| SHA | `dd14f379f7df20a3050862451958af53a45044f3` |
| Contiene `dd14f37` / 10D3H-B | **Sí** |
| No usa `e7b6d5c` como target | Correcto (preview actualizado) |
| Build | READY (~77s) |
| Health | healthy |
| Protection | **Vercel Authentication** (`vercel_auth_enabled=true`) |
| GET webhook preview | 302 → SSO |
| POST webhook sin firma / sin bypass | **401** protection |
| Alias `clickaton-dnxsuite.vercel.app` | Apunta a **Production** antigua (`dpl_F7kpXQR…`); webhook → 404 HTML — **no usar** |
| Dominio `maratonfotografica.com` | Production — **fuera de alcance** |
| Push adicional | No requerido (origin ya en `dd14f37`); no autorizado en esta etapa para otros cambios |

`vercel_validate_staging` falló por bug MCP (`type: sensitive` no aceptado en schema). Evidencia de deploy tomada de `vercel_status` + probes HTTP sanitizados.

## Base staging

| Control | Resultado |
| ------- | --------- |
| `DATABASE_URL` en shell smoke | Ausente |
| Escritura / migraciones aplicadas en remoto | **No** |
| `prisma db push` | No ejecutado |
| Neon producción | No tocada |
| Aptitud para smoke | **Pendiente** — identificar DB Preview no productiva antes de `--execute` |

## URLs públicas

| Variable | Estado |
| -------- | ------ |
| `CLICKATON_PUBLIC_URL` | Ausente en shell |
| `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` | Ausente en shell |
| Preview HTTPS | Existe, pero detrás de SSO |
| Production / dominio público MP | **Prohibido** para este smoke |

Rutas de retorno (código, no probadas end-to-end externo):

- `/maratones/[slug]/inscripcion/pago/exito`
- `/maratones/[slug]/inscripcion/pago/pendiente`
- `/maratones/[slug]/inscripcion/pago/error`
- Webhook: `/api/webhooks/dnx-payments`

## Webhook

| Control | Resultado |
| ------- | --------- |
| URL en panel MP TEST → preview `dd14f37` | No confirmado (tarea manual) |
| Recepción pública sin SSO | **Bloqueada** por Vercel Auth |
| Bypass header `x-vercel-protection-bypass` | Existe en tooling; **MP no lo envía** |
| Flujo esperado | MP → adapter → S2S → inbox → efecto Clickatón |
| Payload como única fuente de verdad | Prohibido (diseño vigente) |

## Dry-run / check-config

```bash
pnpm --filter clickaton smoke:dnx-payments-test -- --check-config
```

- Exit code: **2**
- Blocking: **12** (`blocked=CREDENCIALES`)
- Sin HTTP a MP, sin escrituras DB, sin preferencia

Dry-run normal / `--execute --confirm-test-only`: **no ejecutados** (controles en rojo).

## Escenarios externos

| Escenario | Estado |
| --------- | ------ |
| Aprobado | No ejecutado |
| Rechazado | No ejecutado (cobertura mock/local conservada) |
| Pendiente | No ejecutado (cobertura mock/local conservada) |
| Idempotencia / reconciliación externa | No ejecutado |

## Seguridad

- Sin cobros reales, sin Production, sin split/payout/refund/QR.
- Sin tokens, passwords, public keys completas ni emails en este documento.
- WIP ajeno y stash `10d3b-temp-aside-before-switch` intactos.
- No push forzado; no push de docs sin autorización explícita adicional si se requiere remoto.

## Limpieza

Nada que limpiar en MP/DB: no se crearon preferencias ni inscripciones TEST en esta sesión.

## Veredicto

**SMOKE BLOQUEADO — FALTA CONFIGURACIÓN MANUAL**

Estado de ejecución del smoke: `BLOQUEADO POR VARIABLES` (y, tras vars, queda **bloqueo de deployment** por SSO que impide webhooks públicos).

## Tareas manuales pendientes (mantener 10D3H-C abierta)

1. Cargar en Preview (secret store, no git/chat):
   - `MERCADOPAGO_TEST_ACCESS_TOKEN` / `MERCADOPAGO_TEST_PUBLIC_KEY` (credenciales de prueba)
   - `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba`
   - `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test`
   - `CLICKATON_PUBLIC_URL` / `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` HTTPS del preview actualizado
   - `DNX_PAYMENTS_WEBHOOK_SECRET`
   - Buyer TEST attestado según script
   - `CLICKATON_STAGING_DEPLOYED_SHA=dd14f37…` (o SHA preview vigente)
   - `DATABASE_URL` Preview no productiva
2. Obtener `validateMercadoPagoTestCredentials()` → `safeToExecute: true` (seller `TEST_USER`, env `TEST`).
3. Desactivar Vercel Authentication en la URL de webhook **o** exponer ruta pública equivalente; no usar Production.
4. Configurar notification_url en MP TEST al staging actual (no localhost / no prod / no preview viejo).
5. Re-ejecutar `--check-config` (exit 0) → dry-run → `--execute --confirm-test-only`.
6. Completar escenarios aprobado (+ rechazado/pendiente si sandbox estable) y actualizar esta doc con evidencia sanitizada.

## Próximo paso

No iniciar **10D3I** hasta veredicto `MERCADO PAGO TEST APROBADO — CHECKOUT EXTERNO OPERATIVO`.
