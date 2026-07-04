# 02 — Inventario legacy ComprameLaFoto

**Fecha de auditoría:** 2026-07-04  
**Fuente de verdad:** `/Users/danielcuart/Desktop/compramelafoto`  
**Último commit legacy:** `6e6fd6d4` — *feat(admin): panel Salud de la Plataforma con métricas y acciones* (2026-07-02)  
**Comparación:** Legacy → **infraestructura del monorepo** (`packages/*`, tooling, convenciones suite)  
**Excluido de la comparación:** `apps/compramelafoto` del monorepo (copia stale, será descartada)

> Documento de **solo análisis**. No se copiaron archivos ni se modificó código legacy ni monorepo.  
> Estado pre-migración del monorepo: [`01-current-state.md`](./01-current-state.md)

---

## Resumen ejecutivo

ComprameLaFoto legacy es una **aplicación Next.js 16 monolítica** con Prisma local, **186 modelos**, **170 migraciones**, **564 API routes**, **264 páginas** y **3 workers** desplegables por separado. El monorepo suite centraliza persistencia en `@repo/db` (**162 modelos**, **20 migraciones**), sesiones en `@repo/auth` / `@repo/auth-guards`, y UI compartida en `@repo/design-system` (tema CLF ya definido).

| Dimensión | Legacy | Monorepo (infra) | Brecha |
|-----------|-------:|-----------------:|--------|
| Modelos Prisma | 186 | 162 | 82 solo legacy · 58 solo mono |
| Migraciones | 170 | 20 | Baseline + squash pendiente |
| Auth | Cookie `auth-token` (payload base64) | Cookie `dnx_session` + `UserSession` | Reescritura / bridge |
| Prisma client | `@prisma/client` local (`lib/prisma.ts`) | `@repo/db` | Cambiar import + generate |
| Workers | 3 paquetes en raíz legacy | Sin equivalente en `packages/` | Mover a `apps/` o `workers/` |
| Design system | `components/ui` + `components/design-system` locales | `@repo/design-system` (tema CLF) | Migración gradual UI |
| Cron Vercel | 15 jobs en `vercel.json` | Por definir en app destino | Replicar schedules |

---

## 1. Estructura completa del proyecto legacy

```
compramelafoto/
├── app/                    # Next.js App Router — páginas + API (891 archivos ts/tsx en árbol)
├── components/             # UI por dominio (602 archivos)
├── lib/                    # Lógica de negocio, integraciones (802 archivos)
├── hooks/                  # 1 hook compartido
├── contexts/               # 2 contextos React
├── types/                  # Declaraciones ambient (archiver, piexifjs)
├── emails/                 # Capa envío + plantillas (6 archivos)
├── prisma/                 # schema.prisma + 170 migraciones + seeds/scripts
├── public/                 # 539 archivos estáticos
├── scripts/                # 102 scripts mantenimiento/seed/QA
├── camera-ingest-worker/   # Worker Node — ingestión fotos cámara
├── camera-ftp-gateway/     # Servidor FTP + HTTP — conexión cámara
├── video-worker/           # Worker Node — ffmpeg + watermark video
├── deploy/camera-connection/  # docker-compose + .env.example
├── config/                 # Navegación y config app
├── data/                   # Contenido estático (blog phases, etc.)
├── assets/                 # Assets no públicos
├── docs/                   # Documentación interna legacy
├── styles/                 # Estilos globales
├── middleware.ts           # Blog visitor, referral cookies, rutas públicas
├── vercel.json             # Crons producción
├── package.json
├── .env.example            # Plantilla ENV (referencia)
└── [múltiples .env*]       # Local/staging/prod (no versionados)
```

**No existe** carpeta `services/` ni `workers/` en raíz; la lógica vive en `lib/` y workers son proyectos hermanos.

---

## 2. Inventario cuantitativo

