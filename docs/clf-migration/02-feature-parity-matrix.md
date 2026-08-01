# 02 — Matriz maestra de paridad funcional

**Fecha:** 2026-07-29  
**Leyenda Paridad:** `YES` | `PARTIAL` | `NO` | `N/A`  
**Clasificación feature:** `IMPLEMENTADO` | `IMPLEMENTADO_PARCIAL` | `NO_IMPLEMENTADO` | `IMPLEMENTADO_DIFERENTE` | `LEGACY_OBSOLETO` | `FUNCIONALIDAD_NUEVA_MONOREPO` | `POST_MIGRATION`

---

## Matriz maestra (obligatoria)

| Dominio | Legacy | Monorepo | Paridad | Prioridad | Bloquea Cutover | Acción |
| ------- | ------ | -------- | ------- | --------- | --------------- | ------ |
| Auth | Cookie `auth-token` + Google | SoT único `dnx_session` (@repo/auth); UI unificada `/login` | YES | P0-06→CLOSED | NO (código); redirects env → P0-07 | Ver `11-stage-03-auth-closure-report.md`; cutover RELOGIN_REQUIRED |
| Usuarios | Roles CLF + perfiles | Mismos modelos + identity bridge | PARTIAL | P0 | SÍ | Validar creación/asociación roles LAB/ORG/SCHOOL |
| Roles | ADMIN…SCHOOL_ORGANIZER | Enum unificado + roles suite | YES | P1 | NO | Mantener `SCHOOL_ORGANIZER` |
| Organizadores | Panel + eventos + comisiones | Panel migrado | YES | P1 | NO | Smoke comisiones + collector 100% |
| Fotógrafos | `/fotografo` + `/dashboard` | Migrado | YES | P1 | NO | Smoke upload + álbumes |
| Laboratorios (panel) | `/lab/*` completo (15 páginas) | `app/lab/**` + 15/15 APIs; post-login `/lab/dashboard` | YES | P0→CLOSED | NO | Cerrado ETAPA 02 — ver `10-stage-02-lab-migration-report.md` |
| Eventos | CRUD + share + visibility | Migrado | YES | P1 | NO | Smoke crear/publicar |
| Álbumes | CRUD + packs + preventa | Migrado | YES | P1 | NO | Smoke políticas venta |
| Fotos | Upload/variantes/watermark | Migrado | YES | P1 | NO | Smoke variantes R2 |
| Upload | Dashboard multi-upload | Migrado | YES | P1 | NO | — |
| Procesamiento | Sharp + EXIF + IA | Migrado + crons | YES | P1 | NO | Workers + crons staging |
| Storage | R2 | R2 | YES | P0 | SÍ (config) | Mismos buckets/env en staging/prod |
| Carrito | Galería `/a` `/album` | Migrado | YES | P0 | SÍ | E2E compra |
| Checkout | Preferencias MP | Idéntico + dual-read off | YES | P0 | SÍ | Sandbox + webhook |
| Mercado Pago | Checkout Pro + fee | Idéntico | YES | P0 | SÍ | Mantener paridad Legacy; no 1:N |
| Webhooks | `/api/payments/mp/webhook` | Idéntico | YES | P0 | SÍ | Idempotencia WebhookEvent |
| Órdenes | Album/Print/Precompra | Migrado | YES | P0 | SÍ | Estados + reverse |
| Descargas | Token + ZIP jobs | Migrado | YES | P0 | SÍ | Cron zip + email |
| Emails | Resend + queue | Migrado | YES | P0 | SÍ | Cron email queue |
| Panel Fotógrafo | Completo | Completo | YES | P1 | NO | — |
| Panel Organizador | Completo | Completo | YES | P1 | NO | — |
| Panel Cliente | Completo | Completo | YES | P1 | NO | — |
| Panel Admin | Completo | Completo (~68 pág) | YES | P1 | NO | Sync fix tope 500 fotógrafos |
| Panel Lab | Completo | Completo (ETAPA 02) | YES | — | NO | CLOSED |
| Crons | 17 Vercel + extras | 17 Vercel + mismos extras | YES | P0 | SÍ | Config `CRON_SECRET` |
| Workers | 3 | 3 (Docker rewrite pendiente) | PARTIAL | P0 | SÍ (si FTP/video prod) | Deploy monorepo workers |
| SEO | sitemap/robots | Presentes | YES | P2 | NO | — |
| Google OAuth | Sí | Sí | YES | P1 | NO | Redirect URIs monorepo |
| Base de datos | 186 models prod | 365 models schema | PARTIAL | P0 | **SÍ** | Plan SQL cutover (rename Student) |
| Env vars | 54 en `.env.example` | 54 idénticas + FI opcionales | PARTIAL | P0 | SÍ | Inventario 05 |
| Infraestructura | Vercel + Neon + R2 + workers | Igual + monorepo build | PARTIAL | P0 | SÍ | Pipeline Vercel monorepo |
| Template v2 (fotógrafo API) | `/api/template-v2/*` | Solo admin; faltan 10 APIs | NO | P1 | Condicional* | Portar APIs |
| Consent/terms APIs | `/api/terms/accept`, marketing-opt-in, revoke-face | Ausentes | NO | P1 | Condicional* | Portar |
| DNX Payments 1:N | No | Package listo (Clickatón) | N/A | P3 | **NO** | POST_MIGRATION |
| Social automation | No en CLF | No en CLF | N/A | P3 | **NO** | POST_MIGRATION |

