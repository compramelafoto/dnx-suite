# Clickatón 10D.1 — Remediación pre-launch Production

**Fecha:** 2026-07-30  
**Proyecto Vercel Production:** `clickaton-dnxsuite`  
**Dominio:** `https://maratonfotografica.com`  
**DB Production:** Neon `clickaton-production` (`bitter-math-56019731`) · branch `production` · host `ep-silent-haze-awfh50a5*` · DB `clickaton_production`  
**No tocar Staging:** `ep-round-fog…` / `clickaton-staging`

---

## Veredicto

# `CLICKATON PRODUCTION STORAGE READY`

(10D.1.1B — vars Sensitive en Vercel Production + smoke runtime + welcome fixture)

| Hecho | Estado |
|-------|--------|
| Deploy Production | `dpl_AmjBEis87HAJDQffatZay1Hfq2hH` READY → `maratonfotografica.com` |
| Vars R2 en Production | **PRESENT** (todas las requeridas) |
| Bucket / region / endpoint | `clickaton-media` · `auto` · `https://f2657ee4….r2.cloudflarestorage.com` |
| Smoke PUT→HEAD→GET→DELETE | **PASS** (objeto eliminado) |
| Welcome Card TEST | **PASS** (render → R2 → read → delete; backend `R2`) |
| `DNX_SOCIAL_PUBLISHER_LIVE` | `false` |
| Inscripciones | **CERRADAS** (“Inscripciones próximamente”) |
| `R2_PUBLIC_URL` | unset (OK) |

Legal global: `LEGAL REVIEW REQUIRED`.  
Pendiente dominio obras: `FOTORANK CONTEST WORK STORAGE AUDIT REQUIRED`.

---

## 1. Backup

| Ítem | Valor |
|------|--------|
| Método | `npx neonctl@2.38.5` + org `org-bold-morning-27184918` |
| Proyecto | `bitter-math-56019731` (`clickaton-production`) |
| Parent | `production` / `br-billowing-paper-aw1nrj9t` |
| Branch backup | `backup-before-clickaton-production-launch` |
| ID | `br-proud-butterfly-awggsxia` |
| Estado | `ready` (verificado por `branches list`) |
| Endpoint backup (sanitizado) | `ep-aged-mode-awai9lqh*` |

**PASS** — migrate/seed solo después de este backup.

---

## 2. Migrate

| Ítem | Valor |
|------|--------|
| Comando | `prisma migrate status` / `migrate deploy` vía `@repo/db` |
| Host confirmado | `ep-silent-haze-awfh50a5` (≠ Staging) |
| Pendientes aplicadas | 5 migraciones (ranking, FR rules 09a/09b, legacy user map, guest nullable userId) |
| Status final | **Database schema is up to date** (90 migraciones) |
| `db push` | **no usado** |

**PASS**

---

## 3. Edición

| Campo | Valor |
|-------|--------|
| Slug | `clickaton-argentina-2026` |
| Edition ID | `cms78cthj0000xpc4841bihf4` |
| Nombre | Clickatón Argentina 2026 |
| `isPublished` | **true** |
| `registrationEnabled` | **false** (kill switch cerrado) |
| `status` | `DRAFT` (publicado para landing; sin cobro) |
| Fecha evento | 2026-09-19 (TZ `America/Argentina/Cordoba`) |
| Fases | 25.000 / 30.000 / 35.000 ARS (minor 2500000 / 3000000 / 3500000) |
| First-N remera | `stockLimit=100` en Fase 1 |
| Seed flag | `CLICKATON_SEED_PUBLISH_LANDING=1` |

**PASS** — landing sin abrir inscripciones.

---

## 4. Landing

| Probe | Resultado |
|-------|-----------|
| Health | `publishedEditions: 1`, host `ep-silent-haze…` |
| `/maratones/clickaton-argentina-2026` | **HTTP 200** |
| CTA | **Inscripciones próximamente** (post-deploy kill-switch) |
| `/…/inscripcion` | “no disponible”; sin CTA de cobro |
| Deploy Production | `dpl_3SfbV8tbjwLNseaRwDWJWKwMjBgs` → alias `maratonfotografica.com` |

**PASS** (tras fix mapper + deploy Production).

---

## 5. Kill switch

| Mecanismo | Detalle |
|-----------|---------|
| Fuente de verdad | `ClickatonEdition.registrationEnabled` (+ `isPublished`) |
| Env `REGISTRATIONS_OPEN` | **no existe** (documentado) |
| Checkout | `public-registration-service` → `unavailable` si `!registrationEnabled` |
| UI pública | `prisma-source` ahora respeta `registrationEnabled` (antes marcaba “abierta” con ventanas null) |
| Admin | toggles edición sin redeploy |
| Webhooks / cron / admin | siguen operativos con regs cerradas |

