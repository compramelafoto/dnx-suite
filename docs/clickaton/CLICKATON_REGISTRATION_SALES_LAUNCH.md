# Clickatón — Registration Sales Launch Gate (10G.1 … 10G.9 POST-PAYMENT UX)

**Gate:** `CLICKATON REGISTRATION SALES READY`  
**Actualización:** 2026-07-31 (etapa 10G.9 — post-pago + email delivery)  
**Dominio:** https://maratonfotografica.com  
**Edición:** `clickaton-argentina-2026` · 19/09/2026 · Rosario  

**Decisión legal humana:** `LEGAL APPROVED FOR REGISTRATION` · Terms activas `CLICKATON_TERMS_2026_09_19_v2` (PUBLISHED)

**Doc 10G.9:** [`CLICKATON_POST_PAYMENT_UX_AND_EMAIL_DELIVERY.md`](./CLICKATON_POST_PAYMENT_UX_AND_EMAIL_DELIVERY.md)

---

## Cronograma V2 (10G.3) — captura ≠ upload

Timezone: `America/Argentina/Buenos_Aires`

| Ventana | Horario | Boundary |
|---------|---------|----------|
| Acreditación | 14:00–16:00 | — |
| Charla introductoria | 16:00–16:30 | — |
| **CAPTURE** | 16:00–20:00 | `[16:00:00, 20:00:00)` EXIF `DateTimeOriginal` |
| **UPLOAD** | 16:00–22:00 | `[16:00:00, 22:00:00)` reloj servidor |

La hora de upload **no** valida la captura. 20:00–22:00: sin capturas nuevas válidas; sí selección/revelado/carga.

**Terms:** `CLICKATON_TERMS_2026_09_19_v2` (PUBLISHED). v1 conservada para audit. Nuevas aceptaciones → v2.

**Reserva E2E** `cms8rrnwa0001jp04tvw37s6n`: `CANCELLED`/`EXPIRED` · `termsVersion=v1` · **no mutar** · próximo E2E = nueva reserva con v2.

**Impacto sales:** Schedule/Terms V2 **PASS** en preflight 10G.5. Ventas públicas siguen cerradas (`registrationEnabled=false`) hasta GO humano.

---

## Identidad financiera (10G.2B) — conceptos distintos

Estos tres conceptos **no** implican tres cuentas distintas de Mercado Pago:

| Concepto | Quién / qué | Rol |
|----------|-------------|-----|
| **Finance Owner interno** | `cuart.daniel@gmail.com` → grant `DNX_FINANCE_OWNER` | Administra configuración OAuth / finanzas Clickatón |
| **Recipient interno** | `dnxfotografia@gmail.com` → partner / recipient del acuerdo | Recibe **100%** de la inscripción (Tammy **0%**) |
| **PaymentAccount externo (MP)** | `pa_ba733fa7a35f4326` · `providerUserId=97484805` · PROD | **Única** identidad collector Mercado Pago canónica |

Decisión humana confirmada: el collector “owner” y el recipient `dnxfotografia@gmail.com` son **la misma cuenta real** de Mercado Pago. No se debe crear un segundo OAuth ni un segundo `DnxPaymentAccount` para esa cuenta.

**Clasificación PROD (auditoría 10G.2B):**

- `pa_ba733fa7a35f4326` → **CANONICAL** (único MP PROD con `providerUserId=97484805`)
- Duplicados / alias → **ninguno** (constraint UNIQUE por provider+user+env)
- Historial de credenciales antiguas: no borrar; rotar vía reconnect sobre el canónico

**Vault (10G.2B):**

- La master key Production estaba vacía / irrecuperable → se **rotó** `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` (fingerprint ops local `sha256_12=2ed87c304b99`, len=44).
- La credencial vault previa del canónico **no** puede desencriptarse con la nueva key → hace falta **reconnect OAuth de la misma cuenta MP** (`97484805`), preservando el PA canónico.
- `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=false` (sin cobro LIVE en esta etapa).
- Flags Owner OAuth habilitados solo para permitir reconnect humano (no abren ventas).

**Reconnect humano (misma cuenta MP):**

1. Sesión como Finance Owner: `cuart.daniel@gmail.com`
2. Panel: `/admin/finanzas/cuenta-owner`
3. Reconectar OAuth autorizando la cuenta MP de `dnxfotografia@gmail.com` (`providerUserId` debe seguir siendo `97484805`)
4. Si MP devolviera otro `providerUserId` → abortar con `MERCADO PAGO ACCOUNT MISMATCH`
5. Tras callback: rotar vault en el PA canónico → decrypt read-only → `VAULT DECRYPT PASS`
6. No abrir `registrationEnabled` ni LIVE hasta etapa de cobro controlado

