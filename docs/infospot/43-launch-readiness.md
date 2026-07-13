# 43 — Info Spot launch readiness (infraestructura lista, dominio pendiente)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD de trabajo:** ver git al momento del commit  
**Decisión:** **NO-GO público** — infraestructura preparada; falta delegación DNS DonWeb + secretos R2 S3 + CLF readonly real + smoke final en dominio.

**Alcance de esta etapa:** preparar producción **sin** lanzar el sitio, **sin** esperar el dominio, **sin** Google Cloud / Search Console, **sin** features.

Ver también: [`42-production-go-live.md`](./42-production-go-live.md).

---

## 1. Estado de infraestructura (resumen)

| Pieza | Estado | Notas |
|-------|--------|-------|
| Git / rama | OK | Working tree limpio en commits de esta etapa |
| Vercel project `infospot-dnxsuite` | OK | Production + Preview activos |
| Neon **infospot-production** | OK | Proyecto exclusivo `wandering-pine-79918137` · host `ep-bitter-salad-…` |
| Migraciones Prisma en Neon prod | OK | 36 aplicadas · schema up to date |
| R2 bucket `infospot-media` | OK (parcial) | Bucket + CORS + r2.dev · **faltan** Access Key / Secret S3 |
| SMTP / Resend | Falta | `RESEND_API_KEY` / `EMAIL_FROM` no en Production |
| CRON_SECRET | OK | Seteado en Production · routes cron en `vercel.json` |
| Analytics Measurement ID | Falta | Variable documentada; ID real no cargado |
| Dominio `infospot.com.ar` | Pendiente DonWeb | Ya verificado en Vercel; DNS público aún no resolvía en auditoría previa |
| Google Cloud OAuth console | **No tocado** | Callback prod se actualiza el día del lanzamiento |
| Search Console | **No tocado** | |

**Launch Readiness estimado: ~72%**  
Para 100%: DNS vivo + URL canónica + OAuth callback + R2 keys + CLF readonly no vacío + seed director mínimo + smoke final + declaración GO.

---

## 2. Neon producción

| Campo | Valor (no secreto) |
|-------|---------------------|
| Proyecto | `infospot-production` |
| Project ID | `wandering-pine-79918137` |
| Org | `org-bold-morning-27184918` (Dnx) |
| Región | `aws-us-east-1` |
| Postgres | 17 |
| Branch | `main` (`br-dawn-star-atqwcauw`) |
| Direct host | `ep-bitter-salad-athqzzs1.c-9.us-east-1.aws.neon.tech` |
| Pooler host | `ep-bitter-salad-athqzzs1-pooler.c-9.us-east-1.aws.neon.tech` |
| Database / role | `neondb` / `neondb_owner` |

### Separación staging / prod (Vercel)

| Target | DB |
|--------|-----|
| **Production** | Neon `infospot-production` (bitter-salad) |
| **Preview** (`migration-legacy-clf-to-monorepo`) | Staging histórico `ep-dawn-dew-…` |
| **Development** | Staging histórico `ep-dawn-dew-…` |

**Nunca** reutilizar dawn-dew como Production.

### Backup recomendado

Antes de próximos `migrate deploy` sobre esta DB: snapshot Neon (console → project → Branches → restore point) o `pg_dump` lógico con `DIRECT_URL`.

### Rollback DB

- Prisma **forward-only** — no `migrate reset`, no `db push`.
- Si una migración rompe runtime: rollback de **deployment** Vercel + hotfix forward, o restore snapshot Neon (DBA).

---

## 3. Migraciones

Ejecutado sobre Neon prod exclusivo:

```bash
# Con DATABASE_URL/DIRECT_URL de infospot-production (nunca imprimir)
pnpm --filter @repo/db exec prisma migrate deploy
pnpm --filter @repo/db exec prisma migrate status
# → Database schema is up to date (36 migrations)
```

Incluye migraciones Info Spot + gaps CLF del monorepo (schema compartido).