**PASS** — requisito de lanzamiento cumplido a nivel producto.

---

## 6. Payments provider

| Ítem | Valor |
|------|--------|
| Valores permitidos (código) | `manual` \| `mercado_pago_test` \| `mercado_pago_orders_test` |
| `mercado_pago_production` | **FORBIDDEN** (`mercado_pago_production_forbidden` + release-check 10A) |
| Adapter LIVE writes | bloqueado (`assertSandboxWriteAllowed`) |
| Production env seteado | `CLICKATON_DNX_PAYMENTS_PROVIDER=manual` |
| Motivo | valor soportado, fail-closed; **no** TEST silencioso en Production |
| LIVE cobro | **pendiente etapa siguiente** (OAuth collector + unlock adapter LIVE) |

**PASS parcial** (env ya no MISSING). LIVE real sigue bloqueado por diseño hasta unlock explícito.

---

## 7. R2 / storage

Ver sección **Production Storage** (10D.1.1) abajo.

---

## Production Storage (10D.1.1)

### Contrato código Clickatón (nombres reales)

| Variable | Uso en código |
|----------|----------------|
| `R2_BUCKET` **o** `R2_BUCKET_NAME` | Bucket S3/R2 |
| `R2_ENDPOINT` | `https://<accountId>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Access Key S3-compatible |
| `R2_SECRET_ACCESS_KEY` | Secret S3-compatible (server-only) |
| `R2_PUBLIC_URL` | Opcional — base pública welcome/profile (`welcome-card/storage.ts`) |
| `R2_ACCOUNT_ID` | Recomendada (suite / endpoint derivado) |
| `R2_REGION` | Opcional (`auto`) |

Consumidores:

- Welcome / profile: `apps/clickaton/lib/welcome-card/storage.ts` → keys `clickaton/{welcome\|profile}/…`
- Obras privadas: `apps/clickaton/lib/photo-upload/storage.ts` → keys `clickaton/private/entries/…` (sin URL pública)
- Merch: soft-ref `DnxMediaAsset` + mismos `R2_*` cuando haya assets

**No inventar** prefijos `CLICKATON_R2_*` salvo alias futuro; el runtime hoy espera `R2_*`.

### Arquitectura elegida: **B — bucket Production propio**

| Opción | Decisión |
|--------|---------|
| A. Reutilizar bucket DNX (`compramelafoto-prod` / `infospot-media`) + prefix | **Rechazada** — riesgo de mezcla y exposición; HeadBucket confirma que existen esos buckets ajenos |
| B. Bucket dedicado Clickatón | **Elegida** |

| Recurso | Valor sanitizado |
|---------|------------------|
| Account ID (suite) | `f2657ee4…` (mismo account DNX; no es secreto fuerte) |
| Bucket objetivo | `clickaton-media` (alineado a `infospot-media`; **no** contiene `prod` para poder crearlo vía tooling cuando el token funcione) |
| Prefix lógico app | ya en código: `clickaton/…` y `clickaton/private/entries/…` |
| Smoke key | `clickaton/production/smoke/<uuid>.txt` |
| Separación Staging | bucket distinto futuro `clickaton-*-staging`; **no** sobrescribir Staging CLF |

Buckets existentes auditados (S3 Head con credencial local ajena, solo lectura):  
`compramelafoto-prod` · `compramelafoto-staging` · `infospot-media` — **ningún** `clickaton-*` (**NotFound**).

### Credenciales: API Token ≠ R2 S3 keys

| Tipo | Para qué | Estado 10D.1.1 |
|------|----------|----------------|
| Cloudflare **API Token** (`CLOUDFLARE_API_TOKEN`) | MCP/API: listar/crear buckets, CORS, r2.dev | **INVÁLIDO** (MCP `Authentication error` / `Invalid API Token`) |
| R2 **Access Key ID + Secret** | Runtime Clickatón Put/Get/Delete S3 | **AUSENTE** en Vercel Production Clickatón |

Clickatón **runtime** necesita las Access Keys S3. El API Token solo sirve para ops/MCP.

### Scopes mínimos (least privilege)

En Cloudflare → **R2** → **Manage R2 API Tokens** (o Account API Tokens con permiso R2):

1. Permission: **Object Read & Write** (Workers R2 Storage Bucket Item Write)  
2. Resource: **solo** bucket `clickaton-media`  
3. Evitar token con “Account Settings” / DNS / Workers edit globales  

Opcional ops (separado): API Token con `Cloudflare R2:Edit` solo para crear bucket/CORS — no cargarlo en Vercel de la app.

### Seguridad (diseño actual)

- Secrets server-only (no `NEXT_PUBLIC_*` para secret/access key)  
- Private entries: sin `publicUrl`; key guard `clickaton/private/entries/`  
- Welcome keys: prefix `clickaton/` + UUID  
- Preferir **sin** acceso público de bucket hasta media proxy; si se setea `R2_PUBLIC_URL` (r2.dev), no subir originales privados a paths adivinables compartidos con público  
- MIME / size limits viven en upload services (no en este desbloqueo)

### Env Vercel Production (`clickaton-dnxsuite`) — 10D.1.1B

| Variable | Estado |
|----------|--------|
| `R2_ACCOUNT_ID` | **PRESENT** (`f2657ee4…`) |
| `R2_ACCESS_KEY_ID` | **PRESENT** (no valor en docs) |
| `R2_SECRET_ACCESS_KEY` | **PRESENT** (no valor en docs) |
| `R2_ENDPOINT` | **PRESENT** · `https://f2657ee4….r2.cloudflarestorage.com` |
| `R2_BUCKET` | **PRESENT** · `clickaton-media` |
| `R2_BUCKET_NAME` | **PRESENT** · `clickaton-media` |
| `R2_REGION` | **PRESENT** · `auto` |
| `R2_PUBLIC_URL` | **MISSING** (intencional) |