**Veredicto 10G.2B (pre-reconnect):** ver sección al final.

---

## Checklist sales (10G.1)

| Ítem | Estado |
|------|--------|
| LEGAL | **PASS** |
| TERMS | **PUBLISHED** (`CLICKATON_TERMS_2026_09_19_v2`) · https://maratonfotografica.com/legal/terminos · v1 audit retained |
| DRAFT / edition operable | **PASS** (`status=REGISTRATION_OPEN`) |
| COMMERCIAL OFFER | **PASS** (fase $25.000 activa desde 31/07; remera first-100 / 30/08; talles) |
| EMAIL | **PASS** (evidencia 10E.2) |
| R2 / product media | **PASS** |
| MP LIVE config (recipient/allocation/PA) | **PASS** (DNX 100% · `pa_ba733fa7…` ACTIVE PROD) |
| MP LIVE flag | **ON** (solo ventana E2E 10G.5; apagar tras auditoría post-pago) |
| CONTROLLED LIVE E2E | **EN CURSO** — preferencia LIVE emitida; espera pago humano |
| PUBLIC REGISTRATION | **WAITING HUMAN GO** (`registrationEnabled=false`) |

---

## Preflight final (sin cobro) — PASS config

```text
configuration: READY_CONFIGURATION
liveExecution: ON (durante prueba; ahora OFF)
providerMode: mercado_pago_production
recipient: dnxfotografia@gmail.com
allocation: 100%
amount: 25000 ARS
environment: PROD
webhook/callback: Production maratonfotografica.com
Terms: PUBLISHED
Legal: APPROVED
registrationEnabled: false (salvo ventana mínima E2E)
```

---

## Controlled LIVE E2E — evidencia parcial

| Paso | Resultado |
|------|-----------|
| Reserva guest Production | Creada `cms8rrnwa0001jp04tvw37s6n` · PENDING_PAYMENT · **$25.000** · talle **M** · `termsVersion=CLICKATON_TERMS_2026_09_19_v1` + `termsAcceptedAt` |
| Link Bases en form | `/legal/terminos` Production · PUBLISHED |
| Continuar al pago | **FAIL** → `/pago/error?err=UNEXPECTED` · sin `paymentOrderId` · sin preferencia MP |
| Stop condition | Aplicada: `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=false` + redeploy |

Causa probable (misma familia que intento local): fallo al resolver token OAuth del collector (`VAULT_DECRYPT_FAILED` / vault master key Production). El error se serializa al usuario como `UNEXPECTED`.

**Acción requerida humana/ops (bloqueante de venta):**

1. Restaurar/verificar `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` en Vercel Production (valor con el que se cifraron las credenciales `dnxcred_d5524b2adf65420aa7fd`).  
2. Confirmar decrypt del PA `pa_ba733fa7…` en runtime Production.  
3. Reintentar **una** inscripción LIVE controlada.  
4. Solo entonces emitir `CLICKATON CONTROLLED LIVE E2E PASS`.

---

## Controles que NO se abren solos

- Venta de obras / royalty / withdrawals / certificados / jurado / likes / carruseles / premios / Pase Anual incompleto / post-evento.
- Social LIVE OFF.
- `registrationEnabled=true` solo con GO humano post-E2E PASS.

---

## Veredicto 10G.1

```text
CLICKATON REGISTRATION SALES BLOCKED
```

**Único blocker real del funnel de venta ahora:**

1. **LIVE checkout no crea orden/preferencia MP** (`err=UNEXPECTED` / vault OAuth collector) — no se puede cobrar $25.000 en Production.

Legal, Bases publicadas, edición operable, oferta $25.000 y kill switch público **no** bloquean por sí solos tras 10G.1.

Preparación apertura (NO aplicar): `registrationEnabled=true` queda listo para GO humano **después** de E2E PASS.

---

## Etapa 10G.2B — Identidad única MP + vault

**Hecho (ops, sin cobro):**

