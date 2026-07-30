# Clickatón — GO / NO-GO final (Etapa 10D)

**Fecha:** 2026-07-30  
**Alcance:** apertura real de inscripciones (Production)  
**Proyecto Vercel Production:** `clickaton-dnxsuite`  
**Dominio canónico:** `https://maratonfotografica.com`  
**Staging técnico previo:** `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING` (10C.3.1)

---

## Veredicto

# `NO-GO`

**Motivo principal:** existen **BLOCKERS** que impiden cobro LIVE seguro, legalidad y disponibilidad de la edición en Production.  
**No se realizó deploy Production ni migrate en esta etapa.**

---

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| Staging checkout + reconciliación MP TEST | PASS (cerrado 10C.3.1) |
| Production proyecto / dominio / HTTPS | PASS |
| Production DB identity (`ep-silent-haze…`, ≠ Staging) | PASS |
| Edición AR2026 publicada en Production | **BLOCKER** (`publishedEditions: 0`, ruta 404) |
| Legal (`LEGAL APPROVED FOR REGISTRATION`) | **BLOCKER** (sigue `LEGAL REVIEW REQUIRED`) |
| MP LIVE + OAuth Tammy + collector ACTIVE | **BLOCKER** |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` Production | **BLOCKER** (MISSING) |
| Email Resend Production (vars presentes) | PASS (vars) / WARNING (smoke send no ejecutado) |
| R2 / storage Production | **BLOCKER** / WARNING fuerte (sin R2; Staging usó inline DB) |
| Social LIVE | PASS fail-closed (confirmar valor runtime `false`) |
| Kill switch env `REGISTRATIONS_OPEN` | WARNING (usar flags edición) |
| Backup pre-launch verificable hoy | WARNING → **requerido antes de migrate** |
| Prueba de pago LIVE controlada | **BLOCKER** (no hecha; no autorizada aún) |

---

## 1. Matriz Production — variables / servicios

| Variable / servicio | Production | Estado |
|---------------------|------------|--------|
| Proyecto Vercel `clickaton-dnxsuite` | READY | PASS |
| Dominio `maratonfotografica.com` | verified | PASS |
| `www` → apex | redirect OK | PASS |
| Production Branch | no fijado en `vercel.json` (docs: rama migration) | WARNING |
| Deploy Production actual | `dpl_DKLYM…` (más viejo que Preview con 10C.3.1) | WARNING |
| `DATABASE_URL` | PRESENT · runtime hint `ep-silent-haze-awfh50a5-pooler` | PASS |
| `DIRECT_URL` | PRESENT · `hasDirectUrl: true` | PASS |
| ≠ Staging `ep-round-fog…` | confirmado distinto | PASS |
| `AUTH_SECRET` | PRESENT | PASS |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `CLICKATON_PUBLIC_URL` | PRESENT | PASS |
| `AUTH_URL` | PRESENT | PASS |
| `RESEND_API_KEY` | PRESENT | PASS |
| `EMAIL_FROM` | PRESENT | PASS |
| `DNX_PAYMENTS_WEBHOOK_SECRET` | PRESENT | PASS |
| `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` | PRESENT | PASS |
| Webhook público GET | `405` (esperado) | PASS |
| `CRON_SECRET` / `CLICKATON_CRON_SECRET` | PRESENT | PASS |
| Cron reconcile (`*/10`) | en `vercel.json` | PASS |
| `CLICKATON_QR_TOKEN_SECRET` | PRESENT | PASS |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | PRESENT | PASS |
| `DNX_SOCIAL_PUBLISHER_LIVE` | PRESENT (confirmar `false`) | WARNING |
| `CLICKATON_MP_CLIENT_ID` / `CLIENT_SECRET` | PRESENT | PASS |
| `CLICKATON_MP_REDIRECT_URI` | PRESENT | PASS |
| OAuth flags onboarding / manual authorized | PRESENT | WARNING (OAuth humano no hecho) |
| `CLICKATON_DNX_PAYMENTS_PROVIDER` | **MISSING** | **BLOCKER** |
| `MERCADOPAGO_CREDENTIALS_SOURCE` | **MISSING** | WARNING |
| R2 (`R2_BUCKET*`, keys, endpoint, public URL) | **MISSING** | **BLOCKER** (media/welcome) |
| Google OAuth client | PRESENT | PASS |
| Health `/api/public/health/db` | `ok: true` | PASS |
| `publishedEditions` | **0** | **BLOCKER** |
| Ruta `/maratones/clickaton-argentina-2026` | **404** | **BLOCKER** |
| Vercel SSO en rutas públicas | no observado en health/landing/webhook | PASS |
| Vault financiero | master key PRESENT | PASS |
| FotoRank sync cron | presente en cron list | WARNING (contrato; contest LIVE N/A) |

---

## 2. Base de datos Production

| Campo | Valor |
|-------|--------|
| Evidencia runtime | health `databaseHostHint=ep-silent-haze-awfh50a5-pooler` |
| Docs 10B.2 | Neon `clickaton-production` / branch `production` / DB `clickaton_production` |
| Staging (no usar) | `ep-round-fog…` (10C) / histórico divine-smoke |
| Ediciones publicadas | **0** |
| Migrate status | **no ejecutado en 10D** (requiere backup + GO) |
| Backup `backup-before-clickaton-production-launch` | **NO creado en 10D** (`neonctl` ausente) → **acción humana requerida antes de migrate** |

---

## 3. Edición / fecha / precios / first-N (código canónico)

| Ítem | Evidencia | Estado |
|------|-----------|--------|
| Fecha oficial | `2026-09-19` (`argentina-2026.ts`) | PASS — sin conflicto 19/20 |
| Seed precios | 25k / 30k / 35k ARS | PASS (vigentes en seed) |
| First-N | `firstNBenefitLimit: 100` + `stockLimit` | PASS (patrón correcto) |
| Estado seed seguro | `DRAFT`, `isPublished: false`, `registrationEnabled: false` | PASS (seguro) |
| Materializado en Production | no (404 / 0 published) | **BLOCKER** |

---

## 4. Mercado Pago LIVE / Tammy

| Ítem | Estado |
|------|--------|
| Callback canónico | PASS — `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |
| CLIENT_ID/SECRET LIVE en Vercel | PRESENT |
| OAuth Tammy ejecutado | **BLOCKER** — no |
| `DnxPaymentAccount` ACTIVE Tammy | **BLOCKER** — no verificado / no conectado |
| Distribución 100% Tammy vía config edición | WARNING — validar tras OAuth + snapshot |
| Provider payments Production env | **BLOCKER** — `CLICKATON_DNX_PAYMENTS_PROVIDER` MISSING |