Nota ops: vars tipo **Sensitive** — `vercel env pull` / `env run` no inyectan valores; verificación vía runtime  
`GET /api/cron/r2-production-smoke` (auth cron / `x-vercel-cron`).

### Smokes (10D.1.1B)

| Smoke | Estado |
|-------|--------|
| Runtime PUT→HEAD→GET→DELETE | **PASS** · deleted |
| Welcome render → R2 put → get → delete | **PASS** · backend `R2` · ~68KB PNG |
| Social publish | no ejecutado · `DNX_SOCIAL_PUBLISHER_LIVE=false` |
| Script local `r2-production-smoke.ts` | no usable sin pull de Sensitive; runtime es fuente de verdad |
| Endpoint | `/api/cron/r2-production-smoke` |

### Historial automatización

| Etapa | Resultado |
|-------|-----------|
| 10D.1.1A Wrangler OAuth + bucket | PASS · `clickaton-media` |
| 10D.1.1A crear S3 keys vía API | 403 → keys humanas en Vercel |
| 10D.1.1B verificación runtime | **STORAGE READY** |

---

## 8. Welcome card

**NO HECHO** — bloqueado por credencial R2. Mantener `DNX_SOCIAL_PUBLISHER_LIVE=false`.

---

## 9. Identidad Tammy

| Ítem | Valor |
|-------|--------|
| User.id | `2` (único por email) |
| Email | `tammyytamer@gmail.com` |
| Financial identity | `cms78czmk000rxpc4zdx9k8bf` (PERSON, primary) |
| `DnxPaymentAccount` | **ninguna** |
| Grants | `PRODUCT_FINANCE_VIEWER` / `clickaton` ACTIVE |
| Caps edición | 17 |
| Acuerdo edición | DRAFT “Tammy 100%”, currency ARS, `paymentAccountId=null`, sin version ACTIVE |

**PASS identidad** / **BLOCKER collector OAuth**.

---

## 10. MP LIVE preflight

| Ítem | Estado |
|-------|--------|
| `CLICKATON_MP_CLIENT_ID` / `SECRET` | PRESENT (Encrypted en Vercel) |
| Callback canónico esperado | `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |
| Pull CLI de `CLICKATON_MP_REDIRECT_URI` | vacío (tipo Encrypted/sensitive) — validar en dashboard Vercel/MP app |
| Vault master key | PRESENT |
| Webhook público | GET → 405 (accesible, no muta) |

Preflight **no 100% verde** por storage + collector ausente + redirect no re-leíble vía CLI.  
Estado OAuth: **pendiente humano** (instrucciones abajo). No declarar `READY FOR TAMMY OAUTH` al 100% hasta confirmar redirect exact match en Vercel UI.

---

## 11. OAuth Tammy — instrucciones humanas

Cuando redirect + app MP LIVE estén confirmados en UI:

1. Entrar a `https://maratonfotografica.com`
2. Iniciar sesión con la Cuenta DNX de Tammy (`tammyytamer@gmail.com`)
3. Ir al panel financiero Clickatón
4. Pulsar **Conectar Mercado Pago**
5. Autorizar la cuenta **LIVE** correcta