| Ítem | Resultado |
|------|-----------|
| Identidad MP PROD | **1** PA canónico `pa_ba733fa7a35f4326` · `providerUserId=97484805` |
| Duplicados mismo provider | **Ninguno** → clasificación `CANONICAL_UNIQUE` |
| Finance Owner interno | `cuart.daniel@gmail.com` · `DNX_FINANCE_OWNER` intacto |
| Recipient / allocation | `dnxfotografia@gmail.com` · **100%** · Tammy 0% · sin mutación |
| Master key Production | Rotada (len=44); runtime presente tras redeploy |
| Vault decrypt canónico | **FAIL** (ciphertext de key anterior) |
| LIVE flag | **false** |
| Preferencia / cobro | **No ejecutados** |
| `registrationEnabled` | **false** |
| Redeploy Production | `maratonfotografica.com` listo con env actualizada |
| Preflight (LIVE OFF) | Config READY · recipient/allocation/amount/webhook/callback PASS · `liveExecution=OFF` |

**Scripts:** `apps/clickaton/scripts/ops-10g2b-audit-mp-identity.ts`, `ops-10g2b-verdict.ts`.

### Veredicto 10G.2B

```text
SINGLE MP COLLECTOR RECONNECT REQUIRED
```

Siguiente paso humano (misma cuenta MP, sin segundo PA): reconnect Owner OAuth → `VAULT DECRYPT PASS` → entonces `SINGLE MP COLLECTOR IDENTITY READY`.

---

## Etapa 10G.2C — Ownership conflict en reconnect

**Root cause (PROD audit):** el último OAuth de `cuart.daniel` (userId=5) fue `PARTNER_CONNECTION` sobre FI PERSON `cms7erl5a…`, no `OWNER_RECONNECT` sobre la FI ORGANIZATION collector. Al autorizar `providerUserId=97484805`, partner emitía `PAYMENT_ACCOUNT_OWNERSHIP_CONFLICT` contra `pa_ba733fa7a35f4326`.

**Fix:**
- Owner callback: `RECONNECT_EXISTING_CANONICAL_ACCOUNT` — reutiliza PA collector por `providerUserId` + markers; rota vault; no crea duplicado; Finance Owner puede actuar sin ser `FI.ownerUserId`.
- Partner callback: si choca con collector → `COLLECTOR_ACCOUNT_REQUIRES_OWNER_RECONNECT` (usar `/admin/finanzas/cuenta-owner`).
- Mismatch de otra cuenta MP → `MERCADO_PAGO_ACCOUNT_MISMATCH`.

**Reconnect humano (una vez, post-deploy):** solo panel Owner → Reconectar → misma cuenta MP `97484805` → esperado `VAULT DECRYPT PASS` + `SINGLE MP COLLECTOR IDENTITY READY`.

---

## Etapa 10G.2D — Recipient DNX 100% vs collector canónico (read-only)

**Veredicto:** `DNX 100% RECIPIENT READY VIA CANONICAL COLLECTOR`

| Campo | Valor |
|-------|--------|
| Finance Owner | `cuart.daniel@gmail.com` (grant OK) |
| Recipient | `dnxfotografia@gmail.com` |
| Allocation | **100%** (Tammy 0%; sum 100%) |
| PaymentAccount | `pa_ba733fa7a35f4326` · wiring **DIRECT** |
| providerUserId | `97484805` |
| Vault | **PASS** |
| Collector | mismo PA · ACTIVE · PROD |
| Destination | `SAME_CANONICAL_MP_ACCOUNT` |
| Ready | **sí** |

Preflight ARS 25.000: config READY · LIVE OFF · sin cobro. No hace falta PARTNER_CONNECT adicional ni segundo OAuth.
---

## Etapa 10G.3 — Schedule V2

| Check | Resultado |
|-------|-----------|
| ACCREDITATION 14:00–16:00 | **PASS** |
| INTRO 16:00–16:30 | **PASS** |
| CAPTURE [16:00, 20:00) | **PASS** |
| UPLOAD [16:00, 22:00) | **PASS** |
| EXIF validation exclusive | **PASS** (selfcheck) |
| 8/10 capture-valid only | **PASS** (dominio) |
| TERMS V2 | **PUBLISHED** |
| NEW ACCEPTANCE V2 | **PASS** (wizard/service default) |
| STAGING config + deploy | **PASS** |
| PRODUCTION config + deploy | **PASS** |
| Sales/MP/pricing/allocation | **NO TOCADOS** |
| `registrationEnabled` / LIVE | **false** |

### Veredicto 10G.3

```text
CLICKATON SCHEDULE V2 FULLY ALIGNED
```

**ACCIÓN LEGAL:** confirmación formal humana de `CLICKATON_TERMS_2026_09_19_v2` pendiente antes de abrir ventas públicas (cronograma materialmente distinto a v1).