---

## 5. Email / activación

| Ítem | Estado |
|------|--------|
| Resend + FROM en Production | PASS (variables) |
| Smoke email real 10D | NOT APPLICABLE / WARNING — no ejecutado (sin GO) |
| Staging Resend | MISSING (salvedad conocida) |
| Activation URL debe ser Production | PASS (requisito documentado) |
| Token / AUTH_SECRET Production | PRESENT |

---

## 6. Legal

| Ítem | Estado |
|------|--------|
| `LEGAL REVIEW REQUIRED` | **BLOCKER** |
| Textos `*-test-v1` / pendientes jurídicos | **BLOCKER** |
| Reembolsos/cancelaciones política | **BLOCKER** / WARNING fuerte |
| Código `refundsBlocked: true` | WARNING (ops) |

**Requisito para GO:** `LEGAL APPROVED FOR REGISTRATION`.

---

## 7. Checklist por categoría

| Categoría | Resultado |
|-----------|-----------|
| Identidad DNX | PASS (Staging) / WARNING (Tammy LIVE) |
| Auth | PASS (vars) / WARNING (smoke prod) |
| Registration | **BLOCKER** (edición no publicada en prod) |
| Payments / DNX | **BLOCKER** (provider env + LIVE) |
| MP LIVE | **BLOCKER** |
| Email | WARNING (vars OK, smoke pendiente) |
| Legal | **BLOCKER** |
| DB | PASS identity / WARNING migrate+backup |
| Vercel | PASS / WARNING deploy atrasado vs 10C.3.1 |
| Domains | PASS |
| QR / credential | PASS (Staging) / N/A prod cobros |
| FotoRank | WARNING / N/A contest LIVE |
| Merch / first-N | PASS (código) / **BLOCKER** (no en prod) |
| Mobile | WARNING (no revalidado 10D) |
| Security / rate limit | WARNING |
| Operations / acreditación | WARNING |
| Rollback / kill switch | WARNING (flags edición; backup pendiente) |
| Observability | WARNING |
| Analytics funnel | WARNING |
| Social publisher | PASS fail-closed |

---

## 8. Condiciones mínimas para re-evaluar (próximo veredicto)

1. Backup Neon Production `backup-before-clickaton-production-launch`.  
2. `prisma migrate status` limpio + `migrate deploy` si aplica.  
3. Deploy Production del código post-10C.3.1.  
4. Seed/config AR2026 en Production **sin** abrir (`registrationEnabled=false`) hasta checklist.  
5. Set `CLICKATON_DNX_PAYMENTS_PROVIDER` LIVE + webhook + vault.  
6. R2 Production o storage durable aprobado.  
7. Tammy OAuth LIVE → account ACTIVE.  
8. Distribución edición 100% Tammy.  
9. Smoke email Resend Production.  
10. `LEGAL APPROVED FOR REGISTRATION`.  
11. Política refund/cancel operativa.  
12. Kill switch operativo documentado (flags edición).  
13. Pago LIVE controlado + refund según política.  
14. Recién entonces: `registrationEnabled=true` + `REGISTRATION_OPEN`.

---

## 9. Alternativas de veredicto (por qué no aplican)

| Veredicto | ¿Por qué no? |
|-----------|--------------|
| `GO FOR PRODUCTION LAUNCH` | Hay blockers legales, MP, edición, provider, storage, backup. |
| `GO WITH CONDITIONS` | Las condiciones actuales **sí** ponen en riesgo cobro, legalidad y acceso a la edición. |

---

**Acción legal:** sigue **bloqueante**. No autorizar GO Production hasta `LEGAL APPROVED FOR REGISTRATION`.
