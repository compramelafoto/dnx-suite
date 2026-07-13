# 45 — Production services readiness (alias Vercel operativo)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD servido en Production:** `78efb7e`  
**Alias operativo:** `https://infospot-dnxsuite.vercel.app`  
**Deployment Production:** `dpl_FAh19tn4qSehFpCSoenfcfL5Ay6L` (Ready)  
**Decisión:** **GO operativo en alias Vercel** · **NO-GO** dominio propio (`infospot.com.ar`)

**Alcance de esta etapa:** cerrar bloqueantes técnicos que **no** dependen de DonWeb. Sin Google Cloud, sin Search Console, sin features, sin `db push` / `migrate reset`.

Ver también: [`42-production-go-live.md`](./42-production-go-live.md), [`43-launch-readiness.md`](./43-launch-readiness.md), [`44-editorial-operations-manual.md`](./44-editorial-operations-manual.md).

---

## 1. Matriz de recursos

| Recurso | Estado | Acción requerida |
|---------|--------|------------------|
| Neon prod (`infospot-production` / bitter-salad) | **OK** | Ninguna. 36 migraciones. Settings + 4 categorías sembradas. |
| R2 bucket `infospot-media` | **OK** | CORS + r2.dev públicos. |
| R2 token S3 (`R2_ACCESS_KEY_ID` / `SECRET`) | **Falta** | 22B/22C: **`BLOCKED_BY_MANUAL_R2_TOKEN`**. Metadata OK; keys sin update desde 2026-07-11. Ver [`47-r2-production-smoke-report.md`](./47-r2-production-smoke-report.md). |
| CLF readonly | **OK** | Apunta a CLF prod (`compramelafoto` / falling-darkness). Proxy anti-write en app. |
| Cron | **OK** | `CRON_SECRET` Production · schedules en `vercel.json` · auth 401 sin secret · dry-run + sync limitado OK. |
| Resend / SMTP | **Opcional** | Degradación segura sin `RESEND_API_KEY`. Ver §8. |
| Analytics GA4 | **Opcional** | Métricas internas OK; Measurement ID no cargado. Ver §9. |
| Director | **Pendiente** | DB sin `User`. Tras primer login OAuth → seed rol. Ver §7. |
| Deploy alias Vercel | **OK** | Health `db:ok`, version `78efb7e`. |
| Dominio / SSL / canónicos / OAuth / Search Console | **Pendiente DonWeb** | Fuera de esta etapa. |

**Launch readiness estimado: ~88%** (sin cambio: keys S3 siguen bloqueando media)  
Detalle R2 Etapa 22B: [`46-r2-production-readiness.md`](./46-r2-production-readiness.md).  
Para 100% público en dominio propio: DNS + SSL + canónicos + OAuth redirect + Search Console + **R2 S3 keys** + Director + smoke autenticado uploads.

---

## 2. Neon

| Campo | Valor (no secreto) |
|-------|---------------------|
| Proyecto | `infospot-production` |
| Project ID | `wandering-pine-79918137` |
| Host pooler | `ep-bitter-salad-…-pooler.c-9.us-east-1.aws.neon.tech` |
| Migraciones | 36 |
| Contenido | Categorías canónicas + settings; **0** `PUBLISHED`; sync inbound dejó borradores `DRAFT` / `NEEDS_REVIEW` |
| Users / Director | **0** usuarios |

Preview/Development siguen en staging histórico (`ep-dawn-dew…`) — **no** mezclar con Production.

---

## 3. R2 — procedimiento manual (bloqueante uploads)

El token Cloudflare del DNX-MCP **puede** listar/gestionar buckets, pero **no** crear API Tokens de usuario (`POST /user/tokens` → 403). Las keys S3 deben crearse en el panel.

### Pasos exactos

