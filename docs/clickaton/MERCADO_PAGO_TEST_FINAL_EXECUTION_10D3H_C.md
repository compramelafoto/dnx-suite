# Clickatón — Etapa 10D3H-C — Ejecución final smoke Mercado Pago TEST

**Cierre documental:** ETAPA **10D3H-D** (2026-07-22).  
**Veredicto técnico 10D3H-C:** webhook firmado validado · smoke congelado.

---

## A. Contexto

| Campo | Valor |
| --- | --- |
| Objetivo | Validar Checkout Pro TEST + S2S + webhook HTTP firmado oficial MP en staging |
| Fecha | 2026-07-22 |
| Rama | `migration-legacy-clf-to-monorepo` |
| SHA desplegado | `962f81d` |
| Proyecto Vercel | `clickaton-staging` |
| Alias | `https://clickaton-staging.vercel.app` |
| Neon | `clickaton-staging` / `clickaton_staging` |
| App Mercado Pago | Clickaton / Checkout Pro (`236071…3138`) |
| Seller TEST | `314…2692` · `TESTUSER313600323196489184` · MLA · `@testuser.com` |
| Buyer TEST | cuenta `@testuser.com` (tarjeta APRO) |
| Provider DNX | `mercado_pago_test` |
| Entorno order | SANDBOX |

---

## B. Flujo ejecutado

1. Registration pública TEST creada (`cmrvt7…1nub`).
2. Order DNX creada → preferencia Checkout Pro.
3. Pago TEST en `www.mercadopago.com.ar` (tarjeta APRO, $15 ARS).
4. Retorno a staging (`status=approved`); UI de token no usada como evidencia.
5. Refresh S2S (×2) → APPROVED / CONFIRMED / idempotente.
6. Deploy firma oficial `x-signature` + secret webhook.
7. Simulador oficial MP (Pagos / `payment.updated` / Data ID real) → **HTTP 200**.
8. Ingest `HTTP_WEBHOOK` → S2S `getPayment` → efectos Clickatón.
9. Order PAID · Registration CONFIRMED · Hold CONSUMED · reconciliación CONSISTENT.

---

## C. Evidencia final

| Campo | Resultado |
| --- | --- |
| Payment | `169962…0634` |
| Preference | `314137…9b3a` |
| Registration | `cmrvt7…1nub` |
| Order | `dnx_ord_…4c04` |
| Webhook eventId | `mp_wh_996de368-…_169962120634` |
| HTTP | **200** |
| Firma | válida |
| x-signature | presente |
| x-request-id | presente (en eventId) |
| S2S getPayment | **200** |
| Payment status | approved / accredited |
| Order | PAID |
| Environment | SANDBOX |
| Registration | CONFIRMED |
| Hold | CONSUMED |
| Origin | HTTP_WEBHOOK |
| Reconciliación | CONSISTENT |
| Amount | 1500 minor · ARS |
| External ref | `clickaton:registration:cmrvt7…1nub` |

Simulador MP (entrega firmada usada ante historial vacío):

| Campo | Resultado |
| --- | --- |
| Hora (UTC) | `2026-07-22T17:53:56Z` |
| type / action | `payment` / `payment.updated` |
| Panel | **200 - OK** |
| Log Vercel | `webhook_received` · status APPROVED · registration/order match |

---

## D. Causa raíz histórica (secuencia)

1. El endpoint esperaba firma DNX propietaria (`x-dnx-payments-signature`) y rechazaba webhooks oficiales MP.
2. Se implementó verificación oficial Mercado Pago (`x-signature` / `x-request-id` / manifest HMAC) + path S2S + origin `HTTP_WEBHOOK` (`3fee3e3`).
3. El alias staging sirvió un deployment **Preview** sin `DNX_PAYMENTS_WEBHOOK_SECRET` → 401.
4. El secret se habilitó en Preview y Production; alias pasó a Production.
5. S2S usaba `MERCADOPAGO_TEST_ACCESS_TOKEN` incorrecta o vacía (Sensitive mal cargada) → `Payment not found` / 500.
6. Se cargó la credencial TEST correcta del seller `314…2692` (tipo Encrypted verificable).
7. Webhook firmado → **HTTP 200** con eventId `mp_wh_…`.

---

## E. Seguridad validada