| Área | Cantidad | Ubicación |
|------|----------|-----------|
| Páginas (`page.tsx`) | 264 | `app/**` (excl. `api/`) |
| API routes (`route.ts`) | 564 | `app/api/**` |
| Layouts | ~15 grupos | `app/**/layout.tsx` |
| Componentes TS/TSX | 602 | `components/**` |
| Módulos lib TS/TSX | 802 | `lib/**` |
| Hooks | 1 | `hooks/useSupportTicketDeepLink.ts` |
| Contextos | 2 | `GateVisibilityContext`, `UploadProgressContext` |
| Emails | 6 | `emails/**` |
| Scripts | 102 | `scripts/**` (+ subcarpetas `camera-connection`, `camofduty`) |
| Migraciones Prisma | 170 | `prisma/migrations/` |
| Líneas schema Prisma | 5 387 | `prisma/schema.prisma` |
| Modelos Prisma | 186 | — |
| Archivos public | 539 | `public/**` |
| Middleware | 1 | `middleware.ts` (~143 líneas) |

### Dependencias npm relevantes (`package.json` legacy)

| Categoría | Paquetes |
|-----------|----------|
| Framework | `next@16.1.1`, `react@19.2.3` |
| ORM | `prisma@6.19.1`, `@prisma/client@6.19.1` |
| Pagos | (HTTP a MP; sin SDK npm dedicado) |
| Storage | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |
| IA / visión | `@aws-sdk/client-rekognition`, `@google-cloud/vision` |
| Email | `resend@6.9.1` |
| Imagen / PDF | `sharp`, `pdf-lib`, `pdfkit`, `konva`, `react-konva` |
| 3D / simulador | `three`, `@react-three/fiber`, `@react-three/drei` |
| Editor rich text | `@tiptap/*` |
| Mapas | `leaflet`, `react-leaflet` |
| Utilidades | `zod`, `bcryptjs`, `archiver`, `jszip`, `xlsx`, `csv-parse` |

**Scripts npm destacados:** `build` / `vercel-build` ejecutan `prisma migrate deploy` + `next build`; 20+ seeds; scripts camera-connection; QA financiero/checkout; regeneración zips/watermarks.

---

## 3. Módulos de páginas (App Router)

Distribución por segmento raíz de ruta:

| Segmento | Páginas | Descripción |
|----------|--------:|-------------|
| `admin/` | 68 | Panel super-admin plataforma |
| `fotografo/` | 22 | Panel fotógrafo |
| `lab/` | 15 | Panel laboratorio |
| `dashboard/` | 15 | Dashboard álbumes / productos / diseño |
| `design-system/` | 11 | Showroom UI interno |
| `organizador/` | 10 | Panel organizador eventos |
| `cuantocobro/` | 9 | App Cuánto Cobro embebida |
| `[handler]/`, `l/` | 15 | Landings laboratorio (imprimir, polaroids, fotocarnet) |
| `cliente/` | 7 | Portal cliente post-compra |
| `imprimir*`, `album/`, `a/` | 14+ | Flujos compra álbum / precompra |
| `blog/`, `directorio/`, `land*` | 15+ | Marketing, SEO, leads |
| `camofduty/` | 3 | Simulador Cam of Duty |
| Otros | ~40 | Auth, privacidad, escuela, DNX cursos, tests, demos |

**Layouts multi-rol:** `admin`, `fotografo`, `lab`, `dashboard`, `organizador`, `cliente`, `cuantocobro`, `blog`, `dnx`, `album`, handlers públicos.

---

## 4. APIs por módulo

Distribución por prefijo (`app/api/`):

| Prefijo | Routes | Dominio |
|---------|-------:|---------|
| `admin/` | 159 | Operaciones plataforma |
| `dashboard/` | 96 | Fotógrafo — álbumes, fotos, packs, diseño |
| `fotografo/` | 37 | Perfil, escuelas, pedidos |
| `public/` | 35 | Endpoints sin auth fuerte |
| `organizer/` | 34 | Eventos colaborativos |
| `cron/` | 24 | Jobs programados |
| `lab/` | 15 | Laboratorio |
| `cuantocobro/` | 14 | Presupuestos / consultas |
| `auth/` | 13 | Login, registro, OAuth, reset |
| `school-organizer/` | 12 | Organizador escolar |
| `template-v2/` | 10 | Editor plantillas v2 |
| `internal/` | 10 | Análisis OCR, comisiones |
| `payments/`, `mercadopago/` | 11 | Checkout MP |
| `a/`, `albums/`, `precompra/` | 19+ | Compra pública álbum |
| `print-orders/`, `zip-jobs/` | 10 | Impresión y descargas ZIP |
| Resto | ~50 | Referrals, support, geocode, health, etc. |

### Rutas cron (`app/api/cron/` — 24 endpoints)