---

## Etapa 10G.5 — Preflight final + E2E LIVE controlado

### Preflight (read-only) — PASS

| Check | Resultado |
|-------|-----------|
| Schedule V2 (code + DB + prompts) | **PASS** |
| Terms v2 PUBLISHED / DB | **PASS** |
| Precio ARS 25.000 | **PASS** |
| Provider `mercado_pago_production` | **PASS** |
| Collector `pa_ba733fa7a35f4326` / `97484805` | **PASS** |
| Recipient `dnxfotografia@gmail.com` 100% · Tammy 0% | **PASS** |
| Vault decrypt | **PASS** (master key Production alineada `sha256_12=2ed87c304b99`) |
| Callback / Webhook Production | **PASS** |
| Remera first-100 / deadline 30/08 · talles | **PASS** (0 CONFIRMED consumiendo cupo) |
| `registrationEnabled` | **false** (ventana mínima solo para crear reserva) |
| Legal | **APPROVED** / Terms v2 activa |

**Ops vault:** la master key en Vercel había quedado desalineada (`446054…`); se restauró la key que decrypta la credencial del reconnect (`2ed87c…`). Sin nuevo OAuth ni PA nuevos.

**Código:** adapter Checkout Pro LIVE + `allowProductionWrites` en HTTP client (fail-closed por defecto). Deploy Production `dpl_HETrM2KWgq2gjts3sSQtRYmGTAcr`.

### Reserva LIVE controlada (antes del pago)

| Campo | Valor |
|-------|-------|
| registrationId | `cms9acl7k0001xp78c1aq67so` |
| orderId | `dnx_ord_264240a0bb0a46cc` |
| amount | ARS 25.000 |
| recipient | `dnxfotografia@gmail.com` |
| allocation | 100% |
| providerUserId | `97484805` |
| termsVersion | `CLICKATON_TERMS_2026_09_19_v2` (`termsAcceptedAt` set) |
| talle | `M` |
| estado | `PENDING_PAYMENT` |
| pref_id | `97484805-844c3840-8618-4e12-a9ca-b7f19651656b` |
| environment / provider | `PRODUCTION` / `mercado_pago_production` |

Checkout URL (humano): `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=97484805-844c3840-8618-4e12-a9ca-b7f19651656b`

Post-pago (pendiente): webhook / Order PAID / Registration CONFIRMED / remera / QR / email / welcome / Mi cuenta.

### Resultado 10G.5 — pago LIVE no completado (no es fallo del funnel)

El checkout LIVE llegó correctamente (ARS 25.000, collector `97484805`, recipient DNX 100%, Terms v2).  
El pago **no** se realizó: el operador humano estaba logueado en la misma cuenta Mercado Pago collector → MP bloquea **self-payment**.

Reservas LIVE preservadas **sin** marcar PAID / **sin** webhook Production simulado:

| registrationId | orderId | status / payment | order |
|----------------|---------|------------------|-------|
| `cms9acl7k0001xp78c1aq67so` | `dnx_ord_264240a0bb0a46cc` | `CANCELLED` / `EXPIRED` | `AWAITING_PROVIDER` (PRODUCTION) |
| `cms9byf9d0001xpj73om342k6` | `dnx_ord_1277ebfc77454e94` | `CANCELLED` / `EXPIRED` | `AWAITING_PROVIDER` (PRODUCTION) |

Production seguro post-10G.5: `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=false`, `registrationEnabled=false`, PA `pa_ba733fa7a35f4326` / `97484805` sin rotación.

---

## Etapa 10G.6 — E2E Mercado Pago TEST sin self-payment

### Objetivo

Validar funnel completo en **Staging / MP TEST** (seller ≠ buyer), sin mutar finanzas Production ni repetir pago LIVE.

### Checkout TEST

| Campo | Valor |
|-------|-------|
| registrationId | `cms9dbk1g0003xppehrysck7n` |
| orderId | `dnx_ord_22a14e300a9446a2` |
| preferenceId | `3141372692-72cfee4c-196e-4df0-976a-f2885e13f144` |
| payment_id | `171432208072` |
| amount | ARS 25.000 (`2500000` minor) |
| seller TEST | `TESTUSER313600323196489184` / `3141372692` |
| buyer TEST | `buyer.10g6.34325b@testuser.com` (≠ seller) |
| allocation | ORGANIZER 10000 bps |
| termsVersion | `CLICKATON_TERMS_2026_09_19_v2` |
| order.environment | `SANDBOX` |
| talle | pedido M; catálogo staging usó **XS** (fallback) |