| Check | Resultado |
| --- | --- |
| GET webhook | 405 `METHOD_NOT_ALLOWED` |
| POST unsigned | 400 `WEBHOOK_UNSIGNED` |
| POST firma inválida | 401 `WEBHOOK_INVALID_SIGNATURE` |
| POST firma válida (simulador oficial) | 200 |
| S2S posterior obligatorio | sí (`getPayment` tras firma) |
| Confianza solo en body | no |
| Seller TEST validado | sí (`/users/me` TESTUSER) |
| Order SANDBOX | sí |
| live_mode genérico relajado | no (attestation sandbox bridge+orden) |
| HMAC timing-safe | sí |
| Idempotencia `providerEventId` | sí (`mp_wh_{requestId}_{paymentId}`) |
| Producción comercial aislada | sí |

---

## F. Incidentes y mitigaciones

| Incidente | Mitigación |
| --- | --- |
| Preview sin webhook secret | Secret en Preview+Production; alias Production |
| CLI deploy accidental a `fotoffice-dnxsuite` | Alias `fotoffice.com` restaurado |
| Credencial TEST vacía/incorrecta (Sensitive) | Recreada Encrypted; fingerprint = smoke local |
| Probe temporal `/api/debug/mp-s2s-probe` | Eliminado; redeploy limpio `962f81d` (probe → 404) |
| Historial panel MP vacío | Simulador oficial firmado como evidencia |
| WIP execute / search-by-external_reference | No mezclado en commits de webhook |

Producción comercial / Neon prod / `clickaton-dnxsuite` / `maratonfotografica.com`: **intactos**.

---

## G. Riesgos residuales

- Historial oficial de notificaciones en panel MP Pruebas sigue vacío (sin Reenviar de historial).
- Evidencia firmada obtenida vía **simulador oficial** MP (no replay de entrega histórica).
- `searchPaymentsByExternalReference` permanece WIP local (no en `962f81d`).
- Commits documentales locales pueden estar ahead de origin (push requiere autorización).
- Escenarios rechazado / pendiente no ejecutados (futuro).
- Rotación y custodia de credenciales TEST / webhook secret.
- Observabilidad y alertas de webhook (métricas/alertas) pendientes.

---

## Check-config / execute (congelado)

```bash
pnpm --filter clickaton smoke:dnx-payments-test -- --check-config
# execute (REQUIERE autorización explícita; crea pago TEST real):
pnpm --filter clickaton smoke:dnx-payments-test -- --execute --confirm-test-only
```

| Ítem | Detalle |
| --- | --- |
| Guards | DB no producción; seller TEST; `safeToExecute`; URLs HTTPS staging; provider `mercado_pago_test` |
| Crea | registration, order, preference, (con execute) pago TEST |
| No crea | recursos prod; no push; no Neon prod |
| Variables | `MERCADOPAGO_TEST_ACCESS_TOKEN`, `MERCADOPAGO_TEST_PUBLIC_KEY`, `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba`, `DNX_PAYMENTS_WEBHOOK_SECRET`, `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` / `CLICKATON_PUBLIC_URL`, `DATABASE_URL` staging, `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test` |
| WIP execute | `apps/clickaton/scripts/lib/run-mp-test-execute.ts` (no pusheado) |

### Protocolo de reejecución

1. Proyecto **solo** `clickaton-staging` (nunca `clickaton-dnxsuite`).
2. DB Neon **staging** (`clickaton_staging`); abort si host prod.
3. Seller TEST + buyer TEST **distinto** del pago anterior cuando aplique.
4. Amount mínimo (p. ej. 1500 minor ARS).
5. Dominio / webhook URL staging.
6. `--confirm-test-only` obligatorio en execute.
7. **Autorización explícita** para generar otro pago TEST.
8. Sin producción comercial / sin Neon prod.
9. Limpieza / informe final sanitizado (sin secretos).
10. No fabricar firmas; no desactivar validación.

---

## Commits de producto relevantes (origin)

| SHA | Tema |
| --- | --- |
| `26550be` | docs smoke |
| `3fee3e3` | firma oficial MP |
| `b7dda93` | mensajes retorno |
| `3f92e34` / `962f81d` | unblock build staging |

---

## Veredicto 10D3H-C

**WEBHOOK FIRMADO APROBADO — 10D3H-C LISTA PARA CIERRE** (cerrada en 10D3H-D).

## Próximo bloque (no iniciado)

**10D3I** — definición y ejecución del siguiente bloque (requiere autorización).  
No push automático. No segundo pago sin auth. No producción comercial.