\*Bloquea si el flujo se usa en producción Legacy con tráfico real.

---

## Inventario funcional detallado

### AUTH

| Feature | Legacy | Monorepo | Clasificación |
|---------|--------|----------|---------------|
| Login email/password | Sí | Sí (+ `@repo/auth-ui`) | IMPLEMENTADO_DIFERENTE |
| Logout | Sí | Sí | IMPLEMENTADO |
| Google OAuth | Sí | Sí | IMPLEMENTADO |
| Recuperación sesión | `auth-token` 7d | Dual cookie | IMPLEMENTADO_DIFERENTE |
| Protección rutas | Guards por panel | Guards locales + auth-guards | IMPLEMENTADO_PARCIAL |
| Registro roles | photographer/lab/organizer/customer | APIs presentes; UI lab login rota | IMPLEMENTADO_PARCIAL |
| Roles/permisos | Enum Role | Unificado | IMPLEMENTADO |

### USUARIOS / PANELES

| Rol | Legacy | Monorepo | Clasificación |
|-----|--------|----------|---------------|
| Fotógrafo | Completo | Completo | IMPLEMENTADO |
| Cliente | Completo | Completo | IMPLEMENTADO |
| Organizador | Completo | Completo | IMPLEMENTADO |
| Administrador | Completo | Completo | IMPLEMENTADO |
| Lab | Completo | **Sin páginas** | NO_IMPLEMENTADO |
| School organizer | Completo | Completo | IMPLEMENTADO |
| Cuánto Cobro | Completo | Completo (+ `@repo/cuanto-cobro-core`) | IMPLEMENTADO |

### EVENTOS / ÁLBUMES / FOTOS

| Feature | Clasificación Mono |
|---------|-------------------|
| CRUD eventos, publicación, share | IMPLEMENTADO |
| Álbumes, categorías, vencimiento, comercial | IMPLEMENTADO |
| Upload múltiple, thumbnails, preview, watermark, EXIF | IMPLEMENTADO |
| Eliminación / permisos / R2 cleanup | IMPLEMENTADO |

### VENTA / DESCARGAS

| Feature | Clasificación Mono |
|---------|-------------------|
| Productos, packs, preventa, precompra | IMPLEMENTADO |
| Carrito / checkout / fee plataforma | IMPLEMENTADO |
| Órdenes estados + abandonados cron | IMPLEMENTADO |
| Descargas token, ZIP, originales | IMPLEMENTADO |
| Upsells API `/api/upsells/applicable` | NO_IMPLEMENTADO (ruta faltante) |

### MERCADO PAGO

Ver `06-payment-current-state.md`. Paridad Legacy de cobro: **IMPLEMENTADO** (código idéntico). DNX 1:N: **POST_MIGRATION**.

### EMAILS / CRONS / WORKERS / STORAGE / SEO / INTEGRACIONES

| Dominio | Clasificación |
|---------|---------------|
| Resend + cola + campañas | IMPLEMENTADO |
| 17 crons Vercel | IMPLEMENTADO |
| 9 crons solo código | IMPLEMENTADO_PARCIAL (ops) |
| Workers runtime | IMPLEMENTADO |
| Workers Docker | IMPLEMENTADO_PARCIAL |
| R2 + Rekognition + Vision | IMPLEMENTADO |
| sitemap/robots/OG | IMPLEMENTADO |
| WhatsApp test APIs | NO_IMPLEMENTADO (rutas test ausentes; no crítico) |
| Google OAuth + MP OAuth | IMPLEMENTADO |

---

## POST_MIGRATION (no bloquean cutover)

| Feature | ¿En Legacy prod? | Clasificación |
|---------|------------------|---------------|
| DNX Payments Orders 1:N | No (usa marketplace_fee) | POST_MIGRATION |
| Social automation / `@repo/social-publisher` en CLF | No | POST_MIGRATION |
| Mejoras visuales / design-system showroom | Demo pages omitidas a propósito | POST_MIGRATION / LEGACY_OBSOLETO |
| IA nuevas no presentes en Legacy | — | POST_MIGRATION |
| Camera FTP / video venta / face search | **Sí en Legacy** | **NO son POST_MIGRATION** — son paridad |

---

## Conteos de hallazgos (regresiones)

| Prioridad | Cantidad | Notas |
|-----------|---------:|-------|
| P0 | **6 abiertos** (P0-01 + P0-06 CLOSED) | Ver `07-cutover-blockers.md` |
| P1 | **9** | Lab-adjacent APIs, template-v2, tests, auth polish, terms sync |
| P2 | **6** | Demos omitidos, lint warnings, codemod Prisma |
| P3 | **4** | DNX 1:N, social, showroom DS, cleanup scripts |