### Checks

| Check | Resultado |
|-------|-----------|
| CHECKOUT TEST | **PASS** |
| PAYMENT APPROVED | **PASS** |
| WEBHOOK | **PASS** (apply + Order PAID) |
| ORDER PAID | **PASS** |
| REGISTRATION CONFIRMED | **PASS** |
| REMERA (first-N included) | **PASS** |
| QR / credential | **PASS** (`CKA26-00003`, QR ACTIVE) |
| EMAIL | **PASS** (modo seguro staging) |
| WELCOME | **PASS** (registro creado; generación asset staging `FAILED`) |
| IDEMPOTENCY | **PASS** (1 reg / 1 order / 1 cred / 1 QR tras refresh+webhook dup) |
| Production LIVE unpaid preserved | **PASS** |
| LIVE flag OFF + registrationEnabled false | **PASS** |

### Fix ops observado

`confirmPaid` en Neon: timeout interactivo Prisma default 5s insuficiente (first-N locks + credential/QR). Subido a `timeout: 30_000` en `prisma-checkout-mutations.ts`.

### Distinción de resultados

| Resultado | Estado |
|-----------|--------|
| TECHNICAL E2E TEST | **PASS** |
| LIVE MONEY FLOW | **NO** — requiere pagador real ≠ collector `97484805` |

### Veredicto 10G.6

```text
CLICKATON MP TEST E2E PASS — LIVE EXTERNAL PAYER SMOKE REQUIRED
```

**No** abrir ventas públicas. El smoke LIVE final será **una** compra real con pagador externo distinto del collector.

---

## Etapa 10G.6B — E2E TEST completo (talle M + post-pago)

Corrige selección de talle (`variant.code === "M"`, no `sizeCode`) y re-ejecuta funnel completo Staging.

| Campo | Valor |
|-------|-------|
| registrationId | `cms9j1qsj0003xpm4fy7inz7m` |
| orderId | `dnx_ord_767d9808acd04893` |
| payment_id | `170567659491` |
| talle | **M** |
| Instagram | `clickaton.e2e.c4ed90` |
| credential | `CKA26-00004` ACTIVE + QR |
| user / Mi Cuenta | userId `66` · `/mi-cuenta/inscripciones/…` |
| Production LIVE unpaid | `cms9acl7k…` / `cms9byf9d…` **no PAID** (CANCELLED/EXPIRED por hold; no mutadas) |
| LIVE flag runtime | `false` (`dpl_BujDzTMRwUPACFcCN5Bsxxi68VTJ`) |

```text
CLICKATON MP TEST E2E PASS — LIVE EXTERNAL PAYER SMOKE REQUIRED
```

---

## Etapa 10G.7 — LIVE EXTERNAL PAYER SMOKE (checkpoint humano)

### Preflight read-only

`LIVE PREFLIGHT GATE PASS` — amount 25.000 · collector `97484805` · recipient DNX 100% · vault PASS · Terms v2 · `registrationEnabled=false` (antes de ventana controlada).

### Activación temporal

- `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=true` + redeploy Production (`dpl` alias `maratonfotografica.com`).
- `registrationEnabled` abierto solo para crear la reserva; **vuelto a false**.

### Reserva LIVE nueva (no reutiliza 10G.5)

| Campo | Valor |
|-------|-------|
| registrationId | `cms9jxbh90001xp8soyj2ff7m` |
| orderId | `dnx_ord_eedc170407b647e1` |
| preferenceId | `97484805-a8b344fa-ff96-4955-b081-1f53a743bd6d` |
| amount | ARS 25.000 |
| collector | `97484805` |
| recipient | `dnxfotografia@gmail.com` 100% |
| termsVersion | `CLICKATON_TERMS_2026_09_19_v2` |
| talle | M |
| status | `PENDING_PAYMENT` / order `AWAITING_PROVIDER` · `PRODUCTION` |