```
abandoned-orders              process-design-exports
album-interest-emails         process-design-previews
biometric-cleanup             process-email-campaigns
cleanup-disenador             process-email-queue
cleanup-expired-albums        process-exif-device-scan
cleanup-expired-prints        process-photo-exif-devices
cleanup-orphan-r2             process-zip-jobs
cleanup-preventa-mockups      reconcile-mp-paid-status
cleanup-zip-jobs              reconcile-mp-pending-orders
hidden-album-cleanup          regenerate-zips-last-48h
hourly                        resend-digital-emails-last-48h
process-camera-ingest-jobs    send-album-notifications
```

**Programados en `vercel.json` (15):** abandoned-orders, hourly, process-email-queue, process-email-campaigns, process-zip-jobs, process-camera-ingest-jobs, process-photo-exif-devices, internal/analysis/run, biometric-cleanup, cleanup-expired-albums, cleanup-preventa-mockups, cleanup-disenador, cleanup-orphan-r2, cleanup-zip-jobs, reconcile-mp-*, event-organizer-commissions/mark-available.

> Varios crons existen como API pero **no** están en `vercel.json` (p. ej. `send-album-notifications`, `regenerate-zips-last-48h`) — pueden invocarse desde `hourly` u operación manual.

---

## 5. Componentes

### Carpetas top-level (`components/`)

```
admin, album, album-purchase, blog, carnet, checkout, clients, community,
conversion, cuantocobro, cuenta, dashboard, design-system, dnx, events,
fotografo, fotolibros, gallery, home-preview, lab, land, layout,
mercadopago, order, organizer, panels, photo, photographer, polaroid,
preventa, prints, public, recomendanos, referrals, roster, sales, school,
school-organizer, simulator, template-v2, tutorials, ui
```

| Sub-sistema | Archivos aprox. | Notas |
|-------------|-----------------|-------|
| `components/ui/` | 17 | Primitivos locales (`Button`, `Input`, `AppModal`, `Ds*`) |
| `components/design-system/` | 13 | Previews showroom |
| `components/dashboard/` | mayoría | Álbumes, upload, packs, videos |
| `components/admin/` | amplio | Paneles admin |
| `components/photo/` | amplio | Vista pública álbum, compra |

### Hooks y contextos

| Archivo | Uso |
|---------|-----|
| `hooks/useSupportTicketDeepLink.ts` | Deep links soporte |
| `contexts/GateVisibilityContext.tsx` | Feature flags UI |
| `contexts/UploadProgressContext.tsx` | Progreso subida fotos |

---

## 6. Biblioteca (`lib/`) — módulos de negocio

**~120 entradas top-level** (archivos + carpetas). Carpetas principales:

| Módulo `lib/` | Responsabilidad |
|---------------|-----------------|
| `admin/` | Dashboard admin, alertas, salud plataforma |
| `album/`, `albums/`, `album-packs/`, `album-purchase/`, `album-cleanup/` | Ciclo de vida álbum, packs, limpieza |
| `analysis/`, `ocr/` | Pipeline análisis fotos, Google Vision |
| `faces/` | AWS Rekognition — búsqueda facial |
| `mercadopago/`, `payments/`, `checkout/`, `pricing/` | Pagos, fees, checkout |
| `r2-client.ts`, `images/`, `watermarking.ts` | Cloudflare R2, variantes, marca de agua |
| `camera-connection/` | FTP ingest, jobs, settings |
| `whatsapp/` | Meta Cloud API |
| `email*.ts`, `email-marketing/`, `email-queue.ts` | Resend, colas, campañas |
| `zip-*`, `digital-delivery*` | ZIP jobs, descargas digitales |
| `template-v2/` | Motor plantillas diseño |
| `cuantocobro/` | Presupuestos PDF, consultas |
| `blog/` | CMS blog |
| `organizer-*`, `events/` | Landings y eventos organizador |
| `school-*`, `roster/` | Flujo escolar |
| `referral*`, `referrals/` | Programa referidos |
| `cron/`, `cron-auth.ts`, `jobs/` | Lógica cron compartida |
| `auth.ts`, `prisma.ts` | **Auth legacy + Prisma local** |
| `design-system/` | `access.ts`, `nav.ts` (gates showroom) |
| `photographic-equipment/` | EXIF → equipos fotográficos |
| `videos/` | MVP video (worker externo) |
| `services/` | `commissionService`, `logService`, `settingsService` |

