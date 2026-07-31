# Clickatón 10D.3 — Tammy OAuth LIVE, allocation 100% y Resend smoke

**Fecha:** 2026-07-31  
**Dominio:** `https://maratonfotografica.com`  
**Edición:** `clickaton-argentina-2026` (`cms78cthj0000xpc4841bihf4`)  
**Deploy media:** `dpl_5ct3ZcVG9inyib3bM1bRZJyBTJSt`  
**Inscripciones:** `registrationEnabled=false`  
**Legal:** `LEGAL REVIEW REQUIRED`  
**Pago LIVE:** no ejecutado

---

## Veredicto

```text
TAMMY OAUTH BLOCKED
```

Bloqueos paralelos:

```text
PRODUCTION EMAIL BLOCKED
```

Motivo Tammy: tras auditoría Production, `tammyytamer@gmail.com` tiene **0** `DnxPaymentAccount`. El OAuth LIVE humano aún no se completó (o no retornó callback).

Motivo Resend: `RESEND_API_KEY` / `EMAIL_FROM` / `CLICKATON_CRON_SECRET` son **Encrypted** en Vercel; el agente no puede inyectarlos de forma fiable (`vercel env run` → EMPTY o cron 401). Smoke listo en código (`/api/cron/email-smoke`) pendiente ejecución humana con secret runtime.

---

## 1. Media remera (acción pedida en el mismo mensaje) — PASS

Orden cargado:

| # | Rol | Archivo público | HTTP |
|---|-----|-----------------|------|
| 1 | PRIMARY | `/media/remera-clickaton/primary-duo.png` | 200 |
| 2 | GALLERY | `/media/remera-clickaton/gallery-hombre.png` | 200 |
| 3 | GALLERY | `/media/remera-clickaton/gallery-mujer.png` | 200 |
| 4 | SIZE_CHART | `/media/remera-clickaton/size-chart-vertical.png` | 200 |
| 5 | DETAIL | `/media/remera-clickaton/size-chart-horizontal.png` | 200 |

- Producto `REMERA-CLICKATON`: `primaryImageAssetId` + `sizeChartAssetId` seteados.
- `ClickatonProductMedia` count = **5**.
- Guía vertical = chart canónico (mobile-first); horizontal como detalle adicional.
- Storage: servido desde `public/` de Next (sin mutar infra R2; alineado a constraint 10D.3 “NO tocar R2”). Migración a R2 opcional post-etapa.
- Nota catálogo: la tabla de talles incluye 4XL/5XL; variantes seed siguen **XS–XXXL** (sin ampliar stock en esta etapa).

---

## 2. Tammy OAuth — BLOCKED (humano)

### Acción requerida (solo Tammy)

1. Entrar a `https://maratonfotografica.com` con Cuenta DNX.  
2. **Mi cuenta de cobro** → **Conectar Mercado Pago**.  
3. Autorizar **su** MP real.  
4. Volver al callback Clickatón.

No pedir credenciales a Daniel. No copiar tokens.

### Post-OAuth (pendiente validar)

Checks automáticos a correr cuando exista account:

- User Tammy (`id=2`)
- flow PARTNER
- `DnxPaymentAccount` ACTIVE / PROD
- `providerUserId` presente (sanitizado)
- `credentialReference` (vault) presente
- reconnect / revoke disponibles en UI
- owner `pa_ba733fa7a35f4326` intacto
- sin duplicate / ownership conflict

**Estado actual:** `tammyAccounts=0`.

---

## 3. Allocation — NO cambiada (correcto)

OAuth ≠ asignación. Separación respetada.

ACTIVE actual (Plan B intacto):

| Recipient | % | Payment account |
|-----------|---|-----------------|
| DNX ORGANIZATION (`ownerUserId=1` / dnxfotografia) | **100%** | `pa_ba733fa7a35f4326` |

Tammy **no** está en ACTIVE allocation.  
Cuando Tammy quede ACTIVE, Daniel (`DNX_FINANCE_OWNER`) debe crear DRAFT → Tammy 100% → Activar (UI genérica `EditionDistributionEditor`).

---

## 4. Owner invariant — PASS

| Campo | Valor |
|-------|--------|
| account ID | `pa_ba733fa7a35f4326` |
| status | ACTIVE |
| environment | PROD |
| vault (`credentialReference`) | presente |
| providerUserId | presente |
| capabilities | `COLLECTOR` |

Sin cambios.

---

## 5. Matriz de permisos — PASS (grants)

| Actor | Capabilities ACTIVE | Editar % |
|-------|---------------------|----------|
| `cuart.daniel@gmail.com` | `DNX_FINANCE_OWNER` + PARTNER_CONNECT + VIEWER (+ MANAGER clickaton) | **SÍ** |
| `tammyytamer@gmail.com` | VIEWER + PARTNER_CONNECT | **NO** |
| `dnxfotografia@gmail.com` | VIEWER + PARTNER_CONNECT | **NO** |

---

## 6. Resend smoke — BLOCKED (ops)

Ruta lista: `POST /api/cron/email-smoke`  
Body: `{ "confirm": "RESEND_SMOKE_10D3", "to": "cuart.daniel@gmail.com" }`  
Auth: `Authorization: Bearer $CRON_SECRET` (runtime Vercel).

Validará:

1. Confirmación inscripción (`payment_confirmed`) — links `maratonfotografica.com`, branding Clickatón.  
2. Activación Cuenta DNX vía `requestPasswordReset` → `/recuperar/{token}` (set-password canónico actual).  
   Nota: UX post-pago también usa `/maratones/.../inscripcion/activar/[id]`.

Evidencia agente: cron existente también devolvió **401** con secret de `vercel env run` → secret Encrypted no usable desde CLI.

**Runbook humano (local con secret runtime):**

```bash
curl -X POST https://maratonfotografica.com/api/cron/email-smoke \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"confirm":"RESEND_SMOKE_10D3","to":"cuart.daniel@gmail.com"}'
```

Confirmar inbox + Resend dashboard. No participantes reales.

---

## 7. Diagnóstico financiero (sanitizado)

| Check | Estado |
|-------|--------|
| Owner ACTIVE | PASS |
| Tammy ACTIVE | **NO** (0 accounts) |
| Tammy allocation 100% | **NO** (sigue DNX 100%) |
| dnxfotografia sin OWNER grant | PASS (solo VIEWER + PARTNER_CONNECT) |
| Daniel OWNER | PASS |
| Partner environment PROD | PASS (owner) |
| Registrations closed | PASS |

---

## 8. Remaining blockers → 10D.4

1. Tammy completa OAuth LIVE.  
2. Daniel asigna Tammy = 100% y activa.  
3. Resend smoke PASS (humano).  
4. `LEGAL APPROVED FOR REGISTRATION`.  
5. Solo entonces: **10D.4 — pago LIVE controlado**.

No abrir inscripciones. No pago LIVE aún.

---

## 9. Artefactos técnicos añadidos

- `public/media/remera-clickaton/*` + wire DB  
- `scripts/wire-remera-public-media.ts`  
- `app/api/cron/product-media-bootstrap/route.ts` (R2 bootstrap; auth pendiente secret runtime)  
- `app/api/cron/email-smoke/route.ts` (smoke Resend; auth pendiente secret runtime)

---

**Fin 10D.3 (parcial — OAuth humano + Resend humano pendientes).**