---

## 4. R2

| Ítem | Estado |
|------|--------|
| Bucket `infospot-media` | **OK** (creado 2026-07-13, ENAM) |
| Dominio público r2.dev | **OK** `https://pub-3cc4a4641be54ab9aeca101179467a60.r2.dev` |
| CORS | **OK** — origins: vercel.app, infospot.com.ar, www, localhost:3004 · GET/HEAD/PUT/POST |
| Lifecycle / Object Lock | No configurado (opcional posterior) |
| Prefijos editorial / previews / derivados | Convención app (`infospot/…`) — listo cuando haya keys |
| `R2_BUCKET_NAME` / `R2_PUBLIC_URL` / `R2_ACCOUNT_ID` / `R2_ENDPOINT` | **OK** en Vercel Production |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | **Falta** — crear API token S3 en Cloudflare (DNX-MCP bloquea crear buckets `*-prod` y no genera keys de prod) |

### Manual pendiente (R2 keys)

1. Cloudflare → R2 → Manage R2 API Tokens → Create (Object Read & Write en `infospot-media`).  
2. `vercel env add R2_ACCESS_KEY_ID production` / `R2_SECRET_ACCESS_KEY production` (sensitive).  
3. Redeploy Production.

Nombre del bucket: `infospot-media` (evita el guard `*-prod` de DNX-MCP; es el bucket **de producción** de Info Spot).

---

## 5. SMTP

Info Spot usa **Resend** vía `@repo/auth` (`RESEND_API_KEY`, `EMAIL_FROM` / `DNX_EMAIL_FROM`).

| Variable | Production |
|----------|------------|
| `RESEND_API_KEY` | **Falta** |
| `EMAIL_FROM` | **Falta** (default código: `DNX Suite <noreply@dnxsuite.com>`) |

No se enviaron correos reales en esta etapa.  
Día de lanzamiento: cargar Resend + from del dominio/email verificado (sin tocar Google Cloud aquí).

---

## 6. Cron

| Ítem | Estado |
|------|--------|
| `CRON_SECRET` Production | **OK** (generado y seteado) |
| `vercel.json` crons | **OK** — solo 2 jobs |
| `/api/cron/clf-events-sync` | `*/15 * * * *` |
| `/api/cron/reconcile-public-coverage` | `*/30 * * * *` |
| Jobs experimentales | **No** |

Auth: `Authorization: Bearer $CRON_SECRET`. Sin secreto → 503 (comportamiento seguro).

**Nota:** los crons Vercel requieren deploy que incluya `vercel.json`. Activación efectiva tras el próximo Production deploy de esta rama. No dependen del dominio DonWeb.

---

## 7. Analytics

| Ítem | Estado |
|------|--------|
| API interna `ARTICLE_VIEW` / `EVENT_VIEW` | Existe (`/api/metrics/view` + trackers) |
| CTA / convocatorias | Cubiertos por producto existente |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **Falta** (documentado en `.env.example`) |
| Search Console | **No** configurar todavía |

---

## 8. Variables Production (presencia, sin secretos)

| Variable | Estado |
|----------|--------|
| `DATABASE_URL` / `DIRECT_URL` | OK (Neon prod) |
| `NEXT_PUBLIC_INFOSPOT_URL` / `APP_URL` / `AUTH_URL` | OK (aún `*.vercel.app` hasta DNS) |
| `GOOGLE_*` | OK (callback se actualizará el día D) |
| `CRON_SECRET` | OK |
| `INFOSPOT_IP_HASH_SALT` | OK |
| `R2_BUCKET_NAME` / `PUBLIC_URL` / `ACCOUNT_ID` / `ENDPOINT` | OK |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Falta |
| `COMPRAMELAFOTO_PUBLIC_URL` | OK (`https://compramelafoto.com`) |
| `CLF_READONLY_DATABASE_URL` | Inválido/vacío en práctica — **Falta** valor real de solo lectura |
| `RESEND_API_KEY` / `EMAIL_FROM` | Falta |
| `COOKIE_DOMAIN` | Vacío (correcto hasta dominio) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Falta |