---

## 7. Procesos independientes

### 7.1 `camera-ingest-worker/`

| Aspecto | Detalle |
|---------|---------|
| Paquete | `compramelafoto-camera-ingest-worker@0.1.0` |
| Entry | `src/index.ts` — modos `start` (poll) y `process-once` |
| Deps | `@aws-sdk/client-s3`, `sharp`, `exifr`, `@prisma/client` |
| Prisma | Copia schema vía `scripts/postinstall-prisma.mjs` |
| Función | Procesa `CameraIngestJob` — variantes, R2, EXIF |

**Archivos `src/`:** `index.ts`, `config.ts`, `prisma.ts`, `claim-camera-ingest-job.ts`, `process-camera-ingest-job.ts`, `recover-stale-camera-ingest-jobs.ts`

**Disparadores:** cron `/api/cron/process-camera-ingest-jobs` (cada 5 min en Vercel) + proceso always-on en deploy Docker.

### 7.2 `camera-ftp-gateway/`

| Aspecto | Detalle |
|---------|---------|
| Paquete | `compramelafoto-camera-ftp-gateway@0.1.0` |
| Deps | `ftp-srv`, `basic-ftp`, `bcryptjs`, S3, Prisma |
| Función | Servidor FTP para cámaras; sube raw a R2; encola ingest |

**Archivos `src/`:** `index.ts`, `create-ftp-server.ts`, `http-server.ts`, `authenticate.ts`, `handle-upload.ts`, `rate-limit.ts`, `ready.ts`

**Deploy:** `Dockerfile`, `docker-compose.yml` en raíz; `deploy/camera-connection/docker-compose.yml`

### 7.3 `video-worker/`

| Aspecto | Detalle |
|---------|---------|
| Paquete | `compramelafoto-video-worker@0.1.0` |
| Deps | S3, `sharp`, `execa` (ffmpeg), Prisma |
| Función | Transcodificación, watermark, orientación video |

**Archivos `src/`:** `index.ts`, `process-video-job.ts`, `ffmpeg.ts`, `watermark.ts`, `r2.ts`, `recover-stale-jobs.ts`

### 7.4 Scripts de deploy y mantenimiento

| Ubicación | Tipo |
|-----------|------|
| `deploy/camera-connection/` | Docker compose gateway + env example |
| `scripts/*.ts` | Seeds, backfills, reconciliación MP, QA |
| `scripts/*.sh` | AWS Rekognition setup, zip jobs, process photos |
| `scripts/camera-connection/` | Status/logs gateway, enqueue raw |
| `package.json` scripts | `vercel-build`, `prisma:recover-migrations`, seeds |

**Scripts mantenimiento críticos (producción):**

- `reconcile-mp-paid.ts`, `reconcile-pending-mp-album-orders.ts`
- `regenerate-order-zips.ts`, `regenerate-order-zips-last-48h.ts`
- `resend-digital-emails-last-48h.ts`
- `regenerate-watermarks-last-7-days.ts`
- `backfill-*` (variants, support emails, buyer contact)
- `classify-photo-cleanup-backlog.ts`
- `check-exif-cron-status.ts`

---

## 8. Middleware

**Archivo:** `middleware.ts` (raíz)

| Responsabilidad |
|-----------------|
| Cookie visitante blog (`BLOG_VISITOR_*`) en artículos |
| Cookies referral (`clf_ref`, `clf_ref_meta`) — 30 días |
| Headers derivados para analytics funnel |
| **No** valida sesión global (auth en server components / API) |

**Contraste monorepo:** `@repo/auth-guards` centraliza sesión suite; legacy usa múltiples cookies de rol (`auth-token` + session clients por panel).

---

## 9. Prisma y migraciones

### Legacy

| Métrica | Valor |
|---------|-------|
| Schema | `prisma/schema.prisma` — 5 387 líneas |
| Modelos | **186** |
| Migraciones | **170** carpetas (+ `migration_lock.toml`) |
| Primera | `00000000000000_baseline` |
| Últimas | `20260701190000_photographic_gear_v2`, `20260702120000_exif_device_scan_state` |
| Client | `lib/prisma.ts` → `new PrismaClient()` local |
| Build | `prisma migrate deploy` en cada build Vercel |
| Seeds | `prisma/seed.ts` + 15+ scripts en `scripts/seed-*` |

