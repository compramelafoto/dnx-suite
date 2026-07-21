# Clickatón — Etapa 10D3H-C — Ejecución final smoke Mercado Pago TEST

## Fecha / HEAD / staging

| Campo | Valor |
| ----- | ----- |
| Fecha | 2026-07-21 |
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD local / origin | `f508a19` (ahead 0 / behind 0; contiene `9d94ac2` + `1693491`) |
| Push autorizado | Realizado (`1693491`, `9d94ac2`); origin luego avanzó con `f508a19` (InfoSpot) |
| Proyecto staging | `clickaton-staging` |
| URL | `https://clickaton-staging.vercel.app` |
| Deploy READY | `dpl_38pam3gHVUgL5PMofbRgXw7GWeDu` — SHA `9d94ac2` |
| Neon staging | proyecto `clickaton-staging` (`plain-sky-50672248`) / DB `clickaton_staging` — 61/61 |
| Provider | `mercado_pago_test` |
| Smoke externo pago | **No ejecutado** — bloqueado por webhook Mercado Pago (panel no confirmable sin sesión) |

## Objetivo

```text
Clickatón staging → inscripción TEST → reserva → orden DNX → preferencia MP TEST
→ Checkout Pro TEST → retorno → S2S / webhook → confirmación → reconciliación
```

## Push

| Control | Resultado |
| ------- | --------- |
| Comando | `git push origin migration-legacy-clf-to-monorepo` (sin force) |
| Resultado | Commits `1693491` / `9d94ac2` en origin; estado final `0 0` |
| Force / tags / otras ramas | No |

## Deployment staging

| Control | Resultado |
| ------- | --------- |
| Proyecto | `clickaton-staging` (`prj_MM6Bkdi8…`) |
| Rama | `migration-legacy-clf-to-monorepo` |
| SHA desplegado | `9d94ac2` (ancestro de HEAD `f508a19`) |
| Build | READY |
| Dominio | `clickaton-staging.vercel.app` |
| SSO / password | Off (`ssoProtection: null`) |
| DB | Neon staging `clickaton_staging` |
| `clickaton-dnxsuite` / Production comercial | Intactos |
| `maratonfotografica.com` | No tocado |

## Webhook público (app)

| Probe | Resultado |
| ----- | --------- |
| GET `/api/webhooks/dnx-payments` | **405** `METHOD_NOT_ALLOWED` |
| POST sin firma | **400** `WEBHOOK_UNSIGNED` |
| 302 / Vercel 401 / 404 | Ausentes |

## Webhook Mercado Pago (panel)

| Control | Resultado |
| ------- | --------- |
| App | CLICKATON / Pruebas (requerido) |
| URL esperada | `https://clickaton-staging.vercel.app/api/webhooks/dnx-payments` |
| Evento | Pagos |
| Verificación Browser MCP | **No confirmada** — redirect a login ML/MP |
| MCP save_webhook | Ausente |
| Veredicto paso 5 | **BLOQUEADO POR WEBHOOK MERCADO PAGO** |

No se usó ComprameLaFoto, webhook de producción, `maratonfotografica.com` ni `clickaton-dnxsuite.vercel.app`.

## Check-config final

```text
pnpm --filter clickaton smoke:dnx-payments-test -- --check-config
→ exit 0
```

| Control | Resultado |
| ------- | --------- |
| Seller TEST | `safeToExecute` — `TEST/TEST_USER/app_usr_attested_and_test_seller_verified` |
| Buyer TEST | dominio `@testuser.com` |
| Credentials source | `credenciales_de_prueba` |
| Provider | `mercado_pago_test` |
| DB | staging / `clickaton_staging` |
| URL / webhook | staging HTTPS |
| SHA declarado | `9d94ac2` (lineage OK con HEAD) |
| Production | Ausente |

## Execute

No ejecutado (`--execute --confirm-test-only` retenido) por bloqueo de panel webhook MP.

## Escenarios

| Escenario | Estado |
| --------- | ------ |
| Aprobado | No ejecutado |
| Rechazado | No ejecutado |
| Pendiente | No ejecutado |
| Webhook externo / S2S / idempotencia / reconciliación | No ejecutados |

## Tests locales (sin pago)

| Comando | Resultado |
| ------- | --------- |
| `test:smoke-db-classify` | OK |
| `prisma validate` / `generate` | OK |
| `@repo/payments test` | OK (120) |
| `selfcheck:dnx-payments-checkout` | OK |
| `selfcheck:dnx-payments-persistence` | OK |
| `selfcheck:dnx-payments-smoke` | OK |
| `selfcheck:mercado-pago-test-adapter` | OK |
| `check-types` | OK |
| `lint` | OK |
| `build` | OK |

## Seguridad

- Sin secretos en docs ni logs.
- Sin dinero real / cuentas productivas en checkout.
- Neon producción y Vercel Production comercial no modificados.
- Stash `10d3b-temp-aside-before-switch*` intacto.
- Sin segundo push.

## Bloqueos restantes

1. Confirmar en panel MP (CLICKATON / Pruebas) la URL de webhook staging + evento Pagos.
2. Tras confirmación explícita: ejecutar `--execute --confirm-test-only` + checkout visual TEST.
3. Código execute local (`run-mp-test-execute.ts` + refresh S2S WIP) aún no commiteado — listo para uso local post-desbloqueo.

## Veredicto

**SMOKE BLOQUEADO — CONFIGURACIÓN PENDIENTE** (webhook Mercado Pago panel).

## Próximo paso (no iniciado)

Tras smoke aprobado: **10D3I — PREPARACIÓN DE STAGING OPERATIVO Y OBSERVABILIDAD**.