Validación automática post-retorno (sin mostrar tokens): callback, state, User.id=2, `DnxPaymentAccount` ACTIVE, vault credential ref, provider account id.

---

## 12. Collector

**NO ACTIVE** — sin `DnxPaymentAccount`. Tras OAuth, exigir `status=ACTIVE` + allocatable.

---

## 13. Distribución 100%

| Ítem | Estado |
|-------|--------|
| Acuerdo seed | nombre “Tammy 100%”, ARS, participante ORGANIZER ACCEPTED |
| Version ACTIVE / rules 10000 bps | **no** (`currentVersionId=null`) |
| Hardcode frontend | no (estructura 1:N DB) |

Activar distribución solo después de collector ACTIVE.

---

## 14. Resend

| Ítem | Estado |
|-------|--------|
| `RESEND_API_KEY` / `EMAIL_FROM` | PRESENT (Encrypted) |
| Smoke send controlado | **no ejecutado** (CLI pull vacío; sin exponer secretos) |

**WARNING / acción humana** — enviar TEST inscripción + activación con links Production.

---

## 15. Webhook

| Probe | Resultado |
|-------|-----------|
| `GET /api/webhooks/dnx-payments` | 405 `METHOD_NOT_ALLOWED` |
| SSO blocking | no observado en dominio custom |

**PASS infraestructura básica** (sin evento LIVE falso).

---

## 16. Cron

| Ítem | Estado |
|-------|--------|
| `vercel.json` schedule reconcile | `*/10` → `/api/cron/payments-reconciliation` |
| Secrets | `CRON_SECRET` / `CLICKATON_CRON_SECRET` PRESENT |
| Probe sin secret | 401 `UNAUTHORIZED` (esperado) |
| Llamada autorizada | no ejecutada (secret no pullable) |

**PASS registro + auth gate** / WARNING ejecución con secret.

---

## 17. Observabilidad / runbook

Actualizado en `CLICKATON_PRODUCTION_LAUNCH_RUNBOOK.md` (lookup por registration number, email sanitizado, order, MP payment, correlation).

---

## 18. Legal

Pack: `docs/clickaton/CLICKATON_LEGAL_APPROVAL_PACK.md`  
Estado: **`LEGAL REVIEW REQUIRED`** hasta `LEGAL APPROVED FOR REGISTRATION`.

---

## 19. Branches Vercel

| Ítem | Valor |
|-------|--------|
| Production Branch | **`main`** |
| Rama migration | Preview only (auto Production no apunta a `migration-legacy-clf-to-monorepo`) |
| Deploy 10D.1 Production | CLI `vercel deploy --prod` desde monorepo root → `clickaton-dnxsuite` |
| Nota ops | Un intento previo con `.vercel` incorrecto desplegó **Staging** (`clickaton-staging`); Staging health OK (`ep-round-fog…`, publishedEditions=11). Luego deploy correcto a Production. |

**PASS protección Production Branch** (main).

---

## 20. Remaining blockers (reevaluación corta post-10D.1.1)

| Blocker | Estado |
|---------|--------|
| Production backup | PASS |
| Production migrations | PASS |
| Edition | PASS (`published` + regs closed) |
| DNX Payments provider | PASS parcial (`manual`; LIVE forbidden) |
| R2/storage | **PASS** — `CLICKATON PRODUCTION STORAGE READY` |
| Resend | WARNING (vars PRESENT; smoke pendiente) |
| Tammy OAuth | BLOCKER (sin payment account) |
| Legal | `LEGAL REVIEW REQUIRED` |
| Controlled LIVE payment | NO HECHO (etapa siguiente) |

No avanzar OAuth Tammy / pago LIVE mientras storage siga bloqueado.

---

## CI / checks ejecutados

- `mercado-pago-test-adapter.selfcheck` OK  
- `prisma migrate status` clean (Production)  
- HTTP smoke Production (home, ficha, inscription closed, webhook, cron 401, health)  
- Typecheck/lint monorepo completo: no corrido end-to-end en esta sesión (deploy Vercel build OK)

---

## No hechos (por diseño / bloqueo)

- Abrir `registrationEnabled`  
- Pago LIVE  
- Inventar aprobación legal  
- Reutilizar bucket Staging sin arquitectura explícita  
- Conectar OAuth en nombre de Tammy  