### Monorepo — `@repo/db`

| Métrica | Valor |
|---------|-------|
| Schema | `packages/db/prisma/schema.prisma` — 4 392 líneas |
| Modelos | **162** |
| Migraciones | **20** |
| Export | `import { prisma } from "@repo/db"` |
| Prisma version | `^6.9.0` (legacy `^6.19.1` — alinear en migración) |

### Comparación de modelos

| Conjunto | Cantidad |
|----------|----------|
| Solo en **legacy** | **82** modelos CLF-dominantes |
| Solo en **monorepo** | **58** modelos (FotoRank, FotoOffice, evaluaciones, members, etc.) |
| En ambos (nombre) | ~104 (pueden diverger en campos) |

**Ejemplos solo legacy (muestra):** `AlbumPack*`, `Blog*`, `CameraIngestJob`, `CameraConnectionSettings`, `CatalogProduct*`, `CuantoCobro*`, `EventFolder`, `HiddenAlbum*`, `PhotographicEquipment*`, `ZipJob`, `PreventaPack*`, etc.

**Ejemplos solo monorepo:** `FotorankContest*`, `CourseSales*`, `Evaluation*`, `Member*`, `CardTemplate*`, `FotofficeWorkspaceBranding`, etc.

> La migración Prisma no es copy-paste: requiere **merge de schemas** o baseline legacy → migraciones incrementales en `packages/db`.

---

## 10. Variables de entorno

### Fuente documentada

- `.env.example` (plantilla versionada — 180+ líneas comentadas)
- Archivos locales presentes en disco (no auditados en detalle): `.env`, `.env.local`, `.env.production.local`, `.env.staging`, `.env.r2.local`, etc.

### Variables usadas en código app (125 únicas, excl. `node_modules` / workers)

Agrupadas por dominio:

#### Base de datos y app

`DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `NODE_ENV`, `VERCEL`, `VERCEL_URL`

#### Auth

`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

#### Mercado Pago

`MP_ACCESS_TOKEN`, `MP_ENV`, `MP_STATEMENT_DESCRIPTOR` (+ OAuth vía rutas; `MP_CLIENT_*` en `.env.example`)

#### Cloudflare R2 / storage

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_PUBLIC_BASE_URL`, `NEXT_PUBLIC_R2_PUBLIC_URL`, `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`

#### AWS Rekognition

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `REKOGNITION_COLLECTION_ID`

#### Google Vision / OAuth

`GOOGLE_APPLICATION_CREDENTIALS_JSON`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_API_KEY`

#### Email (Resend)

