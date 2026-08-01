# 05 — Environment variables e infraestructura

**Fecha:** 2026-07-29  
**Regla:** solo nombres y clasificación — **sin secretos**.

---

## 1. LEGACY_ENV / MONOREPO_ENV (`.env.example` app)

Comparación de keys en:

- Legacy: `/Users/danielcuart/Desktop/compramelafoto/.env.example`
- Mono: `apps/compramelafoto/.env.example`

**Resultado:** **54 / 54 idénticas** — ninguna solo-Legacy ni solo-Mono en el example de app.

| Variable | Clasificación | Notas |
|----------|---------------|-------|
| `DATABASE_URL` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | Pooler Neon |
| `DIRECT_URL` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | Migraciones |
| `AUTH_SECRET` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | Sesiones |
| `APP_URL` / `APP_BASE_URL` | MIGRADA / PRODUCTION_CRITICAL | Webhooks/callbacks |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_BASE_URL` / `NEXTAUTH_URL` | MIGRADA | Público |
| `MP_ACCESS_TOKEN` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | App + cursos |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` / `MP_REDIRECT_URI` | MIGRADA / SECRETO | OAuth MP |
| `MP_ENV` | MIGRADA | test/prod flag |
| `RESEND_API_KEY` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` | MIGRADA | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | MIGRADA / SECRETO | OAuth Google |
| `CRON_SECRET` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` / `R2_BUCKET` / `R2_BUCKET_NAME` / `R2_PUBLIC_*` | MIGRADA / PRODUCTION_CRITICAL / SECRETO | Storage |
| `NEXT_PUBLIC_R2_PUBLIC_*` | MIGRADA | CDN URLs |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `REKOGNITION_COLLECTION_ID` | MIGRADA / SECRETO | Faces |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | MIGRADA / SECRETO | Vision |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | MIGRADA / SECRETO | Seed |
| `WATERMARK_*` / `PHOTO_VARIANT_*` / `MAX_FILE_SIZE` / `NEXT_PUBLIC_MAX_UPLOAD_MB` | MIGRADA | Media |
| `PRINT_ICC_PROFILE_*` | MIGRADA | Print |
| `DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS` | MIGRADA | Feature flag |
| `PREVENTA_PACKS_V1` | MIGRADA | Feature flag |
| `WHATSAPP_*` | MIGRADA / SECRETO | Opcional |

Feature flags documentados en comments (ambos): `ENABLE_VIDEO_MVP`, `GLOBAL_PRODUCTS_*`, `ALBUM_PACK_PUBLIC_PAY_ENABLED`, etc. — mismas familias.

---

## 2. Variables NUEVAS / suite (Monorepo, no en `.env.example` CLF app)

Usadas por `@repo/payments` / identity — **no activar en prod CLF para cutover de paridad**:

| Variable | Clasificación | Uso |
|----------|---------------|-----|
| `DNX_FINANCIAL_IDENTITY_READ_MODE` | NUEVA / PRODUCTION_CRITICAL (si se cambia) | Default seguro: `LEGACY_ONLY` |
| `DNX_FINANCIAL_IDENTITY_WRITE_ENABLED` | NUEVA | Off en cutover |
| `DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED` | NUEVA | Ops controlado |
| `DNX_FINANCIAL_IDENTITY_ENV` | NUEVA | Referenciada en dual-read CLF |
| `ORDERS_1N_STAGING_*` / `ORDERS_1N_*` | NUEVA / POST_MIGRATION | Clickatón / 1:N |
| `CLF_READONLY_DATABASE_URL` | NUEVA (packages/db example) | InfoSpot read |
| Session DNX cookies | NUEVA (vía `@repo/auth`) | Requiere `AUTH_SECRET` alineado |

---

## 3. Infraestructura

| Servicio | Legacy | Monorepo | Compartido / exclusivo |
|----------|--------|----------|------------------------|
| PostgreSQL / Neon | Prod CLF branch | Debe apuntar a misma data post-SQL plan | **Compartido en cutover** (una DB) |
| Vercel project | App standalone npm | Build monorepo `pnpm --filter compramelafoto` | **Nuevo proyecto o reconfig** |
| R2 buckets | Prod photos | Mismos buckets cutover | **Compartido** |
| Mercado Pago app | OAuth redirect Legacy domain | Actualizar redirect a dominio Mono | **Misma app MP; redirects** |
| Google OAuth | Redirect Legacy | Redirect Mono | **Misma app Google; redirects** |
| Resend | Dominio email | Igual | **Compartido** |
| Cron Vercel | 17 jobs | 17 jobs (mismo `vercel.json`) | Requiere proyecto Vercel Mono |
| Workers VM/Docker | 3 workers Legacy layout | 3 en `apps/compramelafoto-workers` — Dockerfiles Legacy **no válidos** | **Redeploy exclusivo Mono** |
| Dominio DNS | compramelafoto.com → Legacy | Cutover → Mono | **Humano** |
| Rekognition collection | Prod | Misma collection | **Compartido** |
| AWS / GCP creds | Vision/Rekognition | Igual | **Compartido** |

---

## 4. Build / runtime differences

| | Legacy | Monorepo |
|--|--------|----------|
| Install | `npm ci` | `pnpm install` raíz |
| Build | `prisma migrate deploy && next build` en app | `next build` app; Prisma en `@repo/db` — **migrate NO en vercel-build app** (verificar pipeline) |
| Puerto dev | default 3000 | **3002** |
| Postinstall Prisma | En app | En `packages/db` |

**Riesgo P0 ops:** asegurar que el deploy Mono **no** ejecute migraciones destructivas automáticamente contra prod sin el plan de `03-database-parity.md`.

---

## 5. Checklist infra cutover (no ejecutar ahora)

- [ ] Vercel proyecto Mono con env PRODUCTION_CRITICAL  
- [ ] `APP_URL` / public URLs = dominio final  
- [ ] MP + Google redirect URIs actualizados  
- [ ] `CRON_SECRET` + verificar 3 crons  
- [ ] Workers redeployed con pnpm filters  
- [ ] R2 CORS incluye dominio Mono  
- [ ] DNS TTL bajo + plan rollback a Legacy  
- [ ] FI flags en `LEGACY_ONLY` / write off  