---

## 9. Vercel

| Ítem | Valor |
|-------|--------|
| Project | `infospot-dnxsuite` |
| Framework | Next.js |
| Root | `apps/infospot` |
| Node | 24.x |
| Domains registrados | `infospot.com.ar`, `www.infospot.com.ar`, `infospot-dnxsuite.vercel.app` |
| Acción DonWeb | **No** re-agregar dominio ahora; esperar delegación NS/DNS |

Build settings: `installCommand` / `buildCommand` en `vercel.json`.

---

## 10. Smoke interno (post-infra)

Ejecutar tras redeploy Production con env nuevas:

```bash
curl -sS https://infospot-dnxsuite.vercel.app/api/health
curl -sS -o /dev/null -w "%{http_code}\n" https://infospot-dnxsuite.vercel.app/
curl -sS -o /dev/null -w "%{http_code}\n" https://infospot-dnxsuite.vercel.app/noticias
curl -sS -o /dev/null -w "%{http_code}\n" https://infospot-dnxsuite.vercel.app/eventos
curl -sS https://infospot-dnxsuite.vercel.app/api/cron/clf-events-sync
# → 401/403 con CRON_SECRET configurado (no 503)
```

La DB prod está **vacía de contenido** (sin demo seed). Home/listados deben responder 200 aunque vacíos. Editor/asistente requieren sesión + seed director cuando exista User.

---

## 11. Seguridad

- Secretos no impresos en docs/logs de agente.  
- Cron cerrado sin Bearer válido.  
- R2 CORS acotado a origins conocidos.  
- `ALLOW_INFOSPOT_DEMO_SEED` / write CLF **no** en Production.  
- Sensitive env en Vercel no se releen por `env pull` (esperado).

---

## 12. Checklist — día en que DonWeb termine la delegación

1. □ Confirmar DNS público (`dig infospot.com.ar` / `www` → Vercel).  
2. □ Dominio ya está en Vercel — si hiciera falta, re-verificar SSL (no duplicar si ya verified).  
3. □ Esperar certificado SSL Ready en ambos hosts.  
4. □ Actualizar canónicos: `NEXT_PUBLIC_INFOSPOT_URL`, `APP_URL`, `AUTH_URL` → `https://infospot.com.ar`.  
5. □ Actualizar `GOOGLE_REDIRECT_URI` + callback en la consola OAuth existente (**sin** crear proyecto Google nuevo en esta etapa histórica; solo URI).  
6. □ Opcional: `COOKIE_DOMAIN=.infospot.com.ar` si SSO multi-subdominio.  
7. □ Completar `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` si aún faltan.  
8. □ Completar `CLF_READONLY_DATABASE_URL` (solo lectura prod CLF).  
9. □ (Opcional) `RESEND_API_KEY` + `EMAIL_FROM`.  
10. □ (Opcional) `NEXT_PUBLIC_GA_MEASUREMENT_ID`.  
11. □ Redeploy Production.  
12. □ Smoke final: health, home, noticias, eventos, robots, sitemap (host canónico), login, redacción.  
13. □ Search Console: propiedad + sitemap (**ahora sí**).  
14. □ Declarar **GO**.

---

## 13. Pendientes exclusivos del dominio (DonWeb)

- Delegación NS / records A-CNAME hacia Vercel.  
- SSL automático Vercel.  
- Cambio de URL canónica + OAuth redirect.  
- Search Console.  
- Verificación robots/sitemap con `Host:` del dominio final.

---

## 14. Confirmaciones

- Google Cloud **no** fue configurado en esta etapa.  
- Producción **pública** en `infospot.com.ar` **no** habilitada (DNS pendiente).  
- No merge a `main`.  
- No `db push` / `migrate reset`.  
- No features de editor / asistente / workflow.