`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `SEND_EMAIL`, `SEND_EMAIL_QA`, `ALLOW_EMAIL_QA`, `KEEP_EMAIL_QA_DATA`, `EMAIL_CAMPAIGN_RATE_LIMIT`, `NEXT_PUBLIC_EMAIL_FROM`, `NEXT_PUBLIC_EMAIL_FROM_NAME`

#### WhatsApp (Meta)

`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`, `NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_*`

#### Cron y jobs

`CRON_SECRET`, `ZIP_JOB_PROCESS_SECRET`, `ZIP_JOB_PROCESS_TIMEOUT_MS`, `CAMERA_INGEST_*`, `CAMERA_CONNECTION_FTP_*`, `GATEWAY_BASE_URL`

#### Fotos / watermark / upload

`MAX_FILE_SIZE`, `NEXT_PUBLIC_MAX_UPLOAD_MB`, `PHOTO_VARIANT_*`, `PHOTO_WATERMARK_*`, `PROTECTED_PREVIEW_WATERMARK*`, `WATERMARK_BOUGHT_ENABLED`, `SHARP_TMPDIR`, `PRINT_ICC_PROFILE_*`

#### Feature flags (muestra)

`PREVENTA_PACKS_V1`, `PREVENTA_UX_V2`, `GLOBAL_PRODUCTS_*`, `ENABLE_VIDEO_MVP`, `ALBUM_PACK_PUBLIC_PAY_ENABLED`, `DESIGN_SYSTEM_ENABLED`, `ASYNC_ALBUM_PHOTO_INGEST`, `EXIF_DEVICE_SCAN_*`, `ALBUM_CLEANUP_*`, `CHECKOUT_FEE_SHADOW_MODE`

#### Seguridad / privacidad

`BIOMETRIC_DELETION_SECRET`, `HIDDEN_ALBUM_GRANT_SECRET`, `HIDDEN_ALBUM_IP_SALT`, `PRIVACY_CONTACT_EMAIL`

#### Cuánto Cobro / misc

`CC_QUOTE_PUBLIC_TOKEN_TTL_DAYS`, `PACK_ACCESS_TOKEN_TTL_DAYS`, `DIGITAL_DOWNLOAD_CENTER_ROLLOUT_HOURS`, `CHARLAS_FPR_TALK_SLUG`

---

## 11. Integraciones externas detectadas

| Integración | Ubicación principal legacy | Variables / deps |
|-------------|---------------------------|------------------|
| **MercadoPago** | `lib/mercadopago*`, `app/api/payments/mp/*`, `app/api/mercadopago/*` | `MP_*`, webhooks, OAuth connect |
| **Cloudflare R2** | `lib/r2-client.ts`, `lib/r2-public-url.ts`, workers S3 SDK | `R2_*` |
| **AWS Rekognition** | `lib/faces/rekognition.ts`, búsqueda facial APIs | `AWS_*`, `REKOGNITION_COLLECTION_ID` |
| **Google Vision (OCR)** | `lib/analysis/*`, `internal/analysis/*` | `GOOGLE_APPLICATION_CREDENTIALS_JSON` |
| **Google OAuth** | `app/api/auth/google/*` | `GOOGLE_CLIENT_*` |
| **Resend** | `lib/email.ts`, `lib/email-sender.ts`, `emails/*` | `RESEND_API_KEY`, `EMAIL_*` |
| **WhatsApp** | `lib/whatsapp/*`, `app/api/test/whatsapp` | `WHATSAPP_*` |
| **FTP / cámara** | `camera-ftp-gateway/`, `lib/camera-connection/` | `CAMERA_CONNECTION_FTP_*` |
| **Workers background** | 3 paquetes + crons | Ver §7 |
| **Cron (Vercel)** | `vercel.json` + `app/api/cron/*` | `CRON_SECRET` |
| **YouTube** | TipTap extension / embeds | `YOUTUBE_API_KEY` |

---

## 12. Mapeo legacy → paquetes monorepo (infraestructura)

### `@repo/db`

| Qué integrar | Acción |
|--------------|--------|
| `lib/prisma.ts` | Reemplazar por `import { prisma } from "@repo/db"` |
| `prisma/schema.prisma` + 170 migraciones | Merge en `packages/db`; baseline o squash documentado |
| Workers (`postinstall-prisma.mjs`) | Apuntar a schema generado desde `@repo/db` |
| `health/db-schema` API | Validar contra migraciones unificadas |
| Modelos FotoOffice/FotoRank ya en mono | No duplicar; CLF usa subset + extensiones |

**Riesgo alto:** 82 modelos sin equivalente en mono; 58 modelos mono sin uso en CLF pero comparten DB en suite.

### `@repo/auth`

| Legacy hoy | Suite |
|------------|-------|
| Cookie `auth-token`, token base64 `{userId, role}` | Cookie `dnx_session`, hash SHA-256 en `UserSession` |
| `lib/auth.ts` — `setAuthCookie`, `getAuthUser`, roles `Role` enum | `createUserSession`, `getSessionUserByRawToken`, `getSessionIdentityByRawToken` |
| Registro multi-rol (fotógrafo, lab, organizador) | Identity + `WorkspaceMembership` / `WorkspaceAppAccess` |

**Integración:** reescribir `app/api/auth/*` y helpers de sesión; plan de **convivencia** o migración forzada de sesiones en deploy.

### `@repo/auth-guards`

| Uso propuesto en CLF | API guards |
|----------------------|------------|
| Dashboard fotógrafo | `requireUser()`, rol app |
| Admin plataforma | `isSuperAdmin()` |
| Multi-workspace futuro | `compramelafoto_workspace_id` cookie (ya previsto en guards) |
| Paneles lab/organizador/cliente | **No cubiertos** — guards orientados a workspace suite; posible extensión o guards CLF locales |

**Integración parcial:** admin/super-admin y rutas que adopten modelo workspace; paneles legacy multi-cookie requieren capa adaptadora.

### `@repo/design-system`

| Legacy hoy | Monorepo |
|------------|----------|
| `components/ui/*` (17 primitivos) | `@repo/design-system/components/ui` |
| `components/design-system/*` showroom | Tokens + patterns en paquete |
| `lib/design-system/access.ts` | Feature flag `DESIGN_SYSTEM_ENABLED` |
| Estilos Tailwind + tema ocre local | `themes/compramelafoto.ts` — **ya existe** |
| `PublicMarketingHeader` (reglas design) | `components/layout/PublicMarketingHeader` |
| Spacing dashboard CLF | `compositionSpacing.comprameLaFoto*` |

**Integración:** migración incremental; priorizar shell público y dashboard; mantener Konva/carnet/polaroid locales al inicio.

### `@repo/ui`

| Estado |
|--------|
| Paquete mínimo (turbo starter, exports `src/*.tsx`) |
| **No** usado por legacy |
| Baja prioridad; preferir `@repo/design-system` para CLF |

---

## 13. Servicios y capas transversales

| Servicio | Implementación legacy |
|----------|----------------------|
| Autenticación | `lib/auth.ts` + APIs `auth/*` |
| Autorización admin | `Role` enum + checks en routes |
| Sesión fotógrafo | `lib/photographer-session-client.ts` |
| Sesión lab | `lib/lab-session-client.ts` |
| Sesión organizador | `lib/organizer-session-client.ts` |
| Sesión school-organizer | `lib/school-organizer-session-client.ts` |
| Email transaccional | `lib/email.ts` → Resend |
| Cola email | `lib/email-queue.ts` + cron |
| Pagos | `lib/mercadopago.ts` + webhooks |
| Storage | `lib/r2-client.ts` |
| Imagen | `lib/image-processing.ts`, `lib/watermarking.ts` |
| ZIP async | `lib/zip-job-queue.ts` |
| Análisis IA | `lib/analysis/analysis-runner.ts` |
| Métricas | `lib/platform-metrics.ts`, `lib/observability/` |
| Settings | `lib/services/settingsService.ts` |
| Comisiones | `lib/services/commissionService.ts` |
| Logs admin | `lib/services/logService.ts` |

---

## 14. `public/` — assets estáticos

| Carpeta / archivo | Contenido |
|-------------------|-----------|
| `images/`, `photos/`, `uploads/` | Media estática y uploads dev |
| `camofduty/` | GLBs simulador |
| `catalog-templates/` | Mockups sistema |
| `cuantocobro/`, `dnx/`, `home-preview/` | Landings |
| `leaflet/` | Assets mapas |
| `sounds/`, `texturas/` | UI / simulador |
| `LOGO CLF.png`, `watermark.png`, `faceid.png` | Marca |
| Icons SVG (`next.svg`, `file.svg`, …) | Placeholders Next |

**539 archivos** — evaluar qué migra vs CDN/R2 en import.

---

## 15. Riesgos de migración

| ID | Riesgo | Impacto | Mitigación |
|----|--------|---------|------------|
| L1 | **Schema dual** — 170 migraciones legacy vs 20 mono | Crítico | Baseline CLF en `packages/db`; ambiente DB dedicado para prueba |
| L2 | **Auth incompatible** — cookie y modelo sesión distintos | Alto | Bridge temporal o logout global en cutover |
| L3 | **Workers con Prisma copiado** | Alto | Publicar schema único; CI generate compartido |
| L4 | **Crons Vercel** — 15+ schedules activos | Alto | Inventario 1:1 antes de cutover; `CRON_SECRET` |
| L5 | **Integraciones MP/R2 en producción** | Crítico | Webhooks URL nueva; dual-run en staging |
| L6 | **Datos biométricos (Rekognition)** | Legal/ops | Políticas retención; no copiar colección AWS sin plan |
| L7 | **ENV proliferation** — 125+ vars | Medio | `.env.example` unificado en app monorepo |
| L8 | **Cuánto Cobro / Cam of Duty embebidos** | Medio | Decidir apps separadas vs rutas en CLF |
| L9 | **FTP gateway deploy independiente** | Medio | Mantener Docker fuera de Vercel serverless |
| L10 | **Versión Prisma** — 6.19 vs 6.9 | Medio | Alinear antes de merge schema |
| L11 | **Monorepo models extra** — migraciones FotoOffice en misma DB | Alto | Namespacing lógico; no aplicar migraciones no-CLF a DB prod CLF hasta validar |

---

## 16. Recomendaciones

### Fase 1 — Preparación (sin copiar código aún)

1. **Tag legacy:** anotar `6e6fd6d4` como `clf/legacy-pre-monorepo-import`.
2. **Export inventario Prisma:** diff completo 186 vs 162 modelos (script en `tools/architecture-mcp` o `prisma migrate diff`).
3. **Matriz ENV:** cruzar 125 vars con secretos Vercel producción.
4. **Mapa crons:** confirmar qué rutas llama `hourly` internamente.

### Fase 2 — Infraestructura monorepo

1. **`packages/db`:** incorporar modelos CLF faltantes (82) vía migración baseline `clf_legacy_baseline` + forward migrations.
2. **`@repo/auth`:** extender si hace falta soporte roles CLF (`PHOTOGRAPHER`, `LAB`, `ORGANIZER`) en identity context.
3. **`@repo/auth-guards`:** añadir guards por panel o middleware CLF que delegue en auth suite.
4. **Workers:** ubicar en `apps/compramelafoto-workers/` o `workers/clf-*` del monorepo con dependencia `@repo/db`.
5. **`@repo/design-system`:** usar tema existente; plan de reemplazo `components/ui` → DS.

### Fase 3 — Import aplicación

1. Import limpio a `apps/compramelafoto` (post-archivo copia stale).
2. Primer PR: `lib/prisma.ts` → `@repo/db` sin cambios funcionales.
3. Segundo PR: auth bridge o cutover.
4. Tercero: shell UI + `PublicMarketingHeader`.

### Fase 4 — Cutover producción

1. Staging con DB branch Neon + R2 bucket staging.
2. Replay webhooks MP en staging.
3. Deploy workers + FTP gateway antes de app (dependencia ingest).
4. Ventana de mantenimiento para swap `DATABASE_URL` y cookies.

### Qué **no** hacer

- No comparar ni portar desde `apps/compramelafoto` stale del monorepo.
- No mezclar migraciones FotoOffice/FotoRank en DB producción CLF sin QA.
- No commitear `.env.local` / uploads de `public/uploads`.

---

## 17. Referencias cruzadas

| Documento | Contenido |
|-----------|-----------|
| [`01-current-state.md`](./01-current-state.md) | WIP monorepo pre-import |
| [`../migration-plan.md`](../migration-plan.md) | Plan operativo commits |
| [`../domains/albums/README.md`](../domains/albums/README.md) | Dominio álbumes (mono) |
| [`../registry/products.json`](../registry/products.json) | Producto compramelafoto en registry |
| Legacy `FUNCIONALIDADES_COMPLETAS.md` | Catálogo funcional detallado (fuente legacy) |
| Legacy `ESQUEMA_PRISMA_RESUMEN.md` | Resumen schema legacy |

---

## Anexo A — API `admin/` (159 routes)

Presente en producción; incluye: AI/OCR, álbumes, auditoría, blog, campañas email, finanzas, fraud, laboratorios, pedidos, privacidad, R2, referidos, escuelas, salud plataforma, soporte, template-v2 review, usuarios, etc. Listado completo disponible en:

```bash
find /Users/danielcuart/Desktop/compramelafoto/app/api/admin -name route.ts | sort
```

## Anexo B — API `dashboard/` (96 routes)

Álbumes (fotos, folders, packs, preventa, precompra, videos, school-ops), design-projects, catalog-products, camera-connection, sales-settings, removal-requests, templates. Listado:

```bash
find /Users/danielcuart/Desktop/compramelafoto/app/api/dashboard -name route.ts | sort
```

## Anexo C — Modelos solo en legacy (82)

Generar listado completo:

```bash
comm -23 \
  <(grep '^model ' /Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma | awk '{print $2}' | sort) \
  <(grep '^model ' /Volumes/HD\ DNX\ 10/PROGRAMACIONES/dnx-suite/packages/db/prisma/schema.prisma | awk '{print $2}' | sort)
```

---

*Generado como paso 02 de `docs/architecture/migration/`. Solo análisis — sin modificaciones en legacy ni monorepo.*