1. Abrir [Cloudflare Dashboard](https://dash.cloudflare.com) → cuenta ComprameLaFoto.  
2. **R2** → **Overview** → Account Details → **Manage** (API Tokens).  
3. **Create Account API token** *o* **Create User API token**.  
4. Nombre sugerido: `infospot-media-prod-s3`.  
5. Permisos: **Object Read & Write**.  
6. Scope: **Apply to specific buckets only** → `infospot-media`.  
7. Create → copiar **Access Key ID** y **Secret Access Key** (solo se muestran una vez).  
8. En Vercel → proyecto `infospot-dnxsuite` → Settings → Environment Variables → **Production** (sensitive):

| Variable Vercel | Valor |
|-----------------|--------|
| `R2_ACCESS_KEY_ID` | Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key |

Ya configuradas (no tocar salvo drift):

| Variable | Valor esperado (no secreto) |
|----------|------------------------------|
| `R2_ACCOUNT_ID` | Account ID Cloudflare |
| `R2_BUCKET_NAME` | `infospot-media` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | `https://pub-3cc4a4641be54ab9aeca101179467a60.r2.dev` |

9. **Redeploy Production** (los env sensibles requieren redeploy).  
10. Smoke: upload técnico pequeño → derivados → cleanup (sin dejar residuos).

**No** guardar keys en el repo ni en docs.

---

## 4. CLF readonly

| Ítem | Estado |
|------|--------|
| Variable Production | **Set** (`CLF_READONLY_DATABASE_URL`) |
| Host | CLF prod Neon `ep-falling-darkness-…` (proyecto `compramelafoto` / `divine-hall-…`, branch `production`) |
| Probe | ~46 eventos / ~639 álbumes (SELECT OK) |
| Write guard app | `packages/db/src/clf-readonly-client.ts` — bloquea create/update/delete/`$executeRaw` |
| `CLF_WRITE_DATABASE_URL` | **No** en Production |
| `ALLOW_CLF_WRITE_FROM_INFOSPOT` | **No** en Production → provisioning outbound **bloqueado** |
| `COMPRAMELAFOTO_PUBLIC_URL` | `https://compramelafoto.com` |

Nota: el rol Neon `infospot_readonly` se intentó crear pero Neon lo asocia a `neon_superuser` (no revocable desde `neondb_owner`). La protección efectiva es el **proxy de escritura** + ausencia de write URL/flag. No usar ese rol en Vercel.

### Sync controlado (ejecutado)

1. Dry-run `limit=3` → OK (crearía 3).  
2. Sync real `limit=3` → 3 creados como `DRAFT` / `NEEDS_REVIEW` / `originKind=IMPORTED`.  
3. `PUBLISHED=0`.  
4. Segunda pasada (idempotencia del lote) → `created=0`, `updated=3`.  
5. El cron programado `*/15` puede haber importado más borradores después del promote — todos siguen **sin publicar**.

---

## 5. Crons

| Path | Schedule | Auth |
|------|----------|------|
| `/api/cron/clf-events-sync` | `*/15 * * * *` | Bearer `CRON_SECRET` |
| `/api/cron/reconcile-public-coverage` | `*/30 * * * *` | Bearer `CRON_SECRET` |

Verificado en alias:

- Sin secret → **401**  
- Con secret + `dryRun=1&limit=3` → **200**  
- Coverage dry-run → **200**  
- Lock → **429** si se solapa  

No hay jobs experimentales ni backfills masivos en `vercel.json`.

---

## 6. Deploy

| Ítem | Valor |
|------|-------|
| Alias | `https://infospot-dnxsuite.vercel.app` |
| Health | `status=ok`, `db=ok`, `version=78efb7e` |
| Smoke público | `/` `/noticias` `/eventos` `/publicar-evento` `robots` `sitemap` → 200; 404 OK |
| Dominios Vercel | `infospot.com.ar` / `www` verificados; DNS público aún a cargo de DonWeb |

---

## 7. Director (pendiente de consentimiento / primer login)

No hay usuarios en Neon prod. **No** se creó Director automáticamente.

### Procedimiento seguro

1. Abrir `https://infospot-dnxsuite.vercel.app` e iniciar sesión Google con la cuenta autorizada (crea `User`).  
2. Con `DATABASE_URL`/`DIRECT_URL` de **Production** (nunca imprimir):

```bash
INFOSPOT_DIRECTOR_EMAIL="<email-autorizado>" pnpm --filter @repo/db db:seed:infospot
```

3. Verificar acceso a `/redaccion`, asistente, editor, distribución, coberturas **sin publicar**.

---

## 8. SMTP / Resend

| Clasificación | Detalle |
|---------------|---------|
| **Obligatorio día 1** | Ningún flujo crítico de home/redacción exige correo si el login Google funciona. |
| **Opcional** | Emails de identidad (`packages/auth` → Resend). Sin `RESEND_API_KEY` el envío se **omite sin fallar**. |

Cuando se configure: `RESEND_API_KEY` + `EMAIL_FROM` (remitente verificado; **no** depender aún de `@infospot.com.ar`).

---

## 9. Analytics

| Capa | Estado |
|------|--------|
| Métricas internas (`ARTICLE_VIEW` / `EVENT_VIEW` / CTA) | Código listo |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **No** configurado — no inventar propiedad |
| Search Console | **No** (pendiente dominio) |

---

## 10. Contenido productivo

- **No** se ejecutaron seeds que publican DEMO.  
- Categorías + settings OK.  
- Eventos importados CLF: solo `DRAFT` (revisión editorial antes de publicar).  
- Preferido: borradores REAL desde Redacción tras Director.  
- Alternativa staging: `db:seed:infospot-launch-drafts` (DRAFT/DEMO; **no** recomendado en prod el día D).

---

## 11. Seguridad

| Check | Resultado |
|-------|-----------|
| Cron sin secret | 401 |
| Secretos en HTML home | No detectados |
| HSTS | Presente |
| `ALLOW_CLF_WRITE_FROM_INFOSPOT` | Ausente en Production |
| R2 keys | Aún no cargadas (uploads fallarán hasta §3) |
| Indexación alias | `robots.txt` permite `/` en el host canónico actual (`*.vercel.app`) |

**Política recomendada mientras no haya dominio propio:** no anunciar el alias; tratarlo como staging público técnico. Canónicos siguen en `*.vercel.app` hasta DonWeb. **No** se cambió robots en código en esta etapa.

---

## 12. Pendientes exclusivos del dominio

1. Delegación DNS DonWeb.  
2. SSL en `infospot.com.ar` / `www`.  
3. Canónicos: `NEXT_PUBLIC_INFOSPOT_URL` / `APP_URL` / `AUTH_URL`.  
4. `GOOGLE_REDIRECT_URI` + callback OAuth (sin crear proyecto GCP nuevo).  
5. Search Console.  

---

## 13. Confirmaciones

- Google Cloud **no** configurado.  
- Producción CLF **no** recibió escrituras desde Info Spot (write no habilitado).  
- No merge a `main`.  
- No `prisma db push` / `migrate reset`.  
- No features de editor / asistente / workflow / UX.  
- Alias Vercel operativo con Neon exclusivo, CLF readonly, crons y sync inbound controlado.