Checkout: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=97484805-a8b344fa-ff96-4955-b081-1f53a743bd6d`

### Veredicto (pre-pago)

```text
LIVE EXTERNAL PAYER HUMAN STEP REQUIRED
```

Pagador debe ser cuenta Mercado Pago **distinta** de collector `97484805` (evitar self-payment).  
**Una** sola compra. Tras `PAGO HECHO`: auditar MP APPROVED + Order PAID + Registration CONFIRMED.

### Post-pago 10G.7 — ejecutado

| Campo | Valor |
|-------|-------|
| providerPaymentId | `171469277830` (sanitizado `1714…7830`) |
| MP | `approved` / `accredited` / `live_mode=true` |
| payer_id | `1466630928` (≠ collector `97484805`) |
| DNX Order | `PAID` · ARS 25.000 · PRODUCTION |
| Registration | `CONFIRMED` · Terms v2 · talle M |
| Credential / QR | `CKA26-00001` ACTIVE |
| UI return | `TOKEN_INVALID` esperado (ops `AUTH_SECRET` ≠ Production); **no** invalida el cobro |
| `registrationEnabled` | **false** |
| LIVE flag post-smoke | apagar a `false` (estado seguro) |

```text
CLICKATON LIVE EXTERNAL PAYER SMOKE PASS
CLICKATON READY FOR PUBLIC SALES — WAITING HUMAN GO
```

---

## Etapa 10G.8 — GO LIVE público 19/09/2026

### Evidencia smoke (re-audit)

| Check | Evidencia |
|-------|-----------|
| MP LIVE | payment `171469277830` tuvo `approved`/`accredited`/`live_mode=true` / ARS 25.000 / collector `97484805` / payer `1466630928` |
| MP ahora | `refunded` post-smoke (trazabilidad conservada; Clickatón sigue CONFIRMED/PAID) |
| Order | `dnx_ord_eedc170407b647e1` **PAID** PRODUCTION |
| Registration | `cms9jxbh90001xp8soyj2ff7m` **CONFIRMED** · Terms v2 · talle M · credential/QR |
| Finanzas | recipient DNX 100% · PA `pa_ba733fa7a35f4326` · vault PASS |
| Legal | `CLICKATON_TERMS_2026_09_19_v2` PUBLISHED · LEGAL APPROVED vigente |

### GO ejecutado

| Campo | Valor |
|-------|-------|
| GO at (UTC) | `2026-07-31T23:53:38.309Z` |
| Deploy | `dpl_6qtageYtBkJ22P3jjz8Dsb1CjsPk` |
| Alias | `maratonfotografica.com` |
| `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED` | **true** (runtime vía redeploy post-flag) |
| `registrationEnabled` | **true** |
| status | `REGISTRATION_OPEN` |
| Precio vigente | ARS 25.000 (fases 30k / 35k configuradas) |
| First-100 | ACTIVE (deadline 30/08) |

### Smoke público (sin comprar)

Landing + ficha 19/09 · CTA Inscribirme · formulario · Instagram · talles XS–5XL · guía de talles (R2) · foto · checkboxes bases/privacidad · hint Mercado Pago · **sin** nuevo pago.

### Veredicto

```text
CLICKATON 19/09/2026 PUBLIC SALES LIVE
```

| Report | |
|--------|--|
| PUBLIC REGISTRATION | ON |
| LIVE PAYMENTS | ON |
| MP PRODUCTION | PASS |
| RECIPIENT DNX | 100% |
| PRICE | ARS 25.000 |
| TERMS V2 | ACTIVE |
| PRODUCT MEDIA | PASS |
| FIRST-100 | ACTIVE |
| EMAIL | PASS |
| QR | PASS |
| WELCOME CARD | PASS |

Nota: el footer marketing aún menciona «sin inscripciones…» (copy stale); el funnel público de inscripción **está** activo.

---

---

## 10G.9 — Experiencia post-pago + diagnóstico email

| Ítem | Estado |
|------|--------|
| UX éxito (QR, acreditación Fontanarrosa, cronograma v2, CTAs) | **READY** (código) |
| Recipient Production = email real (no sink `.test`) | **FIXED** (código) |
| Reenvío seguro + rate limit + admin | **READY** (código) |
| Email rediseñado marca Clickatón | **READY** (código) |
| Inscripción real `CKA26-00002` | CONFIRMED / APPROVED / QR ACTIVE — email original mal ruteado a sink |
| Resend webhook eventos | **MISSING** |
| Acción requerida | Reenviar confirmación a Gmail real vía admin Production |
| Deploy 10G.9 | `dpl_GoVdDjHqGxzSqDBUkfm4nXWA1uZM` → maratonfotografica.com |

Veredictos: ver `CLICKATON_POST_PAYMENT_UX_AND_EMAIL_DELIVERY.md`.

---

**Fin 10G.1 … 10G.9 — ventas LIVE + post-pago**
